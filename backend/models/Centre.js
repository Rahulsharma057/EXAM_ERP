const mongoose = require('mongoose');

const centreSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true },
  organisation: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
  address: { type: String },
  contactEmail: { type: String },
  contactPhone: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

centreSchema.index({ organisation: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Centre', centreSchema);
