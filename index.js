// File: index.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const uploadImage = require('./src/utils/uploadImage');

const app = express();
const port = process.env.PORT || 5000;

// ============================================
// CORS Configuration - HANDLE OPTIONS FIRST
// ============================================
const allowedOrigins = [
  'https://www.scarfaura.com',
  'https://scarfaura.com',
  'https://scarfaura-frontend.vercel.app',
  // 'http://localhost:5173',
  'http://localhost:3000'
];

// CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Set CORS headers for all requests
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, X-Requested-With, Accept');
  res.header('Access-Control-Expose-Headers', 'Set-Cookie');
  
  // Handle preflight OPTIONS requests immediately
  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS request handled:', req.url);
    return res.sendStatus(200); // ← Return 200 OK for OPTIONS
  }
  
  next();
});

// ============================================
// Regular Middleware (after CORS)
// ============================================
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.url} from ${req.headers.origin || 'unknown'}`);
  next();
});

// ============================================
// Routes
// ============================================
const authRoutes = require('./src/users/user.route');
const productRoutes = require('./src/products/products.route');
const orderRoutes = require('./src/orders/orders.route');
const reviewRoutes = require('./src/reviews/reviews.router');
const statsRoutes = require('./src/stats/stats.route');

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/stats', statsRoutes);

// Upload image route
app.post('/uploadImage', (req, res) => {
  uploadImage(req.body.image)
    .then((url) => res.send(url))
    .catch((err) => res.status(500).send(err));
});

// Root route
app.get('/', (req, res) => {
  res.send('Scarfaura Kids Clothing Store Ecommerce Server is Running..!');
});

// ============================================
// Database Connection
// ============================================
async function main() {
  try {
    const MONGODB_URI = process.env.MONGODB_URL || process.env.MONGODB_URI;
    
    if (!MONGODB_URI) {
      console.error('❌ MONGODB_URL is not defined!');
      process.exit(1);
    }
    
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected successfully!');
    console.log('📁 Database name:', mongoose.connection.db.databaseName);
    
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  }
}

main();

// ============================================
// Start Server
// ============================================
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});

// ============================================
// Error Handling
// ============================================
process.on('unhandledRejection', (error) => {
  console.error('💥 Unhandled Rejection:', error);
});