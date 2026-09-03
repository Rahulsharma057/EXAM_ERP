
const AssessmentPart = require("../models/AssessmentPart");
const AssessmentSection = require("../models/AssessmentSection");
const AssessmentQuestion = require("../models/AssessmentQuestion");
const Assessment = require("../models/Assessment");
const AssessmentSubmission = require("../models/AssessmentSubmission");

const { recalculateAssessmentTotals } = require("./assessmentController");

/* =========================================================
   HELPERS
========================================================= */

const getUserId = (req) => {
  return req.user?._id || req.user?.id;
};

const isTeacher = (user) => {
  const role = String(user?.role || "").toUpperCase();
  return role === "TEACHER";
};

const isTeacherAssignedToBatch = (user, batchId) => {
  if (!isTeacher(user)) {
    return true;
  }

  const assignedBatches = (user.batches || []).map((id) =>
    id?.toString()
  );

  return assignedBatches.includes(batchId?.toString());
};

const getAssessment = async (assessmentId, user) => {
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

  if (!isTeacherAssignedToBatch(user, assessment.batch)) {
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

const hasStructureLocked = async (assessment) => {
  const hasSubmissions = await AssessmentSubmission.exists({
    assessment: assessment._id,
  });

  if (
    hasSubmissions ||
    ["PUBLISHED", "CLOSED", "ARCHIVED"].includes(assessment.status)
  ) {
    return true;
  }

  return false;
};

const validatePartBelongsToAssessment = async (
  partId,
  assessmentId
) => {
  if (!partId) {
    return null;
  }

  return AssessmentPart.findOne({
    _id: partId,
    assessment: assessmentId,
    isActive: true,
  });
};

/* =========================================================
   CREATE PART
========================================================= */

exports.createPart = async (req, res) => {
  try {
    const { assessmentId } = req.params;

    const {
      name,
      code,
      description,
      isOptional,
      displayOrder,
    } = req.body;

    const { assessment, error } = await getAssessment(
      assessmentId,
      req.user
    );

    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    if (!assessment.hasParts) {
      return res.status(400).json({
        success: false,
        message:
          "This assessment is configured without Parts. Create Sections directly.",
      });
    }

    if (await hasStructureLocked(assessment)) {
      return res.status(400).json({
        success: false,
        message:
          "Assessment structure cannot be modified after publishing, closing, archiving, or receiving submissions.",
      });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Part name is required",
      });
    }

    const existingCount = await AssessmentPart.countDocuments({
      assessment: assessmentId,
      isActive: true,
    });

    const part = await AssessmentPart.create({
      assessment: assessmentId,
      name: String(name).trim(),
      code: code ? String(code).trim().toUpperCase() : undefined,
      description: description || "",
      isOptional: Boolean(isOptional),
      displayOrder:
        displayOrder !== undefined
          ? Number(displayOrder)
          : existingCount + 1,
      createdBy: getUserId(req),
      updatedBy: getUserId(req),
    });

    await recalculateAssessmentTotals(assessmentId);

    return res.status(201).json({
      success: true,
      message: "Part created successfully",
      data: part,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Part code already exists in this assessment",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================================
   GET ALL PARTS
========================================================= */

exports.getParts = async (req, res) => {
  try {
    const { assessmentId } = req.params;

    const { assessment, error } = await getAssessment(
      assessmentId,
      req.user
    );

    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    if (!assessment.hasParts) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const parts = await AssessmentPart.find({
      assessment: assessmentId,
      isActive: true,
    })
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .sort({
        displayOrder: 1,
        createdAt: 1,
      });

    return res.json({
      success: true,
      data: parts,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================================
   GET SINGLE PART
========================================================= */

exports.getPart = async (req, res) => {
  try {
    const { id } = req.params;

    const part = await AssessmentPart.findById(id);

    if (!part || !part.isActive) {
      return res.status(404).json({
        success: false,
        message: "Part not found",
      });
    }

    const { assessment, error } = await getAssessment(
      part.assessment,
      req.user
    );

    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    const sections = await AssessmentSection.find({
      assessment: part.assessment,
      part: part._id,
      isActive: true,
    })
      .sort({
        displayOrder: 1,
        createdAt: 1,
      })
      .lean();

    for (const section of sections) {
      section.questions = await AssessmentQuestion.find({
        section: section._id,
        part: part._id,
        assessment: part.assessment,
        isActive: true,
      })
        .sort({
          displayOrder: 1,
          createdAt: 1,
        })
        .lean();
    }

    return res.json({
      success: true,
      data: {
        ...part.toObject(),
        assessment,
        sections,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================================
   UPDATE PART
========================================================= */

exports.updatePart = async (req, res) => {
  try {
    const { id } = req.params;

    const part = await AssessmentPart.findById(id);

    if (!part || !part.isActive) {
      return res.status(404).json({
        success: false,
        message: "Part not found",
      });
    }

    const { assessment, error } = await getAssessment(
      part.assessment,
      req.user
    );

    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    if (await hasStructureLocked(assessment)) {
      return res.status(400).json({
        success: false,
        message:
          "Part cannot be modified after publishing, closing, archiving, or receiving submissions.",
      });
    }

    const allowedUpdates = {};

    if (req.body.name !== undefined) {
      if (!String(req.body.name).trim()) {
        return res.status(400).json({
          success: false,
          message: "Part name cannot be empty",
        });
      }

      allowedUpdates.name = String(req.body.name).trim();
    }

    if (req.body.code !== undefined) {
      allowedUpdates.code = req.body.code
        ? String(req.body.code).trim().toUpperCase()
        : undefined;
    }

    if (req.body.description !== undefined) {
      allowedUpdates.description = req.body.description;
    }

    if (req.body.isOptional !== undefined) {
      allowedUpdates.isOptional = Boolean(req.body.isOptional);
    }

    if (req.body.displayOrder !== undefined) {
      allowedUpdates.displayOrder = Number(req.body.displayOrder);
    }

    allowedUpdates.updatedBy = getUserId(req);

    const updatedPart = await AssessmentPart.findByIdAndUpdate(
      id,
      allowedUpdates,
      {
        new: true,
        runValidators: true,
      }
    );

    await recalculateAssessmentTotals(part.assessment);

    return res.json({
      success: true,
      message: "Part updated successfully",
      data: updatedPart,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Part code already exists in this assessment",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================================
   DELETE PART
   Soft delete
========================================================= */

exports.deletePart = async (req, res) => {
  try {
    const { id } = req.params;

    const part = await AssessmentPart.findById(id);

    if (!part || !part.isActive) {
      return res.status(404).json({
        success: false,
        message: "Part not found",
      });
    }

    const { assessment, error } = await getAssessment(
      part.assessment,
      req.user
    );

    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    if (await hasStructureLocked(assessment)) {
      return res.status(400).json({
        success: false,
        message:
          "Part cannot be deleted after publishing, closing, archiving, or receiving submissions.",
      });
    }

    await AssessmentPart.findByIdAndUpdate(id, {
      isActive: false,
      updatedBy: getUserId(req),
    });

    await AssessmentSection.updateMany(
      {
        part: id,
        assessment: part.assessment,
      },
      {
        isActive: false,
      }
    );

    await AssessmentQuestion.updateMany(
      {
        part: id,
        assessment: part.assessment,
      },
      {
        isActive: false,
      }
    );

    await recalculateAssessmentTotals(part.assessment);

    return res.json({
      success: true,
      message: "Part deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================================
   REORDER PARTS
========================================================= */

exports.reorderParts = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { parts } = req.body;

    if (!Array.isArray(parts) || !parts.length) {
      return res.status(400).json({
        success: false,
        message:
          "parts must be a non-empty array like [{ id, displayOrder }]",
      });
    }

    const { assessment, error } = await getAssessment(
      assessmentId,
      req.user
    );

    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    if (!assessment.hasParts) {
      return res.status(400).json({
        success: false,
        message: "This assessment does not use Parts",
      });
    }

    if (await hasStructureLocked(assessment)) {
      return res.status(400).json({
        success: false,
        message:
          "Parts cannot be reordered after publishing, closing, archiving, or receiving submissions.",
      });
    }

    const partIds = parts.map((item) => item.id);

    const existingParts = await AssessmentPart.find({
      _id: { $in: partIds },
      assessment: assessmentId,
      isActive: true,
    }).select("_id");

    if (existingParts.length !== parts.length) {
      return res.status(400).json({
        success: false,
        message:
          "One or more Parts do not belong to this assessment",
      });
    }

    await Promise.all(
      parts.map(({ id, displayOrder }) =>
        AssessmentPart.findOneAndUpdate(
          {
            _id: id,
            assessment: assessmentId,
            isActive: true,
          },
          {
            displayOrder: Number(displayOrder),
            updatedBy: getUserId(req),
          }
        )
      )
    );

    return res.json({
      success: true,
      message: "Parts reordered successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================================
   DUPLICATE PART
========================================================= */

exports.duplicatePart = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      code,
      isOptional,
    } = req.body;

    const sourcePart = await AssessmentPart.findById(id);

    if (!sourcePart || !sourcePart.isActive) {
      return res.status(404).json({
        success: false,
        message: "Part not found",
      });
    }

    const { assessment, error } = await getAssessment(
      sourcePart.assessment,
      req.user
    );

    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    if (!assessment.hasParts) {
      return res.status(400).json({
        success: false,
        message: "This assessment does not use Parts",
      });
    }

    if (await hasStructureLocked(assessment)) {
      return res.status(400).json({
        success: false,
        message:
          "Part cannot be duplicated after publishing, closing, archiving, or receiving submissions.",
      });
    }

    const partCount = await AssessmentPart.countDocuments({
      assessment: sourcePart.assessment,
      isActive: true,
    });

    const newPart = await AssessmentPart.create({
      assessment: sourcePart.assessment,
      name:
        name?.trim() ||
        `${sourcePart.name} Copy`,
      code: code
        ? String(code).trim().toUpperCase()
        : undefined,
      description: sourcePart.description || "",
      isOptional:
        isOptional !== undefined
          ? Boolean(isOptional)
          : sourcePart.isOptional,
      displayOrder: partCount + 1,
      createdBy: getUserId(req),
      updatedBy: getUserId(req),
    });

    const sections = await AssessmentSection.find({
      assessment: sourcePart.assessment,
      part: sourcePart._id,
      isActive: true,
    }).lean();

    for (const sourceSection of sections) {
      const newSection = await AssessmentSection.create({
        assessment: sourcePart.assessment,
        part: newPart._id,
        name: sourceSection.name,
        description: sourceSection.description || "",
        displayOrder: sourceSection.displayOrder,
        isActive: true,
      });

      const questions = await AssessmentQuestion.find({
        assessment: sourcePart.assessment,
        section: sourceSection._id,
        part: sourcePart._id,
        isActive: true,
      }).lean();

      if (questions.length) {
        const questionDocs = questions.map((question) => ({
          assessment: sourcePart.assessment,
          part: newPart._id,
          section: newSection._id,
          questionText: question.questionText,
          questionType: question.questionType,
          options: question.options || [],
          maxPoints: question.maxPoints,
          isRequired: question.isRequired,
          displayOrder: question.displayOrder,
          scoringConfig: question.scoringConfig || {},
          isActive: true,
        }));

        await AssessmentQuestion.insertMany(questionDocs);
      }
    }

    await recalculateAssessmentTotals(sourcePart.assessment);

    const populatedPart = await AssessmentPart.findById(
      newPart._id
    );

    return res.status(201).json({
      success: true,
      message: "Part duplicated successfully",
      data: populatedPart,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Part code already exists in this assessment",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================================
   RESTORE PART
========================================================= */

exports.restorePart = async (req, res) => {
  try {
    const { id } = req.params;

    const part = await AssessmentPart.findById(id);

    if (!part) {
      return res.status(404).json({
        success: false,
        message: "Part not found",
      });
    }

    const assessment = await Assessment.findById(
      part.assessment
    );

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    if (!assessment.hasParts) {
      return res.status(400).json({
        success: false,
        message: "This assessment does not use Parts",
      });
    }

    if (await hasStructureLocked(assessment)) {
      return res.status(400).json({
        success: false,
        message:
          "Part cannot be restored after publishing, closing, archiving, or receiving submissions.",
      });
    }

    await AssessmentPart.findByIdAndUpdate(id, {
      isActive: true,
      updatedBy: getUserId(req),
    });

    return res.json({
      success: true,
      message: "Part restored successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================================
   GET PART SUMMARY
========================================================= */

exports.getPartSummary = async (req, res) => {
  try {
    const { id } = req.params;

    const part = await AssessmentPart.findById(id);

    if (!part || !part.isActive) {
      return res.status(404).json({
        success: false,
        message: "Part not found",
      });
    }

    const { error } = await getAssessment(
      part.assessment,
      req.user
    );

    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    const [sectionCount, questionCount] = await Promise.all([
      AssessmentSection.countDocuments({
        assessment: part.assessment,
        part: part._id,
        isActive: true,
      }),

      AssessmentQuestion.countDocuments({
        assessment: part.assessment,
        part: part._id,
        isActive: true,
      }),
    ]);

    return res.json({
      success: true,
      data: {
        partId: part._id,
        name: part.name,
        code: part.code,
        isOptional: part.isOptional,
        totalMarks: part.totalMarks,
        totalQuestions: part.totalQuestions,
        sectionCount,
        questionCount,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

