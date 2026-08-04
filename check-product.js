// check-product.js
const mongoose = require('mongoose');
require('dotenv').config();

async function checkProduct() {
  try {
    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URL || process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      console.error('❌ MONGODB_URL is not defined!');
      process.exit(1);
    }
    
    console.log('🔍 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    console.log('📁 Database:', mongoose.connection.db.databaseName);
    
    // Get the Product model
    const Products = require('./src/products/products.model');
    
    // Find the product by name
    const productName = 'Test Frock'; // Change this to your product name
    console.log(`🔍 Searching for product: "${productName}"`);
    
    const product = await Products.findOne({ name: productName });
    
    if (!product) {
      console.log('❌ Product not found!');
      console.log('💡 Try searching for a different product name.');
      
      // Show all products
      const allProducts = await Products.find({}, 'name category categories images').limit(5);
      console.log('\n📋 Last 5 products in database:');
      allProducts.forEach((p, i) => {
        console.log(`  ${i+1}. ${p.name}`);
        console.log(`     category: ${p.category}`);
        console.log(`     categories: ${p.categories || []}`);
        console.log(`     images: ${p.images || []}`);
      });
      
      await mongoose.disconnect();
      return;
    }
    
    console.log('\n✅ Product found!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 Product Details:');
    console.log('  Name:', product.name);
    console.log('  Category (single):', product.category);
    console.log('  Categories (array):', product.categories);
    console.log('  Categories isArray:', Array.isArray(product.categories));
    console.log('  Categories length:', product.categories?.length || 0);
    console.log('  Image (single):', product.image);
    console.log('  Images (array):', product.images);
    console.log('  Images isArray:', Array.isArray(product.images));
    console.log('  Images length:', product.images?.length || 0);
    console.log('  Price:', product.price);
    console.log('  Description:', product.description);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Check if arrays have data
    if (product.categories && product.categories.length > 0) {
      console.log('✅ Categories saved correctly:', product.categories.join(', '));
    } else {
      console.log('❌ Categories array is empty or not saved!');
    }
    
    if (product.images && product.images.length > 0) {
      console.log('✅ Images saved correctly:', product.images.length, 'images');
    } else {
      console.log('❌ Images array is empty or not saved!');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Done!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the function
checkProduct();