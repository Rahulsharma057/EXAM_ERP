const Organisation = require('../models/Organisation');
const Centre = require('../models/Centre');
const Course = require('../models/Course');
const Batch = require('../models/Batch');
const Student = require('../models/Student');

// ==================== ORGANISATION ====================
exports.getOrganisations = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const filter = { isActive: true };
    if (search) filter.name = { $regex: search, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [data, total] = await Promise.all([
      Organisation.find(filter).sort('name').skip(skip).limit(parseInt(limit)),
      Organisation.countDocuments(filter)
    ]);
    res.json({ success: true, data, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getOrganisation = async (req, res) => {
  try {
    const org = await Organisation.findById(req.params.id);
    if (!org) return res.status(404).json({ success: false, message: 'Not found' });
    const centreCount = await Centre.countDocuments({ organisation: org._id, isActive: true });
    res.json({ success: true, data: { ...org.toObject(), centreCount } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.createOrganisation = async (req, res) => {
  try {
    const org = await Organisation.create(req.body);
    res.status(201).json({ success: true, data: org });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.updateOrganisation = async (req, res) => {
  try {
    const org = await Organisation.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, data: org });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.deleteOrganisation = async (req, res) => {
  try {
    await Organisation.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Organisation deactivated' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// ==================== CENTRE ====================
exports.getCentres = async (req, res) => {
  try {
    const { organisation, search, page = 1, limit = 20 } = req.query;
    const filter = { isActive: true };
    if (organisation) filter.organisation = organisation;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [data, total] = await Promise.all([
      Centre.find(filter).populate('organisation', 'name').sort('name').skip(skip).limit(parseInt(limit)),
      Centre.countDocuments(filter)
    ]);
    res.json({ success: true, data, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getCentre = async (req, res) => {
  try {
    const centre = await Centre.findById(req.params.id).populate('organisation', 'name');
    if (!centre) return res.status(404).json({ success: false, message: 'Not found' });
    const courseCount = await Course.countDocuments({ centre: centre._id, isActive: true });
    res.json({ success: true, data: { ...centre.toObject(), courseCount } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.createCentre = async (req, res) => {
  try {
    const centre = await Centre.create(req.body);
    const populated = await Centre.findById(centre._id).populate('organisation', 'name');
    res.status(201).json({ success: true, data: populated });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.updateCentre = async (req, res) => {
  try {
    const centre = await Centre.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, data: centre });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.deleteCentre = async (req, res) => {
  try {
    await Centre.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Centre deactivated' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// ==================== COURSE ====================
exports.getCourses = async (req, res) => {
  try {
    const { centre, search, page = 1, limit = 20 } = req.query;
    const filter = { isActive: true };
    if (centre) filter.centre = centre;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [data, total] = await Promise.all([
      Course.find(filter).populate('centre', 'name').populate('organisation', 'name').sort('name').skip(skip).limit(parseInt(limit)),
      Course.countDocuments(filter)
    ]);
    res.json({ success: true, data, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getCourse = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id).populate('centre', 'name').populate('organisation', 'name');
    if (!course) return res.status(404).json({ success: false, message: 'Not found' });
    const batchCount = await Batch.countDocuments({ course: course._id, isActive: true });
    res.json({ success: true, data: { ...course.toObject(), batchCount } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.createCourse = async (req, res) => {
  try {
    const { name, code, description, duration, centre } = req.body;

    if (!centre) {
      return res.status(400).json({
        success: false,
        message: 'Centre is required'
      });
    }

    const selectedCentre = await Centre.findById(centre);

    if (!selectedCentre) {
      return res.status(404).json({
        success: false,
        message: 'Centre not found'
      });
    }

    if (!selectedCentre.organisation) {
      return res.status(400).json({
        success: false,
        message: 'Selected centre is not linked to an organisation'
      });
    }

    const course = await Course.create({
      name,
      code,
      description,
      duration,
      centre: selectedCentre._id,
      organisation: selectedCentre.organisation
    });

    const populated = await Course.findById(course._id)
      .populate('centre', 'name')
      .populate('organisation', 'name');

    res.status(201).json({
      success: true,
      data: populated
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
exports.updateCourse = async (req, res) => {
  try {
    const { name, code, description, duration, centre } = req.body;

    const existingCourse = await Course.findById(req.params.id);

    if (!existingCourse) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    let organisation = existingCourse.organisation;

    if (centre && centre.toString() !== existingCourse.centre.toString()) {
      const selectedCentre = await Centre.findById(centre);

      if (!selectedCentre) {
        return res.status(404).json({
          success: false,
          message: 'Centre not found'
        });
      }

      if (!selectedCentre.organisation) {
        return res.status(400).json({
          success: false,
          message: 'Selected centre is not linked to an organisation'
        });
      }

      organisation = selectedCentre.organisation;
    }

    existingCourse.name = name ?? existingCourse.name;
    existingCourse.code = code ?? existingCourse.code;
    existingCourse.description = description ?? existingCourse.description;
    existingCourse.duration = duration ?? existingCourse.duration;
    existingCourse.centre = centre ?? existingCourse.centre;
    existingCourse.organisation = organisation;

    await existingCourse.save();

    const populated = await Course.findById(existingCourse._id)
      .populate('centre', 'name')
      .populate('organisation', 'name');

    res.json({
      success: true,
      data: populated
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    await Course.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Course deactivated' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// ==================== BATCH ====================
exports.getBatches = async (req, res) => {
  try {
    const {
      course,
      search,
      page = 1,
      limit = 20
    } = req.query;

    const filter = {
      isActive: true
    };

    // =====================================================
    // TEACHER → ONLY ASSIGNED BATCHES
    // =====================================================
    if (req.user?.role === "teacher") {
      const assignedBatches = req.user.batches || [];

      // Teacher ke paas koi batch assigned nahi hai
      if (!assignedBatches.length) {
        return res.json({
          success: true,
          data: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0
          }
        });
      }

      filter._id = {
        $in: assignedBatches
      };
    }

    // =====================================================
    // COURSE FILTER
    // =====================================================
    if (course) {
      filter.course = course;
    }

    // =====================================================
    // SEARCH
    // =====================================================
    if (search) {
      filter.name = {
        $regex: search,
        $options: "i"
      };
    }

    const pageNumber = Math.max(parseInt(page) || 1, 1);
    const limitNumber = Math.min(
      Math.max(parseInt(limit) || 20, 1),
      500
    );

    const skip = (pageNumber - 1) * limitNumber;

    const [data, total] = await Promise.all([
      Batch.find(filter)
        .populate("course", "name code")
        .populate("centre", "name code")
        .populate("organisation", "name code")
        .sort("name")
        .skip(skip)
        .limit(limitNumber),

      Batch.countDocuments(filter)
    ]);

    return res.json({
      success: true,
      data,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total
      }
    });

  } catch (error) {
    console.error("GET BATCHES ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
exports.getBatch = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id)
      .populate("course", "name code")
      .populate("centre", "name code")
      .populate("organisation", "name code");

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Batch not found"
      });
    }

    // =====================================================
    // TEACHER ACCESS CHECK
    // =====================================================
    if (req.user?.role === "teacher") {
      const assignedBatches = (req.user.batches || []).map(
        (id) => id.toString()
      );

      if (!assignedBatches.includes(batch._id.toString())) {
        return res.status(403).json({
          success: false,
          message: "You are not assigned to this batch"
        });
      }
    }

    const studentCount = await Student.countDocuments({
      batch: batch._id,
      isActive: true
    });

    return res.json({
      success: true,
      data: {
        ...batch.toObject(),
        studentCount
      }
    });

  } catch (error) {
    console.error("GET BATCH ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.createBatch = async (req, res) => {
  try {
    const {
      name,
      code,
      startDate,
      endDate,
      capacity,
      course,
      description
    } = req.body;

    // Course required
    if (!course) {
      return res.status(400).json({
        success: false,
        message: 'Course is required'
      });
    }

    // Find selected course
    const selectedCourse = await Course.findById(course);

    if (!selectedCourse) {
      return res.status(404).json({
        success: false,
        message: 'Course not found'
      });
    }

    // Course must have centre
    if (!selectedCourse.centre) {
      return res.status(400).json({
        success: false,
        message: 'Selected course is not linked to a centre'
      });
    }

    // Course must have organisation
    if (!selectedCourse.organisation) {
      return res.status(400).json({
        success: false,
        message: 'Selected course is not linked to an organisation'
      });
    }

    // Create batch
    const batch = await Batch.create({
      name,
      code,
      startDate,
      endDate,
      capacity,
      description,

      course: selectedCourse._id,
      centre: selectedCourse.centre,
      organisation: selectedCourse.organisation
    });

    // Populate hierarchy
    const populated = await Batch.findById(batch._id)
      .populate('organisation', 'name')
      .populate('centre', 'name')
      .populate('course', 'name code');

    return res.status(201).json({
      success: true,
      data: populated
    });

  } catch (error) {
    console.error('CREATE BATCH ERROR:', error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateBatch = async (req, res) => {
  try {
    const {
      name,
      code,
      startDate,
      endDate,
      capacity,
      course,
      description
    } = req.body;

    const existingBatch = await Batch.findById(req.params.id);

    if (!existingBatch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    let organisation = existingBatch.organisation;
    let centre = existingBatch.centre;

    // If course is changed, derive centre + organisation again
    if (course && course.toString() !== existingBatch.course?.toString()) {
      const selectedCourse = await Course.findById(course);

      if (!selectedCourse) {
        return res.status(404).json({
          success: false,
          message: 'Course not found'
        });
      }

      if (!selectedCourse.centre) {
        return res.status(400).json({
          success: false,
          message: 'Selected course is not linked to a centre'
        });
      }

      if (!selectedCourse.organisation) {
        return res.status(400).json({
          success: false,
          message: 'Selected course is not linked to an organisation'
        });
      }

      centre = selectedCourse.centre;
      organisation = selectedCourse.organisation;
    }

    existingBatch.name = name ?? existingBatch.name;
    existingBatch.code = code ?? existingBatch.code;
    existingBatch.startDate = startDate ?? existingBatch.startDate;
    existingBatch.endDate = endDate ?? existingBatch.endDate;
    existingBatch.capacity = capacity ?? existingBatch.capacity;
    existingBatch.description = description ?? existingBatch.description;

    if (course) {
      existingBatch.course = course;
    }

    existingBatch.centre = centre;
    existingBatch.organisation = organisation;

    await existingBatch.save();

    const populated = await Batch.findById(existingBatch._id)
      .populate('organisation', 'name')
      .populate('centre', 'name')
      .populate('course', 'name code');

    return res.json({
      success: true,
      data: populated
    });

  } catch (error) {
    console.error('UPDATE BATCH ERROR:', error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.deleteBatch = async (req, res) => {
  try {
    await Batch.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Batch deactivated' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};
