const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    // =====================================================
    // BASIC INFORMATION
    // =====================================================

    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    mobile: {
      type: String,
      trim: true,
    },

    // =====================================================
    // ROLE
    // =====================================================

    role: {
      type: String,
      enum: ["super_admin", "org_admin", "centre_admin", "teacher", "student"],
      required: true,
    },

    // =====================================================
    // HIERARCHY
    // =====================================================

    organisation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organisation",
    },

    centre: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Centre",
    },

    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
    },

    // =====================================================
    // MULTIPLE BATCH ASSIGNMENT
    // Teacher = multiple batches
    // Student = normally one batch
    // =====================================================

    batches: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Batch",
      },
    ],

    // =====================================================
    // STUDENT ACCOUNT LINK
    // =====================================================

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
    },

    // =====================================================
    // STATUS
    // =====================================================

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// =====================================================
// INDEXES
// =====================================================

userSchema.index({
  organisation: 1,
  centre: 1,
  course: 1,
});

userSchema.index({
  batches: 1,
});

userSchema.index({
  role: 1,
  isActive: 1,
});

// =====================================================
// PASSWORD HASH
// =====================================================

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, 12);

  next();
});

// =====================================================
// PASSWORD COMPARE
// =====================================================

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
