const express = require('express');
const router = express.Router();
const { createQuestion, updateQuestion, deleteQuestion, reorderQuestions } = require('../controllers/questionController');
const { protect, authorize } = require('../middleware/auth');

router.post('/sections/:sectionId/questions', protect, authorize('super_admin', 'org_admin', 'centre_admin', 'teacher'), createQuestion);
router.put('/:id', protect, authorize('super_admin', 'org_admin', 'centre_admin', 'teacher'), updateQuestion);
router.delete('/:id', protect, authorize('super_admin', 'org_admin', 'centre_admin', 'teacher'), deleteQuestion);
router.post('/reorder', protect, authorize('super_admin', 'org_admin', 'centre_admin', 'teacher'), reorderQuestions);

module.exports = router;
