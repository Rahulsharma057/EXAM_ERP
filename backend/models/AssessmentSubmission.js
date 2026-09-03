const mongoose = require('mongoose');

const answerSnapshotSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  questionText: { type: String, required: true },
  questionType: { type: String, required: true },
  maxPoints: { type: Number, required: true },
  sectionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  sectionName: { type: String, required: true },
  displayOrder: { type: Number }
}, { _id: false });

const submissionSchema = new mongoose.Schema({
  assessment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },

  // Snapshot of assessment structure at time of submission (historical safety)
  assessmentSnapshot: {
    name: String,
    weekNumber: Number,
    totalMarks: Number,
    sections: [{
      sectionId: mongoose.Schema.Types.ObjectId,
      name: String,
      displayOrder: Number,
      totalMarks: Number
    }]
  },

  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'REASSESSED'],
    default: 'PENDING'
  },

  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  submittedAt: { type: Date, default: Date.now },

  // Calculated scores (server-side only)
  sectionScores: [{
    sectionId: mongoose.Schema.Types.ObjectId,
    sectionName: String,
    obtainedMarks: { type: Number, default: 0 },
    maxMarks: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 }
  }],

  totalObtained: { type: Number, default: 0 },
  totalMax: { type: Number, default: 0 },
  overallPercentage: { type: Number, default: 0 },

  attemptNumber: { type: Number, default: 1 },

  isActive: { type: Boolean, default: true }
}, { timestamps: true });

submissionSchema.index({ assessment: 1, student: 1, attemptNumber: 1 }, { unique: true });
submissionSchema.index({ batch: 1, assessment: 1 });
submissionSchema.index({ student: 1, status: 1 });

module.exports = mongoose.model('AssessmentSubmission', submissionSchema);
