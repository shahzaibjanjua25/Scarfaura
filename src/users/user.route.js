// src/users/user.route.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./user.model');
const mongoose = require('mongoose');
require('dotenv').config();

// ============================================
// Helper Functions
// ============================================
const generateToken = (userId) => {
    return jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
};

// ============================================
// Routes
// ============================================

// Register
router.post('/register', async (req, res) => {
    try {
        const { email, password, username } = req.body;
       //console.log('📝 Registration attempt for:', email);
        
        const existingUser = await User.findOne({ 
            email: email.toLowerCase().trim() 
        });
        
        if (existingUser) {
            return res.status(400).json({ 
                success: false,
                message: 'User already exists' 
            });
        }
        
        const user = new User({ 
            email: email.toLowerCase().trim(), 
            password, 
            username: username.trim() 
        });
        
        await user.save();
       //console.log('✅ User registered successfully:', email);
        
        res.status(201).json({ 
            success: true,
            message: 'User registered successfully' 
        });
        
    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Registration failed',
            error: error.message 
        });
    }
});

// Login
router.post('/login', async (req, res) => {
   //console.log('========================================');
   //console.log('🔐 LOGIN ATTEMPT RECEIVED');
   //console.log('📧 Email:', req.body?.email);
   //console.log('========================================');
    
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ 
                success: false,
                message: 'Email and password are required' 
            });
        }

       //console.log('🔍 Searching for user...');
        const user = await User.findOne({ 
            email: email.toLowerCase().trim() 
        });

        if (!user) {
           //console.log('❌ User not found:', email);
            return res.status(401).json({ 
                success: false,
                message: 'Invalid credentials' 
            });
        }

       //console.log('✅ User found:', user.email);
       //console.log('🔐 Comparing passwords...');
        
        const isMatch = await bcrypt.compare(password, user.password);
       //console.log('🔐 Password match:', isMatch);

        if (!isMatch) {
           //console.log('❌ Password mismatch');
            return res.status(401).json({ 
                success: false,
                message: 'Invalid credentials' 
            });
        }

        if (!process.env.JWT_SECRET) {
            console.error('❌ JWT_SECRET is not configured!');
            return res.status(500).json({ 
                success: false,
                message: 'Server configuration error' 
            });
        }

       //console.log('🔑 Generating token...');
        const token = generateToken(user._id);

       //console.log('✅ Token generated successfully');
       //console.log('========================================');

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

        res.status(200).json(response);

    } catch (error) {
        console.error('💥 FATAL LOGIN ERROR:', error);
        console.error('📚 Stack trace:', error.stack);
        
        res.status(500).json({ 
            success: false,
            message: 'Login failed',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Logout
router.post('/logout', (req, res) => {
    res.status(200).json({ 
        success: true,
        message: 'Logged out successfully'
    });
});

// Get all users
router.get('/users', async (req, res) => {
    try {
        const users = await User.find({}, 'id email role username profileImage').sort({ createdAt: -1 });
        res.status(200).json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch users' 
        });
    }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findByIdAndDelete(id);
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }
        res.status(200).json({ 
            success: true,
            message: 'User deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to delete user' 
        });
    }
});

// Update user role
router.put('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { role } = req.body;
        const user = await User.findByIdAndUpdate(id, { role }, { new: true });
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }
        res.status(200).json({ 
            success: true,
            message: 'User role updated successfully', 
            user 
        });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to update user role' 
        });
    }
});

// Edit Profile
router.patch('/edit-profile', async (req, res) => {
    try {
        const { userId, username, profileImage, bio, profession } = req.body;

        if (!userId) {
            return res.status(400).json({ 
                success: false,
                message: 'User ID is required' 
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }

        if (username !== undefined) user.username = username;
        if (profileImage !== undefined) user.profileImage = profileImage;
        if (bio !== undefined) user.bio = bio;
        if (profession !== undefined) user.profession = profession;

        await user.save();

        res.status(200).json({
            success: true,
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
        res.status(500).json({ 
            success: false,
            message: 'Profile update failed' 
        });
    }
});

// Debug endpoint
router.get('/debug', async (req, res) => {
    try {
        const dbStatus = mongoose.connection.readyState;
        const dbName = mongoose.connection.db?.databaseName;
        const userCount = await User.countDocuments();
        const user = await User.findOne({ email: "shahzaibjanjua25@gmail.com" });
        
        res.json({
            success: true,
            database: {
                connected: dbStatus === 1,
                readyState: dbStatus,
                name: dbName
            },
            userCount: userCount,
            userFound: !!user,
            user: user ? {
                email: user.email,
                username: user.username,
                hasPassword: !!user.password,
                passwordLength: user.password?.length,
                role: user.role
            } : null
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;