const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  centre: { type: mongoose.Schema.Types.ObjectId, ref: 'Centre', required: true },
  organisation: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
  startDate: { type: Date },
  endDate: { type: Date },
  academicYear: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

batchSchema.index({ course: 1, code: 1 }, { unique: true });

module.exports = mongoose.model('Batch', batchSchema);
