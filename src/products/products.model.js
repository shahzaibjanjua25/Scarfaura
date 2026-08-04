// products.model.js
const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true 
    },

    // ✅ Multi-category - Fixed type to [String]
    categories: { 
      type: [String], 
      default: [] 
    },
    // ✅ Primary category (first one) - kept for backward compatibility
    category: { 
      type: String, 
      required: true 
    },

    description: { 
      type: String, 
      required: true 
    },
    
    price: { 
      type: Number, 
      required: true, 
      min: 0 
    },
    
    oldPrice: { 
      type: Number, 
      min: 0,
      default: null 
    },

    // ✅ Multi-image - Fixed type to [String]
    images: { 
      type: [String], 
      default: [] 
    },

    // ✅ Legacy single-image field, kept in sync with images[0]
    image: { 
      type: String, 
      required: false 
    },

    color: { 
      type: String,
      default: '' 
    },
    
    rating: { 
      type: Number, 
      default: 0, 
      min: 0, 
      max: 5 
    },
    
    author: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    }
  },
  { timestamps: true }
);

// ✅ Pre-save middleware: Keep image <-> images consistent
ProductSchema.pre("save", function(next) {
  if (Array.isArray(this.images) && this.images.length > 0) {
    this.image = this.images[0];
  } else if (this.image) {
    this.images = [this.image];
  }
  
  // ✅ Ensure category is set from categories if available
  if (this.categories && this.categories.length > 0 && !this.category) {
    this.category = this.categories[0];
  }
  
  next();
});

// ✅ Pre-update middleware: Mirror the sync for findOneAndUpdate
ProductSchema.pre(/^findOneAndUpdate/, function(next) {
  const update = this.getUpdate() || {};
  const $set = update.$set || update;

  if (Array.isArray($set.images)) {
    $set.image = $set.images.length > 0 ? $set.images[0] : undefined;
  } else if ($set.image) {
    $set.images = [$set.image];
  }

  this.setUpdate(update);
  next();
});

// ✅ Indexes for better query performance
ProductSchema.index({ category: 1 });
ProductSchema.index({ categories: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ rating: -1 });

// ✅ Debug: Log when model is loaded
console.log("✅ Product model loaded successfully");

const Products = mongoose.model("Product", ProductSchema);

module.exports = Products;