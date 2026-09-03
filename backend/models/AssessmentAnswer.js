
const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema(
  {
    // ======================================================
    // SUBMISSION
    // ======================================================

    submission: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AssessmentSubmission",
      required: true,
      index: true,
    },

    // ======================================================
    // ASSESSMENT
    // ======================================================

    assessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
      index: true,
    },

    // ======================================================
    // STUDENT
    // ======================================================

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },

    // ======================================================
    // PART
    // ======================================================

    part: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AssessmentPart",
      default: null,
      index: true,
    },

    // ======================================================
    // SECTION
    // ======================================================

    section: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AssessmentSection",
      required: true,
      index: true,
    },

    // ======================================================
    // QUESTION
    // ======================================================

    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AssessmentQuestion",
      required: true,
      index: true,
    },

    // ======================================================
    // PART SNAPSHOT
    //
    // Keeps historical information safe.
    // ======================================================

    partSnapshot: {
      partId: {
        type: mongoose.Schema.Types.ObjectId,
      },

      name: {
        type: String,
      },

      code: {
        type: String,
      },

      isOptional: {
        type: Boolean,
        default: false,
      },

      displayOrder: {
        type: Number,
      },
    },

    // ======================================================
    // QUESTION SNAPSHOT
    // ======================================================

    questionSnapshot: {
      questionText: String,

      questionType: String,

      maxPoints: Number,

      sectionName: String,

      sectionDisplayOrder: Number,

      partName: String,

      partDisplayOrder: Number,

      displayOrder: Number,
    },

    // ======================================================
    // STUDENT ANSWER
    // ======================================================

    answerValue: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    // ======================================================
    // AWARDED SCORE
    // ======================================================

    awardedScore: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ======================================================
    // GRADING
    // ======================================================

    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    gradedAt: {
      type: Date,
    },

    remarks: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// ==========================================================
// INDEXES
// ==========================================================

// One answer per question in a submission
answerSchema.index(
  {
    submission: 1,
    question: 1,
  },
  {
    unique: true,
  }
);

// Assessment/student result lookup
answerSchema.index({
  assessment: 1,
  student: 1,
});

// Part-wise result
answerSchema.index({
  assessment: 1,
  student: 1,
  part: 1,
});

// Section-wise result
answerSchema.index({
  assessment: 1,
  student: 1,
  section: 1,
});

// ==========================================================
// EXPORT
// ==========================================================

module.exports = mongoose.model(
  "AssessmentAnswer",
  answerSchema
);

