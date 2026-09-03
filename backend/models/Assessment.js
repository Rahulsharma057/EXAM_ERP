const mongoose = require('mongoose');

const assessmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true },
  description: { type: String },
  instructions: { type: String },

  organisation: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
  centre: { type: mongoose.Schema.Types.ObjectId, ref: 'Centre', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },

  weekNumber: { type: Number, required: true },
  academicYear: { type: String },

  status: {
    type: String,
    enum: ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'CLOSED', 'ARCHIVED'],
    default: 'DRAFT'
  },

  publishDate: { type: Date },
  publishTime: { type: String },
  closeDate: { type: Date },
  closeTime: { type: String },

  totalMarks: { type: Number, default: 0 },
  totalQuestions: { type: Number, default: 0 },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  isActive: { type: Boolean, default: true }
}, { timestamps: true });

assessmentSchema.index({ batch: 1, weekNumber: 1 }, { unique: true });
assessmentSchema.index({ status: 1, publishDate: 1 });
assessmentSchema.index({ organisation: 1, centre: 1, course: 1, batch: 1 });

module.exports = mongoose.model('Assessment', assessmentSchema);
