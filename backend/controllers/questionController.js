
const AssessmentQuestion = require("../models/AssessmentQuestion");
const AssessmentSection = require("../models/AssessmentSection");
const AssessmentPart = require("../models/AssessmentPart");
const Assessment = require("../models/Assessment");
const AssessmentSubmission = require("../models/AssessmentSubmission");

const {
  recalculateAssessmentTotals,
} = require("./assessmentController");

/* =========================================================
   HELPERS
========================================================= */

const getUserId = (req) => {
  return req.user?._id || req.user?.id;
};

const isTeacher = (user) => {
  return String(user?.role || "").toUpperCase() === "TEACHER";
};

const isTeacherAssignedToBatch = (user, batchId) => {
  if (!isTeacher(user)) return true;

  const assignedBatches = (user.batches || []).map((id) =>
    id?.toString()
  );

  return assignedBatches.includes(batchId?.toString());
};

const getAssessmentAccess = async (assessmentId, user) => {
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

const isStructureLocked = async (assessment) => {
  const hasSubmissions = await AssessmentSubmission.exists({
    assessment: assessment._id,
  });

  return (
    Boolean(hasSubmissions) ||
    ["PUBLISHED", "CLOSED", "ARCHIVED"].includes(assessment.status)
  );
};

/* =========================================================
   VALIDATE QUESTION
========================================================= */

const validateQuestionData = ({
  questionText,
  questionType,
  options,
  maxPoints,
}) => {
  if (!questionText || !String(questionText).trim()) {
    return "Question text is required";
  }

  const validTypes = [
    "YES_NO",
    "TEXT",
    "NUMBER",
    "SINGLE_CHOICE",
    "MULTIPLE_CHOICE",
  ];

  if (!validTypes.includes(questionType)) {
    return `Invalid question type. Allowed types: ${validTypes.join(
      ", "
    )}`;
  }

  const points = Number(maxPoints);

  if (!Number.isFinite(points) || points <= 0) {
    return "maxPoints must be greater than 0";
  }

  if (
    ["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(
      questionType
    )
  ) {
    if (!Array.isArray(options) || options.length < 2) {
      return "At least 2 options are required for choice questions";
    }

    const cleanedOptions = options
      .map((option) => String(option).trim())
      .filter(Boolean);

    if (cleanedOptions.length < 2) {
      return "At least 2 valid options are required";
    }

    const uniqueOptions = new Set(
      cleanedOptions.map((option) => option.toLowerCase())
    );

    if (uniqueOptions.size !== cleanedOptions.length) {
      return "Duplicate options are not allowed";
    }
  }

  return null;
};

/* =========================================================
   CREATE QUESTION
========================================================= */

exports.createQuestion = async (req, res) => {
  try {
    const { sectionId } = req.params;

    const {
      questionText,
      questionType = "YES_NO",
      options = [],
      maxPoints = 1,
      isRequired = true,
      displayOrder,
      scoringConfig = {},
    } = req.body;

    const section = await AssessmentSection.findById(
      sectionId
    );

    if (!section || !section.isActive) {
      return res.status(404).json({
        success: false,
        message: "Section not found",
      });
    }

    const { assessment, error } = await getAssessmentAccess(
      section.assessment,
      req.user
    );

    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    if (await isStructureLocked(assessment)) {
      return res.status(400).json({
        success: false,
        message:
          "Questions cannot be added after publishing, closing, archiving, or receiving submissions.",
      });
    }

    /* =====================================================
       PART VALIDATION
    ===================================================== */

    let resolvedPartId = null;

    if (assessment.hasParts) {
      if (!section.part) {
        return res.status(400).json({
          success: false,
          message:
            "This section is not linked to a Part.",
        });
      }

      const part = await AssessmentPart.findOne({
        _id: section.part,
        assessment: section.assessment,
        isActive: true,
      });

      if (!part) {
        return res.status(400).json({
          success: false,
          message:
            "Section is linked to an invalid Part.",
        });
      }

      resolvedPartId = part._id;
    } else {
      if (section.part) {
        return res.status(400).json({
          success: false,
          message:
            "This assessment does not use Parts, but the section has a Part.",
        });
      }

      resolvedPartId = null;
    }

    const normalizedType = String(
      questionType
    ).toUpperCase();

    const validationError = validateQuestionData({
      questionText,
      questionType: normalizedType,
      options,
      maxPoints,
    });

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const count = await AssessmentQuestion.countDocuments({
      assessment: section.assessment,
      section: sectionId,
      isActive: true,
    });

    const question = await AssessmentQuestion.create({
      assessment: section.assessment,
      part: resolvedPartId,
      section: sectionId,
      questionText: String(questionText).trim(),
      questionType: normalizedType,
      options,
      maxPoints: Number(maxPoints),
      isRequired: Boolean(isRequired),
      displayOrder:
        displayOrder !== undefined
          ? Number(displayOrder)
          : count + 1,
      scoringConfig: scoringConfig || {},
      isActive: true,
    });

    await recalculateAssessmentTotals(
      section.assessment
    );

    return res.status(201).json({
      success: true,
      message: "Question created successfully",
      data: question,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================================
   GET QUESTIONS BY SECTION
========================================================= */

exports.getQuestions = async (req, res) => {
  try {
    const { sectionId } = req.params;

    const section = await AssessmentSection.findById(
      sectionId
    );

    if (!section || !section.isActive) {
      return res.status(404).json({
        success: false,
        message: "Section not found",
      });
    }

    const { error } = await getAssessmentAccess(
      section.assessment,
      req.user
    );

    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    const questions = await AssessmentQuestion.find({
      assessment: section.assessment,
      section: sectionId,
      ...(section.part
        ? { part: section.part }
        : { part: null }),
      isActive: true,
    })
      .sort({
        displayOrder: 1,
        createdAt: 1,
      })
      .lean();

    return res.json({
      success: true,
      data: questions,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================================
   GET SINGLE QUESTION
========================================================= */

exports.getQuestion = async (req, res) => {
  try {
    const { id } = req.params;

    const question = await AssessmentQuestion.findById(
      id
    ).lean();

    if (!question || !question.isActive) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    const { assessment, error } =
      await getAssessmentAccess(
        question.assessment,
        req.user
      );

    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    let part = null;

    if (question.part) {
      part = await AssessmentPart.findOne({
        _id: question.part,
        assessment: question.assessment,
        isActive: true,
      }).lean();
    }

    const section = await AssessmentSection.findOne({
      _id: question.section,
      assessment: question.assessment,
      isActive: true,
    }).lean();

    return res.json({
      success: true,
      data: {
        ...question,
        assessment,
        part,
        section,
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
   UPDATE QUESTION
========================================================= */

exports.updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;

    const question = await AssessmentQuestion.findById(
      id
    );

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    const { assessment, error } =
      await getAssessmentAccess(
        question.assessment,
        req.user
      );

    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    if (await isStructureLocked(assessment)) {
      return res.status(400).json({
        success: false,
        message:
          "Question cannot be modified after publishing, closing, archiving, or receiving submissions.",
      });
    }

    const updates = {};

    if (req.body.questionText !== undefined) {
      if (!String(req.body.questionText).trim()) {
        return res.status(400).json({
          success: false,
          message: "Question text cannot be empty",
        });
      }

      updates.questionText =
        String(req.body.questionText).trim();
    }

    if (req.body.questionType !== undefined) {
      updates.questionType = String(
        req.body.questionType
      ).toUpperCase();
    }

    if (req.body.options !== undefined) {
      updates.options = req.body.options;
    }

    if (req.body.maxPoints !== undefined) {
      updates.maxPoints = Number(req.body.maxPoints);
    }

    if (req.body.isRequired !== undefined) {
      updates.isRequired = Boolean(req.body.isRequired);
    }

    if (req.body.displayOrder !== undefined) {
      updates.displayOrder = Number(
        req.body.displayOrder
      );
    }

    if (req.body.scoringConfig !== undefined) {
      updates.scoringConfig = req.body.scoringConfig || {};
    }

    if (req.body.isActive !== undefined) {
      updates.isActive = Boolean(req.body.isActive);
    }

    /* =====================================================
       SECTION CHANGE
    ===================================================== */

    if (req.body.sectionId !== undefined) {
      const newSection =
        await AssessmentSection.findOne({
          _id: req.body.sectionId,
          assessment: question.assessment,
          isActive: true,
        });

      if (!newSection) {
        return res.status(400).json({
          success: false,
          message:
            "Selected Section does not belong to this assessment.",
        });
      }

      if (assessment.hasParts) {
        if (!newSection.part) {
          return res.status(400).json({
            success: false,
            message:
              "Selected Section is not linked to a Part.",
          });
        }

        updates.part = newSection.part;
      } else {
        updates.part = null;
      }

      updates.section = newSection._id;
    }

    /* =====================================================
       PART CHANGE
       Normally derived from Section
    ===================================================== */

    if (
      req.body.partId !== undefined &&
      req.body.sectionId === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "partId cannot be changed independently. Change the Section instead.",
      });
    }

    const validationData = {
      questionText:
        updates.questionText !== undefined
          ? updates.questionText
          : question.questionText,

      questionType:
        updates.questionType !== undefined
          ? updates.questionType
          : question.questionType,

      options:
        updates.options !== undefined
          ? updates.options
          : question.options,

      maxPoints:
        updates.maxPoints !== undefined
          ? updates.maxPoints
          : question.maxPoints,
    };

    const validationError =
      validateQuestionData(validationData);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const updatedQuestion =
      await AssessmentQuestion.findByIdAndUpdate(
        id,
        updates,
        {
          new: true,
          runValidators: true,
        }
      );

    await recalculateAssessmentTotals(
      question.assessment
    );

    return res.json({
      success: true,
      message: "Question updated successfully",
      data: updatedQuestion,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================================
   DELETE QUESTION
========================================================= */

exports.deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;

    const question =
      await AssessmentQuestion.findById(id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    const { assessment, error } =
      await getAssessmentAccess(
        question.assessment,
        req.user
      );

    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    if (await isStructureLocked(assessment)) {
      return res.status(400).json({
        success: false,
        message:
          "Question cannot be deleted after publishing, closing, archiving, or receiving submissions.",
      });
    }

    await AssessmentQuestion.findByIdAndUpdate(
      id,
      {
        isActive: false,
      }
    );

    await recalculateAssessmentTotals(
      question.assessment
    );

    return res.json({
      success: true,
      message: "Question deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================================
   REORDER QUESTIONS
========================================================= */

exports.reorderQuestions = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const { questions } = req.body;

    if (!Array.isArray(questions) || !questions.length) {
      return res.status(400).json({
        success: false,
        message:
          "questions must be a non-empty array like [{ id, displayOrder }]",
      });
    }

    const section =
      await AssessmentSection.findById(sectionId);

    if (!section || !section.isActive) {
      return res.status(404).json({
        success: false,
        message: "Section not found",
      });
    }

    const { assessment, error } =
      await getAssessmentAccess(
        section.assessment,
        req.user
      );

    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    if (await isStructureLocked(assessment)) {
      return res.status(400).json({
        success: false,
        message:
          "Questions cannot be reordered after publishing, closing, archiving, or receiving submissions.",
      });
    }

    const ids = questions.map((item) => item.id);

    const filter = {
      _id: { $in: ids },
      assessment: section.assessment,
      section: sectionId,
      isActive: true,
    };

    if (section.part) {
      filter.part = section.part;
    } else {
      filter.part = null;
    }

    const existingQuestions =
      await AssessmentQuestion.find(filter).select("_id");

    if (existingQuestions.length !== questions.length) {
      return res.status(400).json({
        success: false,
        message:
          "One or more Questions do not belong to this Section.",
      });
    }

    await Promise.all(
      questions.map(({ id, displayOrder }) =>
        AssessmentQuestion.findOneAndUpdate(
          {
            _id: id,
            assessment: section.assessment,
            section: sectionId,
            isActive: true,
          },
          {
            displayOrder: Number(displayOrder),
          }
        )
      )
    );

    return res.json({
      success: true,
      message: "Questions reordered successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================================
   DUPLICATE QUESTION
========================================================= */

exports.duplicateQuestion = async (req, res) => {
  try {
    const { id } = req.params;

    const sourceQuestion =
      await AssessmentQuestion.findById(id);

    if (!sourceQuestion || !sourceQuestion.isActive) {
      return res.status(404).json({
        success: false,
        message: "Question not found",
      });
    }

    const { assessment, error } =
      await getAssessmentAccess(
        sourceQuestion.assessment,
        req.user
      );

    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    if (await isStructureLocked(assessment)) {
      return res.status(400).json({
        success: false,
        message:
          "Question cannot be duplicated after publishing, closing, archiving, or receiving submissions.",
      });
    }

    const count =
      await AssessmentQuestion.countDocuments({
        assessment: sourceQuestion.assessment,
        section: sourceQuestion.section,
        isActive: true,
      });

    const newQuestion =
      await AssessmentQuestion.create({
        assessment: sourceQuestion.assessment,
        part: sourceQuestion.part || null,
        section: sourceQuestion.section,
        questionText: `${sourceQuestion.questionText} Copy`,
        questionType: sourceQuestion.questionType,
        options: sourceQuestion.options || [],
        maxPoints: sourceQuestion.maxPoints,
        isRequired: sourceQuestion.isRequired,
        displayOrder: count + 1,
        scoringConfig:
          sourceQuestion.scoringConfig || {},
        isActive: true,
      });

    await recalculateAssessmentTotals(
      sourceQuestion.assessment
    );

    return res.status(201).json({
      success: true,
      message: "Question duplicated successfully",
      data: newQuestion,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

