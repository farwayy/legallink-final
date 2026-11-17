const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const fs   = require('fs');
const jwt  = require('jsonwebtoken');
const dotenv = require('dotenv');

// Explicitly load .env with absolute path BEFORE any application modules or routes
dotenv.config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/database');
const axios = require('axios');
const { Server } = require('socket.io');


// Import routes
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const caseRoutes = require('./routes/caseRoutes');
const userRoutes = require('./routes/userRoutes');
const lawyerRoutes = require('./routes/lawyerRoutes');
//const chatbotRoutes = require('./routes/chatbotRoutes');
const chatRoutes = require('./routes/chatRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const requestRoutes = require('./routes/requestRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const ngoRoutes = require('./routes/ngoRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const disputeRoutes = require('./routes/disputeRoutes');
const paymentRoutes = require('./routes/paymentRoutes');



// Import real-time manager (simplified version)
const RealTimeManager = require('./sockets/realtimeManager');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true
}));
// Keep the raw body too: Stripe webhooks need it to check their signature
app.use(express.json({
  verify: (req, _res, buf) => {
    if (req.originalUrl && req.originalUrl.startsWith('/api/payments/webhook')) req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Security: response headers, block MongoDB operators in requests, check the JWT secret
const { sanitizeInput, securityHeaders, checkJwtSecret } = require('./middleware/security');
checkJwtSecret();
app.disable('x-powered-by');
app.use(securityHeaders);
app.use(sanitizeInput);
// Ensure uploads directory and standard verification documents exist
const uploadsDir = path.resolve(__dirname, 'uploads');
try {
  const { ensureUploadsExist } = require('./scripts/seedUploads');
  ensureUploadsExist();
} catch (e) {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
}

// Uploaded files: profile photos are public; documents (CNIC, Bar Council,
// NGO registration, case evidence) only open through /api/files with a
// short-lived link for people allowed to see them.
const { guardUploads } = require('./services/fileAccess');
app.use('/uploads', guardUploads, express.static(uploadsDir));

// Fallback document provider for missing documents requested from /uploads/
app.get('/uploads/:filename', (req, res, next) => {
  const filename = path.basename(req.params.filename);
  const ext = path.extname(filename).toLowerCase();
  
  if (ext === '.pdf' || filename.includes('license') || filename.includes('bar') || filename.includes('doc')) {
    const samplePdf = path.resolve(uploadsDir, 'sample_bar_license.pdf');
    if (fs.existsSync(samplePdf)) {
      res.setHeader('Content-Type', 'application/pdf');
      return res.sendFile(samplePdf);
    }
  }
  
  if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext) || filename.includes('ngo') || filename.includes('cert')) {
    const sampleImg = path.resolve(uploadsDir, 'sample_ngo_certificate.jpg');
    if (fs.existsSync(sampleImg)) {
      res.setHeader('Content-Type', ext === '.png' ? 'image/png' : 'image/jpeg');
      return res.sendFile(sampleImg);
    }
  }
  
  next();
});

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
  }
});

// Global variable for realTimeManager
let realTimeManager;

// Connect to MongoDB and then initialize
const startServer = async () => {
  try {
    await connectDB();
    
    // Initialize Real-Time Manager after DB connection
    realTimeManager = new RealTimeManager(io);
    app.set('realTimeManager', realTimeManager);
    
    // Routes
    app.use('/api/auth', authRoutes);

    // Older case links point to /api/documents/<file>: same rules as /api/files.
    // Needs a sign-in token (header or ?token=) from someone allowed to see it.
    app.get('/api/documents/:filename', async (req, res) => {
      try {
        const { canOpen, sendLocal } = require('./services/fileAccess');
        const rawToken =
          (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null) || req.query.token;
        if (!rawToken) return res.status(401).json({ message: 'Sign in to open this document.' });
        let decoded;
        try {
          decoded = jwt.verify(rawToken, process.env.JWT_SECRET);
        } catch {
          return res.status(401).json({ message: 'Your sign-in has expired.' });
        }
        const filename = path.basename(req.params.filename);
        if (!(await canOpen(`/uploads/${filename}`, decoded))) {
          return res.status(403).json({ message: "You don't have access to this document." });
        }
        if (!sendLocal(res, filename)) return res.status(404).json({ message: 'Document not found.' });
      } catch (err) {
        console.error('Document serve error:', err);
        res.status(500).json({ message: 'Server error.' });
      }
    });
    app.use('/api/files', require('./routes/fileRoutes'));

    app.use('/api/admin', adminRoutes);
    app.use('/api/cases', caseRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/lawyer', lawyerRoutes);
    //app.use('/api/chatbot', chatbotRoutes);
    app.use('/api/chat', chatRoutes);
    app.use('/api/subscriptions', subscriptionRoutes);
    app.use('/api/requests', requestRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.use('/api/ngo', ngoRoutes);
    app.use('/api/reviews', reviewRoutes);
    app.use('/api/disputes', disputeRoutes);
    app.use('/api/payments', paymentRoutes);
    
    // Health check
    app.get('/api/health', (req, res) => {
      res.json({ status: 'OK', timestamp: new Date() });
    });
    
    // Error handling middleware
    // Turns upload problems into a clear message instead of "Something went wrong!"
    app.use((err, req, res, next) => {
      console.error(`\n❌ [${req.method} ${req.originalUrl}]`, err.stack || err);
      const msg = String((err && err.message) || '');

      // File too big / too many files (multer)
      if (err && err.name === 'MulterError') {
        const text = err.code === 'LIMIT_FILE_SIZE'
          ? 'One of your files is too large. Each file must be under 10 MB.'
          : `There was a problem with your files (${err.code}). Please choose them again.`;
        return res.status(400).json({ message: text });
      }
      // File type refused by our upload filter
      if (/unsupported file format|only .* (images|files|documents)/i.test(msg)) {
        return res.status(400).json({ message: msg });
      }
      // Cloudinary refused the file itself (e.g. a damaged or unusual image)
      if (/file format .* not allowed|invalid image file|unsupported .*format/i.test(msg)) {
        return res.status(400).json({
          message: "This file couldn't be read as a PDF, Word document or image. Please save it again as PDF, JPG or PNG and try once more.",
          error: msg
        });
      }
      // Cloudinary refused or couldn't be reached
      if ((err && (err.http_code || /cloudinary|api_key|api_secret|signature/i.test(msg)))) {
        return res.status(502).json({
          message: "We couldn't upload your files right now. Please try again in a minute.",
          error: msg
        });
      }
      res.status(500).json({ message: 'Something went wrong on our side. Please try again.', error: msg });
    });
    
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 http://localhost:${PORT}`);
      console.log(`🔌 WebSocket server ready`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = { getRealTimeManager: () => realTimeManager };