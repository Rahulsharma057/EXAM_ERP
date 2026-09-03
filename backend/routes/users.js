const express = require('express');

const router = express.Router();

const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  toggleUserStatus,
  resetUserPassword,
  deleteUser,
  getUserStats,
} = require('../controllers/userController');

const { protect, authorize } = require('../middleware/auth');

// ======================================================
// SUPER ADMIN ONLY
// ======================================================

router.use(protect);
router.use(authorize('super_admin'));

// ======================================================
// USER STATS
// GET /api/users/stats
// ======================================================

router.get('/stats', getUserStats);

// ======================================================
// USERS
// ======================================================

router.get('/', getUsers);

router.post('/', createUser);

// ======================================================
// SINGLE USER
// ======================================================

router.get('/:id', getUser);

router.put('/:id', updateUser);

router.patch('/:id/status', toggleUserStatus);

router.patch('/:id/password', resetUserPassword);

router.delete('/:id', deleteUser);

module.exports = router;