const express = require('express');
const router = express.Router();
const { register, login, getMe, getOrganisations, getCentres, getCourses, getBatches, getBatchStudents } = require('../controllers/authController');
const { protect, hierarchyFilter } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.get('/organisations', protect, hierarchyFilter, getOrganisations);
router.get('/organisations/:organisationId/centres', protect, hierarchyFilter, getCentres);
router.get('/centres/:centreId/courses', protect, hierarchyFilter, getCourses);
router.get('/courses/:courseId/batches', protect, hierarchyFilter, getBatches);
router.get('/batches/:batchId/students', protect, getBatchStudents);

module.exports = router;
