// products.route.js
const express = require("express");
const Products = require("./products.model");
const Reviews = require("../reviews/reviews.model");
const router = express.Router();

/* ------------------------------------------------------------------
   Normalisers
   These accept whatever shape the client sends — a real array, a JSON
   string ("[\"a\",\"b\"]"), a comma list ("a,b"), or a bare string —
   and always return a clean, de-duplicated array. This is what stops
   a multi-select silently collapsing to one value.
-------------------------------------------------------------------*/

const toArray = (value) => {
  if (value === undefined || value === null) return [];

  if (Array.isArray(value)) {
    return [...new Set(value.map((v) => String(v).trim()).filter(Boolean))];
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    // JSON-encoded array, e.g. sent through multipart/form-data
    if (trimmed.startsWith("[")) {
      try {
        return toArray(JSON.parse(trimmed));
      } catch {
        /* fall through to comma split */
      }
    }
    return toArray(trimmed.split(","));
  }

  return [];
};

// Returns { categories, category } with the primary guaranteed to be
// present in the array and listed first.
const normalizeCategories = (categories, category) => {
  const list = toArray(categories);
  const primary = (typeof category === "string" && category.trim()) || list[0] || null;

  if (!primary) return { categories: [], category: null };

  const ordered = [primary, ...list.filter((c) => c !== primary)];
  return { categories: [...new Set(ordered)], category: primary };
};

// Returns { images, image } with image mirroring images[0].
const normalizeImages = (images, image) => {
  const list = toArray(images);
  const merged = image && !list.includes(image) ? [image, ...list] : list;
  return { images: merged, image: merged[0] || null };
};

/* ------------------------------------------------------------------
   Create
-------------------------------------------------------------------*/

router.post("/create-product", async (req, res) => {
  try {
    const { categories, category, images, image, ...rest } = req.body;

    const cats = normalizeCategories(categories, category);
    if (!cats.category) {
      return res.status(400).json({
        success: false,
        message: "At least one category is required"
      });
    }

    const imgs = normalizeImages(images, image);
    if (imgs.images.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one product image is required"
      });
    }

    const newProduct = new Products({
      ...rest,
      category: cats.category,
      categories: cats.categories,
      images: imgs.images,
      image: imgs.image
    });

    const savedProduct = await newProduct.save();

    // Average rating (a brand-new product has none, but harmless to keep)
    const reviews = await Reviews.find({ productId: savedProduct._id });
    if (reviews.length > 0) {
      const totalRating = reviews.reduce((acc, r) => acc + r.rating, 0);
      savedProduct.rating = totalRating / reviews.length;
      await savedProduct.save();
    }

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      product: savedProduct
    });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create product",
      error: error.message
    });
  }
});

/* ------------------------------------------------------------------
   List
-------------------------------------------------------------------*/

router.get("/", async (req, res) => {
  try {
    const { category, color, minPrice, maxPrice, page = 1, limit = 10 } = req.query;

    const filter = {};
    const conditions = [];

    // Accepts one category or several: ?category=A or ?category=A,B
    if (category && category !== "all") {
      const wanted = toArray(category);
      if (wanted.length > 0) {
        conditions.push({
          $or: [{ category: { $in: wanted } }, { categories: { $in: wanted } }]
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

    // $and keeps each filter independent — a second $or can't clobber the first
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

/* ------------------------------------------------------------------
   Single
-------------------------------------------------------------------*/

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

/* ------------------------------------------------------------------
   Update
-------------------------------------------------------------------*/

router.patch("/update-product/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    const { categories, category, images, image, ...rest } = req.body;

    const existingProduct = await Products.findById(productId);
    if (!existingProduct) {
      return res.status(404).send({ message: "Product not found" });
    }

    const updates = { ...rest };

    // Only touch categories if the client actually sent some
    if (categories !== undefined || category !== undefined) {
      const cats = normalizeCategories(
        categories !== undefined ? categories : existingProduct.categories,
        category !== undefined ? category : existingProduct.category
      );
      if (!cats.category) {
        return res.status(400).send({ message: "At least one category is required" });
      }
      updates.category = cats.category;
      updates.categories = cats.categories;
    }

    // Same for images — an explicit empty array is a valid "remove all"
    if (images !== undefined || image !== undefined) {
      const imgs = normalizeImages(
        images !== undefined ? images : existingProduct.images,
        image !== undefined ? image : existingProduct.image
      );
      if (imgs.images.length === 0) {
        return res.status(400).send({ message: "At least one product image is required" });
      }
      updates.images = imgs.images;
      updates.image = imgs.image;
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

/* ------------------------------------------------------------------
   Delete
-------------------------------------------------------------------*/

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

/* ------------------------------------------------------------------
   Related
-------------------------------------------------------------------*/

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
      // escape regex metacharacters so a product named "Silk (Ltd.)"
      // can't throw or match unintended documents
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

    const orConditions = [];
    if (words.length > 0) {
      orConditions.push({ name: { $regex: new RegExp(words.join("|"), "i") } });
    }

    // Match on every category the product belongs to, not just the primary
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