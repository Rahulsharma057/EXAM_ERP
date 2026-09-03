
const mongoose = require("mongoose");

const assessmentSchema = new mongoose.Schema(
  {
    // ======================================================
    // BASIC DETAILS
    // ======================================================

    name: {
      type: String,
      required: true,
      trim: true,
    },

    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    description: {
      type: String,
      trim: true,
    },

    instructions: {
      type: String,
      trim: true,
    },

    // ======================================================
    // HIERARCHY
    // ======================================================

    organisation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organisation",
      required: true,
      index: true,
    },

    centre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Centre",
      required: true,
      index: true,
    },

    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
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
    // WEEK / ACADEMIC YEAR
    // ======================================================

    weekNumber: {
      type: Number,
      required: true,
      min: 1,
    },

    academicYear: {
      type: String,
      trim: true,
    },

    // ======================================================
    // PART STRUCTURE
    //
    // false:
    // Assessment
    //   └── Sections
    //       └── Questions
    //
    // true:
    // Assessment
    //   └── Parts
    //       └── Sections
    //           └── Questions
    // ======================================================

    hasParts: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ======================================================
    // STATUS
    // ======================================================

    status: {
      type: String,
      enum: [
        "DRAFT",
        "SCHEDULED",
        "PUBLISHED",
        "CLOSED",
        "ARCHIVED",
      ],
      default: "DRAFT",
      index: true,
    },

    // ======================================================
    // SCHEDULE
    // ======================================================

    publishDate: {
      type: Date,
    },

    publishTime: {
      type: String,
      trim: true,
    },

    closeDate: {
      type: Date,
    },

    closeTime: {
      type: String,
      trim: true,
    },

    // ======================================================
    // TOTALS
    //
    // These are assessment-level template totals.
    // Student-specific final totals will be calculated
    // separately according to optional-part attempts.
    // ======================================================

    totalMarks: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalQuestions: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ======================================================
    // AUDIT
    // ======================================================

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // ======================================================
    // ACTIVE FLAG
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

// One assessment per batch per week
assessmentSchema.index(
  {
    batch: 1,
    weekNumber: 1,
  },
  {
    unique: true,
  }
);

// Status / scheduling queries
assessmentSchema.index({
  status: 1,
  publishDate: 1,
});

// Hierarchy filtering
assessmentSchema.index({
  organisation: 1,
  centre: 1,
  course: 1,
  batch: 1,
});

// Parts mode filtering
assessmentSchema.index({
  batch: 1,
  hasParts: 1,
});

// ==========================================================
// EXPORT
// ==========================================================

module.exports = mongoose.model("Assessment", assessmentSchema);
