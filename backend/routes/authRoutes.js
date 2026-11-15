const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Lawyer = require('../models/Lawyer');
const Admin = require('../models/Admin');
const NGO = require('../models/NGO');
const { 
  sendVerificationCodes, 
  sendApprovalNotification, 
  sendRejectionNotification,
  sendLawyerUnderReviewNotification,
  sendUserWelcomeNotification,
  sendPasswordResetEmail
} = require('../services/verificationService');
const {
  getLawyerSignupUploader,
  uploadLegalDoc,
  getUploadedFileUrl
} = require('../services/cloudinaryService');

const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../utils/adminPermissions');
const { forgotPasswordLimiter } = require('../middleware/rateLimit');
const { loginLimiter, codeLimiter, signupLimiter, passwordProblem } = require('../middleware/security');
const router = express.Router();

// Generate JWT token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// ============ CAPTCHA STORAGE ============
const captchaStore = new Map();

// Generate CAPTCHA (returns text, not SVG for simplicity)
router.get('/captcha', (req, res) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let captchaText = '';
  for (let i = 0; i < 6; i++) {
    captchaText += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  const sessionId = req.headers['x-session-id'] || Date.now().toString();
  captchaStore.set(sessionId, {
    text: captchaText.toUpperCase(), // Store as UPPERCASE
    expires: Date.now() + 5 * 60 * 1000
  });
  
  console.log(`📝 CAPTCHA generated for ${sessionId}: ${captchaText}`); // Debug log
  
  res.json({ captcha: captchaText, sessionId: sessionId });
});

// Verify CAPTCHA
router.post('/verify-captcha', (req, res) => {
  const { sessionId, captcha } = req.body;
  const stored = captchaStore.get(sessionId);
  
  console.log(`🔍 Verifying CAPTCHA - Session: ${sessionId}`);
  console.log(`   User entered: ${captcha}`);
  console.log(`   Stored value: ${stored?.text}`);
  
  if (!stored) {
    console.log(`❌ No stored CAPTCHA found`);
    return res.json({ valid: false, message: 'CAPTCHA expired. Please refresh.' });
  }
  if (stored.expires < Date.now()) {
    captchaStore.delete(sessionId);
    console.log(`❌ CAPTCHA expired`);
    return res.json({ valid: false, message: 'CAPTCHA expired. Please refresh.' });
  }
  
  // Case-insensitive comparison
  const isValid = stored.text === captcha.toUpperCase();
  console.log(`✅ CAPTCHA valid: ${isValid}`);
  
  if (isValid) {
    captchaStore.delete(sessionId);
  }
  
  res.json({ valid: isValid });
});   

// ============ USER ROUTES ============

/**
 * POST /api/auth/user/send-otp
 * Sends a 6-digit email OTP to the citizen's email before signup.
 * Reuses the shared verificationStore and sendVerificationCodes utility.
 */
