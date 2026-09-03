const mongoose = require('mongoose');

const User = require('../models/User');
const Organisation = require('../models/Organisation');
const Centre = require('../models/Centre');
const Course = require('../models/Course');
const Batch = require('../models/Batch');
const Student = require('../models/Student');

const ALLOWED_ROLES = [
  'super_admin',
  'org_admin',
  'centre_admin',
  'teacher',
  'student',
];

const normalizeArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return [value].filter(Boolean);
};

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const getUserPopulate = () => [
  { path: 'organisation', select: 'name code' },
  { path: 'centre', select: 'name code' },
  { path: 'course', select: 'name code' },
  { path: 'batches', select: 'name code academicYear' },
  { path: 'studentId', select: 'rollNumber name fatherName mobile' },
];

/**
 * ======================================================
 * VALIDATE HIERARCHY
 * ======================================================
 */
const validateHierarchy = async ({
  role,
  organisation,
  centre,
  course,
  batches,
  studentId,
}) => {
  let orgDoc = null;
  let centreDoc = null;
  let courseDoc = null;
  let batchDocs = [];
  let studentDoc = null;

  // --------------------------------------------------
  // SUPER ADMIN
  // --------------------------------------------------

  if (role === 'super_admin') {
    return {
      organisation: undefined,
      centre: undefined,
      course: undefined,
      batches: [],
      studentId: undefined,
    };
  }

  // --------------------------------------------------
  // ORGANISATION
  // --------------------------------------------------

  if (!organisation || !isValidObjectId(organisation)) {
    throw new Error('Organisation is required');
  }

  orgDoc = await Organisation.findOne({
    _id: organisation,
    isActive: true,
  });

  if (!orgDoc) {
    throw new Error('Invalid or inactive organisation');
  }

  // --------------------------------------------------
  // ORG ADMIN
  // --------------------------------------------------

  if (role === 'org_admin') {
    return {
      organisation: orgDoc._id,
      centre: undefined,
      course: undefined,
      batches: [],
      studentId: undefined,
    };
  }

  // --------------------------------------------------
  // CENTRE
  // --------------------------------------------------

  if (!centre || !isValidObjectId(centre)) {
    throw new Error('Centre is required');
  }

  centreDoc = await Centre.findOne({
    _id: centre,
    organisation: organisation,
    isActive: true,
  });

  if (!centreDoc) {
    throw new Error(
      'Invalid centre or centre does not belong to selected organisation'
    );
  }

  // --------------------------------------------------
  // CENTRE ADMIN
  // --------------------------------------------------

  if (role === 'centre_admin') {
    return {
      organisation: orgDoc._id,
      centre: centreDoc._id,
      course: undefined,
      batches: [],
      studentId: undefined,
    };
  }

  // --------------------------------------------------
  // COURSE
  // --------------------------------------------------

  if (!course || !isValidObjectId(course)) {
    throw new Error('Course is required');
  }

  courseDoc = await Course.findOne({
    _id: course,
    organisation: organisation,
    centre: centre,
    isActive: true,
  });

  if (!courseDoc) {
    throw new Error(
      'Invalid course or course does not belong to selected centre'
    );
  }

  // --------------------------------------------------
  // BATCHES
  // --------------------------------------------------

  const batchIds = normalizeArray(batches);

  if (!batchIds.length) {
    throw new Error('At least one batch is required');
  }

  const invalidBatchId = batchIds.find(
    (id) => !isValidObjectId(id)
  );

  if (invalidBatchId) {
    throw new Error('Invalid batch ID');
  }

  batchDocs = await Batch.find({
    _id: { $in: batchIds },
    organisation: organisation,
    centre: centre,
    course: course,
    isActive: true,
  });

  if (batchDocs.length !== batchIds.length) {
    throw new Error(
      'One or more selected batches do not belong to the selected course'
    );
  }

  // --------------------------------------------------
  // STUDENT
  // --------------------------------------------------

  if (role === 'student') {
    if (!studentId || !isValidObjectId(studentId)) {
      throw new Error('Student is required');
    }

    studentDoc = await Student.findOne({
      _id: studentId,
      organisation: organisation,
      centre: centre,
      course: course,
      batch: batchIds[0],
      isActive: true,
    });

    if (!studentDoc) {
      throw new Error(
        'Selected student does not belong to the selected hierarchy'
      );
    }

    if (batchIds.length !== 1) {
      throw new Error('Student can be assigned to only one batch');
    }
  }

  return {
    organisation: orgDoc._id,
    centre: centreDoc._id,
    course: courseDoc._id,
    batches: batchDocs.map((batch) => batch._id),
    studentId: studentDoc ? studentDoc._id : undefined,
  };
};

