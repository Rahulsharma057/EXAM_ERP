
const AssessmentSection = require("../models/AssessmentSection");
const AssessmentQuestion = require("../models/AssessmentQuestion");
const Assessment = require("../models/Assessment");
const AssessmentPart = require("../models/AssessmentPart");
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
   CREATE SECTION
========================================================= */

exports.createSection = async (req, res) => {
  try {
    const { assessmentId } = req.params;

    const {
      name,
      description,
      displayOrder,
      partId,
      isActive,
    } = req.body;

    const { assessment, error } = await getAssessmentAccess(
      assessmentId,
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
          "Assessment structure cannot be modified after publishing, closing, archiving, or receiving submissions.",
      });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Section name is required",
      });
    }

    let resolvedPartId = null;

    /* =====================================================
       PART MODE
    ===================================================== */

    if (assessment.hasParts) {
      if (!partId) {
        return res.status(400).json({
          success: false,
          message:
            "partId is required because this assessment uses Parts.",
        });
      }

      const part = await AssessmentPart.findOne({
        _id: partId,
        assessment: assessmentId,
        isActive: true,
      });

      if (!part) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid Part. The selected Part does not belong to this assessment.",
        });
      }

      resolvedPartId = part._id;
    } else {
      /* ===================================================
         DIRECT SECTION MODE
      =================================================== */

      if (partId) {
        return res.status(400).json({
          success: false,
          message:
            "This assessment does not use Parts. partId must not be provided.",
        });
      }

      resolvedPartId = null;
    }

    const sectionFilter = {
      assessment: assessmentId,
      isActive: true,
    };

    if (resolvedPartId) {
      sectionFilter.part = resolvedPartId;
    } else {
      sectionFilter.part = null;
    }

    const count = await AssessmentSection.countDocuments(
      sectionFilter
    );

    const section = await AssessmentSection.create({
      assessment: assessmentId,
      part: resolvedPartId,
      name: String(name).trim(),
      description: description || "",
      displayOrder:
        displayOrder !== undefined
          ? Number(displayOrder)
          : count + 1,
      isActive:
        isActive !== undefined
          ? Boolean(isActive)
          : true,
    });

    await recalculateAssessmentTotals(assessmentId);

    return res.status(201).json({
      success: true,
      message: "Section created successfully",
      data: section,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================================
   GET SECTIONS OF ASSESSMENT
========================================================= */

exports.getSections = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { partId } = req.query;

    const { assessment, error } = await getAssessmentAccess(
      assessmentId,
      req.user
    );

    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    const filter = {
      assessment: assessmentId,
      isActive: true,
    };

    if (assessment.hasParts) {
      if (partId) {
        const part = await AssessmentPart.findOne({
          _id: partId,
          assessment: assessmentId,
          isActive: true,
        });

        if (!part) {
          return res.status(400).json({
            success: false,
            message: "Invalid Part",
          });
        }

        filter.part = partId;
      }
    } else {
      filter.part = null;
    }

    const sections = await AssessmentSection.find(filter)
      .sort({
        displayOrder: 1,
        createdAt: 1,
      })
      .lean();

    return res.json({
      success: true,
      data: sections,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================================
   GET SINGLE SECTION
========================================================= */

exports.getSection = async (req, res) => {
  try {
    const { id } = req.params;

    const section = await AssessmentSection.findById(id).lean();

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

    let part = null;

    if (section.part) {
      part = await AssessmentPart.findOne({
        _id: section.part,
        assessment: section.assessment,
        isActive: true,
      }).lean();

      if (!part) {
        return res.status(400).json({
          success: false,
          message:
            "Section is linked to an invalid or inactive Part.",
        });
      }
    }

    const questions = await AssessmentQuestion.find({
      section: section._id,
      assessment: section.assessment,
      ...(section.part ? { part: section.part } : { part: null }),
      isActive: true,
    })
      .sort({
        displayOrder: 1,
        createdAt: 1,
      })
      .lean();

    return res.json({
      success: true,
      data: {
        ...section,
        assessment,
        part,
        questions,
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
   UPDATE SECTION
========================================================= */

exports.updateSection = async (req, res) => {
  try {
    const { id } = req.params;

    const section = await AssessmentSection.findById(id);

    if (!section) {
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
          "Section cannot be modified after publishing, closing, archiving, or receiving submissions.",
      });
    }

    const updates = {};

    if (req.body.name !== undefined) {
      if (!String(req.body.name).trim()) {
        return res.status(400).json({
          success: false,
          message: "Section name cannot be empty",
        });
      }

      updates.name = String(req.body.name).trim();
    }

    if (req.body.description !== undefined) {
      updates.description = req.body.description;
    }

    if (req.body.displayOrder !== undefined) {
      updates.displayOrder = Number(req.body.displayOrder);
    }

    if (req.body.isActive !== undefined) {
      updates.isActive = Boolean(req.body.isActive);
    }

    /* =====================================================
       PART CHANGE
       ===================================================== */

    if (req.body.partId !== undefined) {
      if (assessment.hasParts) {
        if (req.body.partId) {
          const part = await AssessmentPart.findOne({
            _id: req.body.partId,
            assessment: assessment._id,
            isActive: true,
          });

          if (!part) {
            return res.status(400).json({
              success: false,
              message:
                "Selected Part does not belong to this assessment.",
            });
          }

          updates.part = part._id;
        } else {
          return res.status(400).json({
            success: false,
            message:
              "partId is required for an assessment using Parts.",
          });
        }
      } else {
        if (req.body.partId) {
          return res.status(400).json({
            success: false,
            message:
              "This assessment does not use Parts.",
          });
        }

        updates.part = null;
      }
    }

    const updatedSection =
      await AssessmentSection.findByIdAndUpdate(
        id,
        updates,
        {
          new: true,
          runValidators: true,
        }
      );

    await recalculateAssessmentTotals(section.assessment);

    return res.json({
      success: true,
      message: "Section updated successfully",
      data: updatedSection,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================================
   DELETE SECTION
========================================================= */

exports.deleteSection = async (req, res) => {
  try {
    const { id } = req.params;

    const section = await AssessmentSection.findById(id);

    if (!section) {
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
          "Section cannot be deleted after publishing, closing, archiving, or receiving submissions.",
      });
    }

    await AssessmentSection.findByIdAndUpdate(id, {
      isActive: false,
    });

    await AssessmentQuestion.updateMany(
      {
        section: id,
        assessment: section.assessment,
      },
      {
        isActive: false,
      }
    );

    await recalculateAssessmentTotals(section.assessment);

    return res.json({
      success: true,
      message: "Section deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================================
   REORDER SECTIONS
========================================================= */

exports.reorderSections = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { sections } = req.body;

    if (!Array.isArray(sections) || !sections.length) {
      return res.status(400).json({
        success: false,
        message:
          "sections must be a non-empty array like [{ id, displayOrder }]",
      });
    }

    const { assessment, error } = await getAssessmentAccess(
      assessmentId,
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
          "Sections cannot be reordered after publishing, closing, archiving, or receiving submissions.",
      });
    }

    const ids = sections.map((item) => item.id);

    const existingSections = await AssessmentSection.find({
      _id: { $in: ids },
      assessment: assessmentId,
      isActive: true,
    }).select("_id part");

    if (existingSections.length !== sections.length) {
      return res.status(400).json({
        success: false,
        message:
          "One or more Sections do not belong to this assessment.",
      });
    }

    /* =====================================================
       Keep reorder inside same Part
       ===================================================== */

    if (assessment.hasParts) {
      const firstSection = existingSections[0];

      const samePart = existingSections.every(
        (section) =>
          String(section.part || "") ===
          String(firstSection.part || "")
      );

      if (!samePart) {
        return res.status(400).json({
          success: false,
          message:
            "Sections from different Parts cannot be reordered together.",
        });
      }
    }

    await Promise.all(
      sections.map(({ id, displayOrder }) =>
        AssessmentSection.findOneAndUpdate(
          {
            _id: id,
            assessment: assessmentId,
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
      message: "Sections reordered successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/* =========================================================
   DUPLICATE SECTION
========================================================= */

exports.duplicateSection = async (req, res) => {
  try {
    const { id } = req.params;

    const sourceSection = await AssessmentSection.findById(id);

    if (!sourceSection || !sourceSection.isActive) {
      return res.status(404).json({
        success: false,
        message: "Section not found",
      });
    }

    const { assessment, error } = await getAssessmentAccess(
      sourceSection.assessment,
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
          "Section cannot be duplicated after publishing, closing, archiving, or receiving submissions.",
      });
    }

    const sectionFilter = {
      assessment: sourceSection.assessment,
      isActive: true,
      part: sourceSection.part || null,
    };

    const count = await AssessmentSection.countDocuments(
      sectionFilter
    );

    const newSection = await AssessmentSection.create({
      assessment: sourceSection.assessment,
      part: sourceSection.part || null,
      name: `${sourceSection.name} Copy`,
      description: sourceSection.description || "",
      displayOrder: count + 1,
      isActive: true,
    });

    const questions = await AssessmentQuestion.find({
      assessment: sourceSection.assessment,
      section: sourceSection._id,
      isActive: true,
    }).lean();

    if (questions.length) {
      const copiedQuestions = questions.map((question) => ({
        assessment: sourceSection.assessment,
        part: sourceSection.part || null,
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

      await AssessmentQuestion.insertMany(copiedQuestions);
    }

    await recalculateAssessmentTotals(
      sourceSection.assessment
    );

    const populated = await AssessmentSection.findById(
      newSection._id
    );

    return res.status(201).json({
      success: true,
      message: "Section duplicated successfully",
      data: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

