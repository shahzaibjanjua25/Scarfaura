// File: index.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
// require('dotenv').config();
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const uploadImage = require('./src/utils/uploadImage');

const app = express();
const port = process.env.PORT || 5000;

// Middleware setup
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  cors({
    origin: [
      'https://scarfaura-frontend.vercel.app',
      'https://www.scarfaura.com',
      'http://localhost:5173',//do
    ],
    credentials: true,
  })
);

// Route imports
const authRoutes = require('./src/users/user.route');
const productRoutes = require('./src/products/products.route');
const orderRoutes = require('./src/orders/orders.route');
const reviewRoutes = require('./src/reviews/reviews.router');
const statsRoutes = require('./src/stats/stats.route');
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes); // ✅ Correct path
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

// DB connection
async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('Mongodb connected successfully!');
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}

main();

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
