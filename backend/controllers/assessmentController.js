const Assessment = require('../models/Assessment');
const AssessmentSection = require('../models/AssessmentSection');
const AssessmentQuestion = require('../models/AssessmentQuestion');
const AssessmentSubmission = require('../models/AssessmentSubmission');
const Student = require('../models/Student');
const Batch = require('../models/Batch');
const { ASSESSMENT_STATUS } = require('../config/constants');
const isTeacherAssignedToBatch = (user, batchId) => {
  if (user?.role !== "teacher") {
    return true;
  }

  const assignedBatches = (user.batches || []).map(
    (id) => id.toString()
  );

  return assignedBatches.includes(batchId?.toString());
};

const getAccessibleAssessment = async (assessmentId, user) => {
  const assessment = await Assessment.findById(assessmentId);

  if (!assessment) {
    return {
      assessment: null,
      error: {
        status: 404,
        message: "Assessment not found",
      },
    };
  }

  if (
    user?.role === "teacher" &&
    !isTeacherAssignedToBatch(user, assessment.batch)
  ) {
    return {
      assessment: null,
      error: {
        status: 403,
        message: "You are not authorized to access this assessment",
      },
    };
  }

  return {
    assessment,
    error: null,
  };
};
// Helper to recalculate totals
const recalculateAssessmentTotals = async (assessmentId) => {
  const sections = await AssessmentSection.find({ assessment: assessmentId, isActive: true });
  let totalMarks = 0;
  let totalQuestions = 0;

  for (const section of sections) {
    const questions = await AssessmentQuestion.find({ section: section._id, isActive: true });
    const sectionTotal = questions.reduce((sum, q) => sum + q.maxPoints, 0);
    section.totalMarks = sectionTotal;
    await section.save();
    totalMarks += sectionTotal;
    totalQuestions += questions.length;
  }

  await Assessment.findByIdAndUpdate(assessmentId, { totalMarks, totalQuestions });
};