router.post('/user/send-otp', codeLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    // Prevent OTP spam for already-registered emails
    const already = await User.findOne({ email });
    if (already) {
      return res.status(409).json({ message: 'An account with this email already exists. Please log in instead.' });
    }

    const result = await sendVerificationCodes(email, null);
    
    // Store verification code immediately so verification works even if SMTP fails
    verificationStore.set(email, { 
      code: result.code, 
      expiresAt: result.expiresAt,
      expires: result.expiresAt 
    });

    if (!result.emailSent) {
      console.warn(`⚠️ [SMTP Notice] Email failed to deliver via Gmail (${result.error}). Development fallback code for ${email}: ${result.code}`);
    } else {
      console.log(`📧 Citizen OTP successfully sent via Gmail to ${email}`);
    }

    res.json({ 
      success: true, 
      message: result.emailSent 
        ? 'A 6-digit verification code has been sent to your email.' 
        : `Verification code generated. (Dev Mode Code: ${result.code})`,
      emailSent: result.emailSent,
      devCode: result.emailSent ? undefined : result.code
    });
  } catch (error) {
    console.error('user/send-otp error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// User Signup (OTP-gated)
router.post('/user/signup', signupLimiter, async (req, res) => {
  try {
    const { name, email, password, phone, cnic, address, verificationCode } = req.body;

    const pwProblem = passwordProblem(password);
    if (pwProblem) return res.status(400).json({ message: pwProblem });

    // ── OTP check ──────────────────────────────────────────────────────────
    if (!verificationCode) {
      return res.status(400).json({ message: 'Email verification code is required.' });
    }
    const storedCode = verificationStore.get(email);
    if (!storedCode) {
      return res.status(400).json({ message: 'No verification code found. Please request a new code.' });
    }
    if (storedCode.expiresAt && storedCode.expiresAt < Date.now()) {
      verificationStore.delete(email);
      return res.status(400).json({ message: 'Verification code expired. Please request a new code.' });
    }
    if (storedCode.code !== verificationCode) {
      return res.status(400).json({ message: 'Invalid verification code. Please check and try again.' });
    }
    console.log(`✅ Citizen OTP verified for ${email}`);
    // ───────────────────────────────────────────────────────────────────────

    const existingUser = await User.findOne({ $or: [{ email }, { cnic }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists with this email or CNIC' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = new User({ name, email, password: hashedPassword, phone, cnic, address });
    await user.save();
    
    verificationStore.delete(email);

    // Send welcome email
    sendUserWelcomeNotification({ email: user.email, name: user.name }).catch(err => {
      console.warn('User welcome email warning:', err.message);
    });

    const token = generateToken(user._id, 'user');
    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: user._id, name: user.name, email: user.email, role: 'user' }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});


// Check if email or phone already exists
router.post('/check-exists', async (req, res) => {
  try {
    const { email, phone } = req.body;
    const query = {};
    
    if (email) query.email = email;
    if (phone) query.phone = phone;
    
    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    
    if (existingUser) {
      return res.json({ 
        exists: true, 
        field: existingUser.email === email ? 'email' : 'phone',
        message: existingUser.email === email 
          ? 'This email is already registered. Please login instead.'
          : 'This phone number is already registered. Please login instead.'
      });
    }
    
    res.json({ exists: false });
  } catch (error) {
    console.error('Check exists error:', error);
    res.status(500).json({ exists: false, message: 'Server error' });
  }
});

// User Login
router.post('/user/login', loginLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim();
    const password = String(req.body.password || '');
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    if (!user.password) {
      return res.status(400).json({ message: 'This account signs in with Google. Use "Continue with Google".' });
    }

    // Check the password first, so the account's status is only shown to its owner
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated. Contact admin.' });
    }
    
    const token = generateToken(user._id, 'user');
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: 'user'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// ============ GOOGLE OAUTH 2.0 ============
/**
 * POST /api/auth/google
 * Authenticates or registers a user via Google OAuth 2.0 ID token credential.
 */
router.post('/google', async (req, res) => {
  try {
    const { credential, role = 'user' } = req.body;

    if (!credential) {
      return res.status(400).json({ 
        success: false, 
        message: 'Google ID token credential is required.' 
      });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.warn('⚠️ [Google OAuth] GOOGLE_CLIENT_ID is not configured in backend/.env');
    }

    const googleClient = new OAuth2Client(clientId);
    let payload = null;

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: clientId && !clientId.includes('your-google-client-id') ? clientId : undefined
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      console.error('❌ [Google OAuth] ID token verification failed:', verifyErr.message);
      return res.status(401).json({
        success: false,
        message: 'Google token verification failed: ' + verifyErr.message
      });
    }

    if (!payload || !payload.email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Unable to retrieve user email from Google credential payload.' 
      });
    }

    const { sub: googleId, email, name, picture } = payload;
    const normalizedEmail = email.toLowerCase().trim();

    // Check for existing user by googleId or email
    let user = await User.findOne({
      $or: [
        { googleId: googleId },
        { email: normalizedEmail }
      ]
    });

    if (user) {
      // Validate active status
      if (user.isActive === false) {
        return res.status(403).json({ 
          success: false, 
          message: 'Your account has been deactivated. Please contact administration.' 
        });
      }

      // Link googleId and sync profile photo if not yet present
      let changed = false;
      if (!user.googleId) {
        user.googleId = googleId;
        changed = true;
      }
      if (!user.photo && picture) {
        user.photo = picture;
        changed = true;
      }
      if (changed) {
        await user.save();
      }
      console.log(`🔑 [Google OAuth] User logged in: ${normalizedEmail} (ID: ${user._id})`);
    } else {
      // Create new Citizen User document
      user = new User({
        name: name || 'Google User',
        email: normalizedEmail,
        googleId: googleId,
        photo: picture || '',
        role: 'user',
        authProvider: 'google',
        isActive: true,
        phone: '',
        cnic: null,
        address: ''
      });
      await user.save();
      console.log(`✨ [Google OAuth] New citizen registered via Google: ${normalizedEmail} (ID: ${user._id})`);
    }

    // Issue standard LegalLink JWT token
    const token = generateToken(user._id, user.role || 'user');

    return res.json({
      success: true,
      message: 'Google sign-in successful',
      token,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role || 'user',
        photo: user.photo || picture || '',
        authProvider: user.authProvider || 'google'
      }
    });
  } catch (error) {
    console.error('❌ [Google OAuth Handler Error]:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error processing Google authentication: ' + error.message 
    });
  }
});

