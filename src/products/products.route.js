// products.route.js
const express = require("express");
const mongoose = require("mongoose");
const Products = require("./products.model");
const Reviews = require("../reviews/reviews.model");
const router = express.Router();

// CREATE PRODUCT
router.post("/create-product", async (req, res) => {
  try {
    console.log('📥 === CREATE PRODUCT ===');
    console.log('📥 Body:', JSON.stringify(req.body, null, 2));

    const { categories, category, images, image, ...rest } = req.body;

    // Ensure arrays
    let categoriesArray = [];
    if (Array.isArray(categories)) {
      categoriesArray = categories;
    } else if (typeof categories === 'string') {
      categoriesArray = categories.split(',').map(s => s.trim()).filter(Boolean);
    }

    let imagesArray = [];
    if (Array.isArray(images)) {
      imagesArray = images;
    } else if (typeof images === 'string') {
      imagesArray = images.split(',').map(s => s.trim()).filter(Boolean);
    }

    // Get primary values
    const primaryCategory = category || (categoriesArray.length > 0 ? categoriesArray[0] : null);
    const primaryImage = image || (imagesArray.length > 0 ? imagesArray[0] : null);

    console.log('📥 categoriesArray:', categoriesArray);
    console.log('📥 imagesArray:', imagesArray);

    // Validate
    if (!primaryCategory || categoriesArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one category is required"
      });
    }

    if (imagesArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one product image is required"
      });
    }

    // ✅ Create product with explicit fields
    const productData = {
      name: rest.name || '',
      description: rest.description || '',
      price: Number(rest.price) || 0,
      oldPrice: rest.oldPrice ? Number(rest.oldPrice) : null,
      color: rest.color || '',
      author: rest.author,
      // ✅ CRITICAL: Set the arrays explicitly
      categories: categoriesArray,
      category: primaryCategory,
      images: imagesArray,
      image: primaryImage
    };

    console.log('💾 Product data to save:', JSON.stringify(productData, null, 2));

    // ✅ Create and save
    const newProduct = new Products(productData);
    const savedProduct = await newProduct.save();

    console.log('✅ Product saved!');
    console.log('✅ ID:', savedProduct._id);
    console.log('✅ categories:', savedProduct.categories);
    console.log('✅ images:', savedProduct.images);

    // ✅ Force the arrays to be included in the response
    const responseData = {
      _id: savedProduct._id,
      name: savedProduct.name,
      description: savedProduct.description,
      price: savedProduct.price,
      oldPrice: savedProduct.oldPrice,
      color: savedProduct.color,
      author: savedProduct.author,
      category: savedProduct.category,
      image: savedProduct.image,
      categories: savedProduct.categories || [],
      images: savedProduct.images || [],
      rating: savedProduct.rating,
      createdAt: savedProduct.createdAt,
      updatedAt: savedProduct.updatedAt,
      __v: savedProduct.__v
    };

    console.log('📤 Response data:', JSON.stringify(responseData, null, 2));

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product: responseData
    });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create product",
      error: error.message
    });
  }
});

// LIST PRODUCTS
router.get("/", async (req, res) => {
  try {
    const { category, color, minPrice, maxPrice, page = 1, limit = 10 } = req.query;

    const filter = {};
    const conditions = [];

    if (category && category !== "all") {
      const categories = typeof category === 'string' ? category.split(',').map(s => s.trim()) : [category];
      if (categories.length > 0) {
        conditions.push({
          $or: [{ category: { $in: categories } }, { categories: { $in: categories } }]
        });
      }
    }

    if (color && color !== "all") {
      conditions.push({ color });
    }

    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    if (!isNaN(min) && !isNaN(max)) {
      conditions.push({ price: { $gte: min, $lte: max } });
    } else if (!isNaN(min)) {
      conditions.push({ price: { $gte: min } });
    } else if (!isNaN(max)) {
      conditions.push({ price: { $lte: max } });
    }

    if (conditions.length > 0) filter.$and = conditions;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNum - 1) * limitNum;

    const totalProducts = await Products.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / limitNum);

    let products = await Products.find(filter)
      .skip(skip)
      .limit(limitNum)
      .sort({ createdAt: -1 });

    try {
      products = await Products.populate(products, {
        path: "author",
        select: "email username",
        options: { strictPopulate: false }
      });
    } catch (populateError) {
      console.log("Could not populate author:", populateError.message);
    }

    res.status(200).json({ products, totalPages, totalProducts });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({
      message: "Failed to fetch products",
      error: error.message
    });
  }
});

