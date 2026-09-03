const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
  assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true },
  name: { type: String, required: true },
  description: { type: String },
  displayOrder: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  totalMarks: { type: Number, default: 0 }
}, { timestamps: true });

sectionSchema.index({ assessment: 1, displayOrder: 1 });

module.exports = mongoose.model('AssessmentSection', sectionSchema);
