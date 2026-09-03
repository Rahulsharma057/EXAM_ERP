const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  rollNumber: { type: String, required: true },
  name: { type: String, required: true },
  fatherName: { type: String },
  motherName: { type: String },
  mobile: { type: String },
  email: { type: String },
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  dateOfBirth: { type: Date },
  organisation: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true },
  centre: { type: mongoose.Schema.Types.ObjectId, ref: 'Centre', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

studentSchema.index({ batch: 1, rollNumber: 1 }, { unique: true });
studentSchema.index({ organisation: 1, centre: 1, course: 1, batch: 1 });

module.exports = mongoose.model('Student', studentSchema);
