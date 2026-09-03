const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  section: { type: mongoose.Schema.Types.ObjectId, ref: 'AssessmentSection', required: true },
  assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true },

  questionText: { type: String, required: true },
  questionType: {
    type: String,
    enum: ['YES_NO', 'TEXT', 'NUMBER', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE'],
    default: 'YES_NO'
  },

  options: [{ type: String }],

  maxPoints: { type: Number, required: true, default: 1 },
  isRequired: { type: Boolean, default: true },
  displayOrder: { type: Number, required: true },
  isActive: { type: Boolean, default: true },

  // Future-proof scoring configuration
  scoringConfig: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

questionSchema.index({ section: 1, displayOrder: 1 });
questionSchema.index({ assessment: 1 });

module.exports = mongoose.model('AssessmentQuestion', questionSchema);
