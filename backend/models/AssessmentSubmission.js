
const mongoose = require("mongoose");

// ==========================================================
// ANSWER SNAPSHOT
// ==========================================================

const answerSnapshotSchema = new mongoose.Schema(
  {
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    questionText: {
      type: String,
      required: true,
    },

    questionType: {
      type: String,
      required: true,
    },

    maxPoints: {
      type: Number,
      required: true,
    },

    // ------------------------------------------------------
    // PART SNAPSHOT
    // ------------------------------------------------------

    partId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    partName: {
      type: String,
    },

    partCode: {
      type: String,
    },

    partIsOptional: {
      type: Boolean,
      default: false,
    },

    partDisplayOrder: {
      type: Number,
    },

    // ------------------------------------------------------
    // SECTION SNAPSHOT
    // ------------------------------------------------------

    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    sectionName: {
      type: String,
      required: true,
    },

    sectionDisplayOrder: {
      type: Number,
    },

    displayOrder: {
      type: Number,
    },
  },
  {
    _id: false,
  }
);

// ==========================================================
// PART SCORE SNAPSHOT
//
// This stores whether the student attempted a Part.
//
// Example:
//
// Part 1
// attempted: true
// obtained: 35
// max: 50
//
// Part 2
// attempted: false
// obtained: 0
// max: 0
//
// IMPORTANT:
// For a skipped optional Part, maxMarks = 0.
// Therefore it is excluded from final percentage.
// ==========================================================

const partScoreSchema = new mongoose.Schema(
  {
    partId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AssessmentPart",
      required: true,
    },

    partName: {
      type: String,
      required: true,
    },

    partCode: {
      type: String,
    },

    isOptional: {
      type: Boolean,
      default: false,
    },

    attempted: {
      type: Boolean,
      default: true,
    },

    obtainedMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    maxMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    percentage: {
      type: Number,
      default: 0,
      min: 0,
    },

    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

// ==========================================================
// SECTION SCORE
// ==========================================================

const sectionScoreSchema = new mongoose.Schema(
  {
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AssessmentSection",
      required: true,
    },

    sectionName: {
      type: String,
      required: true,
    },

    // Part information for section-wise result
    partId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AssessmentPart",
      default: null,
    },

    partName: {
      type: String,
    },

    partDisplayOrder: {
      type: Number,
    },

    obtainedMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    maxMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    percentage: {
      type: Number,
      default: 0,
      min: 0,
    },

    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

// ==========================================================
// SUBMISSION SCHEMA
// ==========================================================

const submissionSchema = new mongoose.Schema(
  {
    // ======================================================
    // BASIC RELATIONS
    // ======================================================

    assessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
      index: true,
    },

    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },

    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
      index: true,
    },

    // ======================================================
    // ASSESSMENT SNAPSHOT
    //
    // Historical safety:
    // Future changes to Assessment/Part/Section/Question
    // must NOT change old results.
    // ======================================================

    assessmentSnapshot: {
      name: String,

      code: String,

      weekNumber: Number,

      academicYear: String,

      totalMarks: Number,

      totalQuestions: Number,

      hasParts: {
        type: Boolean,
        default: false,
      },

      // ----------------------------------------------------
      // PART SNAPSHOT
      // ----------------------------------------------------

      parts: [
        {
          partId: {
            type: mongoose.Schema.Types.ObjectId,
          },

          name: {
            type: String,
          },

          code: {
            type: String,
          },

          description: {
            type: String,
          },

          isOptional: {
            type: Boolean,
            default: false,
          },

          displayOrder: {
            type: Number,
          },

          totalMarks: {
            type: Number,
            default: 0,
          },

          totalQuestions: {
            type: Number,
            default: 0,
          },
        },
      ],

      // ----------------------------------------------------
      // SECTION SNAPSHOT
      // ----------------------------------------------------

      sections: [
        {
          sectionId: {
            type: mongoose.Schema.Types.ObjectId,
          },

          name: {
            type: String,
          },

          description: {
            type: String,
          },

          partId: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
          },

          partName: {
            type: String,
          },

          partDisplayOrder: {
            type: Number,
          },

          displayOrder: {
            type: Number,
          },

          totalMarks: {
            type: Number,
            default: 0,
          },

          totalQuestions: {
            type: Number,
            default: 0,
          },
        },
      ],
    },

    // ======================================================
    // SUBMISSION STATUS
    // ======================================================

    status: {
      type: String,

      enum: [
        "PENDING",
        "COMPLETED",
        "REASSESSED",
      ],

      default: "PENDING",

      index: true,
    },

    // ======================================================
    // SUBMITTED BY
    // ======================================================

    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    submittedAt: {
      type: Date,
      default: Date.now,
    },

    // ======================================================
    // PART-WISE SCORES
    // ======================================================

    partScores: {
      type: [partScoreSchema],
      default: [],
    },

    // ======================================================
    // SECTION-WISE SCORES
    // ======================================================

    sectionScores: {
      type: [sectionScoreSchema],
      default: [],
    },

    // ======================================================
    // OVERALL SCORE
    //
    // Calculated ONLY by backend.
    //
    // Optional skipped Part is excluded because its
    // maxMarks is NOT added to totalMax.
    // ======================================================

    totalObtained: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalMax: {
      type: Number,
      default: 0,
      min: 0,
    },

    overallPercentage: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ======================================================
    // ATTEMPT
    // ======================================================

    attemptNumber: {
      type: Number,
      default: 1,
      min: 1,
    },

    // ======================================================
    // ACTIVE
    // ======================================================

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// ==========================================================
// INDEXES
// ==========================================================

// One submission per student per assessment per attempt
submissionSchema.index(
  {
    assessment: 1,
    student: 1,
    attemptNumber: 1,
  },
  {
    unique: true,
  }
);

// Batch + assessment result lookup
submissionSchema.index({
  batch: 1,
  assessment: 1,
});

// Student history
submissionSchema.index({
  student: 1,
  status: 1,
});

// Part-wise result queries
submissionSchema.index({
  assessment: 1,
  student: 1,
  "partScores.partId": 1,
});

// ==========================================================
// EXPORT
// ==========================================================

module.exports = mongoose.model(
  "AssessmentSubmission",
  submissionSchema
);
