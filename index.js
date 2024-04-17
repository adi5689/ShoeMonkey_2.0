require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const jwt = require("jsonwebtoken");
const path = require("path");
const cors = require("cors");
const connectDB = require("./config/mongobd");
const cloudinary = require("./config/cloudinary");
const { resourceLimits } = require("worker_threads");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 4000;
const sessionSecret = process.env.SESSION_SECRET;


const allowedOrigins = [process.env.FRONTEND_URL, process.env.ADMIN_URL];
const corsOptions = {
  origin: function (origin, callback) {
     if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
       callback(null, true);
     } else {
       callback(new Error('Not allowed by CORS'));
     }
  },
 };

app.use(cookieParser());
app.use(express.json());
app.use(cors(corsOptions));


app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// Database connection with MongoDB
connectDB();

// Image upload config for in-memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Schema for creating products
const ProductSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  images: {
    type: [String],
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  new_price: {
    type: String,
    required: true,
  },
  old_price: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  available: {
    type: Boolean,
    default: true,
  },
  sizes: {
    type: [String],
    default: [],
  },
});
const Product = mongoose.model("Product", ProductSchema);

// Endpoint to add a product with images
app.post("/addproduct", upload.array("images"), async (req, res) => {
  try {
    console.log("Starting product upload...");

    // Validate form data
    const {
      name,
      category,
      new_price,
      old_price,
      description,
      sizes,
      available,
    } = req.body;
    if (
      !name ||
      !category ||
      !new_price ||
      !old_price ||
      !description ||
      !sizes
    ) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Map through the array of files and create an array of URLs
    const imageUrls = await Promise.all(
      req.files.map(async (file) => {
        console.log("Uploading file:", file.originalname);

        // Use upload_stream for uploading the file Buffer directly
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              resource_type: "auto",
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result.secure_url);
            }
          );
          stream.end(file.buffer);
        });
      })
    );

    console.log("Collected image URLs:", imageUrls); // Log the imageUrls array to check its contents

    const sizesArray = sizes.split(",").map((size) => size.trim());

    // Create a new product with the collected image URLs
    let products = await Product.find({});
    let id;
    if (products.length > 0) {
      let last_product_array = products.slice(-1);
      let last_product = last_product_array[0];
      id = last_product.id + 1;
    } else {
      id = 1;
    }

    const product = new Product({
      id: id,
      name: name,
      images: imageUrls, // Use the imageUrls array here
      category: category,
      new_price: new_price,
      old_price: old_price,
      sizes: sizesArray,
      description: description,
      available: available,
    });

    // Save the product to MongoDB
    console.log("Saving product to MongoDB...");
    console.log(product);
    await product
      .save()
      .catch((error) =>
        console.error("Error saving product to MongoDB:", error)
      );
    console.log("Product saved");
    res.json({
      success: true,
      name: name,
    });
  } catch (err) {
    console.error("Error in request handler:", err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to remove a product
app.post("/removeproduct", async (req, res) => {
  try {
    const product = await Product.findOne({ id: req.body.id });
    if (!product) {
      return res.status(404).json({ error: "Product not found!" });
    }

    // Delete images from Cloudinary
    console.log("Deleting images from Cloudinary...");
    const deletionPromises = product.images.map(async (imageUrl) => {
      // Extract public Id from the URL
      const publicId = imageUrl.substring(
        imageUrl.lastIndexOf("/") + 1,
        imageUrl.lastIndexOf(".")
      );
      try {
        await cloudinary.uploader.destroy(publicId);
        console.log(`Image with publicId ${publicId} deleted from cloudinary.`);
      } catch (err) {
        console.error(
          `Error deleting image with publicId ${publicId} from Cloudinary:`,
          err
        );
        throw err; // Throw the error to be caught by the catch block
      }
    });

    // Wait for all image deletion promises to resolve
    await Promise.all(deletionPromises);
    console.log("Images deletion process completed.");

    // Delete the product from MongoDB
    console.log("Removing product from MongoDB...");
    await Product.findOneAndDelete({ id: req.body.id });
    console.log("Product removed!");

    res.json({
      success: true,
      name: product.name,
    });
  } catch (err) {
    console.error("Error removing product:", err);
    res.status(500).json({ error: "Error removing product" });
  }
});

// Endpoint to get all products
app.get("/allproducts", async (req, res) => {
  try {
    let products = await Product.find({});
    console.log("All products fetched!");
    res.json(products);
  } catch (err) {
    console.error("Error fetching Products:", err);
    res.status(500).json({ error: "Error fetching products" });
  }
});

//fetch single product data
app.get("/product/:id", async (req, res) => {
  try {
    const customId = req.params.id;
    console.log(`Fetching product with custom ID: ${customId}`);

    // Find the product by custom ID
    const product = await Product.findOne({ id: parseInt(customId) });
    if (!product) {
      return res.status(404).json({ error: "Product not found!" });
    }

    console.log("Product fetched successfully!");
    res.json(product);
  } catch (err) {
    console.error("Error fetching product:", err);
    res.status(500).json({ error: "Error fetching product" });
  }
});

//Endpoint to edit a product data
app.put("/editproduct/:id", upload.array("images"), async (req, res) => {
  try {
    console.log("Starting product Edit....");

    // Validate form data
    const {
      name,
      category,
      new_price,
      old_price,
      description,
      sizes,
      available,
    } = req.body;
    if (
      !name ||
      !category ||
      !new_price ||
      !old_price ||
      !description ||
      !sizes
    ) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Find the product by ID
    const productId = req.params.id;
    console.log(`Fetching product with custom ID: ${productId}`);

    // Find the product by ID
    const product = await Product.findOne({ id: parseInt(productId) });
    if (!product) {
      return res.status(404).json({ error: "Product not found!" });
    }

    // If images are being updated, delete old images from Cloudinary
    if (req.files && req.files.length > 0) {
      console.log("Deleting old images from Cloudinary....");
      const deletionPromises = product.images.map(async (imageUrl) => {
        // Extract public Id from the URL
        const publicId = imageUrl.substring(
          imageUrl.lastIndexOf("/") + 1,
          imageUrl.lastIndexOf(".")
        );
        try {
          await cloudinary.uploader.destroy(publicId);
          console.log(
            `Image with publicId ${publicId} deleted from cloudinary.`
          );
        } catch (err) {
          console.error(
            `Error deleting image with publicId ${publicId} from Cloudinary:`,
            err
          );
        }
      });

      await Promise.all(deletionPromises);
      console.log("Old images deleted from Cloudinary!");
    }

    // Update the product with new data
    product.name = name;
    product.category = category;
    product.new_price = new_price;
    product.old_price = old_price;
    product.description = description;
    product.sizes = sizes.split(",").map((size) => size.trim());
    product.available = available;

    // If images are being updated, handle the file uploads
    if (req.files && req.files.length > 0) {
      console.log("Updating Images...");

      // Map through the array of files and create an array of URLs
      const imageUrls = await Promise.all(
        req.files.map(async (file) => {
          console.log("Uploading file:", file.originalname);

          // Use upload_stream for uploading the file buffer directly
          return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              {
                resource_type: "auto",
              },
              (error, result) => {
                if (error) reject(error);
                else resolve(result.secure_url);
              }
            );
            stream.end(file.buffer);
          });
        })
      );

      console.log("Collected image URLs:", imageUrls);

      product.images = imageUrls;
    }

    console.log("Saving updated product to MongoDB...");
    await product.save();
    console.log("Product updated!");

    res.json({
      success: true,
      name: name,
    });
  } catch (err) {
    console.error("Error in request handler:", err);
    res.status(500).json({ error: err.message });
  }
});