// ============ LAWYER ROUTES ============

// Temporary storage for verification codes (use a more robust storage)
const verificationStore = new Map();

// Send verification code
router.post('/send-verification', codeLimiter, async (req, res) => {
  try {
    const { phone, email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email address is required.' });
    }

    console.log(`📨 Sending verification to ${email} / ${phone}`);
    
    const result = await sendVerificationCodes(email, phone);

    // Store with expiry (both expiresAt and expires for compatibility)
    verificationStore.set(email, { 
      code: result.code, 
      expiresAt: result.expiresAt,
      expires: result.expiresAt 
    });

    if (!result.emailSent) {
      console.warn(`⚠️ [SMTP Notice] Email failed to deliver via Gmail (${result.error}). Development fallback code for ${email}: ${result.code}`);
    } else {
      console.log(`📝 Stored verification code for ${email}`);
    }
    
    return res.json({ 
      success: true, 
      message: result.emailSent 
        ? 'Verification code sent to your email.'
        : `Verification code generated. (Dev Mode Code: ${result.code})`,
      emailSent: result.emailSent,
      devCode: result.emailSent ? undefined : result.code
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to send verification code. Please try again later.' 
    });
  }
});

// Check a verification code straight away (advocate signup, "Verify" step).
// The code stays valid for the final signup; 5 wrong tries cancels it.
const MAX_CODE_ATTEMPTS = 5;
router.post('/verify-code', codeLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim();
    const code = String(req.body.code || '').trim();
    if (!email || !code) {
      return res.status(400).json({ message: 'Enter the 6-digit code from your email.' });
    }

    const stored = verificationStore.get(email);
    if (!stored) {
      return res.status(400).json({ message: 'No code found for this email. Press "Send code" to get one.' });
    }

    const expiry = stored.expiresAt || stored.expires;
    if (expiry && expiry < Date.now()) {
      verificationStore.delete(email);
      return res.status(400).json({ message: 'This code has expired. Press "Send code" to get a new one.' });
    }

    if (stored.code !== code) {
      stored.attempts = (stored.attempts || 0) + 1;
      if (stored.attempts >= MAX_CODE_ATTEMPTS) {
        verificationStore.delete(email);
        return res.status(400).json({ message: 'Too many wrong codes. Press "Send code" to get a new one.' });
      }
      const left = MAX_CODE_ATTEMPTS - stored.attempts;
      return res.status(400).json({ message: `That code isn't right. ${left} ${left === 1 ? 'try' : 'tries'} left.` });
    }

    stored.attempts = 0;
    res.json({ success: true, message: 'Email verified.' });
  } catch (error) {
    console.error('verify-code error:', error);
    res.status(500).json({ message: 'Could not check the code. Please try again.' });
  }
});

