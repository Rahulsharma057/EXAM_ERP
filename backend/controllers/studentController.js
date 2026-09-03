const Student = require('../models/Student');
const Batch = require('../models/Batch');

exports.getStudents = async (req, res) => {
  try {
    const { batch, search, page = 1, limit = 50 } = req.query;
    const filter = { isActive: true };

    if (batch) filter.batch = batch;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [students, total] = await Promise.all([
      Student.find(filter)
        .populate('batch', 'name')
        .populate('course', 'name')
        .sort('rollNumber')
        .skip(skip)
        .limit(parseInt(limit)),
      Student.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: students,
      pagination: { page: parseInt(page), limit: parseInt(limit), total }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('organisation', 'name')
      .populate('centre', 'name')
      .populate('course', 'name')
      .populate('batch', 'name');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    res.json({ success: true, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createStudent = async (req, res) => {
  try {
    const student = await Student.create(req.body);
    res.status(201).json({ success: true, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    res.json({ success: true, data: student });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    await Student.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Student deactivated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
