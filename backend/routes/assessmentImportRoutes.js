const express = require("express");
const router = express.Router();

const {
  extractQuestions,
  commitImportedQuestions,
} = require("../controllers/assessmentImportController");

const { protect, authorize } = require("../middleware/auth");
const upload = require("../middleware/uploadMiddleware");

const roles = ["teacher", "centre_admin", "org_admin", "super_admin"];

// Step 1: upload PDF/DOCX/image → get back draft questions (not saved)
router.post(
  "/assessments/:assessmentId/extract",
  protect,
  authorize(...roles),
  upload.single("file"),
  (err, req, res, next) => {
    // Catches multer errors (bad file type / too large) with a clean message.
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  },
  extractQuestions,
);

// Step 2: after the teacher reviews/edits the draft questions, save them for real
router.post(
  "/assessments/:assessmentId/commit",
  protect,
  authorize(...roles),
  commitImportedQuestions,
);

module.exports = router;