const express = require("express");
const cors = require('cors');
const auth = require("./auth/auth");
const fileRoutes = require("./routes/files/fileRoutes");
const path = require("path");

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['https://main.dlronecmuj8qf.amplifyapp.com', 'https://drivex2-0-server.onrender.com'],
  credentials: true
}));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use("/api/auth", auth);
app.use("/api/files", fileRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("Google Drive Clone API is running!");
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
