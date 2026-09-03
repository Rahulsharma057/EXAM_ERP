
const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
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
    // null = assessment without Parts
    //
    // ObjectId = question belongs to a Part
    //
    // Assessment
    //   └── Part
    //       └── Section
    //           └── Question
    // ======================================================

    part: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AssessmentPart",
      default: null,
      index: true,
    },

    // ======================================================
    // QUESTION
    // ======================================================

    questionText: {
      type: String,
      required: true,
      trim: true,
    },

    questionType: {
      type: String,
      enum: [
        "YES_NO",
        "TEXT",
        "NUMBER",
        "SINGLE_CHOICE",
        "MULTIPLE_CHOICE",
      ],
      default: "YES_NO",
    },

    options: [
      {
        type: String,
        trim: true,
      },
    ],

    // ======================================================
    // MARKS
    // ======================================================

    maxPoints: {
      type: Number,
      required: true,
      default: 1,
      min: 0,
    },

    isRequired: {
      type: Boolean,
      default: true,
    },

    // ======================================================
    // ORDER / STATUS
    // ======================================================

    displayOrder: {
      type: Number,
      required: true,
      min: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    // ======================================================
    // FUTURE-PROOF SCORING
    // ======================================================

    scoringConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// ==========================================================
// INDEXES
// ==========================================================

questionSchema.index({
  section: 1,
  displayOrder: 1,
});

questionSchema.index({
  assessment: 1,
});

questionSchema.index({
  assessment: 1,
  part: 1,
});

questionSchema.index({
  part: 1,
  section: 1,
  displayOrder: 1,
});

// ==========================================================
// EXPORT
// ==========================================================

module.exports = mongoose.model(
  "AssessmentQuestion",
  questionSchema
);
