// products.model.js
const mongoose = require("mongoose");

// Clear any existing model to prevent conflicts
if (mongoose.models.Product) {
  delete mongoose.models.Product;
}

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    categories: { type: [String], default: [] },
    category: { type: String, required: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    oldPrice: { type: Number, min: 0, default: null },
    images: { type: [String], default: [] },
    image: { type: String, default: '' },
    color: { type: String, default: '' },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { 
    timestamps: true 
  }
);

// NO middleware - let the route handle everything

const Products = mongoose.model("Product", ProductSchema);

console.log('✅ Product model loaded with array support');

module.exports = Products;