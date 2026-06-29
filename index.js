const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const axios = require('axios');
const Stripe = require('stripe');

dotenv.config();
const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[SERVER LOG] Incoming Request: ${req.method} ${req.url}`);
  next();
});

app.get('/', (req, res) => {
  res.send('hi ahsan labib ramin,the legalease serverside is running well');
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'), false);
    }
  }
});

mongoose.connect(process.env.MONGODB_URI, {
  dbName: process.env.DB_NAME
}).then(() => {
  console.log('MongoDB connected');
  seedAdmin();
}).catch((err) => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});