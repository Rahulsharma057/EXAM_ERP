const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true },
  description: { type: String },
  organisation: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
  centre: { type: mongoose.Schema.Types.ObjectId, ref: 'Centre', required: true },
  duration: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

courseSchema.index({ centre: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Course', courseSchema);
