const express = require('express');
const router = express.Router();
const {
  getOrganisations, getOrganisation, createOrganisation, updateOrganisation, deleteOrganisation,
  getCentres, getCentre, createCentre, updateCentre, deleteCentre,
  getCourses, getCourse, createCourse, updateCourse, deleteCourse,
  getBatches, getBatch, createBatch, updateBatch, deleteBatch
} = require('../controllers/orgController');
const { protect, authorize } = require('../middleware/auth');

// Organisations
router.get('/organisations', protect, getOrganisations);
router.get('/organisations/:id', protect, getOrganisation);
router.post('/organisations', protect, authorize('super_admin'), createOrganisation);
router.put('/organisations/:id', protect, authorize('super_admin'), updateOrganisation);
router.delete('/organisations/:id', protect, authorize('super_admin'), deleteOrganisation);

// Centres
router.get('/centres', protect, getCentres);
router.get('/centres/:id', protect, getCentre);
router.post('/centres', protect, authorize('super_admin', 'org_admin'), createCentre);
router.put('/centres/:id', protect, authorize('super_admin', 'org_admin'), updateCentre);
router.delete('/centres/:id', protect, authorize('super_admin', 'org_admin'), deleteCentre);

// Courses
router.get('/courses', protect, getCourses);
router.get('/courses/:id', protect, getCourse);
router.post('/courses', protect, authorize('super_admin', 'org_admin', 'centre_admin'), createCourse);
router.put('/courses/:id', protect, authorize('super_admin', 'org_admin', 'centre_admin'), updateCourse);
router.delete('/courses/:id', protect, authorize('super_admin', 'org_admin', 'centre_admin'), deleteCourse);

// Batches
router.get('/batches', protect, getBatches);
router.get('/batches/:id', protect, getBatch);
router.post('/batches', protect, authorize('super_admin', 'org_admin', 'centre_admin'), createBatch);
router.put('/batches/:id', protect, authorize('super_admin', 'org_admin', 'centre_admin'), updateBatch);
router.delete('/batches/:id', protect, authorize('super_admin', 'org_admin', 'centre_admin'), deleteBatch);

module.exports = router;
