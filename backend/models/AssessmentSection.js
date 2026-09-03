
const mongoose = require("mongoose");

const sectionSchema = new mongoose.Schema(
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
    // PART
    //
    // null = old/direct section structure
    //
    // Assessment
    //   └── Section
    //
    // ObjectId = part-based structure
    //
    // Assessment
    //   └── Part
    //       └── Section
    // ======================================================

    part: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AssessmentPart",
      default: null,
      index: true,
    },

    // ======================================================
    // SECTION DETAILS
    // ======================================================

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    displayOrder: {
      type: Number,
      required: true,
      min: 0,
    },

    // ======================================================
    // STATUS
    // ======================================================

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // ======================================================
    // CALCULATED TOTAL
    // ======================================================

    totalMarks: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// ==========================================================
// INDEXES
// ==========================================================

// Sections directly under assessment
sectionSchema.index({
  assessment: 1,
  displayOrder: 1,
});

// Sections inside a Part
sectionSchema.index({
  assessment: 1,
  part: 1,
  displayOrder: 1,
});

// Active sections
sectionSchema.index({
  assessment: 1,
  isActive: 1,
});

// ==========================================================
// EXPORT
// ==========================================================

module.exports = mongoose.model(
  "AssessmentSection",
  sectionSchema
);

