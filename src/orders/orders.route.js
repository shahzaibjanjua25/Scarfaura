const express = require("express");
const Order = require("./orders.model");
const router = express.Router();

// Create Order - Allow Guest Checkout
router.post("/create-order", async (req, res) => {
  const {
    user,
    products,
    email,
    phone,
    shippingAddress,
    paymentMethod,
    amount,
    specialInstructions,
    customerName
  } = req.body;

  try {
    // ✅ Validate required fields (user is now OPTIONAL)
    if (!products || products.length === 0) {
      return res.status(400).json({ error: "Products are required" });
    }

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    if (!shippingAddress || !shippingAddress.address) {
      return res.status(400).json({ error: "Shipping address is required" });
    }

    // Generate order ID
    const orderId = 'ORD-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);

    // ✅ Create new order - user is optional
    const order = new Order({
      // Only include user if provided
      ...(user && { user }),
      // If user not provided, user will be null (default from schema)
      orderId,
      products: products.map(product => ({
        productId: product.productId || product._id,
        name: product.name,
        image: product.image || "",
        price: Number(product.price) || 0,
        quantity: Number(product.quantity) || 1
      })),
      amount: Number(amount) || 0,
      email: email.trim(),
      phone: phone.trim(),
      shippingAddress: {
        address: shippingAddress.address.trim(),
        city: shippingAddress.city?.trim() || "",
        state: shippingAddress.state?.trim() || "",
        zipCode: shippingAddress.zipCode?.trim() || ""
      },
      paymentMethod: paymentMethod || "Cash on Delivery",
      specialInstructions: specialInstructions || "",
      customerName: customerName || "", // ✅ Store customer name for guest checkout
      status: "pending"
    });

    await order.save();

    res.status(201).json({
      message: "Order created successfully",
      orderId: order.orderId,
      _id: order._id
    });

    
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({
      error: "Failed to create order",
      details: error.message
    });
  }
});

// ... rest of your routes remain the same

// Add a new route for checkout validation
router.post("/validate-checkout", async (req, res) => {
  const { products, email } = req.body;

  try {
    // Basic validation before proceeding to checkout
    if (!products || products.length === 0) {
      return res.status(400).json({ error: "Your cart is empty" });
    }

    if (!email) {
      return res.status(400).json({ error: "Please login to place your order" });
    }

    // Calculate total amount
    const amount = products.reduce((total, product) => {
      return total + (product.price * product.quantity);
    }, 0);

    res.status(200).json({
      valid: true,
      amount,
      itemCount: products.length
    });
  } catch (error) {
    console.error("Checkout validation error:", error);
    res.status(500).json({
      error: "Checkout validation failed",
      details: error.message
    });
  }
});
// Get orders by email
router.get("/:email", async (req, res) => {
  const email = req.params.email;

  if (!email) {
    return res.status(400).json({ message: "Email parameter is required" });
  }

  try {
    const orders = await Order.find({ email: email }).sort({ createdAt: -1 });
    if (orders.length === 0 || !orders) {
      return res
        .status(404)
        .json({ order: 0, message: "No orders found for this email" });
    }
    res.json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get order by ID
// In your backend routes (orders.route.js)
// Update the get order by ID endpoint:
router.get("/order/:id", async (req, res) => {
  try {
    let order;
    // Check if it's a custom orderId (starts with ORD-)
    if (req.params.id.startsWith('ORD-')) {
      order = await Order.findOne({ orderId: req.params.id });
    } else {
      // Otherwise treat as MongoDB _id
      order = await Order.findById(req.params.id);
    }

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.status(200).json(order);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all orders 
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    if (orders.length === 0) {
      console.log('No orders found');
      return res.status(200).json({ message: "No orders found", orders: [] });
    }

    res.status(200).json(orders);
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update order status
router.patch('/update-order-status/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Order status is required" });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { status, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({
      message: "Order status updated successfully",
      order: updatedOrder
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ message: "Server error" });
  }
});
// Route to get order status counts
router.get('/status-stats', async (req, res) => {
  try {
    const statusCounts = await Order.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // Format the data to be more frontend-friendly
    const formatted = {};
    statusCounts.forEach(stat => {
      formatted[stat._id] = stat.count;
    });

    res.status(200).json(formatted);
  } catch (error) {
    console.error("Error fetching status stats:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete order
router.delete('/delete-order/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const deletedOrder = await Order.findByIdAndDelete(id);

    if (!deletedOrder) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(200).json({
      message: "Order deleted successfully",
      order: deletedOrder
    });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;