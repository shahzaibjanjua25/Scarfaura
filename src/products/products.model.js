// products.model.js
const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // Full list of categories. This is the source of truth.
    categories: {
      type: [String],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "At least one category is required",
      },
    },

    // Denormalised primary category (categories[0]) kept for legacy queries.
    category: { type: String, required: true, trim: true },

    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    oldPrice: { type: Number, min: 0, default: null },

    // Full list of image URLs. This is the source of truth.
    images: {
      type: [String],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "At least one product image is required",
      },
    },

    // Denormalised primary image (images[0]) kept for legacy consumers.
    image: { type: String, default: "" },

    color: { type: String, default: "" },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Runs before validation on save(), so coercion happens before the
// required/validate checks above are evaluated.
ProductSchema.pre("validate", function (next) {
  if (!Array.isArray(this.categories)) {
    this.categories = this.categories ? [this.categories] : [];
  }
  if (!Array.isArray(this.images)) {
    this.images = this.images ? [this.images] : [];
  }

  this.categories = this.categories.map((c) => String(c).trim()).filter(Boolean);
  this.images = this.images.map((i) => String(i).trim()).filter(Boolean);

  // Keep the denormalised singulars in sync with the arrays.
  if (this.categories.length > 0) {
    if (!this.category || !this.categories.includes(this.category)) {
      this.category = this.categories[0];
    }
  }
  if (this.images.length > 0) {
    if (!this.image || !this.images.includes(this.image)) {
      this.image = this.images[0];
    }
  }

  next();
});

// Reuse the compiled model if it already exists. Never delete and
// recompile — that leaves stale references in modules that already
// required this file.
module.exports =
  mongoose.models.Product || mongoose.model("Product", ProductSchema);