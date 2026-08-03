const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('Checking .env file...');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✅ Loaded' : '❌ Not loaded');

const mongoose = require('mongoose');

async function checkProducts() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    console.log('Using URI:', process.env.MONGODB_URI);
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected!');
    
    const Product = require('./src/products/products.model');
    
    const count = await Product.countDocuments();
    console.log('📦 Total products in database:', count);
    
    if (count > 0) {
      const products = await Product.find().limit(3);
      console.log('📋 Sample products:');
      products.forEach((p, i) => {
        console.log(  .  - create-user.js{p.price});
      });
    } else {
      console.log('⚠️ No products found in database!');
    }
    
    await mongoose.disconnect();
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
}

checkProducts();
