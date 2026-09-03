
const mongoose = require("mongoose");

const assessmentPartSchema = new mongoose.Schema(
  {
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
    // PART DETAILS
    // ======================================================

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    code: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 50,
    },

    description: {
      type: String,
      trim: true,
    },

    // ======================================================
    // OPTIONAL PART
    //
    // false = student must attempt
    // true  = student can skip
    // ======================================================

    isOptional: {
      type: Boolean,
      default: false,
      index: true,
    },

    // ======================================================
    // DISPLAY ORDER
    // ======================================================

    displayOrder: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ======================================================
    // DENORMALIZED TOTALS
    //
    // These are calculated from the Part's questions.
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
    // ACTIVE FLAG
    // ======================================================

    isActive: {
      type: Boolean,
      default: true,
      index: true,
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
  },
  {
    timestamps: true,
  }
);

// ==========================================================
// INDEXES
// ==========================================================

// Parts of an assessment in display order
assessmentPartSchema.index({
  assessment: 1,
  displayOrder: 1,
});

// Active parts
assessmentPartSchema.index({
  assessment: 1,
  isActive: 1,
});

// Prevent duplicate part codes inside same assessment
assessmentPartSchema.index(
  {
    assessment: 1,
    code: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      code: {
        $exists: true,
        $nin: [null, ""],
      },
    },
  }
);

// ==========================================================
// EXPORT
// ==========================================================

module.exports = mongoose.model(
  "AssessmentPart",
  assessmentPartSchema
);