/**
 * ======================================================
 * GET USERS
 * GET /api/users
 * ======================================================
 */
exports.getUsers = async (req, res) => {
  try {
    const {
      search = '',
      role = '',
      status = '',
      page = 1,
      limit = 20,
    } = req.query;

    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(
      Math.max(Number(limit) || 20, 1),
      100
    );

    const filter = {};

    if (role) {
      if (!ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role',
        });
      }

      filter.role = role;
    }

    if (status === 'active') {
      filter.isActive = true;
    }

    if (status === 'inactive') {
      filter.isActive = false;
    }

    if (search.trim()) {
      const regex = new RegExp(search.trim(), 'i');

      filter.$or = [
        { name: regex },
        { email: regex },
        { mobile: regex },
      ];
    }

    const skip = (pageNumber - 1) * limitNumber;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .populate(getUserPopulate())
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNumber)
        .lean(),

      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        totalPages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    console.error('getUsers error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * ======================================================
 * GET SINGLE USER
 * GET /api/users/:id
 * ======================================================
 */
exports.getUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    const user = await User.findById(id)
      .select('-password')
      .populate(getUserPopulate());

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('getUser error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * ======================================================
 * CREATE USER
 * POST /api/users
 * ======================================================
 */
exports.createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      organisation,
      centre,
      course,
      batches,
      studentId,
      mobile,
      isActive = true,
    } = req.body;

    // --------------------------------------------------
    // BASIC VALIDATION
    // --------------------------------------------------

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name is required',
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    if (!role || !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Valid role is required',
      });
    }

    // --------------------------------------------------
    // EMAIL
    // --------------------------------------------------

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists',
      });
    }

    // --------------------------------------------------
    // HIERARCHY VALIDATION
    // --------------------------------------------------

    const hierarchy = await validateHierarchy({
      role,
      organisation,
      centre,
      course,
      batches,
      studentId,
    });

    // --------------------------------------------------
    // CREATE
    // --------------------------------------------------

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role,

      organisation: hierarchy.organisation,
      centre: hierarchy.centre,
      course: hierarchy.course,

      batches: hierarchy.batches,

      studentId: hierarchy.studentId,

      mobile: mobile?.trim() || undefined,

      isActive: Boolean(isActive),
    });

    const createdUser = await User.findById(user._id)
      .select('-password')
      .populate(getUserPopulate());

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: createdUser,
    });
  } catch (error) {
    console.error('createUser error:', error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists',
      });
    }

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * ======================================================
 * UPDATE USER
 * PUT /api/users/:id
 * ======================================================
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const {
      name,
      email,
      password,
      role,
      organisation,
      centre,
      course,
      batches,
      studentId,
      mobile,
      isActive,
    } = req.body;

    // --------------------------------------------------
    // PREVENT SELF ROLE CHANGE
    // --------------------------------------------------

    if (
      user._id.equals(req.user._id) &&
      role &&
      role !== 'super_admin'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Super Admin cannot remove their own super admin role',
      });
    }

    // --------------------------------------------------
    // ROLE
    // --------------------------------------------------

    const finalRole = role || user.role;

    if (!ALLOWED_ROLES.includes(finalRole)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role',
      });
    }

    // --------------------------------------------------
    // HIERARCHY VALUES
    // --------------------------------------------------

    const finalOrganisation =
      organisation !== undefined
        ? organisation
        : user.organisation;

    const finalCentre =
      centre !== undefined
        ? centre
        : user.centre;

    const finalCourse =
      course !== undefined
        ? course
        : user.course;

    const finalBatches =
      batches !== undefined
        ? batches
        : user.batches || [];

    const finalStudentId =
      studentId !== undefined
        ? studentId
        : user.studentId;

    const hierarchy = await validateHierarchy({
      role: finalRole,
      organisation: finalOrganisation,
      centre: finalCentre,
      course: finalCourse,
      batches: finalBatches,
      studentId: finalStudentId,
    });

    // --------------------------------------------------
    // BASIC FIELDS
    // --------------------------------------------------

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Name cannot be empty',
        });
      }

      user.name = name.trim();
    }

    if (email !== undefined) {
      const normalizedEmail = email.trim().toLowerCase();

      const emailExists = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: user._id },
      });

      if (emailExists) {
        return res.status(409).json({
          success: false,
          message: 'A user with this email already exists',
        });
      }

      user.email = normalizedEmail;
    }

    if (mobile !== undefined) {
      user.mobile = mobile?.trim() || undefined;
    }

    if (password !== undefined) {
      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters',
        });
      }

      user.password = password;
    }

    // --------------------------------------------------
    // HIERARCHY
    // --------------------------------------------------

    user.role = finalRole;

    user.organisation = hierarchy.organisation;
    user.centre = hierarchy.centre;
    user.course = hierarchy.course;
    user.batches = hierarchy.batches;
    user.studentId = hierarchy.studentId;

    if (isActive !== undefined) {
      user.isActive = Boolean(isActive);
    }

    await user.save();

    const updatedUser = await User.findById(user._id)
      .select('-password')
      .populate(getUserPopulate());

    res.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    console.error('updateUser error:', error);

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * ======================================================
 * TOGGLE USER STATUS
 * PATCH /api/users/:id/status
 * ======================================================
 */