// Schema for USER
const User = mongoose.model("User", {
  name: {
    type: String,
  },
  email: {
    type: String,
    unique: true,
  },
  password: {
    type: String,
  },
  cart: [
    {
      productId: Number,
      name: String,
      price: String,
      quantity: Number,
      size: String,
      images: [String],
    },
  ],
  date: {
    type: Date,
    default: Date.now,
  },
});

// Creating endpoint for registering user
app.post("/signup", async (req, res) => {
  let check = await User.findOne({ email: req.body.email });
  if (check) {
    return res
      .status(400)
      .json({ success: false, errors: "Email is already registered." });
  }

  let cart = {};
  for (let i = 0; i < 300; i++) {
    cart[i] = 0;
  }

  const user = new User({
    name: req.body.username,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  });
  await user.save();

  const data = {
    user: {
      id: user.id,
    },
  };

  const token = jwt.sign(data, process.env.JWT_SECRET);
  res.json({ success: true, token });
});

// Creating endpoint for user login
app.post("/login", async (req, res) => {
  let user = await User.findOne({ email: req.body.email });
  if (user) {
    const passwordMatch = req.body.password === user.password;
    if (passwordMatch) {
      const data = {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
        },
      };
      const token = jwt.sign(data, process.env.JWT_SECRET);
      res.cookie("token", token, {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      });
      res.json({ success: true, token, email: user.email, name: user.name });
    } else {
      res.json({ success: false, errors: "Wrong Password!" });
    }
  } else {
    res.json({ success: false, errors: "Wrong email or password!" });
  }
});

const authenticateToken = (req, res, next) => {
  // Extract the token from the Authorization header
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Assuming the format is 'Bearer <token>'

  if (token == null) return res.sendStatus(401); // If no token is provided, return 401 Unauthorized

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error(err); // Log the error for debugging purposes
      return res.sendStatus(403); // If token is invalid, return 403 Forbidden
    }
    req.user = user;
    next(); // Proceed to the next middleware or route handler
  });
};

