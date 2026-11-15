const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: function () {
      return this.authProvider === "local";
    },
    minlength: 6,
  },
  phone: {
    type: String,
    default: "",
  },
  cnic: {
    type: String,
    sparse: true,
  },
  address: {
    type: String,
    default: "",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  photo: { 
    type: String, 
    default: "",
  },
  role: {
    type: String,
    default: "user",
  },
  googleId: {
    type: String,
    sparse: true,
    unique: true,
  },
  authProvider: {
    type: String,
    enum: ["local", "google"],
    default: "local",
  },
  resetPasswordToken: {
    type: String,
    default: null,
  },
  resetPasswordExpires: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("User", userSchema);
