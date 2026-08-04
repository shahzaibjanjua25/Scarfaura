// products.route.js
const express = require("express");
const Products = require("./products.model");
const Reviews = require("../reviews/reviews.model");

const router = express.Router();

// Accepts an array, a comma-separated string, or a single value and
// always returns a clean array of non-empty strings.
const toArray = (value, fallbackSingular) => {
  let out = [];
  if (Array.isArray(value)) {
    out = value;
  } else if (typeof value === "string" && value.trim()) {
    out = value.split(",");
  } else if (fallbackSingular) {
    out = [fallbackSingular];
  }
  return out.map((v) => String(v).trim()).filter(Boolean);
};

// ============================================
// CREATE PRODUCT
// ============================================
router.post("/create-product", async (req, res) => {
  try {
    const { categories, category, images, image, ...rest } = req.body;

    const categoriesArray = toArray(categories, category);
    const imagesArray = toArray(images, image);

    if (categoriesArray.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "At least one category is required" });
    }
    if (imagesArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one product image is required",
      });
    }

    const newProduct = new Products({
      name: rest.name,
      description: rest.description,
      price: Number(rest.price),
      oldPrice:
        rest.oldPrice === undefined || rest.oldPrice === null || rest.oldPrice === ""
          ? null
          : Number(rest.oldPrice),
      color: rest.color || "",
      author: rest.author,
      categories: categoriesArray,
      category: category || categoriesArray[0],
      images: imagesArray,
      image: image || imagesArray[0],
    });

    const savedProduct = await newProduct.save();

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      product: savedProduct.toObject(),
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: Object.fromEntries(
          Object.entries(error.errors).map(([k, v]) => [k, v.message])
        ),
      });
    }
    console.error("Error creating product:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create product" });
  }
});

// ============================================
// GET ALL PRODUCTS
// ============================================
router.get("/", async (req, res) => {
  try {
    const {
      category,
      color,
      minPrice,
      maxPrice,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      order = "desc",
    } = req.query;

    const conditions = [];

    if (category && category !== "all") {
      const cats = toArray(category);
      if (cats.length > 0) {
        conditions.push({
          $or: [{ category: { $in: cats } }, { categories: { $in: cats } }],
        });
      }
    }

    if (color && color !== "all") conditions.push({ color });

    const min = parseFloat(minPrice);
    const max = parseFloat(maxPrice);
    const priceFilter = {};
    if (!isNaN(min)) priceFilter.$gte = min;
    if (!isNaN(max) && isFinite(max)) priceFilter.$lte = max;
    if (Object.keys(priceFilter).length > 0) conditions.push({ price: priceFilter });

    const filter = conditions.length > 0 ? { $and: conditions } : {};

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

    // Whitelist sort fields so a query param can't probe arbitrary paths.
    const allowedSort = ["createdAt", "price", "rating", "name"];
    const sortField = allowedSort.includes(sortBy) ? sortBy : "createdAt";
    const sortDir = order === "asc" ? 1 : -1;

    const [totalProducts, products] = await Promise.all([
      Products.countDocuments(filter),
      Products.find(filter)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .sort({ [sortField]: sortDir })
        .populate({
          path: "author",
          select: "username",
          options: { strictPopulate: false },
        })
        .lean(),
    ]);

    return res.status(200).json({
      products,
      totalPages: Math.ceil(totalProducts / limitNum),
      totalProducts,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({ message: "Failed to fetch products" });
  }
});

// ============================================
// RELATED PRODUCTS  (must be declared before "/:id")
// ============================================
router.get("/related/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Products.findById(id).lean();
    if (!product) return res.status(404).json({ message: "Product not found" });

    const words = String(product.name || "")
      .split(" ")
      .filter((w) => w.length > 1)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

    const orConditions = [];
    if (words.length > 0) {
      orConditions.push({ name: { $regex: new RegExp(words.join("|"), "i") } });
    }

    const allCats = product.categories?.length
      ? product.categories
      : [product.category].filter(Boolean);
    if (allCats.length > 0) {
      orConditions.push({ category: { $in: allCats } });
      orConditions.push({ categories: { $in: allCats } });
    }

    const query = orConditions.length > 0
      ? { _id: { $ne: id }, $or: orConditions }
      : { _id: { $ne: id } };

    const relatedProducts = await Products.find(query).limit(12).lean();
    return res.status(200).json(relatedProducts);
  } catch (error) {
    console.error("Error fetching related products:", error);
    return res.status(500).json({ message: "Failed to fetch related products" });
  }
});

// ============================================
// GET SINGLE PRODUCT
// ============================================
router.get("/:id", async (req, res) => {
  try {
    const productId = req.params.id;

    const product = await Products.findById(productId)
      .populate("author", "username")
      .lean();

    if (!product) return res.status(404).json({ message: "Product not found" });

    const reviews = await Reviews.find({ productId })
      .populate("userId", "username")
      .lean();

    return res.status(200).json({ product, reviews });
  } catch (error) {
    console.error("Error fetching product:", error);
    return res.status(500).json({ message: "Failed to fetch product" });
  }
});

// ============================================
// UPDATE PRODUCT
// ============================================
router.patch("/update-product/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    const { categories, category, images, image, author, ...rest } = req.body;

    const existingProduct = await Products.findById(productId);
    if (!existingProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Only allow these fields to be changed. `author` is deliberately
    // excluded so ownership can't be reassigned via the request body.
    const editable = ["name", "description", "price", "oldPrice", "color", "rating"];
    for (const key of editable) {
      if (rest[key] !== undefined) existingProduct[key] = rest[key];
    }

    if (categories !== undefined || category !== undefined) {
      const categoriesArray = toArray(categories, category);
      if (categoriesArray.length === 0) {
        return res
          .status(400)
          .json({ message: "At least one category is required" });
      }
      existingProduct.categories = categoriesArray;
      existingProduct.category = category || categoriesArray[0];
    }

    if (images !== undefined || image !== undefined) {
      const imagesArray = toArray(images, image);
      if (imagesArray.length === 0) {
        return res
          .status(400)
          .json({ message: "At least one product image is required" });
      }
      existingProduct.images = imagesArray;
      existingProduct.image = image || imagesArray[0];
    }

    // save() runs the pre('validate') hook; findByIdAndUpdate would not.
    const updatedProduct = await existingProduct.save();

    return res.status(200).json({
      message: "Product updated successfully",
      product: updatedProduct.toObject(),
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Validation failed",
        errors: Object.fromEntries(
          Object.entries(error.errors).map(([k, v]) => [k, v.message])
        ),
      });
    }
    console.error("Error updating product:", error);
    return res.status(500).json({ message: "Failed to update product" });
  }
});

// ============================================
// DELETE PRODUCT
// ============================================
router.delete("/:id", async (req, res) => {
  try {
    const productId = req.params.id;

    const deletedProduct = await Products.findByIdAndDelete(productId);
    if (!deletedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    await Reviews.deleteMany({ productId });

    return res.status(200).json({
      message: "Product and associated reviews deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    return res.status(500).json({ message: "Failed to delete product" });
  }
});

module.exports = router;