exports.createAssessment = async (req, res) => {
  try {
    const {
      name, code, description, instructions,
      organisation, centre, course, batch,
      weekNumber, academicYear,
      publishDate, publishTime, closeDate, closeTime
    } = req.body;

    // Check duplicate week for batch
    const existing = await Assessment.findOne({ batch, weekNumber });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Assessment for Week ${weekNumber} already exists for this batch`
      });
    }

    const assessment = await Assessment.create({
      name, code, description, instructions,
      organisation, centre, course, batch,
      weekNumber, academicYear,
      publishDate, publishTime, closeDate, closeTime,
      status: ASSESSMENT_STATUS.DRAFT,
      createdBy: req.user.id
    });

    res.status(201).json({ success: true, data: assessment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
exports.getAssessments = async (req, res) => {
  try {
    const {
      organisation,
      centre,
      course,
      batch,
      status,
      weekNumber,
      search,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    // ==========================================================
    // QUERY FILTERS
    // ==========================================================

    if (organisation) {
      filter.organisation = organisation;
    }

    if (centre) {
      filter.centre = centre;
    }

    if (course) {
      filter.course = course;
    }

    if (batch) {
      filter.batch = batch;
    }

    if (status) {
      filter.status = status;
    }

    if (weekNumber) {
      filter.weekNumber = parseInt(weekNumber, 10);
    }

    if (search) {
      filter.name = {
        $regex: search,
        $options: "i",
      };
    }

    // ==========================================================
    // HIERARCHY SECURITY
    // ==========================================================

    const hierarchyFilter = req.hierarchyFilter || {};

    // Organisation restriction
    if (hierarchyFilter.organisation) {
      filter.organisation = hierarchyFilter.organisation;
    }

    // Centre restriction
    if (hierarchyFilter.centre) {
      filter.centre = hierarchyFilter.centre;
    }

    // Course restriction
    if (hierarchyFilter.course) {
      filter.course = hierarchyFilter.course;
    }

    // Batch restriction
    if (hierarchyFilter.batch) {
      filter.batch = hierarchyFilter.batch;
    }

    // ==========================================================
    // EXTRA TEACHER SAFETY
    // ==========================================================

    if (req.user?.role === "teacher") {
      const assignedBatches = req.user.batches || [];

      if (!assignedBatches.length) {
        return res.json({
          success: true,
          data: [],
          pagination: {
            page: parseInt(page, 10),
            limit: parseInt(limit, 10),
            total: 0,
          },
        });
      }

      // IMPORTANT:
      // Teacher can ONLY see assessments belonging
      // to their assigned batches.
      filter.batch = {
        $in: assignedBatches,
      };
    }

    // ==========================================================
    // PAGINATION
    // ==========================================================

    const currentPage = Math.max(parseInt(page, 10) || 1, 1);

    const currentLimit = Math.min(
      Math.max(parseInt(limit, 10) || 20, 1),
      100
    );

    const skip =
      (currentPage - 1) * currentLimit;

    // ==========================================================
    // DATABASE
    // ==========================================================

    const [assessments, total] = await Promise.all([
      Assessment.find(filter)
        .populate("organisation", "name")
        .populate("centre", "name")
        .populate("course", "name")
        .populate("batch", "name")
        .populate("createdBy", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(currentLimit),

      Assessment.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: assessments,
      pagination: {
        page: currentPage,
        limit: currentLimit,
        total,
      },
    });
  } catch (error) {
    console.error(
      "GET ASSESSMENTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.id)
      .populate('organisation', 'name')
      .populate('centre', 'name')
      .populate('course', 'name')
      .populate('batch', 'name')
      .populate('createdBy', 'name');

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    // Get sections
    const sections = await AssessmentSection.find({
      assessment: assessment._id,
      isActive: true
    }).sort('displayOrder');

    // Get questions for each section
    const sectionsWithQuestions = await Promise.all(
      sections.map(async (section) => {
        const questions = await AssessmentQuestion.find({
          section: section._id,
          isActive: true
        }).sort('displayOrder');

        return {
          ...section.toObject(),
          questions
        };
      })
    );

    return res.json({
      success: true,
      data: {
        ...assessment.toObject(),
        sections: sectionsWithQuestions
      }
    });

  } catch (error) {
    console.error('GET ASSESSMENT ERROR:', error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.id);
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    // Prevent editing if already has submissions
    const hasSubmissions = await AssessmentSubmission.exists({ assessment: assessment._id });
    if (hasSubmissions && ['PUBLISHED', 'CLOSED'].includes(assessment.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit assessment with existing submissions. Create a new version instead.'
      });
    }

    const updates = { ...req.body, updatedBy: req.user.id };
    delete updates.status; // Status changes via dedicated endpoints

    const updated = await Assessment.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
exports.duplicateAssessment = async (req, res) => {
  try {
    const source = await Assessment.findById(req.params.id);

    if (!source) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    const {
      newName,
      newCode,
      newWeekNumber,
      targetBatch,
    } = req.body;

    // --------------------------------------------------
    // TARGET BATCH REQUIRED
    // --------------------------------------------------

    if (!targetBatch) {
      return res.status(400).json({
        success: false,
        message: "Please select a target batch",
      });
    }

    // --------------------------------------------------
    // GET TARGET BATCH
    // --------------------------------------------------

    const batch = await Batch.findById(targetBatch);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Target batch not found",
      });
    }

    // --------------------------------------------------
    // TARGET HIERARCHY
    // --------------------------------------------------

    const organisationId = batch.organisation;
    const centreId = batch.centre;
    const courseId = batch.course;

    if (!organisationId || !centreId || !courseId) {
      return res.status(400).json({
        success: false,
        message:
          "Selected batch is missing organisation, centre or course information",
      });
    }

    // --------------------------------------------------
    // WEEK
    // --------------------------------------------------

    const weekNumber =
      newWeekNumber !== undefined &&
      newWeekNumber !== null &&
      newWeekNumber !== ""
        ? parseInt(newWeekNumber)
        : source.weekNumber;

    if (!Number.isInteger(weekNumber) || weekNumber <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid week number",
      });
    }

    // --------------------------------------------------
    // CHECK DUPLICATE
    // --------------------------------------------------

    const existing = await Assessment.findOne({
      batch: targetBatch,
      weekNumber,
      isActive: true,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Assessment for Week ${weekNumber} already exists for this batch`,
      });
    }

    // --------------------------------------------------
    // CREATE NEW ASSESSMENT
    // --------------------------------------------------

    const newAssessment = await Assessment.create({
      name: newName || `${source.name} (Copy)`,

      code:
        newCode ||
        `${source.code}_COPY_${String(targetBatch).slice(-6)}`,

      description: source.description,
      instructions: source.instructions,

      organisation: organisationId,
      centre: centreId,
      course: courseId,
      batch: targetBatch,

      weekNumber,

      academicYear: source.academicYear,

      status: ASSESSMENT_STATUS.DRAFT,

      publishDate: null,
      publishTime: null,
      closeDate: null,
      closeTime: null,

      totalMarks: 0,
      totalQuestions: 0,

      createdBy: req.user.id,
    });

    // --------------------------------------------------
    // COPY SECTIONS
    // --------------------------------------------------

    const sections = await AssessmentSection.find({
      assessment: source._id,
      isActive: true,
    }).sort("displayOrder");

    for (const section of sections) {
      const newSection = await AssessmentSection.create({
        assessment: newAssessment._id,

        name: section.name,
        description: section.description,

        displayOrder: section.displayOrder,

        totalMarks: 0,

        isActive: true,
      });

      // ------------------------------------------------
      // COPY QUESTIONS
      // ------------------------------------------------

      const questions = await AssessmentQuestion.find({
        section: section._id,
        isActive: true,
      }).sort("displayOrder");

      for (const question of questions) {
        await AssessmentQuestion.create({
          assessment: newAssessment._id,
          section: newSection._id,

          questionText: question.questionText,

          questionType: question.questionType,

          options: question.options || [],

          maxPoints: question.maxPoints,

          isRequired: question.isRequired,

          displayOrder: question.displayOrder,

          isActive: true,

          scoringConfig: question.scoringConfig,
        });
      }
    }

    // --------------------------------------------------
    // RECALCULATE TOTALS
    // --------------------------------------------------

    await recalculateAssessmentTotals(
      newAssessment._id
    );

    // --------------------------------------------------
    // RETURN POPULATED ASSESSMENT
    // --------------------------------------------------

    const populatedAssessment =
      await Assessment.findById(newAssessment._id)
        .populate("organisation", "name")
        .populate("centre", "name")
        .populate("course", "name")
        .populate("batch", "name");

    return res.status(201).json({
      success: true,
      message:
        "Assessment successfully duplicated to selected batch",

      data: populatedAssessment,
    });
  } catch (error) {
    console.error(
      "DUPLICATE ASSESSMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.publishAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.id);
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    if (![ASSESSMENT_STATUS.DRAFT, ASSESSMENT_STATUS.SCHEDULED].includes(assessment.status)) {
      return res.status(400).json({ success: false, message: 'Assessment cannot be published from current status' });
    }

    // Verify assessment has sections and questions
    const sections = await AssessmentSection.find({ assessment: assessment._id, isActive: true });
    if (sections.length === 0) {
      return res.status(400).json({ success: false, message: 'Assessment must have at least one section' });
    }

    let hasQuestions = false;
    for (const section of sections) {
      const qCount = await AssessmentQuestion.countDocuments({ section: section._id, isActive: true });
      if (qCount > 0) hasQuestions = true;
    }

    if (!hasQuestions) {
      return res.status(400).json({ success: false, message: 'Assessment must have at least one question' });
    }

    assessment.status = ASSESSMENT_STATUS.PUBLISHED;
    assessment.publishDate = assessment.publishDate || new Date();
    await assessment.save();

    res.json({ success: true, data: assessment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.scheduleAssessment = async (req, res) => {
  try {
    const { publishDate, publishTime, closeDate, closeTime } = req.body;
    const assessment = await Assessment.findById(req.params.id);

    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    assessment.status = ASSESSMENT_STATUS.SCHEDULED;
    assessment.publishDate = publishDate;
    assessment.publishTime = publishTime;
    assessment.closeDate = closeDate;
    assessment.closeTime = closeTime;
    await assessment.save();

    res.json({ success: true, data: assessment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.closeAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.id);
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    assessment.status = ASSESSMENT_STATUS.CLOSED;
    assessment.closeDate = new Date();
    await assessment.save();

    res.json({ success: true, data: assessment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.archiveAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findByIdAndUpdate(
      req.params.id,
      { status: ASSESSMENT_STATUS.ARCHIVED },
      { new: true }
    );
    res.json({ success: true, data: assessment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteAssessment = async (req, res) => {
  try {
    const { id } = req.params;

    const assessment = await Assessment.findById(id);

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    // Sirf DRAFT delete ho sakta hai
    if (assessment.status !== ASSESSMENT_STATUS.DRAFT) {
      return res.status(400).json({
        success: false,
        message: "Only draft assessments can be deleted",
      });
    }

    // Pehle questions delete
    await AssessmentQuestion.deleteMany({
      assessment: assessment._id,
    });

    // Phir sections delete
    await AssessmentSection.deleteMany({
      assessment: assessment._id,
    });

    // Finally assessment delete
    await Assessment.findByIdAndDelete(
      assessment._id
    );

    return res.json({
      success: true,
      message: "Assessment permanently deleted",
      data: {
        deletedAssessmentId: assessment._id,
      },
    });
  } catch (error) {
    console.error(
      "DELETE ASSESSMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



exports.getAssessmentPreview = async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.id)
      .populate('organisation', 'name')
      .populate('centre', 'name')
      .populate('course', 'name')
      .populate('batch', 'name');

    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    const sections = await AssessmentSection.find({ assessment: assessment._id, isActive: true })
      .sort('displayOrder');

    const sectionsWithQuestions = await Promise.all(
      sections.map(async (section) => {
        const questions = await AssessmentQuestion.find({
          section: section._id,
          isActive: true
        }).sort('displayOrder').select('-assessment');
        return { ...section.toObject(), questions };
      })
    );

    res.json({
      success: true,
      data: {
        assessment: assessment.toObject(),
        sections: sectionsWithQuestions
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


exports.recalculateAssessmentTotals = recalculateAssessmentTotals;




