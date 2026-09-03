
const express = require("express");

const router = express.Router();

const {
  createPart,
  getParts,
  getPart,
  updatePart,
  deletePart,
  reorderParts,
} = require("../controllers/assessmentPartController");

const { protect, authorize } = require("../middleware/auth");

// ============================================================
// ASSESSMENT PART ROUTES
// ============================================================

// Create Part
// POST /api/v1/assessment-parts/assessments/:assessmentId/parts
router.post(
  "/assessments/:assessmentId/parts",
  protect,
  authorize(
    "teacher",
    "centre_admin",
    "org_admin",
    "super_admin"
  ),
  createPart
);

// Get all Parts of an Assessment
// GET /api/v1/assessment-parts/assessments/:assessmentId/parts
router.get(
  "/assessments/:assessmentId/parts",
  protect,
  authorize(
    "teacher",
    "centre_admin",
    "org_admin",
    "super_admin"
  ),
  getParts
);

// Get single Part
// GET /api/v1/assessment-parts/:id
router.get(
  "/:id",
  protect,
  authorize(
    "teacher",
    "centre_admin",
    "org_admin",
    "super_admin"
  ),
  getPart
);

// Update Part
// PUT /api/v1/assessment-parts/:id
router.put(
  "/:id",
  protect,
  authorize(
    "teacher",
    "centre_admin",
    "org_admin",
    "super_admin"
  ),
  updatePart
);

// Delete Part
// DELETE /api/v1/assessment-parts/:id
router.delete(
  "/:id",
  protect,
  authorize(
    "teacher",
    "centre_admin",
    "org_admin",
    "super_admin"
  ),
  deletePart
);

// Reorder Parts
// PATCH /api/v1/assessment-parts/assessments/:assessmentId/parts/reorder
router.patch(
  "/assessments/:assessmentId/parts/reorder",
  protect,
  authorize(
    "teacher",
    "centre_admin",
    "org_admin",
    "super_admin"
  ),
  reorderParts
);

module.exports = router;

