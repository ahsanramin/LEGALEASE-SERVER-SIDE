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

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  role: { type: String, enum: ['user', 'lawyer', 'admin'], default: 'user' },
  profilePic: { type: String, default: '' },
  shortlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lawyer' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const lawyerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  bio: { type: String, required: true },
  specialization: { type: String, required: true },
  fee: { type: Number, required: true },
  image: { type: String, required: true },
  experience: { type: String, default: '' },
  location: { type: String, default: '' },
  isPublished: { type: Boolean, default: false },
  isBusy: { type: Boolean, default: false },
  stripePaymentId: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const hiringSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lawyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lawyer', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  paymentStatus: { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
  amount: { type: Number, required: true },
  hiringDate: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const commentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lawyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lawyer', required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.