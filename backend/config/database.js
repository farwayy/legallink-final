const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/legallink';
    const isAtlas = uri.includes('mongodb+srv') || uri.includes('ssl=true') || uri.includes('tls=true');
    const options = {
      serverSelectionTimeoutMS: 10000,
    };
    if (isAtlas) {
      options.tls = true;
      options.tlsAllowInvalidCertificates = true;
    }
    await mongoose.connect(uri, options);
    console.log('✅ MongoDB Connected Successfully');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
