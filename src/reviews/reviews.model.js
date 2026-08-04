const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    comment: {
      type: String,
      required: [true, 'Comment is required'],
      trim: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product ID is required'],
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields automatically
  }
);

// Optional: Prevent users from reviewing the same product more than once
reviewSchema.index({ userId: 1, productId: 1 }, { unique: true });

// Optional: Virtual populate if you want to access the related product or user info easily
// reviewSchema.virtual('user', { ref: 'User', localField: 'userId', foreignField: '_id', justOne: true });
// reviewSchema.virtual('product', { ref: 'Product', localField: 'productId', foreignField: '_id', justOne: true });

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
