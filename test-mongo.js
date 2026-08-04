// const path = require('path');
// require('dotenv').config({ path: path.join(__dirname, '.env') });

// console.log('🔍 Testing MongoDB connection...');
// console.log('📦 MONGODB_URL:', process.env.MONGODB_URL);

// const mongoose = require('mongoose');

// async function testConnection() {
//   try {
//     console.log('🔄 Connecting...');
//     await mongoose.connect(process.env.MONGODB_URL, {
//       serverSelectionTimeoutMS: 5000,
//       connectTimeoutMS: 5000,
//     });
//     console.log('✅ Connected successfully!');
//     console.log('📊 Database name:', mongoose.connection.db.databaseName);
//     await mongoose.disconnect();
//     console.log('✅ Disconnected');
//   } catch (error) {
//     console.error('❌ Connection failed:', error.message);
//     console.error('📌 Make sure your IP is whitelisted in MongoDB Atlas');
//     console.error('📌 Or check if MongoDB is running locally');
//   }
// }

// testConnection();
