// ============================================================
// index.js — runs both locally (`node index.js`) and on Vercel.
//
// Vercel's Node runtime imports this module and uses the exported
// Express app. It does NOT run a persistent listener, so app.listen()
// is called only when this file is executed directly.
// ============================================================

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const uploadImage = require('./src/utils/uploadImage');

const app = express();

// ------------------------------------------------------------------
// Local-only DNS override.
//
// Forcing public resolvers works around broken local DNS when
// resolving Atlas SRV records. On Vercel the resolver already works,
// and overriding it can break lookups — so this is dev-only.
// ------------------------------------------------------------------
if (process.env.NODE_ENV !== 'production') {
  try {
    require('node:dns').setServers(['1.1.1.1', '8.8.8.8']);
  } catch (_) {
    /* non-fatal */
  }
}

// ------------------------------------------------------------------
// Cached Mongoose connection.
//
// Vercel reuses the Node process across invocations. Calling
// mongoose.connect() at module load (as the old `main()` did) opened a
// fresh connection on every cold start with nothing reusing or closing
// them, which eventually exhausts the Atlas connection limit. Storing
// the cache on `global` lets it survive module re-evaluation.
// ------------------------------------------------------------------
const MONGODB_URI = process.env.MONGODB_URL || process.env.MONGODB_URI;

let cached = global.__mongooseCache;
if (!cached) {
  cached = global.__mongooseCache = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) return cached.conn;

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URL is not set in the environment');
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      // Fail fast instead of queueing queries behind a dead socket.
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

// ------------------------------------------------------------------
// CORS
// ------------------------------------------------------------------
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    // Required so caches don't serve one origin's response to another.
    res.header('Vary', 'Origin');
  }

  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  // 'Cookie' removed: it is a forbidden header name, browsers never
  // send it in an Access-Control-Request-Headers preflight.
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.header('Access-Control-Expose-Headers', 'Set-Cookie');

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ------------------------------------------------------------------
// Body parsing
//
// express.json/urlencoded ARE body-parser. Mounting both meant every
// request body was parsed twice. body-parser can be removed from
// package.json.
// ------------------------------------------------------------------
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(cookieParser());

// Ensure a live DB connection before any route touches a model.
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('DB connection failed:', err.message);
    res.status(503).json({ message: 'Database unavailable' });
  }
});

// ------------------------------------------------------------------
// Health / build verification
//
// Reports the schema paths compiled into the RUNNING process. If
// `categories` and `images` are absent here, the deployment is serving
// an old build no matter what your local file says.
// ------------------------------------------------------------------
app.get('/health', (req, res) => {
  const Products = require('./src/products/products.model');
  res.json({
    status: 'ok',
    commit: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
    dbState: mongoose.connection.readyState, // 1 === connected
    dbName: mongoose.connection.name || null,
    productSchemaPaths: Object.keys(Products.schema.paths).sort(),
  });
});

// ------------------------------------------------------------------
// Routes
// ------------------------------------------------------------------
app.use('/api/auth', require('./src/users/user.route'));
app.use('/api/products', require('./src/products/products.route'));
app.use('/api/orders', require('./src/orders/orders.route'));
app.use('/api/reviews', require('./src/reviews/reviews.router'));
app.use('/api/stats', require('./src/stats/stats.route'));

// ------------------------------------------------------------------
// Server-side image upload.
//
// NOTE: this endpoint is unauthenticated and accepts a 25 MB body,
// which makes it an open upload proxy against your Cloudinary quota.
// See VERCEL-DEPLOYMENT.md for how to gate it behind your admin auth
// middleware. The error is no longer echoed to the caller, since the
// Cloudinary SDK includes request detail in its error objects.
// ------------------------------------------------------------------
app.post('/uploadImage', async (req, res) => {
  try {
    if (!req.body?.image) {
      return res.status(400).json({ message: 'No image provided' });
    }
    const url = await uploadImage(req.body.image);
    res.json({ url });
  } catch (err) {
    console.error('Image upload failed:', err);
    res.status(500).json({ message: 'Image upload failed' });
  }
});

app.get('/', (req, res) => {
  res.send('Scarfaura Backend is Running..!');
});

// ------------------------------------------------------------------
// 404 + error handling
// ------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// ------------------------------------------------------------------
// Local listener only. On Vercel the exported app is used instead.
// ------------------------------------------------------------------
if (require.main === module) {
  const port = process.env.PORT || 5000;
  connectDB()
    .then(() => {
      app.listen(port, () => console.log(`Server running on port ${port}`));
    })
    .catch((err) => {
      console.error('Startup failed:', err.message);
      process.exit(1);
    });
}

module.exports = app;