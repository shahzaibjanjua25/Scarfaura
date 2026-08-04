const express = require("express");
const User = require("../users/user.model");
const Order = require("../orders/orders.model");
const Reviews = require("../reviews/reviews.model");
const Products = require("../products/products.model");

const router = express.Router();
// Add this in stats.route.js
router.get('/user-stats/:email', async (req, res) => {
  const { email } = req.params;

  try {
    // 1. Check if the user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 2. Count reviews by userId (not email!)
    const totalReviews = await Reviews.countDocuments({ userId: user._id });

    // 3. Get all orders by this email
    const orders = await Order.find({ email }).lean();

    // 4. Count total purchased products
    const totalPurchasedProducts = orders.reduce((sum, order) => {
      return sum + order.products.reduce((pSum, p) => pSum + p.quantity, 0);
    }, 0);

    // 5. Send response
    res.status(200).json({
      email,
      totalReviews,
      totalPurchasedProducts,
    });

  } catch (err) {
    console.error("User stats error:", err);
    res.status(500).json({ message: 'Failed to fetch user stats' });
  }
});


router.get('/admin-stats', async (req, res) => {
  try {
    // 1. Basic Counts
    const [totalOrders, totalProducts, totalReviews, totalUsers] = await Promise.all([
      Order.countDocuments(),
      Products.countDocuments(),
      Reviews.countDocuments(),
      User.countDocuments()
    ]);

    // 2. Total Earnings
    const totalEarningsResult = await Order.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalEarnings = totalEarningsResult[0]?.total || 0;

    // 3. Monthly Earnings
    const monthlyEarningsResult = await Order.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          earnings: { $sum: "$amount" },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // 4. Monthly Users
    const monthlyUsersResult = await User.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          userCount: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    const allMonths = Array.from({ length: 12 }, (_, i) => i + 1);
    const currentYear = new Date().getFullYear();

    const monthlyEarnings = allMonths.map(month => {
      const entry = monthlyEarningsResult.find(e => e._id.month === month && e._id.year === currentYear);
      return {
        month,
        earnings: entry?.earnings || 0,
        orderCount: entry?.orderCount || 0
      };
    });

    const monthlyUsers = allMonths.map(month => {
      const data = monthlyUsersResult.find(e => e._id.month === month && e._id.year === currentYear);
      return {
        month,
        userCount: data?.userCount || 0,
        cumulativeUsers: monthlyUsersResult
          .filter(e =>
            (e._id.year === currentYear && e._id.month <= month) ||
            e._id.year < currentYear
          )
          .reduce((sum, item) => sum + item.userCount, 0)
      };
    });

    // 5. Recent Orders (populate 'user' by ObjectId)
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate({ path: 'user', select: 'username email' }) // Make sure `user` is ObjectId in Order model
      .lean();

    // 6. Popular Products
    const popularProducts = await Order.aggregate([
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.productId",
          count: { $sum: 1 },
          totalRevenue: { $sum: "$products.price" }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      { $unwind: "$productDetails" },
      {
        $project: {
          productId: "$_id",
          name: "$productDetails.name",
          image: "$productDetails.image",
          count: 1,
          totalRevenue: 1
        }
      }
    ]);

    // Final Response
    res.status(200).json({
      totalOrders,
      totalProducts,
      totalReviews,
      totalUsers,
      totalEarnings,
      monthlyEarnings,
      monthlyUsers,
      recentOrders,
      popularProducts,
      lastUpdated: new Date()
    });

  } catch (error) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({
      message: "Failed to fetch admin stats",
      error: error.message
    });
  }
});

module.exports = router;
