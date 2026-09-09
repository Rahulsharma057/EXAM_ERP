const express = require("express");

const router = express.Router();

const {
  createQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions,
} = require("../controllers/questionController");

const { protect, authorize } = require("../middleware/auth");

const roles = [
  "super_admin",
  "org_admin",
  "centre_admin",
  "teacher",
];

// ============================================================
// CREATE QUESTION
// POST /api/questions/sections/:sectionId/questions
// ============================================================

router.post(
  "/sections/:sectionId/questions",
  protect,
  authorize(...roles),
  createQuestion
);

// ============================================================
// UPDATE QUESTION
// PUT /api/questions/:id
// ============================================================

router.put(
  "/:id",
  protect,
  authorize(...roles),
  updateQuestion
);

// ============================================================
// DELETE QUESTION
// DELETE /api/questions/:id
// ============================================================

router.delete(
  "/:id",
  protect,
  authorize(...roles),
  deleteQuestion
);

// ============================================================
// REORDER QUESTIONS
// PATCH /api/questions/sections/:sectionId/questions/reorder
// ============================================================

router.patch(
  "/sections/:sectionId/questions/reorder",
  protect,
  authorize(...roles),
  reorderQuestions
);

module.exports = router;