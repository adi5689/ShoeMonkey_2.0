Sure, here's a README file along with a sample `.env` file for your server code:

**README.md:**

# ShoeMonkey_2.0 Server

This is a backend server for an e-commerce application built using Node.js, Express.js, and MongoDB. It provides endpoints for user authentication, product management, cart management, order placement, and order retrieval.

## Setup

1. **Clone the repository:**

   ```
   git clone <repository_url>
   ```

2. **Install dependencies:**

   ```
   npm install
   ```

3. **Set up environment variables:**

   Create a `.env` file in the root directory of the project and add the following variables:

   ```
   PORT=4000
   MONGODB_URI=<Your_MongoDB_Connection_String>
   SESSION_SECRET=<Your_Session_Secret_Key>
   JWT_SECRET=<Your_JWT_Secret_Key>
   STRIPE_SECRET_KEY=<Your_Stripe_Secret_Key>
   FRONTEND_URL=<Your_Frontend_URL>
   ADMIN_URL=<Your_Admin_URL>
   ```

   - `PORT`: Port number for the server to listen on.
   - `MONGODB_URI`: MongoDB connection string.
   - `SESSION_SECRET`: Secret key for session management.
   - `JWT_SECRET`: Secret key for JSON Web Token (JWT) authentication.
   - `STRIPE_SECRET_KEY`: Secret key for Stripe API (for handling payments).
   - `FRONTEND_URL`: URL of the frontend application (for CORS configuration).
   - `ADMIN_URL`: URL of the admin interface (for CORS configuration).

4. **Start the server:**

   ```
   npm start
   ```

The server should now be running on the specified port, and you can start making requests to its endpoints.

## Endpoints

- **User Authentication:**
  - `/signup`: Register a new user.
  - `/login`: Log in an existing user.

- **Product Management:**
  - `/addproduct`: Add a new product.
  - `/removeproduct`: Remove a product.
  - `/allproducts`: Get all products.
  - `/product/:id`: Get a single product by ID.
  - `/editproduct/:id`: Edit a product.

- **Cart Management:**
  - `/addtocart`: Add a product to the cart.
  - `/removefromcart`: Remove a product from the cart.
  - `/cartdata`: Get all cart data.

- **Order Management:**
  - `/placeorder`: Place a new order.
  - `/orders/:orderId`: Get details of a specific order.

## Dependencies

- `express`: Web framework for Node.js.
- `mongoose`: MongoDB object modeling tool.
- `multer`: Middleware for handling `multipart/form-data`, used for file uploads.
- `jsonwebtoken`: For generating and verifying JSON Web Tokens (JWT).
- `cloudinary`: Cloud storage service for handling image uploads.
- `cors`: Middleware for enabling Cross-Origin Resource Sharing (CORS).
- `express-session`: Session middleware for Express.js.
- `cookie-parser`: Middleware for parsing cookies in Express.js.