// GET SINGLE PRODUCT
router.get("/:id", async (req, res) => {
  try {
    const productId = req.params.id;

    const product = await Products.findById(productId).populate(
      "author",
      "email username"
    );

    if (!product) {
      return res.status(404).send({ message: "Product not found" });
    }

    const reviews = await Reviews.find({ productId }).populate(
      "userId",
      "username email"
    );

    res.status(200).send({ product, reviews });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).send({ message: "Failed to fetch product" });
  }
});

// UPDATE PRODUCT
router.patch("/update-product/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    const { categories, category, images, image, ...rest } = req.body;

    const existingProduct = await Products.findById(productId);
    if (!existingProduct) {
      return res.status(404).send({ message: "Product not found" });
    }

    const updates = { ...rest };

    if (categories !== undefined || category !== undefined) {
      let categoriesArray = [];
      if (Array.isArray(categories)) {
        categoriesArray = categories;
      } else if (typeof categories === 'string') {
        categoriesArray = categories.split(',').map(s => s.trim()).filter(Boolean);
      } else {
        categoriesArray = existingProduct.categories || [];
      }
      
      const primaryCategory = category || (categoriesArray.length > 0 ? categoriesArray[0] : existingProduct.category);
      
      if (!primaryCategory || categoriesArray.length === 0) {
        return res.status(400).send({ message: "At least one category is required" });
      }
      
      updates.category = primaryCategory;
      updates.categories = categoriesArray;
    }

    if (images !== undefined || image !== undefined) {
      let imagesArray = [];
      if (Array.isArray(images)) {
        imagesArray = images;
      } else if (typeof images === 'string') {
        imagesArray = images.split(',').map(s => s.trim()).filter(Boolean);
      } else {
        imagesArray = existingProduct.images || [];
      }
      
      const primaryImage = image || (imagesArray.length > 0 ? imagesArray[0] : existingProduct.image);
      
      if (imagesArray.length === 0) {
        return res.status(400).send({ message: "At least one product image is required" });
      }
      
      updates.images = imagesArray;
      updates.image = primaryImage;
    }

    const updatedProduct = await Products.findByIdAndUpdate(
      productId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.status(200).send({
      message: "Product updated successfully",
      product: updatedProduct
    });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).send({ message: "Failed to update product" });
  }
});

// DELETE PRODUCT
router.delete("/:id", async (req, res) => {
  try {
    const productId = req.params.id;

    const deletedProduct = await Products.findByIdAndDelete(productId);
    if (!deletedProduct) {
      return res.status(404).send({ message: "Product not found" });
    }

    await Reviews.deleteMany({ productId });

    res.status(200).send({
      message: "Product and associated reviews deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).send({ message: "Failed to delete product" });
  }
});

// RELATED PRODUCTS
router.get("/related/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Products.findById(id);
    if (!product) {
      return res.status(404).send({ message: "Product not found" });
    }

    const words = product.name
      .split(" ")
      .filter((word) => word.length > 1)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

    const orConditions = [];
    if (words.length > 0) {
      orConditions.push({ name: { $regex: new RegExp(words.join("|"), "i") } });
    }

    const allCats = product.categories?.length ? product.categories : [product.category];
    orConditions.push({ category: { $in: allCats } });
    orConditions.push({ categories: { $in: allCats } });

    const relatedProducts = await Products.find({
      _id: { $ne: id },
      $or: orConditions
    }).limit(12);

    res.status(200).send(relatedProducts);
  } catch (error) {
    console.error("Error fetching related products:", error);
    res.status(500).send({ message: "Failed to fetch related products" });
  }
});

module.exports = router;