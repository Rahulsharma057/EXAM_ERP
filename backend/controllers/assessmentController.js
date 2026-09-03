
const mongoose = require("mongoose");

const Assessment = require("../models/Assessment");
const AssessmentPart = require("../models/AssessmentPart");
const AssessmentSection = require("../models/AssessmentSection");
const AssessmentQuestion = require("../models/AssessmentQuestion");
const AssessmentSubmission = require("../models/AssessmentSubmission");
const Batch = require("../models/Batch");

const { ASSESSMENT_STATUS } = require("../config/constants");

// ============================================================
// HELPERS
// ============================================================

const getUserId = (req) => {
  return req.user?.id || req.user?._id;
};

const normalizeRole = (role) => {
  return String(role || "").trim().toLowerCase();
};

const isTeacher = (user) => {
  return normalizeRole(user?.role) === "teacher";
};

const isTeacherAssignedToBatch = (user, batchId) => {
  if (!isTeacher(user)) {
    return true;
  }

  const assignedBatches = (user?.batches || []).map((id) =>
    id?.toString()
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
    isTeacher(user) &&
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

// ============================================================
// VALIDATE ASSESSMENT HIERARCHY
// ============================================================

const validateAssessmentHierarchy = async ({
  organisation,
  centre,
  course,
  batch,
}) => {
  if (!organisation || !centre || !course || !batch) {
    return {
      valid: false,
      message:
        "Organisation, Centre, Course and Batch are required",
    };
  }

  const batchDoc = await Batch.findById(batch);

  if (!batchDoc) {
    return {
      valid: false,
      message: "Batch not found",
    };
  }

  if (
    batchDoc.organisation &&
    batchDoc.organisation.toString() !== organisation.toString()
  ) {
    return {
      valid: false,
      message: "Selected batch does not belong to selected organisation",
    };
  }

  if (
    batchDoc.centre &&
    batchDoc.centre.toString() !== centre.toString()
  ) {
    return {
      valid: false,
      message: "Selected batch does not belong to selected centre",
    };
  }

  if (
    batchDoc.course &&
    batchDoc.course.toString() !== course.toString()
  ) {
    return {
      valid: false,
      message: "Selected batch does not belong to selected course",
    };
  }

  return {
    valid: true,
    batch: batchDoc,
  };
};

// ============================================================
// GET ASSESSMENT STRUCTURE
// ============================================================

const getAssessmentStructure = async (assessmentId) => {
  const assessment = await Assessment.findById(assessmentId);

  if (!assessment) {
    return null;
  }

  const parts = assessment.hasParts
    ? await AssessmentPart.find({
        assessment: assessmentId,
        isActive: true,
      }).sort({
        displayOrder: 1,
        createdAt: 1,
      })
    : [];

  const sections = await AssessmentSection.find({
    assessment: assessmentId,
    isActive: true,
  }).sort({
    displayOrder: 1,
    createdAt: 1,
  });

  const sectionIds = sections.map((section) => section._id);

  const questions =
    sectionIds.length > 0
      ? await AssessmentQuestion.find({
          assessment: assessmentId,
          section: { $in: sectionIds },
          isActive: true,
        }).sort({
          displayOrder: 1,
          createdAt: 1,
        })
      : [];

  const questionsBySection = new Map();

  for (const question of questions) {
    const key = question.section.toString();

    if (!questionsBySection.has(key)) {
      questionsBySection.set(key, []);
    }

    questionsBySection.get(key).push(question);
  }

  const sectionsWithQuestions = sections.map((section) => ({
    section,
    questions:
      questionsBySection.get(section._id.toString()) || [],
  }));

  return {
    assessment,
    parts,
    sections: sectionsWithQuestions,
  };
};

// ============================================================
// RECALCULATE TOTALS
//
// Assessment total = all active questions.
// Optional part exclusion is handled during SUBMISSION scoring,
// not here.
//
// This keeps the assessment template's actual maximum marks intact.
// ============================================================

const recalculateAssessmentTotals = async (assessmentId) => {
  const assessment = await Assessment.findById(assessmentId);

  if (!assessment) {
    throw new Error("Assessment not found");
  }

  const sections = await AssessmentSection.find({
    assessment: assessmentId,
    isActive: true,
  }).sort({
    displayOrder: 1,
  });

  const sectionIds = sections.map((section) => section._id);

  const questions =
    sectionIds.length > 0
      ? await AssessmentQuestion.find({
          assessment: assessmentId,
          section: { $in: sectionIds },
          isActive: true,
        })
      : [];

  const questionsBySection = new Map();

  for (const question of questions) {
    const key = question.section.toString();

    if (!questionsBySection.has(key)) {
      questionsBySection.set(key, []);
    }

    questionsBySection.get(key).push(question);
  }

  const sectionTotals = new Map();

  for (const section of sections) {
    const sectionQuestions =
      questionsBySection.get(section._id.toString()) || [];

    const sectionTotal = sectionQuestions.reduce(
      (sum, question) =>
        sum + Number(question.maxPoints || 0),
      0
    );

    section.totalMarks = sectionTotal;
    section.totalQuestions = sectionQuestions.length;

    await section.save();

    sectionTotals.set(section._id.toString(), {
      totalMarks: sectionTotal,
      totalQuestions: sectionQuestions.length,
    });
  }

  // ==========================================================
  // PART TOTALS
  // ==========================================================

  if (assessment.hasParts) {
    const parts = await AssessmentPart.find({
      assessment: assessmentId,
      isActive: true,
    });

    for (const part of parts) {
      const partSections = sections.filter(
        (section) =>
          section.part &&
          section.part.toString() === part._id.toString()
      );

      let partTotalMarks = 0;
      let partTotalQuestions = 0;

      for (const section of partSections) {
        const sectionTotal =
          sectionTotals.get(section._id.toString()) || {
            totalMarks: 0,
            totalQuestions: 0,
          };

        partTotalMarks += sectionTotal.totalMarks;
        partTotalQuestions += sectionTotal.totalQuestions;
      }

      part.totalMarks = partTotalMarks;
      part.totalQuestions = partTotalQuestions;

      await part.save();
    }
  }

  // ==========================================================
  // ASSESSMENT TOTAL
  // ==========================================================

  const totalMarks = sections.reduce(
    (sum, section) =>
      sum +
      Number(
        sectionTotals.get(section._id.toString())?.totalMarks || 0
      ),
    0
  );

  const totalQuestions = sections.reduce(
    (sum, section) =>
      sum +
      Number(
        sectionTotals.get(section._id.toString())
          ?.totalQuestions || 0
      ),
    0
  );

  assessment.totalMarks = totalMarks;
  assessment.totalQuestions = totalQuestions;

  await assessment.save();

  return assessment;
};

// ============================================================
// CREATE ASSESSMENT
// ============================================================

exports.createAssessment = async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      instructions,

      organisation,
      centre,
      course,
      batch,

      weekNumber,
      academicYear,

      hasParts = false,

      publishDate,
      publishTime,
      closeDate,
      closeTime,
    } = req.body;

    // --------------------------------------------------------
    // REQUIRED FIELDS
    // --------------------------------------------------------

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Assessment name is required",
      });
    }

    if (!weekNumber || Number(weekNumber) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid week number is required",
      });
    }

    // --------------------------------------------------------
    // HIERARCHY
    // --------------------------------------------------------

    const hierarchy = await validateAssessmentHierarchy({
      organisation,
      centre,
      course,
      batch,
    });

    if (!hierarchy.valid) {
      return res.status(400).json({
        success: false,
        message: hierarchy.message,
      });
    }

    // --------------------------------------------------------
    // DUPLICATE WEEK
    // --------------------------------------------------------

    const existing = await Assessment.findOne({
      batch,
      weekNumber: Number(weekNumber),
      isActive: true,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Assessment for Week ${weekNumber} already exists for this batch`,
      });
    }

    // --------------------------------------------------------
    // CREATE
    // --------------------------------------------------------

    const assessment = await Assessment.create({
      name: name.trim(),
      code,
      description,
      instructions,

      organisation,
      centre,
      course,
      batch,

      weekNumber: Number(weekNumber),
      academicYear,

      hasParts: Boolean(hasParts),

      publishDate,
      publishTime,
      closeDate,
      closeTime,

      status: ASSESSMENT_STATUS.DRAFT,

      createdBy: getUserId(req),
    });

    return res.status(201).json({
      success: true,
      data: assessment,
    });
  } catch (error) {
    console.error("CREATE ASSESSMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// GET ASSESSMENTS
// ============================================================

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

    // ========================================================
    // HIERARCHY SECURITY
    // ========================================================

    const hierarchyFilter = req.hierarchyFilter || {};

    if (hierarchyFilter.organisation) {
      filter.organisation = hierarchyFilter.organisation;
    }

    if (hierarchyFilter.centre) {
      filter.centre = hierarchyFilter.centre;
    }

    if (hierarchyFilter.course) {
      filter.course = hierarchyFilter.course;
    }

    if (hierarchyFilter.batch) {
      filter.batch = hierarchyFilter.batch;
    }

    // ========================================================
    // TEACHER SECURITY
    // ========================================================

    if (isTeacher(req.user)) {
      const assignedBatches = req.user?.batches || [];

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

      filter.batch = {
        $in: assignedBatches,
      };
    }

    // ========================================================
    // PAGINATION
    // ========================================================

    const currentPage = Math.max(
      parseInt(page, 10) || 1,
      1
    );

    const currentLimit = Math.min(
      Math.max(parseInt(limit, 10) || 20, 1),
      100
    );

    const skip = (currentPage - 1) * currentLimit;

    // ========================================================
    // DATABASE
    // ========================================================

    const [assessments, total] = await Promise.all([
      Assessment.find(filter)
        .populate("organisation", "name")
        .populate("centre", "name")
        .populate("course", "name")
        .populate("batch", "name")
        .populate("createdBy", "name")
        .sort({
          createdAt: -1,
        })
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
        totalPages: Math.ceil(total / currentLimit),
      },
    });
  } catch (error) {
    console.error("GET ASSESSMENTS ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// GET SINGLE ASSESSMENT
// ============================================================

exports.getAssessment = async (req, res) => {
  try {
    const { assessment, error } =
      await getAccessibleAssessment(
        req.params.id,
        req.user
      );

    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    const structure = await getAssessmentStructure(
      assessment._id
    );

    const assessmentData = assessment.toObject();

    // ========================================================
    // NO PART MODE
    // ========================================================

    if (!assessment.hasParts) {
      const sections = structure.sections.map(
        ({ section, questions }) => ({
          ...section.toObject(),
          questions,
        })
      );

      return res.json({
        success: true,
        data: {
          ...assessmentData,
          sections,
          parts: [],
        },
      });
    }

    // ========================================================
    // PART MODE
    // ========================================================

    const sectionsByPart = new Map();

    for (const part of structure.parts) {
      sectionsByPart.set(part._id.toString(), []);
    }

    const unassignedSections = [];

    for (const { section, questions } of structure.sections) {
      const sectionData = {
        ...section.toObject(),
        questions,
      };

      if (section.part) {
        const key = section.part.toString();

        if (!sectionsByPart.has(key)) {
          sectionsByPart.set(key, []);
        }

        sectionsByPart.get(key).push(sectionData);
      } else {
        unassignedSections.push(sectionData);
      }
    }

    const parts = structure.parts.map((part) => ({
      ...part.toObject(),
      sections:
        sectionsByPart.get(part._id.toString()) || [],
    }));

    return res.json({
      success: true,
      data: {
        ...assessmentData,
        parts,
        sections: unassignedSections,
      },
    });
  } catch (error) {
    console.error("GET ASSESSMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// UPDATE ASSESSMENT
// ============================================================

exports.updateAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findById(
      req.params.id
    );

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    if (
      isTeacher(req.user) &&
      !isTeacherAssignedToBatch(
        req.user,
        assessment.batch
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this assessment",
      });
    }

    // ========================================================
    // SUBMISSION CHECK
    // ========================================================

    const hasSubmissions =
      await AssessmentSubmission.exists({
        assessment: assessment._id,
      });

    if (
      hasSubmissions &&
      [
        ASSESSMENT_STATUS.PUBLISHED,
        ASSESSMENT_STATUS.CLOSED,
      ].includes(assessment.status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot edit assessment with existing submissions. Create a new version instead.",
      });
    }

    // ========================================================
    // SAFE UPDATE
    // ========================================================

    const allowedFields = [
      "name",
      "code",
      "description",
      "instructions",

      "organisation",
      "centre",
      "course",
      "batch",

      "weekNumber",
      "academicYear",

      "publishDate",
      "publishTime",
      "closeDate",
      "closeTime",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (
        Object.prototype.hasOwnProperty.call(
          req.body,
          field
        )
      ) {
        updates[field] = req.body[field];
      }
    }

    // ========================================================
    // HAS PARTS CANNOT CHANGE AFTER STRUCTURE EXISTS
    // ========================================================

    if (
      Object.prototype.hasOwnProperty.call(
        req.body,
        "hasParts"
      )
    ) {
      const requestedHasParts = Boolean(
        req.body.hasParts
      );

      if (
        requestedHasParts !==
        Boolean(assessment.hasParts)
      ) {
        const [partCount, sectionCount, questionCount] =
          await Promise.all([
            AssessmentPart.countDocuments({
              assessment: assessment._id,
              isActive: true,
            }),
            AssessmentSection.countDocuments({
              assessment: assessment._id,
              isActive: true,
            }),
            AssessmentQuestion.countDocuments({
              assessment: assessment._id,
              isActive: true,
            }),
          ]);

        if (
          hasSubmissions ||
          partCount > 0 ||
          sectionCount > 0 ||
          questionCount > 0
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Assessment Parts mode cannot be changed after structure has been created.",
          });
        }

        updates.hasParts = requestedHasParts;
      }
    }

    updates.updatedBy = getUserId(req);

    // ========================================================
    // HIERARCHY VALIDATION IF CHANGED
    // ========================================================

    const nextOrganisation =
      updates.organisation ?? assessment.organisation;

    const nextCentre =
      updates.centre ?? assessment.centre;

    const nextCourse =
      updates.course ?? assessment.course;

    const nextBatch =
      updates.batch ?? assessment.batch;

    const hierarchy =
      await validateAssessmentHierarchy({
        organisation: nextOrganisation,
        centre: nextCentre,
        course: nextCourse,
        batch: nextBatch,
      });

    if (!hierarchy.valid) {
      return res.status(400).json({
        success: false,
        message: hierarchy.message,
      });
    }

    // ========================================================
    // DUPLICATE WEEK CHECK
    // ========================================================

    const nextWeekNumber =
      updates.weekNumber ?? assessment.weekNumber;

    const duplicate = await Assessment.findOne({
      _id: {
        $ne: assessment._id,
      },
      batch: nextBatch,
      weekNumber: Number(nextWeekNumber),
      isActive: true,
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        message: `Assessment for Week ${nextWeekNumber} already exists for this batch`,
      });
    }

    const updated =
      await Assessment.findByIdAndUpdate(
        req.params.id,
        updates,
        {
          new: true,
          runValidators: true,
        }
      );

    return res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error("UPDATE ASSESSMENT ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// DUPLICATE ASSESSMENT
// Supports:
// Assessment
//   └── Parts
//        └── Sections
//             └── Questions
//
// AND
//
// Assessment
//   └── Sections
//        └── Questions
// ============================================================

exports.duplicateAssessment = async (req, res) => {
  try {
    const source = await Assessment.findById(
      req.params.id
    );

    if (!source) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    if (
      isTeacher(req.user) &&
      !isTeacherAssignedToBatch(
        req.user,
        source.batch
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to duplicate this assessment",
      });
    }

    const {
      newName,
      newCode,
      newWeekNumber,
      targetBatch,
    } = req.body;

    if (!targetBatch) {
      return res.status(400).json({
        success: false,
        message: "Please select a target batch",
      });
    }

    const batch = await Batch.findById(targetBatch);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Target batch not found",
      });
    }

    if (
      isTeacher(req.user) &&
      !isTeacherAssignedToBatch(
        req.user,
        targetBatch
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to duplicate assessment to this batch",
      });
    }

    const organisationId = batch.organisation;
    const centreId = batch.centre;
    const courseId = batch.course;

    if (
      !organisationId ||
      !centreId ||
      !courseId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Selected batch is missing organisation, centre or course information",
      });
    }

    const weekNumber =
      newWeekNumber !== undefined &&
      newWeekNumber !== null &&
      newWeekNumber !== ""
        ? parseInt(newWeekNumber, 10)
        : source.weekNumber;

    if (
      !Number.isInteger(weekNumber) ||
      weekNumber <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid week number",
      });
    }

    const existing = await Assessment.findOne({
      batch: targetBatch,
      weekNumber,
      isActive: true,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message:
          `Assessment for Week ${weekNumber} already exists for this batch`,
      });
    }

    // ========================================================
    // CREATE ASSESSMENT
    // ========================================================

    const newAssessment =
      await Assessment.create({
        name:
          newName ||
          `${source.name} (Copy)`,

        code:
          newCode ||
          `${source.code || "ASSESSMENT"}_COPY_${String(
            targetBatch
          ).slice(-6)}`,

        description: source.description,
        instructions: source.instructions,

        organisation: organisationId,
        centre: centreId,
        course: courseId,
        batch: targetBatch,

        weekNumber,

        academicYear:
          source.academicYear,

        hasParts:
          Boolean(source.hasParts),

        status:
          ASSESSMENT_STATUS.DRAFT,

        publishDate: null,
        publishTime: null,
        closeDate: null,
        closeTime: null,

        totalMarks: 0,
        totalQuestions: 0,

        createdBy: getUserId(req),
      });

    // ========================================================
    // PART MODE
    // ========================================================

    const partIdMap = new Map();

    if (source.hasParts) {
      const sourceParts =
        await AssessmentPart.find({
          assessment: source._id,
          isActive: true,
        }).sort({
          displayOrder: 1,
        });

      for (const part of sourceParts) {
        const newPart =
          await AssessmentPart.create({
            assessment:
              newAssessment._id,

            name: part.name,
            code: part.code,
            description: part.description,

            isOptional:
              Boolean(part.isOptional),

            displayOrder:
              part.displayOrder,

            totalMarks: 0,
            totalQuestions: 0,

            isActive: true,

            createdBy: getUserId(req),
            updatedBy: getUserId(req),
          });

        partIdMap.set(
          part._id.toString(),
          newPart._id
        );
      }
    }

    // ========================================================
    // SECTIONS
    // ========================================================

    const sourceSections =
      await AssessmentSection.find({
        assessment: source._id,
        isActive: true,
      }).sort({
        displayOrder: 1,
      });

    const sectionIdMap = new Map();

    for (const section of sourceSections) {
      let newPartId = null;

      if (source.hasParts && section.part) {
        newPartId =
          partIdMap.get(
            section.part.toString()
          ) || null;
      }

      const newSection =
        await AssessmentSection.create({
          assessment:
            newAssessment._id,

          part: newPartId,

          name: section.name,
          description: section.description,

          displayOrder:
            section.displayOrder,

          totalMarks: 0,
          totalQuestions: 0,

          isActive: true,
        });

      sectionIdMap.set(
        section._id.toString(),
        newSection._id
      );

      // ======================================================
      // QUESTIONS
      // ======================================================

      const questions =
        await AssessmentQuestion.find({
          section: section._id,
          isActive: true,
        }).sort({
          displayOrder: 1,
        });

      for (const question of questions) {
        await AssessmentQuestion.create({
          assessment:
            newAssessment._id,

          part: newPartId,

          section:
            newSection._id,

          questionText:
            question.questionText,

          questionType:
            question.questionType,

          options:
            question.options || [],

          maxPoints:
            question.maxPoints,

          isRequired:
            question.isRequired,

          displayOrder:
            question.displayOrder,

          isActive: true,

          scoringConfig:
            question.scoringConfig || {},
        });
      }
    }

    await recalculateAssessmentTotals(
      newAssessment._id
    );

    const populatedAssessment =
      await Assessment.findById(
        newAssessment._id
      )
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

// ============================================================
// PUBLISH ASSESSMENT
// ============================================================

exports.publishAssessment = async (req, res) => {
  try {
    const { assessment, error } =
      await getAccessibleAssessment(
        req.params.id,
        req.user
      );

    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    if (
      ![
        ASSESSMENT_STATUS.DRAFT,
        ASSESSMENT_STATUS.SCHEDULED,
      ].includes(assessment.status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Assessment cannot be published from current status",
      });
    }

    const structure =
      await getAssessmentStructure(
        assessment._id
      );

    if (!structure.sections.length) {
      return res.status(400).json({
        success: false,
        message:
          "Assessment must have at least one section",
      });
    }

    // ========================================================
    // PART VALIDATION
    // ========================================================

    if (assessment.hasParts) {
      if (!structure.parts.length) {
        return res.status(400).json({
          success: false,
          message:
            "Assessment with Parts must have at least one Part",
        });
      }

      const partIds = new Set(
        structure.parts.map((part) =>
          part._id.toString()
        )
      );

      for (const {
        section,
        questions,
      } of structure.sections) {
        if (
          !section.part ||
          !partIds.has(
            section.part.toString()
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              `Section "${section.name}" must belong to a valid Part`,
          });
        }

        if (!questions.length) {
          return res.status(400).json({
            success: false,
            message:
              `Section "${section.name}" must have at least one question`,
          });
        }
      }
    } else {
      // ======================================================
      // NO PART MODE
      // ======================================================

      for (const {
        section,
        questions,
      } of structure.sections) {
        if (!questions.length) {
          return res.status(400).json({
            success: false,
            message:
              `Section "${section.name}" must have at least one question`,
          });
        }

        // Existing old sections should not have part
        if (section.part) {
          return res.status(400).json({
            success: false,
            message:
              `Section "${section.name}" has an invalid Part`,
          });
        }
      }
    }

    // ========================================================
    // QUESTION VALIDATION
    // ========================================================

    const allQuestions =
      structure.sections.flatMap(
        ({ questions }) => questions
      );

    if (!allQuestions.length) {
      return res.status(400).json({
        success: false,
        message:
          "Assessment must have at least one question",
      });
    }

    // ========================================================
    // RECALCULATE BEFORE PUBLISH
    // ========================================================

    await recalculateAssessmentTotals(
      assessment._id
    );

    assessment.status =
      ASSESSMENT_STATUS.PUBLISHED;

    if (!assessment.publishDate) {
      assessment.publishDate =
        new Date();
    }

    assessment.updatedBy =
      getUserId(req);

    await assessment.save();

    return res.json({
      success: true,
      data: assessment,
    });
  } catch (error) {
    console.error(
      "PUBLISH ASSESSMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// SCHEDULE ASSESSMENT
// ============================================================

exports.scheduleAssessment = async (req, res) => {
  try {
    const assessment =
      await Assessment.findById(
        req.params.id
      );

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    if (
      isTeacher(req.user) &&
      !isTeacherAssignedToBatch(
        req.user,
        assessment.batch
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to schedule this assessment",
      });
    }

    if (
      ![
        ASSESSMENT_STATUS.DRAFT,
        ASSESSMENT_STATUS.SCHEDULED,
      ].includes(assessment.status)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Only Draft or Scheduled assessment can be scheduled",
      });
    }

    const {
      publishDate,
      publishTime,
      closeDate,
      closeTime,
    } = req.body;

    if (!publishDate) {
      return res.status(400).json({
        success: false,
        message: "Publish date is required",
      });
    }

    if (!closeDate) {
      return res.status(400).json({
        success: false,
        message: "Close date is required",
      });
    }

    assessment.status =
      ASSESSMENT_STATUS.SCHEDULED;

    assessment.publishDate =
      publishDate;

    assessment.publishTime =
      publishTime || null;

    assessment.closeDate =
      closeDate;

    assessment.closeTime =
      closeTime || null;

    assessment.updatedBy =
      getUserId(req);

    await assessment.save();

    return res.json({
      success: true,
      data: assessment,
    });
  } catch (error) {
    console.error(
      "SCHEDULE ASSESSMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// CLOSE ASSESSMENT
// ============================================================

exports.closeAssessment = async (req, res) => {
  try {
    const assessment =
      await Assessment.findById(
        req.params.id
      );

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    if (
      isTeacher(req.user) &&
      !isTeacherAssignedToBatch(
        req.user,
        assessment.batch
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to close this assessment",
      });
    }

    assessment.status =
      ASSESSMENT_STATUS.CLOSED;

    assessment.closeDate =
      new Date();

    assessment.closeTime = null;

    assessment.updatedBy =
      getUserId(req);

    await assessment.save();

    return res.json({
      success: true,
      data: assessment,
    });
  } catch (error) {
    console.error(
      "CLOSE ASSESSMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// ARCHIVE ASSESSMENT
// ============================================================

exports.archiveAssessment = async (
  req,
  res
) => {
  try {
    const assessment =
      await Assessment.findById(
        req.params.id
      );

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    if (
      isTeacher(req.user) &&
      !isTeacherAssignedToBatch(
        req.user,
        assessment.batch
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to archive this assessment",
      });
    }

    assessment.status =
      ASSESSMENT_STATUS.ARCHIVED;

    assessment.updatedBy =
      getUserId(req);

    await assessment.save();

    return res.json({
      success: true,
      data: assessment,
    });
  } catch (error) {
    console.error(
      "ARCHIVE ASSESSMENT ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// DELETE ASSESSMENT
// ============================================================

exports.deleteAssessment = async (
  req,
  res
) => {
  try {
    const { id } = req.params;

    const assessment =
      await Assessment.findById(id);

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    if (
      isTeacher(req.user) &&
      !isTeacherAssignedToBatch(
        req.user,
        assessment.batch
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this assessment",
      });
    }

    // Only draft
    if (
      assessment.status !==
      ASSESSMENT_STATUS.DRAFT
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Only draft assessments can be deleted",
      });
    }

    // Never delete assessment with submissions
    const hasSubmissions =
      await AssessmentSubmission.exists({
        assessment: assessment._id,
      });

    if (hasSubmissions) {
      return res.status(400).json({
        success: false,
        message:
          "Assessment with submissions cannot be deleted",
      });
    }

    // ========================================================
    // DELETE QUESTIONS
    // ========================================================

    await AssessmentQuestion.deleteMany({
      assessment: assessment._id,
    });

    // ========================================================
    // DELETE SECTIONS
    // ========================================================

    await AssessmentSection.deleteMany({
      assessment: assessment._id,
    });

    // ========================================================
    // DELETE PARTS
    // ========================================================

    await AssessmentPart.deleteMany({
      assessment: assessment._id,
    });

    // ========================================================
    // DELETE ASSESSMENT
    // ========================================================

    await Assessment.findByIdAndDelete(
      assessment._id
    );

    return res.json({
      success: true,
      message:
        "Assessment permanently deleted",
      data: {
        deletedAssessmentId:
          assessment._id,
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

// ============================================================
// ASSESSMENT PREVIEW
// ============================================================

exports.getAssessmentPreview = async (
  req,
  res
) => {
  try {
    const { assessment, error } =
      await getAccessibleAssessment(
        req.params.id,
        req.user
      );

    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    const structure =
      await getAssessmentStructure(
        assessment._id
      );

    const assessmentData =
      assessment.toObject();

    // ========================================================
    // NO PART MODE
    // ========================================================

    if (!assessment.hasParts) {
      const sections =
        structure.sections.map(
          ({ section, questions }) => ({
            ...section.toObject(),
            questions,
          })
        );

      return res.json({
        success: true,
        data: {
          assessment:
            assessmentData,
          parts: [],
          sections,
        },
      });
    }

    // ========================================================
    // PART MODE
    // ========================================================

    const sectionsByPart =
      new Map();

    for (const part of structure.parts) {
      sectionsByPart.set(
        part._id.toString(),
        []
      );
    }

    for (const {
      section,
      questions,
    } of structure.sections) {
      if (!section.part) {
        continue;
      }

      const key =
        section.part.toString();

      if (!sectionsByPart.has(key)) {
        sectionsByPart.set(key, []);
      }

      sectionsByPart
        .get(key)
        .push({
          ...section.toObject(),
          questions,
        });
    }

    const parts =
      structure.parts.map(
        (part) => ({
          ...part.toObject(),

          sections:
            sectionsByPart.get(
              part._id.toString()
            ) || [],
        })
      );

    return res.json({
      success: true,
      data: {
        assessment:
          assessmentData,
        parts,
        sections: [],
      },
    });
  } catch (error) {
    console.error(
      "ASSESSMENT PREVIEW ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// EXPORT HELPERS
// ============================================================

exports.getAccessibleAssessment =
  getAccessibleAssessment;

exports.isTeacherAssignedToBatch =
  isTeacherAssignedToBatch;

exports.recalculateAssessmentTotals =
  recalculateAssessmentTotals;

exports.getAssessmentStructure =
  getAssessmentStructure;

