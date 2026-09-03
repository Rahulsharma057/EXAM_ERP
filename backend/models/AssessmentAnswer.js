const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  submission: { type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentSubmission', required: true },
  assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },

  question: { type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentQuestion', required: true },
  section: { type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentSection', required: true },

  // Snapshot of question at submission time
  questionSnapshot: {
    questionText: String,
    questionType: String,
    maxPoints: Number,
    sectionName: String,
    displayOrder: Number
  },

  answerValue: { type: mongoose.Schema.Types.Mixed, required: true },
  awardedScore: { type: Number, default: 0 },

  gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  gradedAt: { type: Date },

  remarks: { type: String }
}, { timestamps: true });

answerSchema.index({ submission: 1, question: 1 }, { unique: true });
answerSchema.index({ assessment: 1, student: 1 });

module.exports = mongoose.model('AssessmentAnswer', answerSchema);
