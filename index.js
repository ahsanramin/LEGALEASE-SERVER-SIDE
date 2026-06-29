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
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lawyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lawyer', required: true },
  hiringId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hiring' },
  amount: { type: Number, required: true },
  transactionId: { type: String, required: true },
  type: { type: String, enum: ['publishing', 'hiring'], default: 'hiring' },
  status: { type: String, default: 'success' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Lawyer = mongoose.model('Lawyer', lawyerSchema);
const Hiring = mongoose.model('Hiring', hiringSchema);
const Comment = mongoose.model('Comment', commentSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);

async function seedAdmin() {
  try {
    const adminEmail = 'admin@gmail.com';
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin@1234', 10);
      await User.create({
        name: 'ahsan labib ramin',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        profilePic: 'https://ui-avatars.com/api/?name=Ahsan+Labib&background=random'
      });
      console.log('Default admin created successfully');
    } else {
      console.log('Default admin already exists');
    }
  } catch (error) {
    console.error('Admin seeding error:', error);
  }
}

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const checkRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access forbidden for this role' });
    }
    next();
  };
};

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || 'user',
      profilePic: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
    });
    const token = jwt.sign({ id: newUser._id, role: newUser.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, profilePic: user.profilePic } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { email, name, picture } = req.body;
    let user = await User.findOne({ email });
    if (!user) {
      const randomPassword = Math.random().toString(36).slice(-8);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      user = await User.create({
        name,
        email,
        password: hashedPassword,
        role: 'user',
        profilePic: picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
      });
    }
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, profilePic: user.profilePic } });
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(500).json({ message: 'Google authentication failed' });
  }
});

app.get('/api/auth/me', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch('/api/users/profile', verifyToken, async (req, res) => {
  try {
    const { name, profilePic } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { name, profilePic, updatedAt: Date.now() },
      { new: true }
    ).select('-password');
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ user: updatedUser });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: error.message });
  }
  });

