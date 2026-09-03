const express = require('express');
const router = express.Router();
const { createSection, updateSection, deleteSection, reorderSections } = require('../controllers/sectionController');
const { protect, authorize } = require('../middleware/auth');

router.post('/assessments/:assessmentId/sections', protect, authorize('super_admin', 'org_admin', 'centre_admin', 'teacher'), createSection);
router.put('/:id', protect, authorize('super_admin', 'org_admin', 'centre_admin', 'teacher'), updateSection);
router.delete('/:id', protect, authorize('super_admin', 'org_admin', 'centre_admin', 'teacher'), deleteSection);
router.post('/reorder', protect, authorize('super_admin', 'org_admin', 'centre_admin', 'teacher'), reorderSections);

module.exports = router;
