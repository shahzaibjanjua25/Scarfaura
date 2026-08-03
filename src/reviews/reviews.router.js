const express = require("express");
const router = express.Router();
const Reviews = require("./reviews.model");
const Products = require("../products/products.model");

// ✅ Create or update a review
router.post('/post-review', async (req, res) => {
  try {
    const { comment, rating, productId, userId } = req.body;

    if (!comment || rating === undefined || !productId || !userId) {
      return res.status(400).send({ message: 'All fields are required' });
    }

    const existingReview = await Reviews.findOne({ productId, userId });

    if (existingReview) {
      existingReview.comment = comment;
      existingReview.rating = rating;
      await existingReview.save();
    } else {
      const newReview = new Reviews({ comment, rating, productId, userId });
      await newReview.save();
    }

    // Recalculate average rating
    const reviews = await Reviews.find({ productId });
    if (reviews.length > 0) {
      const totalRating = reviews.reduce((acc, review) => acc + review.rating, 0);
      const averageRating = totalRating / reviews.length;

      const product = await Products.findById(productId);
      if (product) {
        product.rating = averageRating;
        await product.save({ validateBeforeSave: false });
      } else {
        return res.status(404).send({ message: 'Product not found' });
      }
    }

    res.status(200).send({
      message: 'Review processed successfully',
      reviews,
    });
  } catch (error) {
    console.error('Error posting review:', error);
    res.status(500).send({ message: 'Failed to post review', error: error.message });
  }
});

// ✅ Get total review count
router.get("/total-reviews", async (req, res) => {
  try {
    const totalReviews = await Reviews.countDocuments({});
    res.status(200).send({ totalReviews });
  } catch (error) {
    console.error("Error fetching total reviews:", error);
    res.status(500).send({ message: "Failed to fetch total reviews" });
  }
});

// ✅ Get all reviews (admin/debug)
router.get("/", async (req, res) => {

  try {
    const reviews = await Reviews.find()
      .populate('userId')
      .populate('productId');
    res.status(200).json(reviews);
  } catch (err) {
    console.error('Error fetching reviews:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Get reviews by user ID
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    const reviews = await Reviews.find({ userId }).sort({ createdAt: -1 });

    if (!reviews || reviews.length === 0) {
      return res.status(404).json({ message: "No reviews found for this user" });
    }

    res.status(200).json(reviews);
  } catch (error) {
    console.error("Error fetching reviews by user:", error);
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
});

// ✅ Delete a review by ID
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const deletedReview = await Reviews.findByIdAndDelete(id);
    if (!deletedReview) {
      return res.status(404).json({ message: 'Review not found' });
    }

    // Update product rating after deletion
    const productId = deletedReview.productId;
    const remainingReviews = await Reviews.find({ productId });

    if (remainingReviews.length > 0) {
      const totalRating = remainingReviews.reduce((acc, r) => acc + r.rating, 0);
      const averageRating = totalRating / remainingReviews.length;

      await Products.findByIdAndUpdate(productId, { rating: averageRating });
    } else {
      await Products.findByIdAndUpdate(productId, { rating: 0 });
    }

    res.status(200).json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error("Error deleting review:", error);
    res.status(500).json({ message: "Failed to delete review", error: error.message });
  }
});

module.exports = router;