//Endpoint to add products in cartdata
app.post("/addtocart", authenticateToken, async (req, res) => {
  try {
    //extract user id and product details from the request header
    const { email, productId, quantity, size } = req.body;
    console.log(req.body);

    //find user by id
    const user = await User.findOne({ email: email });
    if (!user) {
      return res.status(404).json({ error: "User not found!" });
    }

    const product = await Product.findOne({ id: productId });
    if (!product) {
      return res.status(404).json({ error: "Product not found!" });
    }

    //check if product already in cart
    const existingProductIndex = user.cart.findIndex(
      (item) => item.productId === productId
    );
    if (existingProductIndex !== -1) {
      user.cart[existingProductIndex].quantity += quantity;
    } else {
      user.cart.push({
        productId: product.id,
        name: product.name,
        price: product.new_price,
        quantity: quantity,
        size: size,
        images: product.images,
      });
    }

    await user.save();

    res.json({
      success: true,
      message: "Product added to cart successfully!",
    });
  } catch (err) {
    console.error("Error adding product to cart:", err);
    res.status(500).json({ error: "Error adding product to cart." });
  }
});

//endpoint for remove products from cart
app.post("/removefromcart", authenticateToken, async (req, res) => {
    try {
       // Extract user email and product details from the request body
       const { email, productId } = req.body;
   
       // Find user by email
       const user = await User.findOne({ email: email });
       if (!user) {
         return res.status(404).json({ error: "User not found!" });
       }
   
       // Find product in user's cart
       const productIndex = user.cart.findIndex(
         (item) => item.productId === productId
       );
       if (productIndex === -1) {
         return res.status(404).json({ error: "Product not found in cart!" });
       }
   
       // Check if the quantity is greater than one
       if (user.cart[productIndex].quantity > 1) {
         // If quantity is greater than one, decrement the quantity by one
         user.cart[productIndex].quantity -= 1;
       } else {
         // If quantity is one, remove the product from the cart
         user.cart.splice(productIndex, 1);
       }
   
       // Save the updated user information
       await user.save();
   
       res.json({
         success: true,
         message: "Product removed from cart successfully!",
       });
    } catch (err) {
       console.error("Error removing product from cart:", err);
       res.status(500).json({ error: "Error removing product from cart!" });
    }
   });
   

//Endpoint for getting all the cart data
app.get("/cartdata", authenticateToken, async (req, res) => {
  try {
    const {user:{email}} = req.user;
    console.log("Attempting to find user with email:", email);
    const user = await User.findOne({ email: email });
    console.log("User found:", user);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user.cart);
  } catch (err) {
    console.error("Error fetching cart Data", err);
    res.status(500).json({ error: "Error fetching cart data." });
  }
});

const OrderSchema = new mongoose.Schema({
 userEmail: {
    type: String,
    required: true,
 },
 name: { 
  type: String,
  required: true,
},
 products: [
    {
      productId: Number,
      name: String,
      price: String,
      quantity: Number,
      size: String,
      images: [String],
    },
 ],
 address: {
    street: String,
    pincode: String,
    city: String,
    state: String,
    phoneNumber: String,
 },
 totalValue: {
    type: Number,
    required: true,
 },
 date: {
    type: Date,
    default: Date.now,
 },
});

const Order = mongoose.model("Order", OrderSchema);
module.exports = Order;


app.post("/placeorder", authenticateToken, async (req, res) => {
  try {
     const { email, address, totalValue } = req.body;
 
     // Find the user by email
     const user = await User.findOne({ email: email });
     if (!user) {
       return res.status(404).json({ error: "User not found!" });
     }
 
     // Create a new order
     const order = new Order({
       userEmail: email,
       name: user.name,
       products: user.cart,
       address: address,
       totalValue: totalValue,
     });
 
     // Save the order
     await order.save();
 
     // Clear the user's cart
     user.cart = [];
     await user.save();
 
     // Respond with success message
     res.json({
       success: true,
       message: "Order placed successfully!",
       orderId: order._id,
     });
  } catch (err) {
     console.error("Error placing order:", err);
     res.status(500).json({ error: "Error placing order." });
  }
 });
 
 app.get('/orders/:orderId', authenticateToken, async (req, res) => {
  try {
     const { orderId } = req.params;
 
     // Find the order by ID
     const order = await Order.findById(orderId);
     if (!order) {
       return res.status(404).json({ error: "Order not found!" });
     }
 
     // Prepare the order data for the response
     const orderData = {
       orderId: order._id, 
       totalAmount: order.totalValue,
       username: order.name,
       items: order.products.map(product => ({
         name: product.name,
         quantity: product.quantity,
         price: product.price,
         size: product.size,
         images: product.images,
       })),
       address: order.address,
     };
 
     res.json(orderData);
  } catch (err) {
     console.error("Error fetching order:", err);
     res.status(500).json({ error: "Error fetching order." });
  }
 });
 



const PORT = process.env.PORT || 4001; 
app.listen(PORT, () => {
 console.log(`Server running on port ${PORT}`);
});

