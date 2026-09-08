const Student = require('../models/Student');
const Batch = require('../models/Batch');

exports.getStudents = async (req, res) => {
  try {
    const { batch, organisation, centre, course, search } = req.query;

    // Guard page/limit so bad or missing query params can't produce
    // NaN skip/limit values or a 0/negative limit.
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 50));

    const filter = { isActive: true };

    if (organisation) filter.organisation = organisation;
    if (centre) filter.centre = centre;
    if (course) filter.course = course;
    if (batch) filter.batch = batch;

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const [students, total] = await Promise.all([
      Student.find(filter)
        .populate('batch', 'name')
        .populate('course', 'name')
        .sort('rollNumber')
        .skip(skip)
        .limit(limit),
      Student.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: students,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
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