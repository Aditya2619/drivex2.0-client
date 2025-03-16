const { Client } = require("pg");
postgresql://neondb_owner:npg_W3QCiEhgoSR6@ep-silent-term-a5lm1nop-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
const client = new Client({
  user: "neondb_owner",
  password: "npg_W3QCiEhgoSR6",
  host: "ep-silent-term-a5lm1nop-pooler.us-east-2.aws.neon.tech",
  database: "temp",
  port: 5432,
  ssl: {
    rejectUnauthorized: false,
  },
});

client.connect(function (err) {
  if (err) throw err;
  console.log("🎉 Database Connected!");
});

// Create users table with Google OAuth fields
client.query(
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, 
    name VARCHAR(255), 
    email VARCHAR(255) UNIQUE, 
    password VARCHAR(255),
    picture VARCHAR(255),
    google_id VARCHAR(255),
    access_token TEXT,
    token_type VARCHAR(50),
    expires_in INTEGER,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
  )`,
  function (err, res) {
    if (err) throw err;
    console.log("🎉 Users table created or already exists!");
  }
);

// Create files table for Google Drive clone functionality
client.query(
  `CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    file_name VARCHAR(255),
    file_type VARCHAR(100),
    file_size BIGINT,
    file_path TEXT,
    parent_folder_id INTEGER,
    is_folder BOOLEAN DEFAULT false,
    is_starred BOOLEAN DEFAULT false,
    is_trashed BOOLEAN DEFAULT false,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
  )`,
  function (err, res) {
    if (err) throw err;
    console.log("🎉 Files table created or already exists!");
  }
);

// const router = express.Router();

// router.post("/auth/register", async (req, res) => {
//     const { name, email, password } = req.body;
  
//     const response = await client.query(
//       "INSERT INTO users (name, email, password) VALUES ($1, $2, $3)",
//       [name, email, password]
//     );
  
//     console.log(response);
  
//     res.send("✅ user registered successfully");
// });
  
// router.get("/u/:id", async (req, res) => {
// const { id } = req.params;
// const response = await client.query("SELECT * FROM users WHERE id = $1", [id]);
// res.send(response.rows);
// });

// router.delete("/db/drop/users", async (req, res) => {
// const response = await client.query("DROP TABLE users");
// res.send("🚨 users table dropped");
// });

module.exports = client;