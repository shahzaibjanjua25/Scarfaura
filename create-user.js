require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');

async function createTestUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
   //console.log('✅ Connected!');
    
    const User = require('./src/users/user.model');
    
    // Check if user exists
    let user = await User.findOne({ email: 'admin@test.com' });
    
    if (!user) {
      user = new User({
        username: 'admin',
        email: 'admin@test.com',
        password: 'password123',
        role: 'admin'
      });
      await user.save();
     //console.log('✅ Test user created!');
     //console.log('User ID:', user._id);
    } else {
     //console.log('✅ User already exists!');
     //console.log('User ID:', user._id);
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

createTestUser();
