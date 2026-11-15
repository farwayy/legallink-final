/**
 * One-time script to create the admin account in MongoDB.
 * Run: node seedAdmin.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ADMIN_EMAIL    = 'admin@legallink.pk';
const ADMIN_PASSWORD = 'Admin@123456';
const ADMIN_NAME     = 'Legal Link Admin';

(async () => {
  try {
    const uri = process.env.MONGODB_URI || '';
    const isAtlas = uri.includes('mongodb+srv') || uri.includes('ssl=true') || uri.includes('tls=true');
    const options = { serverSelectionTimeoutMS: 10000 };
    if (isAtlas) {
      options.tls = true;
      options.tlsAllowInvalidCertificates = true;
    }
    await mongoose.connect(uri, options);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const admins = db.collection('admins');

    const existing = await admins.findOne({ email: ADMIN_EMAIL });
    if (existing) {
      console.log('⚠️  Admin already exists:', ADMIN_EMAIL);
    } else {
      const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
      await admins.insertOne({
        name:      ADMIN_NAME,
        email:     ADMIN_EMAIL,
        password:  hashedPassword,
        role:      'super_admin',
        createdAt: new Date()
      });
      console.log('✅ Admin account created!');
    }

    console.log('\n─────────────────────────────────────');
    console.log('  Admin Login Credentials');
    console.log('─────────────────────────────────────');
    console.log('  Email   :', ADMIN_EMAIL);
    console.log('  Password:', ADMIN_PASSWORD);
    console.log('  URL     : http://localhost:3000/admin/login');
    console.log('─────────────────────────────────────\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
