const express = require('express');
const router = express.Router();
const { createSubmission, getSubmissions, getSubmission, getBatchCompletionStatus } = require('../controllers/submissionController');
const { protect, authorize } = require('../middleware/auth');

router.post('/assessments/:assessmentId/submissions', protect, authorize('teacher', 'centre_admin', 'org_admin', 'super_admin'), createSubmission);
router.get('/assessments/:assessmentId/submissions', protect, getSubmissions);
router.get('/:id', protect, getSubmission);
router.get('/assessments/:assessmentId/completion', protect, getBatchCompletionStatus);

module.exports = router;
