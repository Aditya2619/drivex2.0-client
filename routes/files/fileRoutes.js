const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const client = require('../../db');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Create unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // List of accepted MIME types
  const acceptedTypes = [
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 
    // Videos
    'video/mp4', 'video/webm', 
  ];
  
  if (acceptedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and videos are accepted.'), false);
  }
};

// Initialize multer upload
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Middleware to verify user is authenticated
const verifyUser = (req, res, next) => {
  const userId = req.body.userId || req.query.userId;
  
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }
  
  // You can add more authentication checks here if needed
  
  next();
};

// Route to upload a file
router.post('/upload', (req, res) => {
  upload.single('file')(req, res, function (err) {
    if (err) {
      console.error('Multer error:', err);
      // Check if it's a file type error
      if (err.message.includes('file type')) {
        return res.status(400).json({ error: err.message });
      }
      // Other multer errors
      return res.status(500).json({ error: 'File upload failed' });
    }
    
    // Continue with the upload process
    handleFileUpload(req, res);
  });
});

// Function to handle the file upload after multer processing
const handleFileUpload = async (req, res) => {
  try {
    console.log('File upload request received');
    console.log('Request body:', req.body);
    console.log('File:', req.file ? {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      filename: req.file.filename
    } : 'No file');

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.body.userId;
    console.log('User ID from request:', userId);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { originalname, mimetype, size, filename } = req.file;
    const filePath = path.join('uploads', filename);

    // Insert file info into database
    console.log('Inserting file into database with user ID:', userId);
    const result = await client.query(
      `INSERT INTO files (
        user_id, file_name, file_type, file_size, file_path, 
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING *`,
      [userId, originalname, mimetype, size, filePath]
    );

    console.log('File inserted successfully:', result.rows[0]);
    res.status(201).json({
      message: 'File uploaded successfully',
      file: result.rows[0]
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
};

// Route to get all files for a user
router.get('/', async (req, res) => {
  try {
    console.log('Get files request received');
    console.log('Query parameters:', req.query);
    
    const { userId } = req.query;
    console.log('User ID from request:', userId);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    console.log('Fetching files for user ID:', userId);
    const result = await client.query(
      `SELECT * FROM files 
       WHERE user_id = $1 AND is_trashed = false
       ORDER BY created_at DESC`,
      [userId]
    );

    console.log(`Found ${result.rows.length} files for user ID ${userId}`);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Route to delete a file
router.delete('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { userId } = req.query;
    
    console.log(`Delete request for file ID: ${fileId} by user ID: ${userId}`);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // First, get the file to check ownership and get the file path
    const fileCheck = await client.query(
      `SELECT * FROM files WHERE id = $1 AND user_id = $2`,
      [fileId, userId]
    );
    
    if (fileCheck.rows.length === 0) {
      return res.status(404).json({ error: 'File not found or not authorized' });
    }
    
    const filePath = path.join(__dirname, '../../', fileCheck.rows[0].file_path);
    
    // Delete the file from the database
    await client.query(
      `DELETE FROM files WHERE id = $1 AND user_id = $2`,
      [fileId, userId]
    );
    
    // Delete the file from the filesystem
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`File deleted from filesystem: ${filePath}`);
      }
    } catch (fsError) {
      console.error('Error deleting file from filesystem:', fsError);
      // Continue even if file deletion fails
    }
    
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Route to update file name
router.patch('/:fileId/rename', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { userId, newFileName } = req.body;
    
    console.log(`Rename request for file ID: ${fileId} by user ID: ${userId} to: ${newFileName}`);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    if (!newFileName || newFileName.trim() === '') {
      return res.status(400).json({ error: 'New file name is required' });
    }
    
    // Check if the file exists and belongs to the user
    const fileCheck = await client.query(
      `SELECT * FROM files WHERE id = $1 AND user_id = $2`,
      [fileId, userId]
    );
    
    if (fileCheck.rows.length === 0) {
      return res.status(404).json({ error: 'File not found or not authorized' });
    }
    
    // Update the file name
    const result = await client.query(
      `UPDATE files SET file_name = $1, updated_at = NOW() WHERE id = $2 AND user_id = $3 RETURNING *`,
      [newFileName, fileId, userId]
    );
    
    res.json({
      message: 'File renamed successfully',
      file: result.rows[0]
    });
  } catch (error) {
    console.error('Error renaming file:', error);
    res.status(500).json({ error: 'Failed to rename file' });
  }
});

// Route to get file preview/details
router.get('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const { userId } = req.query;
    
    console.log(`Preview request for file ID: ${fileId} by user ID: ${userId}`);
    
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    // Get the file details
    const result = await client.query(
      `SELECT * FROM files WHERE id = $1 AND user_id = $2`,
      [fileId, userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found or not authorized' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error getting file details:', error);
    res.status(500).json({ error: 'Failed to get file details' });
  }
});

module.exports = router; 