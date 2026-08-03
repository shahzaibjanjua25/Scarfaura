const mongoose = require("mongoose");

// Embedded schema for shipping address
const ShippingAddressSchema = new mongoose.Schema({
  address: { type: String, required: true },
  city:    { type: String, required: true },
  state:   { type: String, required: true },
  zipCode: { type: String, required: true },
}, { _id: false }); // prevent _id generation for subdoc

// Main order schema
const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    orderId: {
      type: String,
      default: () => `ORD-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
    },

    products: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true
        },
        name:     { type: String },
        image:    { type: String },
        price:    { type: Number },
        quantity: { type: Number, required: true },
      }
    ],

    amount: { type: Number },

    email: { type: String, required: true },

    phone: { type: String, required: true },

    shippingAddress: ShippingAddressSchema,

    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "Delivered", "cancelled"],
      default: "pending"
    },

    paymentMethod: { type: String },

    specialInstructions: { type: String }
  },
  { timestamps: true }
);

// Create the model
const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