// Lawyer Signup with file uploads (Cloudinary or local fallback)
const lawyerSignupUpload = getLawyerSignupUploader();

router.post('/lawyer/signup', signupLimiter, lawyerSignupUpload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'officialDocument', maxCount: 1 }
]), async (req, res) => {
  try {
    const { 
      name, email, phone, cnic, password, barCouncilId, 
      stateOfPractice, experience, specialization, officeAddress, 
      languages, bio, verificationCode 
    } = req.body;

    const pwProblem = passwordProblem(password);
    if (pwProblem) return res.status(400).json({ message: pwProblem });
    
    console.log(`🔍 Verifying code for email: ${email}`);
    console.log(`   User entered code: ${verificationCode}`);
    
    // Verify code
    const storedCode = verificationStore.get(email);
    
    if (!storedCode) {
      console.log(`❌ No stored code found for ${email}`);
      return res.status(400).json({ message: 'No verification code found. Please request a new code.' });
    }
    
    const expiryTime = storedCode.expiresAt || storedCode.expires;
    console.log(`   Stored code: ${storedCode.code}`);
    console.log(`   Code expires: ${new Date(expiryTime)}`);
    
    if (expiryTime && expiryTime < Date.now()) {
      console.log(`❌ Code expired for ${email}`);
      verificationStore.delete(email);
      return res.status(400).json({ message: 'Verification code expired. Please request a new code.' });
    }
    
    if (storedCode.code !== verificationCode) {
      console.log(`❌ Code mismatch for ${email}`);
      return res.status(400).json({ message: 'Invalid verification code. Please check and try again.' });
    }
    
    console.log(`✅ Code verified for ${email}`);
    
    // Check if lawyer exists
    const existingLawyer = await Lawyer.findOne({ $or: [{ email }, { cnic }, { barCouncilId }] });
    if (existingLawyer) {
      return res.status(400).json({ message: 'Lawyer already exists' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Parse JSON fields
    const parsedStateOfPractice = JSON.parse(stateOfPractice);
    const parsedSpecialization = JSON.parse(specialization);
    const parsedLanguages = JSON.parse(languages);
    
    // Get file paths (Cloudinary HTTPS URL or local uploads fallback)
    const photoPath = (req.files && req.files['photo']) ? getUploadedFileUrl(req.files['photo'][0]) : '';
    const documentPath = (req.files && req.files['officialDocument']) ? getUploadedFileUrl(req.files['officialDocument'][0]) : '';
    
    const lawyer = new Lawyer({
      name, email, phone, cnic, password: hashedPassword,
      photo: photoPath, barCouncilId, stateOfPractice: parsedStateOfPractice,
      experience, officialDocument: documentPath, specialization: parsedSpecialization,
      officeAddress, languages: parsedLanguages, bio: bio || '',
      verificationStatus: 'pending'
    });
    
    await lawyer.save();
    
    // Clear verification code
    verificationStore.delete(email);
    console.log(`✅ Lawyer saved and code cleared for ${email}`);

    // Send under review email confirmation
    sendLawyerUnderReviewNotification(
      lawyer.email, 
      lawyer.name, 
      lawyer.barCouncilId, 
      parsedSpecialization
    ).catch(err => {
      console.warn('Lawyer under-review email warning:', err.message);
    });
    
    res.status(201).json({ message: 'Application submitted successfully. Awaiting admin approval.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Lawyer Login
router.post('/lawyer/login', loginLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim();
    const password = String(req.body.password || '');
    
    const lawyer = await Lawyer.findOne({ email });
    if (!lawyer) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Check the password first, so the account's status is only shown to its owner
    const isMatch = await bcrypt.compare(password, lawyer.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    if (lawyer.isBlocked) {
      return res.status(403).json({ message: 'Account is blocked. Contact admin.' });
    }
    
    if (lawyer.verificationStatus !== 'approved') {
      return res.status(403).json({ message: `Account is ${lawyer.verificationStatus}. Please wait for admin approval.` });
    }
    
    const token = generateToken(lawyer._id, 'lawyer');
    
    res.json({
      message: 'Login successful',
      token,
      lawyer: {
        id: lawyer._id,
        name: lawyer.name,
        email: lawyer.email,
        verificationStatus: lawyer.verificationStatus,
        isBlocked: lawyer.isBlocked,
        role: 'lawyer'
      }
    });
  } catch (error) {
    console.error('Lawyer login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Admin: Approve/Reject lawyer (legacy duplicate of PATCH /api/admin/lawyers/:id/verify).
// SECURITY: was previously public — anyone could approve or reject an advocate.
router.patch('/admin/lawyers/:id/verify', adminAuth, requirePermission('verify'), async (req, res) => {
  try {
    const { verificationStatus, rejectionReason } = req.body;
    const lawyer = await Lawyer.findById(req.params.id);
    
    if (!lawyer) return res.status(404).json({ message: 'Lawyer not found' });
    
    lawyer.verificationStatus = verificationStatus;
    if (rejectionReason) lawyer.rejectionReason = rejectionReason;
    await lawyer.save();
    
    // Send notification
    if (verificationStatus === 'approved') {
      await sendApprovalNotification(lawyer.email, lawyer.name, lawyer.phone);
    } else if (verificationStatus === 'rejected') {
      await sendRejectionNotification(lawyer.email, lawyer.name, lawyer.phone, rejectionReason || 'Your application did not meet our requirements.');
    }
    
    res.json({ message: `Lawyer ${verificationStatus}`, lawyer });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ============ ADMIN ROUTES ============

// Admin Login
// Locks the account for 15 minutes after 5 wrong passwords in a row.
const ADMIN_MAX_ATTEMPTS = 5;
const ADMIN_LOCK_MINUTES = 15;

router.post('/admin/login', loginLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').toLowerCase().trim();
    const { password } = req.body;

    const admin = await Admin.findOne({ email });
    if (!admin || !admin.password) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (admin.isLocked()) {
      const mins = Math.max(1, Math.ceil((admin.lockUntil - Date.now()) / 60000));
      return res.status(423).json({
        message: `Too many wrong passwords. Sign-in is locked for ${mins} more minute${mins === 1 ? '' : 's'}.`,
        lockedForMinutes: mins
      });
    }

    const isMatch = await bcrypt.compare(password || '', admin.password);
    if (!isMatch) {
      admin.failedLoginAttempts = (admin.failedLoginAttempts || 0) + 1;
      if (admin.failedLoginAttempts >= ADMIN_MAX_ATTEMPTS) {
        admin.failedLoginAttempts = 0;
        admin.lockUntil = new Date(Date.now() + ADMIN_LOCK_MINUTES * 60000);
        await admin.save();
        return res.status(423).json({
          message: `Too many wrong passwords. Sign-in is locked for ${ADMIN_LOCK_MINUTES} minutes.`,
          lockedForMinutes: ADMIN_LOCK_MINUTES
        });
      }
      await admin.save();
      const left = ADMIN_MAX_ATTEMPTS - admin.failedLoginAttempts;
      return res.status(400).json({
        message: left <= 2 ? `Invalid credentials. ${left} attempt${left === 1 ? '' : 's'} left before sign-in is locked.` : 'Invalid credentials'
      });
    }

    if (admin.status && admin.status !== 'active') {
      return res.status(403).json({ message: 'This admin account has been deactivated. Contact a super admin.' });
    }

    admin.failedLoginAttempts = 0;
    admin.lockUntil = null;
    admin.lastLoginAt = new Date();
    if (!admin.status) admin.status = 'active';
    await admin.save();

    const token = jwt.sign({ id: admin._id, role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Admin login successful',
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: 'admin',
        adminRole: admin.role || 'super_admin'
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.role === 'user') {
      const user = await User.findById(decoded.id).select('-password');
      return res.json({ user, role: 'user' });
    } else if (decoded.role === 'lawyer') {
      const lawyer = await Lawyer.findById(decoded.id).select('-password');
      return res.json({ user: lawyer, role: 'lawyer' });
    } else if (decoded.role === 'admin') {
      const admin = await Admin.findById(decoded.id).select('-password -inviteTokenHash -resetPasswordToken -failedLoginAttempts -lockUntil');
      return res.json({ user: admin, role: 'admin' });
    } else if (decoded.role === 'ngo') {
      const ngo = await NGO.findById(decoded.id).select('-password');
      return res.json({ user: ngo, role: 'ngo' });
    }
    
    res.status(400).json({ message: 'Invalid role' });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// ============ PASSWORD RESET ROUTES (ALL 4 ROLES) ============

/**
 * POST /api/auth/forgot-password
 * Body: { email, role } ('user' | 'lawyer' | 'ngo' | 'admin')
 */
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({ message: 'Email address and role are required.' });
    }

    const validRoles = ['user', 'lawyer', 'ngo', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified.' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Directly query the model for the given role
    let Model;
    if (role === 'user') Model = User;
    else if (role === 'lawyer') Model = Lawyer;
    else if (role === 'ngo') Model = NGO;
    else if (role === 'admin') Model = Admin;

    const account = await Model.findOne({ email: cleanEmail });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'No registered account found with this email for the selected role. Please check your email or select the correct account type.'
      });
    }

    // Generate secure random reset token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Store hashed token with 30-minute expiry
    account.resetPasswordToken = hashedToken;
    account.resetPasswordExpires = new Date(Date.now() + 30 * 60 * 1000);
    await account.save();

    // Send email using existing Nodemailer setup
    try {
      await sendPasswordResetEmail({
        email: account.email,
        name: account.name || 'Account Holder',
        role,
        rawToken
      });
      console.log(`📧 Password reset email dispatched to ${account.email} for role [${role}]`);
    } catch (emailErr) {
      console.error(`❌ Failed to send password reset email to ${account.email}:`, emailErr);
    }

    return res.json({
      success: true,
      message: 'Password reset instructions have been dispatched to your email address.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error processing password reset request.' });
  }
});

/**
 * POST /api/auth/reset-password
 * Body: { token, role, password }
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, role, password } = req.body;

    if (!token || !role || !password) {
      return res.status(400).json({ message: 'Reset token, role, and new password are required.' });
    }

    const pwProblem = passwordProblem(password);
    if (pwProblem) {
      return res.status(400).json({ message: pwProblem });
    }

    const validRoles = ['user', 'lawyer', 'ngo', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified.' });
    }

    let Model;
    if (role === 'user') Model = User;
    else if (role === 'lawyer') Model = Lawyer;
    else if (role === 'ngo') Model = NGO;
    else if (role === 'admin') Model = Admin;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const account = await Model.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!account) {
      return res.status(400).json({
        message: 'Password reset link is invalid or has expired. Please request a new link.'
      });
    }

    // Set new password (Admin schema pre-save hook handles hashing, other models hash explicitly)
    if (role === 'admin') {
      account.password = password;
    } else {
      account.password = await bcrypt.hash(password, 10);
    }

    account.resetPasswordToken = undefined;
    account.resetPasswordExpires = undefined;
    if (role === 'admin') {
      // A reset also clears any sign-in lock
      account.failedLoginAttempts = 0;
      account.lockUntil = null;
      account.passwordChangedAt = new Date();
    }
    await account.save();

    console.log(`✅ Password successfully reset for ${account.email} [${role}]`);

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error resetting password.' });
  }
});
// ═══════════════════════════════════════════════════════════════════════════
//  RESUBMIT APPLICATION — Rejected Lawyer
//  PATCH /api/auth/lawyer/resubmit
//  Requires: valid lawyer JWT; lawyer must have verificationStatus === 'rejected'
// ═══════════════════════════════════════════════════════════════════════════
const { authMiddleware, requireRole } = require('../middleware/auth');

router.patch(
  '/lawyer/resubmit',
  authMiddleware,
  requireRole(['lawyer']),
  uploadLegalDoc.single('officialDocument'),
  async (req, res) => {
    try {
      const lawyer = await Lawyer.findById(req.user.id);
      if (!lawyer) return res.status(404).json({ message: 'Lawyer account not found.' });
      if (lawyer.verificationStatus !== 'rejected') {
        return res.status(400).json({ message: 'Only rejected applications can be resubmitted.' });
      }

      const {
        phone, bio, barCouncilId, stateOfPractice, experience,
        specialization, officeAddress, languages
      } = req.body;

      if (phone)         lawyer.phone          = phone;
      if (bio)           lawyer.bio            = bio;
      if (barCouncilId)  lawyer.barCouncilId   = barCouncilId;
      if (officeAddress) lawyer.officeAddress  = officeAddress;
      if (experience)    lawyer.experience     = Number(experience);
      if (stateOfPractice) {
        try { lawyer.stateOfPractice = typeof stateOfPractice === 'string' ? JSON.parse(stateOfPractice) : stateOfPractice; } catch {}
      }
      if (specialization) {
        try { lawyer.specialization = typeof specialization === 'string' ? JSON.parse(specialization) : specialization; } catch {}
      }
      if (languages) {
        try { lawyer.languages = typeof languages === 'string' ? JSON.parse(languages) : languages; } catch {}
      }
      if (req.file) {
        lawyer.officialDocument = getUploadedFileUrl(req.file);
      }

      // Reset status back to pending for admin review
      lawyer.verificationStatus = 'pending';
      lawyer.rejectionReason    = '';
      await lawyer.save();

      // Notify admin via real-time if available (optional)
      res.json({
        message: 'Your application has been resubmitted successfully. It is now pending admin review.',
        verificationStatus: 'pending'
      });
    } catch (error) {
      console.error('Lawyer resubmit error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
//  RESUBMIT APPLICATION — Rejected NGO
//  PATCH /api/auth/ngo/resubmit
//  Requires: valid NGO JWT; NGO must have verificationStatus === 'rejected'
// ═══════════════════════════════════════════════════════════════════════════

router.patch(
  '/ngo/resubmit',
  authMiddleware,
  requireRole(['ngo']),
  uploadLegalDoc.single('officialDocument'),
  async (req, res) => {
    try {
      const ngo = await NGO.findById(req.user.id);
      if (!ngo) return res.status(404).json({ message: 'NGO account not found.' });
      if (ngo.verificationStatus !== 'rejected') {
        return res.status(400).json({ message: 'Only rejected applications can be resubmitted.' });
      }

      const {
        phone, bio, website, address, city, province, operatingHours,
        focusAreas, servicesOffered,
        focalName, focalDesignation, focalCnic, focalPhone
      } = req.body;

      if (phone)          ngo.phone          = phone;
      if (bio)            ngo.bio            = bio;
      if (website)        ngo.website        = website;
      if (address)        ngo.address        = address;
      if (city)           ngo.city           = city;
      if (province)       ngo.province       = province;
      if (operatingHours) ngo.operatingHours = operatingHours;
      if (focalName)         ngo.focalPerson.name        = focalName;
      if (focalDesignation)  ngo.focalPerson.designation = focalDesignation;
      if (focalCnic)         ngo.focalPerson.cnic        = focalCnic;
      if (focalPhone)        ngo.focalPerson.phone       = focalPhone;
      if (focusAreas) {
        try { ngo.focusAreas = typeof focusAreas === 'string' ? JSON.parse(focusAreas) : focusAreas; } catch {}
      }
      if (servicesOffered) {
        try { ngo.servicesOffered = typeof servicesOffered === 'string' ? JSON.parse(servicesOffered) : servicesOffered; } catch {}
      }
      if (req.file) {
        ngo.officialDocument = getUploadedFileUrl(req.file);
      }

      // Reset status back to pending for admin review
      ngo.verificationStatus = 'pending';
      ngo.rejectionReason    = '';
      await ngo.save();

      res.json({
        message: 'Your NGO registration has been resubmitted. It is now pending admin review.',
        verificationStatus: 'pending'
      });
    } catch (error) {
      console.error('NGO resubmit error:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

module.exports = router;