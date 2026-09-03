const express = require('express');
const router = express.Router();
const { getStudents, getStudent, createStudent, updateStudent, deleteStudent } = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', protect, getStudents);
router.get('/:id', protect, getStudent);
router.post('/', protect, authorize('centre_admin', 'org_admin', 'super_admin'), createStudent);
router.put('/:id', protect, authorize('centre_admin', 'org_admin', 'super_admin'), updateStudent);
router.delete('/:id', protect, authorize('centre_admin', 'org_admin', 'super_admin'), deleteStudent);

module.exports = router;
