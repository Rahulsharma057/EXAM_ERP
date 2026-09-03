
const express = require('express');

const router = express.Router();

const {
  getAssessmentResults,
  getStudentResults,
  getBatchResults,
  getStudentWiseSectionResults,

  // Teacher Marks Entry
  getAssessmentStudentsForMarks,
  getStudentMarksEntry,
  saveStudentMarks
} = require('../controllers/resultsController');

const { protect } =
  require('../middleware/auth');


// ============================================================
// RESULTS
// ============================================================

router.get(
  '/assessments/:assessmentId/results',
  protect,
  getAssessmentResults
);

router.get(
  '/students/:studentId/assessment-results',
  protect,
  getStudentResults
);

router.get(
  '/batches/:batchId/assessment-results',
  protect,
  getBatchResults
);

router.get(
  '/assessments/:assessmentId/students/:studentId/sections',
  protect,
  getStudentWiseSectionResults
);


// ============================================================
// TEACHER MARKS ENTRY
// ============================================================

// Assessment ke batch ke students
router.get(
  '/assessments/:assessmentId/marks/students',
  protect,
  getAssessmentStudentsForMarks
);


// Selected student ke questions + marks
router.get(
  '/assessments/:assessmentId/marks/students/:studentId',
  protect,
  getStudentMarksEntry
);


// Teacher marks save karega
router.post(
  '/assessments/:assessmentId/marks/students/:studentId',
  protect,
  saveStudentMarks
);


module.exports = router;

