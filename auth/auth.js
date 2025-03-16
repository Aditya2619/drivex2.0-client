const express = require('express');
const router = express.Router();
const client = require('../db.js');

// Route to handle Google OAuth authentication
router.post('/google', async (req, res) => {
  try {
    const { 
      email, 
      name, 
      picture, 
      sub, // Google's user ID
      accessToken,
      tokenType,
      expiresIn
    } = req.body;

    // Check if user already exists
    const userCheck = await client.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (userCheck.rows.length > 0) {
      // User exists, update their information
      await client.query(
        "UPDATE users SET name = $1, picture = $2, google_id = $3, access_token = $4, token_type = $5, expires_in = $6, updated_at = NOW() WHERE email = $7",
        [name, picture, sub, accessToken, tokenType, expiresIn, email]
      );

      return res.status(200).json({
        success: true,
        message: "User updated successfully",
        user: userCheck.rows[0]
      });
    } else {
      // User doesn't exist, create new user
      const newUser = await client.query(
        "INSERT INTO users (name, email, picture, google_id, access_token, token_type, expires_in, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING *",
        [name, email, picture, sub, accessToken, tokenType, expiresIn]
      );

      return res.status(201).json({
        success: true,
        message: "User created successfully",
        user: newUser.rows[0]
      });
    }
  } catch (error) {
    console.error("Error in Google authentication:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during authentication",
      error: error.message
    });
  }
});

module.exports = router;