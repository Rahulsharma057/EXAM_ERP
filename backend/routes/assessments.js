const express = require("express");

const router = express.Router();

const {
  createAssessment,
  getAssessments,
  getAssessment,
  updateAssessment,
  duplicateAssessment,
  publishAssessment,
  scheduleAssessment,
  closeAssessment,
  archiveAssessment,
  deleteAssessment,
  getAssessmentPreview,
} = require("../controllers/assessmentController");

const { protect, authorize, hierarchyFilter } = require("../middleware/auth");

const { assessmentValidation } = require("../middleware/validate");

// ============================================================
// CREATE ASSESSMENT
// ============================================================

router.post(
  "/",
  protect,
  authorize("super_admin", "org_admin", "centre_admin", "teacher"),
  assessmentValidation.create,
  createAssessment,
);

// ============================================================
// GET ALL ASSESSMENTS
// IMPORTANT: hierarchyFilter added
// ============================================================

router.get("/", protect, hierarchyFilter, getAssessments);

// ============================================================
// GET SINGLE ASSESSMENT
// ============================================================

router.get("/:id", protect, hierarchyFilter, getAssessment);

// ============================================================
// UPDATE ASSESSMENT
// ============================================================

router.put(
  "/:id",
  protect,
  hierarchyFilter,
  authorize("super_admin", "org_admin", "centre_admin", "teacher"),
  updateAssessment,
);

// ============================================================
// PUBLISH
// ============================================================

router.post(
  "/:id/publish",
  protect,
  hierarchyFilter,
  authorize("super_admin", "org_admin", "centre_admin", "teacher"),
  publishAssessment,
);

// ============================================================
// SCHEDULE
// ============================================================

router.post(
  "/:id/schedule",
  protect,
  hierarchyFilter,
  authorize("super_admin", "org_admin", "centre_admin", "teacher"),
  scheduleAssessment,
);

// ============================================================
// CLOSE
// ============================================================

router.post(
  "/:id/close",
  protect,
  hierarchyFilter,
  authorize("super_admin", "org_admin", "centre_admin", "teacher"),
  closeAssessment,
);

// ============================================================
// ARCHIVE
// ============================================================

router.post(
  "/:id/archive",
  protect,
  hierarchyFilter,
  authorize("super_admin", "org_admin", "centre_admin", "teacher"),
  archiveAssessment,
);

// ============================================================
// DELETE
// ============================================================

router.delete(
  "/:id",
  protect,
  hierarchyFilter,
  authorize("super_admin", "org_admin", "centre_admin", "teacher"),
  deleteAssessment,
);

// ============================================================
// PREVIEW
// ============================================================

router.get("/:id/preview", protect, hierarchyFilter, getAssessmentPreview);

// ============================================================
// DUPLICATE
// ============================================================

router.post(
  "/:id/duplicate",
  protect,
  hierarchyFilter,
  authorize("super_admin", "org_admin", "centre_admin", "teacher"),
  duplicateAssessment,
);

module.exports = router;
