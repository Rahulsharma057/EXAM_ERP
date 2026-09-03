const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Organisation = require('../models/Organisation');
const Centre = require('../models/Centre');
const Course = require('../models/Course');
const Batch = require('../models/Batch');
const Student = require('../models/Student');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'your_jwt_secret', {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, role, organisation, centre, course, batch } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const user = await User.create({
      name, email, password, role,
      organisation, centre, course, batch
    });

    res.status(201).json({
      success: true,
      token: generateToken(user._id),
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!user.isActive) {
  return res.status(401).json({
    success: false,
    message:
      'Your account is inactive. Please contact administrator.',
  });
}

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    res.json({
      success: true,
      token: generateToken(user._id),
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('organisation', 'name code')
      .populate('centre', 'name code')
      .populate('course', 'name code')
  .populate('batches', 'name code')
      .populate('studentId', 'rollNumber name');

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Hierarchy endpoints
exports.getOrganisations = async (req, res) => {
  try {
    const filter = req.hierarchyFilter.organisation 
      ? { _id: req.hierarchyFilter.organisation } 
      : {};
    const orgs = await Organisation.find({ ...filter, isActive: true }).sort('name');
    res.json({ success: true, data: orgs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCentres = async (req, res) => {
  try {
    const { organisationId } = req.params;
    const filter = { organisation: organisationId, isActive: true };
    if (req.hierarchyFilter.centre) filter._id = req.hierarchyFilter.centre;

    const centres = await Centre.find(filter).sort('name');
    res.json({ success: true, data: centres });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCourses = async (req, res) => {
  try {
    const { centreId } = req.params;
    const filter = { centre: centreId, isActive: true };
    if (req.hierarchyFilter.course) filter._id = req.hierarchyFilter.course;

    const courses = await Course.find(filter).sort('name');
    res.json({ success: true, data: courses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBatches = async (req, res) => {
  try {
    const { courseId } = req.params;
    const filter = { course: courseId, isActive: true };
    if (req.hierarchyFilter.batch) filter._id = req.hierarchyFilter.batch;

    const batches = await Batch.find(filter).sort('name');
    res.json({ success: true, data: batches });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getBatchStudents = async (req, res) => {
  try {
    const { batchId } = req.params;

    if (req.user.role === 'teacher') {
      const assignedBatches = (req.user.batches || []).map(
        id => id.toString()
      );

      if (!assignedBatches.includes(batchId.toString())) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned to this batch',
        });
      }
    }

    const students = await Student.find({
      batch: batchId,
      isActive: true,
    })
      .sort('rollNumber')
      .select('rollNumber name fatherName mobile gender');

    res.json({
      success: true,
      data: students,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