app.get('/api/users/shortlist', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('shortlist');
    res.status(200).json(user.shortlist || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/users/shortlist/check/:lawyerId', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const isShortlisted = user.shortlist.some(id => id.toString() === req.params.lawyerId);
    res.status(200).json({ isShortlisted });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/users/shortlist/:lawyerId', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.shortlist.includes(req.params.lawyerId)) {
      user.shortlist.push(req.params.lawyerId);
      await user.save();
    }
    res.status(200).json({ message: 'Added to shortlist' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/users/shortlist/:lawyerId', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.shortlist = user.shortlist.filter(id => id.toString() !== req.params.lawyerId);
    await user.save();
    res.status(200).json({ message: 'Removed from shortlist' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/upload', verifyToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        message: 'No image file provided' });
    }
    const imageBuffer = req.file.buffer;
    const base64Image = imageBuffer.toString('base64');
    const imgbbUrl = `https://api.imgbb.com/1/upload?key=${process.env.NEXT_PUBLIC_IMAGE_UPLOAD_API}`;
    const formData = new FormData();
    formData.append('image', base64Image);
    const response = await axios.post(imgbbUrl, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    res.status(200).json({ url: response.data.data.url });
  } catch (error) {
    res.status(500).json({ message: 'Image upload failed' });
  }
});

app.get('/api/lawyers', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const minFee = parseFloat(req.query.minFee) || 0;
    const maxFee = parseFloat(req.query.maxFee) || 1000000;
    const availability = req.query.availability;
    const query = { isPublished: true };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } }
      ];
    }
    query.fee = { $gte: minFee, $lte: maxFee };
    if (availability === 'true') query.isBusy = false;
    if (availability === 'false') query.isBusy = true;
    const total = await Lawyer.countDocuments(query);
    const lawyers = await Lawyer.find(query)
      .populate('userId', 'name email profilePic')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    res.status(200).json({
      lawyers,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
app.get('/api/lawyers/top', async (req, res) => {
  try {
    const topLawyers = await Hiring.aggregate([
      { $group: { _id: '$lawyerId', hireCount: { $sum: 1 } } },
      { $sort: { hireCount: -1 } },
      { $limit: 3 }
    ]);
    const lawyerIds = topLawyers.map(item => item._id);
    let lawyers = await Lawyer.find({ _id: { $in: lawyerIds } }).populate('userId', 'name email profilePic');
    lawyers = lawyers.map(lawyer => {
      const match = topLawyers.find(t => t._id.toString() === lawyer._id.toString());
      return {
        ...lawyer.toObject(),
        hireCount: match ? match.hireCount : 0
      };
    });
    res.status(200).json(lawyers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/lawyers/featured', async (req, res) => {
  try {
    const lawyers = await Lawyer.find({ isPublished: true })
      .populate('userId', 'name email profilePic')
      .sort({ createdAt: -1 })
      .limit(6);
    res.status(200).json(lawyers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/lawyers/:id', async (req, res) => {
  try {
    const lawyer = await Lawyer.findById(req.params.id).populate('userId', 'name email profilePic createdAt');
    if (!lawyer) {
      return res.status(404).json({ message: 'Lawyer not found' });
    }
    res.status(200).json(lawyer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/lawyers/me/profile', verifyToken, checkRole('lawyer'), async (req, res) => {
  try {
    const lawyer = await Lawyer.findOne({userId: req.user.id });
    if (!lawyer) {
      return res.status(404).json({ message: 'Lawyer profile not found' });
    }
    res.status(200).json(lawyer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/lawyers', verifyToken, checkRole('lawyer'), async (req, res) => {
  try {
    const { name, bio, specialization, fee, image, stripePaymentId, experience, location } = req.body;
    const existing = await Lawyer.findOne({ userId: req.user.id });
    if (existing) {
      return res.status(400).json({ message: 'Profile already exists' });
    }
    const lawyer = await Lawyer.create({
      userId: req.user.id,
      name,
      bio,
      specialization,
      fee: parseFloat(fee),
      image,
      experience,
      location,
      isPublished: true,
      stripePaymentId: stripePaymentId || ''
    });
    res.status(201).json(lawyer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.put('/api/lawyers/:id', verifyToken, checkRole('lawyer'), async (req, res) => {
  try {
    const { name, bio, specialization, fee, image, experience, location } = req.body;
    const lawyer = await Lawyer.findOne({ _id: req.params.id, userId: req.user.id });
    if (!lawyer) {
      return res.status(404).json({ message: 'Lawyer profile not found or unauthorized' });
    }
    lawyer.name = name || lawyer.name;
    lawyer.bio = bio || lawyer.bio;
    lawyer.specialization = specialization || lawyer.specialization;
    lawyer.fee = fee || lawyer.fee;
    lawyer.image = image || lawyer.image;
    lawyer.experience = experience !== undefined ? experience : lawyer.experience;
    lawyer.location = location !== undefined ? location : lawyer.location;
    lawyer.updatedAt = Date.now();
    await lawyer.save();
 res.status(200).json(lawyer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/lawyers/:id', verifyToken, checkRole('lawyer', 'admin'), async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.user.role === 'lawyer') {
      query.userId = req.user.id;
    }
    const result = await Lawyer.findOneAndDelete(query);
    if (!result) {
      return res.status(404).json({ message: 'Lawyer not found or unauthorized' });
    }
    res.status(200).json({ message: 'Lawyer profile deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch('/api/lawyers/:id/status', verifyToken, checkRole('lawyer', 'admin'), async (req, res) => {
  try {
    const { isPublished, isBusy } = req.body;
    const query = { _id: req.params.id };
    if (req.user.role === 'lawyer') {
      query.userId = req.user.id;
    }
    const lawyer = await Lawyer.findOne(query);
    if (!lawyer) {
      return res.status(404).json({ message: 'Lawyer not found' });
    }
    if (isPublished !== undefined) lawyer.isPublished = isPublished;
    if (isBusy !== undefined) lawyer.isBusy = isBusy;
    lawyer.updatedAt = Date.now();
    await lawyer.save();
    res.status(200).json(lawyer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/hiring', verifyToken, checkRole('user'), async (req, res) => {
  try {
    const { lawyerId, amount } = req.body;
    const existingHire = await Hiring.findOne({ userId: req.user.id, lawyerId, status: 'pending' });
    if (existingHire) {
      return res.status(400).json({ message: 'You already have a pending hire request with this lawyer' });
    }
    const hire = await Hiring.create({
      userId: req.user.id,
      lawyerId,
      amount: parseFloat(amount),
      status: 'pending',
      paymentStatus: 'unpaid'
    });
    res.status(201).json(hire);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/hiring/user', verifyToken, checkRole('user'), async (req, res) => {
  try {
    const hires = await Hiring.find({ userId: req.user.id })
      .populate('lawyerId', 'name specialization fee image')
      .sort({ createdAt: -1 });
    res.status(200).json(hires);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/hiring/lawyer', verifyToken, checkRole('lawyer'), async (req, res) => {
  try {
    const lawyer = await Lawyer.findOne({ userId: req.user.id });
    if (!lawyer) {
      return res.status(404).json({ message: 'Lawyer profile not found' });
    }
    const hires = await Hiring.find({ lawyerId: lawyer._id })
      .populate('userId', 'name email profilePic')
      .sort({ createdAt: -1 });
    res.status(200).json(hires);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch('/api/hiring/:id', verifyToken, checkRole('lawyer'), async (req, res) => {
  try {
    const { status } = req.body;
    const lawyer = await Lawyer.findOne({ userId: req.user.id });
    if (!lawyer) {
      return res.status(404).json({ message: 'Lawyer profile not found' });
    }
    const hire = await Hiring.findOne({ _id: req.params.id, lawyerId: lawyer._id });
    if (!hire) {
      return res.status(404).json({ message: 'Hiring request not found' });
    }
    if (status !== 'accepted' && status !== 'rejected') {
      return res.status(400).json({ message: 'Invalid status update' });
    }
    hire.status = status;
    hire.updatedAt = Date.now();
    await hire.save();
    res.status(200).json(hire);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/hiring/:id/pay', verifyToken, checkRole('user'), async (req, res) => {
  try {
    const hire = await Hiring.findOne({ _id: req.params.id, userId: req.user.id })
      .populate('lawyerId');
    if (!hire) {
      return res.status(404).json({ message: 'Hiring record not found' });
    }
    if (hire.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Already paid' });
    }
    const paymentIntent = await stripe.paymentIntents.create({
      amount: hire.amount * 100,
      currency: 'usd',
      metadata: {
        hiringId: hire._id.toString(),
        userId: req.user.id
      }
    });
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/payments/lawyer-publish', verifyToken, checkRole('lawyer'), async (req, res) => {
  try {
    const { amount } = req.body;
    const lawyer = await Lawyer.findOne({ userId: req.user.id });
    if (!lawyer) {
      return res.status(404).json({ message: 'Lawyer profile not found' });
    }
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: 'usd',
      metadata: {
        lawyerId: lawyer._id.toString(),
        userId: req.user.id
      }
      });
    res.status(200).json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('[PAYMENT ERROR]', error);
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/payments/confirm-publish', verifyToken, checkRole('lawyer'), async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status === 'succeeded') {
      const lawyer = await Lawyer.findOne({ userId: req.user.id });
      if (lawyer) {
        lawyer.isPublished = true;
        lawyer.stripePaymentId = paymentIntentId;
        await lawyer.save();
        await Transaction.create({
          userId: req.user.id,
          lawyerId: lawyer._id,
          amount: paymentIntent.amount / 100,
          transactionId: paymentIntentId,
          type: 'publishing'
        });
        console.log(`[DUMMY EMAIL] To: ${req.user.email} | Subject: Profile Published | Body: Your legal profile has been published successfully.`);
        return res.status(200).json({ message: 'Profile published successfully' });
      }
    }
    res.status(400).json({ message: 'Payment not successful' });
  } catch (error) {
    console.error('[CONFIRM PUBLISH ERROR]', error);
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/payments/confirm-hire', verifyToken, checkRole('user'), async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status === 'succeeded') {
      const hiringId = paymentIntent.metadata.hiringId;
      const hire = await Hiring.findById(hiringId);
      if (hire) {
        hire.paymentStatus = 'paid';
        hire.updatedAt = Date.now();
        await hire.save();
        await Transaction.create({
          userId: hire.userId,
          lawyerId: hire.lawyerId,
                    hiringId: hire._id,
          amount: hire.amount,
          transactionId: paymentIntentId,
          type: 'hiring'
        });
        const lawyer = await Lawyer.findById(hire.lawyerId);
        if (lawyer) {
          lawyer.isBusy = true;
          await lawyer.save();
        }
        console.log(`[DUMMY EMAIL] To: ${req.user.email} | Subject: Payment Successful | Body: Your payment of $${hire.amount} was successful.`);
        return res.status(200).json({ message: 'Payment confirmed and status updated' });
      }
    }
    res.status(400).json({ message: 'Payment not successful' });
  } catch (error) {
    console.error('[CONFIRM HIRE ERROR]', error);
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/comments', verifyToken, checkRole('user'), async (req, res) => {
  try {
    const { lawyerId, content } = req.body;
    const hasHired = await Hiring.findOne({ userId: req.user.id, lawyerId, paymentStatus: 'paid' });
    if (!hasHired) {
      return res.status(403).json({ message: 'You must hire this lawyer and make a payment to comment' });
    }
    const comment = await Comment.create({
      userId: req.user.id,
      lawyerId,
      content
    });
    const populatedComment = await comment.populate('userId', 'name profilePic');
    res.status(201).json(populatedComment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/comments/lawyer/:id', async (req, res) => {
  try {
    const comments = await Comment.find({ lawyerId: req.params.id })
      .populate('userId', 'name profilePic')
      .sort({ createdAt: -1 });
    res.status(200).json(comments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});