exports.toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    if (String(req.user._id) === String(id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account',
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.isActive = !user.isActive;

    await user.save();

    res.json({
      success: true,
      message: user.isActive
        ? 'User activated successfully'
        : 'User deactivated successfully',
      data: {
        id: user._id,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error('toggleUserStatus error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * ======================================================
 * RESET PASSWORD
 * PATCH /api/users/:id/password
 * ======================================================
 */
exports.resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.password = password;

    await user.save();

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error('resetUserPassword error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * ======================================================
 * DELETE USER
 * DELETE /api/users/:id
 *
 * Production-safe approach:
 * Instead of permanently deleting historical users,
 * deactivate them.
 * ======================================================
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    if (String(req.user._id) === String(id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account',
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.isActive = false;

    await user.save();

    res.json({
      success: true,
      message: 'User deactivated successfully',
    });
  } catch (error) {
    console.error('deleteUser error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * ======================================================
 * USER STATS
 * GET /api/users/stats
 * ======================================================
 */
exports.getUserStats = async (req, res) => {
  try {
    const [
      total,
      active,
      inactive,
      superAdmins,
      orgAdmins,
      centreAdmins,
      teachers,
      students,
    ] = await Promise.all([
      User.countDocuments(),

      User.countDocuments({ isActive: true }),

      User.countDocuments({ isActive: false }),

      User.countDocuments({ role: 'super_admin' }),

      User.countDocuments({ role: 'org_admin' }),

      User.countDocuments({ role: 'centre_admin' }),

      User.countDocuments({ role: 'teacher' }),

      User.countDocuments({ role: 'student' }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        active,
        inactive,
        byRole: {
          super_admin: superAdmins,
          org_admin: orgAdmins,
          centre_admin: centreAdmins,
          teacher: teachers,
          student: students,
        },
      },
    });
  } catch (error) {
    console.error('getUserStats error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};