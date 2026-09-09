const express = require("express");

const router = express.Router();

const {
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
} = require("../controllers/sectionController");

const { protect, authorize } = require("../middleware/auth");

// ============================================================
// CREATE SECTION
// POST /api/sections/assessments/:assessmentId/sections
// ============================================================

router.post(
  "/assessments/:assessmentId/sections",
  protect,
  authorize("super_admin", "org_admin", "centre_admin", "teacher"),
  createSection,
);

// ============================================================
// UPDATE SECTION
// PUT /api/sections/:id
// ============================================================

router.put(
  "/:id",
  protect,
  authorize("super_admin", "org_admin", "centre_admin", "teacher"),
  updateSection,
);

// ============================================================
// DELETE SECTION
// DELETE /api/sections/:id
// ============================================================

router.delete(
  "/:id",
  protect,
  authorize("super_admin", "org_admin", "centre_admin", "teacher"),
  deleteSection,
);

// ============================================================
// REORDER SECTIONS
// PATCH /api/sections/assessments/:assessmentId/sections/reorder
// ============================================================

router.patch(
  "/assessments/:assessmentId/sections/reorder",
  protect,
  authorize("super_admin", "org_admin", "centre_admin", "teacher"),
  reorderSections,
);

module.exports = router;
