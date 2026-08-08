// const mongoose = require('mongoose');
// require('dotenv').config({ path: __dirname + '/.env' });

////console.log('🔍 Testing connection to MongoDB Atlas...');
////console.log('📦 URL:', process.env.MONGODB_URL);

// async function testConnection() {
//   try {
//     await mongoose.connect(process.env.MONGODB_URL, {
//       serverSelectionTimeoutMS: 15000,
//       connectTimeoutMS: 15000,
//     });
//    //console.log('✅ Connected successfully to MongoDB Atlas!');
//    //console.log('📊 Database:', mongoose.connection.db.databaseName);
//     await mongoose.disconnect();
//     process.exit(0);
//   } catch (error) {
//     console.error('❌ Connection error:', error.message);
//     console.error('💡 The non-SRV connection might still work.');
//     console.error('💡 Trying with different options...');
//     process.exit(1);
//   }
// }

// testConnection();
