const express = require('express');
const router = express.Router();
const User = require('./user.model');
const generateToken = require('../middleware/generateToken');
const verifyToken = require('../middleware/verifyToken');
require('dotenv').config()


// Register endpoint
router.post('/register', async (req, res) => {
    try {
        const { email, password, username } = req.body;
        const user = new User({ email, password, username });
        await user.save();
        res.status(201).send({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).send({ message: 'Registration failed. User already Exits' });
    }
});

// Login endpoint
// In auth.js - Login route with detailed logging
router.post('/login', async (req, res) => {
    console.log('========================================');
    console.log('🔐 LOGIN ATTEMPT RECEIVED');
    console.log('📧 Email:', req.body?.email);
    console.log('🔑 Password provided:', req.body?.password ? 'Yes' : 'No');
    console.log('========================================');
    
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            console.log('❌ Missing email or password');
            return res.status(400).json({ 
                success: false,
                message: 'Email and password are required' 
            });
        }

        console.log('🔍 Searching for user in database...');
        console.log('📧 Looking for email:', email.toLowerCase().trim());

        // Find user
        const user = await User.findOne({ 
            email: email.toLowerCase().trim() 
        });

        if (!user) {
            console.log('❌ User not found for email:', email);
            return res.status(401).json({ 
                success: false,
                message: 'Invalid credentials' 
            });
        }

        console.log('✅ User found!');
        console.log('👤 Username:', user.username);
        console.log('📧 Email:', user.email);
        console.log('🔑 Role:', user.role);
        console.log('🔐 Hashed password in DB:', user.password ? user.password.substring(0, 25) + '...' : 'No password!');
        console.log('🔐 Password hash length:', user.password?.length || 0);

        console.log('🔍 Comparing passwords with bcrypt...');
        
        let isMatch = false;
        try {
            isMatch = await bcrypt.compare(password, user.password);
            console.log('🔐 Password match result:', isMatch);
        } catch (bcryptError) {
            console.error('❌ Bcrypt comparison error:', bcryptError);
            return res.status(500).json({ 
                success: false,
                message: 'Password verification error',
                error: bcryptError.message 
            });
        }

        if (!isMatch) {
            console.log('❌ Password mismatch for user:', user.email);
            return res.status(401).json({ 
                success: false,
                message: 'Invalid credentials' 
            });
        }

        console.log('✅ Password matched successfully!');

        // Check JWT_SECRET
        if (!process.env.JWT_SECRET) {
            console.error('❌ JWT_SECRET is not configured!');
            return res.status(500).json({ 
                success: false,
                message: 'Server configuration error - JWT_SECRET missing' 
            });
        }

        console.log('🔑 Generating JWT token...');

        // Generate token
        const token = jwt.sign(
            { 
                id: user._id, 
                email: user.email,
                username: user.username,
                role: user.role,
                isAdmin: user.isAdmin || false
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        console.log('✅ Token generated successfully');
        console.log('🎫 Token preview:', token.substring(0, 30) + '...');

        // Set cookie
        try {
            res.cookie('token', token, { 
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });
            console.log('✅ Cookie set successfully');
        } catch (cookieError) {
            console.error('❌ Cookie error:', cookieError);
            // Continue even if cookie fails
        }

        const response = {
            success: true,
            message: 'Logged in successfully',
            token,
            user: {
                _id: user._id,
                email: user.email,
                username: user.username,
                role: user.role,
                profileImage: user.profileImage || '',
                bio: user.bio || '',
                profession: user.profession || '',
                isAdmin: user.isAdmin || false
            }
        };

        console.log('📤 Sending success response');
        console.log('========================================');
        res.status(200).json(response);

    } catch (error) {
        console.error('💥 FATAL LOGIN ERROR:', error);
        console.error('📚 Stack trace:', error.stack);
        console.log('========================================');
        
        res.status(500).json({ 
            success: false,
            message: 'Login failed',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});
// all users 

router.get('/users', async (req, res) => {
    try {
        const users = await User.find({}, 'id email role').sort({ createdAt: -1 });
        res.status(200).send(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send({ message: 'Failed to fetch users' });
    }
});

// delete a user
router.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findByIdAndDelete(id);
        if (!user) {
            return res.status(404).send({ message: 'User not found' });
        }
        res.status(200).send({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).send({ message: 'Failed to delete user' });
    }
})

// update a user role
router.put('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        const user = await User.findByIdAndUpdate(id, { role }, { new: true });
        if (!user) {
            return res.status(404).send({ message: 'User not found' });
        }
        res.status(200).send({ message: 'User role updated successfully', user });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).send({ message: 'Failed to update user role' });
    }
});

// Edit Profile endpoint
router.patch('/edit-profile', async (req, res) => {
    try {
        // Destructure fields from the request body
        const { userId, username, profileImage, bio, profession } = req.body;

        // Check if userId is provided
        if (!userId) {
            return res.status(400).send({ message: 'User ID is required' });
        }

        // Find user by ID
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).send({ message: 'User not found' });
        }

        // Update the user's profile with provided fields
        if (username !== undefined) user.username = username;
        if (profileImage !== undefined) user.profileImage = profileImage;
        if (bio !== undefined) user.bio = bio;
        if (profession !== undefined) user.profession = profession;

        // Save the updated user profile
        await user.save();

        // Send the updated user profile as the response
        res.status(200).send({
            message: 'Profile updated successfully',
            user: {
                _id: user._id,
                username: user.username,
                email: user.email,
                profileImage: user.profileImage,
                bio: user.bio,
                profession: user.profession,
                role: user.role,
            }
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).send({ message: 'Profile update failed' });
    }
});

module.exports = router;