const express = require('express');
const multer = require('multer');
const router = express.Router();
const { exportTemplate, exportResults, importMarks, importStudents,  downloadStudentTemplate } = require('../controllers/excelController');
const { protect, authorize } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/assessments/:assessmentId/export-template', protect, authorize('teacher', 'centre_admin', 'org_admin', 'super_admin'), exportTemplate);
router.get('/assessments/:assessmentId/export-results', protect, authorize('teacher', 'centre_admin', 'org_admin', 'super_admin'), exportResults);
router.post('/assessments/:assessmentId/import-marks', protect, authorize('teacher', 'centre_admin', 'org_admin', 'super_admin'), upload.single('file'), importMarks);
router.post('/import-students', protect, authorize('centre_admin', 'org_admin', 'super_admin'), upload.single('file'), importStudents);
router.get(
  '/student-template',
  protect,
  authorize('centre_admin', 'org_admin', 'super_admin'),
  downloadStudentTemplate
);
module.exports = router;
