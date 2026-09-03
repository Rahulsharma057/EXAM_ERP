
const Assessment = require('../models/Assessment');
const AssessmentPart = require('../models/AssessmentPart');
const AssessmentSection = require('../models/AssessmentSection');
const AssessmentQuestion = require('../models/AssessmentQuestion');
const AssessmentSubmission = require('../models/AssessmentSubmission');
const AssessmentAnswer = require('../models/AssessmentAnswer');
const Student = require('../models/Student');

const {
  ASSESSMENT_STATUS,
  QUESTION_TYPES,
} = require('../config/constants');

// ============================================================
// HELPERS
// ============================================================

const getUserId = (req) => req.user?._id || req.user?.id;

const isTeacher = (req) => {
  const role = String(req.user?.role || '').toUpperCase();
  return role === 'TEACHER';
};

const isTeacherAssignedToBatch = (req, batchId) => {
  if (!isTeacher(req)) return true;

  const assignedBatches = (req.user?.batches || []).map((id) =>
    id.toString()
  );

  return assignedBatches.includes(batchId?.toString());
};

const round2 = (value) =>
  Math.round(Number(value || 0) * 100) / 100;

const calculateAnswerScore = (question, answerValue) => {
  const value = String(answerValue || '').trim().toUpperCase();

  if (question.questionType === QUESTION_TYPES.YES_NO) {
    return value === 'YES'
      ? Number(question.maxPoints || 0)
      : 0;
  }

  // TEXT / NUMBER / SINGLE_CHOICE / MULTIPLE_CHOICE
  // are teacher graded unless custom scoringConfig is implemented.
  return 0;
};

// ============================================================
// LOAD ASSESSMENT STRUCTURE
// ============================================================

const getAssessmentStructure = async (assessmentId) => {
  const assessment = await Assessment.findById(assessmentId);

  if (!assessment) {
    throw new Error('Assessment not found');
  }

  const hasParts = assessment.hasParts === true;

  const parts = [];
  const directSections = [];

  if (hasParts) {
    const assessmentParts = await AssessmentPart.find({
      assessment: assessmentId,
      isActive: true,
    }).sort({ displayOrder: 1, createdAt: 1 });

    for (const part of assessmentParts) {
      const sections = await AssessmentSection.find({
        assessment: assessmentId,
        part: part._id,
        isActive: true,
      }).sort({ displayOrder: 1, createdAt: 1 });

      const sectionData = [];

      for (const section of sections) {
        const questions = await AssessmentQuestion.find({
          assessment: assessmentId,
          section: section._id,
          part: part._id,
          isActive: true,
        }).sort({ displayOrder: 1, createdAt: 1 });

        sectionData.push({
          section,
          questions,
        });
      }

      parts.push({
        part,
        sections: sectionData,
      });
    }
  } else {
    const sections = await AssessmentSection.find({
      assessment: assessmentId,
      $or: [
        { part: null },
        { part: { $exists: false } },
      ],
      isActive: true,
    }).sort({ displayOrder: 1, createdAt: 1 });

    for (const section of sections) {
      const questions = await AssessmentQuestion.find({
        assessment: assessmentId,
        section: section._id,
        isActive: true,
      }).sort({ displayOrder: 1, createdAt: 1 });

      directSections.push({
        section,
        questions,
      });
    }
  }

  return {
    assessment,
    hasParts,
    parts,
    sections: directSections,
  };
};

// ============================================================
// BUILD SNAPSHOT
// ============================================================

const buildAssessmentSnapshot = async (assessmentId) => {
  const structure = await getAssessmentStructure(assessmentId);

  const {
    assessment,
    hasParts,
    parts,
    sections,
  } = structure;

  const snapshotParts = [];
  const snapshotSections = [];

  let calculatedAssessmentMax = 0;
  let calculatedQuestionCount = 0;

  if (hasParts) {
    for (const item of parts) {
      const { part, sections: partSections } = item;

      let partTotal = 0;
      let partQuestions = 0;

      for (const itemSection of partSections) {
        const { section, questions } = itemSection;

        const sectionTotal = questions.reduce(
          (sum, question) =>
            sum + Number(question.maxPoints || 0),
          0
        );

        partTotal += sectionTotal;
        partQuestions += questions.length;

        snapshotSections.push({
          sectionId: section._id,
          name: section.name,
          description: section.description || '',
          displayOrder: section.displayOrder,
          partId: part._id,
          partName: part.name,
          partDisplayOrder: part.displayOrder,
          totalMarks: sectionTotal,
          totalQuestions: questions.length,
        });
      }

      snapshotParts.push({
        partId: part._id,
        name: part.name,
        code: part.code || '',
        description: part.description || '',
        isOptional: part.isOptional === true,
        displayOrder: part.displayOrder,
        totalMarks: partTotal,
        totalQuestions: partQuestions,
      });

      calculatedAssessmentMax += partTotal;
      calculatedQuestionCount += partQuestions;
    }
  } else {
    for (const item of sections) {
      const { section, questions } = item;

      const sectionTotal = questions.reduce(
        (sum, question) =>
          sum + Number(question.maxPoints || 0),
        0
      );

      snapshotSections.push({
        sectionId: section._id,
        name: section.name,
        description: section.description || '',
        displayOrder: section.displayOrder,
        partId: null,
        partName: '',
        partDisplayOrder: 0,
        totalMarks: sectionTotal,
        totalQuestions: questions.length,
      });

      calculatedAssessmentMax += sectionTotal;
      calculatedQuestionCount += questions.length;
    }
  }

  return {
    assessment,
    hasParts,
    parts: snapshotParts,
    sections: snapshotSections,
    calculatedAssessmentMax,
    calculatedQuestionCount,
  };
};

// ============================================================
// PART SELECTION MAP
// ============================================================

const normalizePartSelections = (
  partSelections,
  snapshotParts,
  answers
) => {
  const map = new Map();

  if (Array.isArray(partSelections)) {
    for (const item of partSelections) {
      if (!item?.partId) continue;

      map.set(
        item.partId.toString(),
        item.attempted !== false
      );
    }
  }

  // Required parts are always attempted.
  for (const part of snapshotParts) {
    const partId = part.partId.toString();

    if (!part.isOptional) {
      map.set(partId, true);
    }
  }

  // If optional part selection is not explicitly supplied,
  // infer it from submitted answers.
  for (const part of snapshotParts) {
    const partId = part.partId.toString();

    if (!part.isOptional || map.has(partId)) {
      continue;
    }

    const hasAnswer = answers.some(
      (answer) =>
        answer.partId?.toString() === partId
    );

    map.set(partId, hasAnswer);
  }

  return map;
};

// ============================================================
// CALCULATE SUBMISSION TOTALS
// ============================================================

const calculateSubmissionScores = async (submissionId) => {
  const submission =
    await AssessmentSubmission.findById(submissionId);

  if (!submission) {
    throw new Error('Submission not found');
  }

  const answers = await AssessmentAnswer.find({
    submission: submissionId,
  });

  const snapshotParts =
    submission.assessmentSnapshot?.parts || [];

  const snapshotSections =
    submission.assessmentSnapshot?.sections || [];

  const partSelectionMap = new Map();

  for (const part of snapshotParts) {
    partSelectionMap.set(
      part.partId.toString(),
      part.isOptional ? false : true
    );
  }

  // Determine attempted state.
  for (const answer of answers) {
    const partId =
      answer.part?.toString() ||
      answer.partSnapshot?.partId?.toString();

    if (partId) {
      partSelectionMap.set(partId, true);
    }
  }

  const sectionScores = [];
  const partScores = [];

  let totalObtained = 0;
  let totalMax = 0;

  // ==========================================================
  // PART-WISE CALCULATION
  // ==========================================================

  for (const part of snapshotParts) {
    const partId = part.partId.toString();
    const attempted =
      partSelectionMap.get(partId) === true;

    if (!attempted && part.isOptional) {
      partScores.push({
        partId: part.partId,
        partName: part.name,
        partCode: part.code || '',
        isOptional: true,
        attempted: false,
        obtainedMarks: 0,
        maxMarks: 0,
        percentage: 0,
        displayOrder: part.displayOrder,
      });

      continue;
    }

    let partObtained = 0;
    let partMax = 0;

    const partSections =
      snapshotSections.filter(
        (section) =>
          section.partId?.toString() === partId
      );

    for (const section of partSections) {
      const sectionAnswers = answers.filter(
        (answer) =>
          answer.questionSnapshot?.sectionId?.toString() ===
            section.sectionId?.toString() ||
          (
            answer.section?.toString() ===
              section.sectionId?.toString() &&
            (
              answer.part?.toString() === partId ||
              answer.partSnapshot?.partId?.toString() === partId
            )
          )
      );

      const sectionObtained =
        sectionAnswers.reduce(
          (sum, answer) =>
            sum + Number(answer.awardedScore || 0),
          0
        );

      const sectionMax =
        Number(section.totalMarks || 0);

      const sectionPercentage =
        sectionMax > 0
          ? (sectionObtained / sectionMax) * 100
          : 0;

      sectionScores.push({
        sectionId: section.sectionId,
        sectionName: section.name,
        partId: section.partId || null,
        partName: section.partName || '',
        partDisplayOrder:
          section.partDisplayOrder || 0,
        obtainedMarks: round2(sectionObtained),
        maxMarks: round2(sectionMax),
        percentage: round2(sectionPercentage),
        displayOrder: section.displayOrder,
      });

      partObtained += sectionObtained;
      partMax += sectionMax;
    }

    partScores.push({
      partId: part.partId,
      partName: part.name,
      partCode: part.code || '',
      isOptional: part.isOptional === true,
      attempted: true,
      obtainedMarks: round2(partObtained),
      maxMarks: round2(partMax),
      percentage:
        partMax > 0
          ? round2((partObtained / partMax) * 100)
          : 0,
      displayOrder: part.displayOrder,
    });

    totalObtained += partObtained;
    totalMax += partMax;
  }

  // ==========================================================
  // DIRECT SECTION MODE
  // ==========================================================

  if (!snapshotParts.length) {
    for (const section of snapshotSections) {
      const sectionAnswers = answers.filter(
        (answer) =>
          answer.section?.toString() ===
          section.sectionId?.toString()
      );

      const sectionObtained =
        sectionAnswers.reduce(
          (sum, answer) =>
            sum + Number(answer.awardedScore || 0),
          0
        );

      const sectionMax =
        Number(section.totalMarks || 0);

      const sectionPercentage =
        sectionMax > 0
          ? (sectionObtained / sectionMax) * 100
          : 0;

      sectionScores.push({
        sectionId: section.sectionId,
        sectionName: section.name,
        partId: null,
        partName: '',
        partDisplayOrder: 0,
        obtainedMarks: round2(sectionObtained),
        maxMarks: round2(sectionMax),
        percentage: round2(sectionPercentage),
        displayOrder: section.displayOrder,
      });

      totalObtained += sectionObtained;
      totalMax += sectionMax;
    }
  }

  const overallPercentage =
    totalMax > 0
      ? (totalObtained / totalMax) * 100
      : 0;

  submission.partScores = partScores;
  submission.sectionScores = sectionScores;

  submission.totalObtained = round2(totalObtained);
  submission.totalMax = round2(totalMax);
  submission.overallPercentage =
    round2(overallPercentage);

  submission.status = 'COMPLETED';

  await submission.save();

  return submission;
};

// ============================================================
// CREATE / UPDATE STUDENT SUBMISSION
// ============================================================

exports.createSubmission = async (req, res) => {
  try {
    const { assessmentId } = req.params;

    const {
      studentId,
      answers = [],
      partSelections = [],
    } = req.body;

    const assessment =
      await Assessment.findById(assessmentId);

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found',
      });
    }

    if (
      assessment.status !==
      ASSESSMENT_STATUS.PUBLISHED
    ) {
      return res.status(400).json({
        success: false,
        message: 'Assessment is not published',
      });
    }

    const now = new Date();

    if (
      assessment.publishDate &&
      now < new Date(assessment.publishDate)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Assessment has not started yet',
      });
    }

    if (
      assessment.closeDate &&
      now > new Date(assessment.closeDate)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Assessment is closed',
      });
    }

    const student =
      await Student.findById(studentId);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    if (
      student.batch?.toString() !==
      assessment.batch?.toString()
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Student does not belong to this batch',
      });
    }

    if (
      isTeacher(req) &&
      !isTeacherAssignedToBatch(
        req,
        assessment.batch
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          'You are not authorized for this batch',
      });
    }

    const structure =
      await buildAssessmentSnapshot(
        assessmentId
      );

    const {
      hasParts,
      parts,
      sections,
      calculatedAssessmentMax,
    } = structure;

    const existingSubmission =
      await AssessmentSubmission.findOne({
        assessment: assessmentId,
        student: studentId,
        attemptNumber: 1,
      });

    if (
      existingSubmission &&
      existingSubmission.status === 'COMPLETED'
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Assessment already submitted for this student',
      });
    }

    // Validate question IDs against assessment.
    const validQuestionMap = new Map();

    if (hasParts) {
      for (const partItem of structure.parts) {
        for (const sectionItem of partItem.sections) {
          for (const question of sectionItem.questions) {
            validQuestionMap.set(
              question._id.toString(),
              {
                question,
                section: sectionItem.section,
                part: partItem.part,
              }
            );
          }
        }
      }
    } else {
      for (const sectionItem of sections) {
        for (const question of sectionItem.questions) {
          validQuestionMap.set(
            question._id.toString(),
            {
              question,
              section: sectionItem.section,
              part: null,
            }
          );
        }
      }
    }

    const cleanAnswers = [];

    for (const ans of answers) {
      const item =
        validQuestionMap.get(
          ans.questionId?.toString()
        );

      if (!item) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid question in submission',
        });
      }

      const {
        question,
        section,
        part,
      } = item;

      cleanAnswers.push({
        questionId: question._id,
        answerValue:
          ans.answerValue === undefined ||
          ans.answerValue === null
            ? ''
            : ans.answerValue,
        question,
        section,
        part,
      });
    }

    const normalizedPartSelections =
      normalizePartSelections(
        partSelections,
        structure.parts.map((item) => ({
          ...item.part.toObject(),
          partId: item.part._id,
        })),
        cleanAnswers.map((item) => ({
          partId: item.part?._id,
        }))
      );

    // ==========================================================
    // BUILD SNAPSHOT
    // ==========================================================

    const assessmentSnapshot = {
      name: assessment.name,
      code: assessment.code,
      weekNumber: assessment.weekNumber,
      totalMarks: calculatedAssessmentMax,
      hasParts,
      parts,
      sections,
    };

    let submission;

    if (existingSubmission) {
      submission = existingSubmission;

      submission.assessmentSnapshot =
        assessmentSnapshot;

      submission.submittedAt = now;
      submission.submittedBy = getUserId(req);

      await submission.save();
    } else {
      submission =
        await AssessmentSubmission.create({
          assessment: assessmentId,
          student: studentId,
          batch: assessment.batch,
          attemptNumber: 1,
          assessmentSnapshot,
          submittedAt: now,
          submittedBy: getUserId(req),
        });
    }

    // Save selected part information temporarily
    submission._partSelectionMap =
      normalizedPartSelections;

    await AssessmentAnswer.deleteMany({
      submission: submission._id,
    });

    const answerDocuments = [];

    for (const item of cleanAnswers) {
      const {
        question,
        section,
        part,
        answerValue,
      } = item;

      const partId =
        part?._id || null;

      if (
        partId &&
        part?.isOptional === true &&
        normalizedPartSelections.get(
          partId.toString()
        ) === false
      ) {
        continue;
      }

      const score =
        calculateAnswerScore(
          question,
          answerValue
        );

      answerDocuments.push({
        submission: submission._id,
        assessment: assessmentId,
        student: studentId,
        question: question._id,
        section: section._id,
        part: partId,

        questionSnapshot: {
          questionText: question.questionText,
          questionType: question.questionType,
          maxPoints: Number(
            question.maxPoints || 0
          ),
          sectionId: section._id,
          sectionName: section.name,
          sectionDisplayOrder:
            section.displayOrder,
          partId,
          partName: part?.name || '',
          partDisplayOrder:
            part?.displayOrder || 0,
          displayOrder:
            question.displayOrder,
        },

        partSnapshot: part
          ? {
              partId: part._id,
              name: part.name,
              code: part.code || '',
              isOptional:
                part.isOptional === true,
              displayOrder:
                part.displayOrder || 0,
            }
          : undefined,

        answerValue,
        awardedScore: score,
        gradedBy: getUserId(req),
        gradedAt: now,
      });
    }

    if (answerDocuments.length) {
      await AssessmentAnswer.insertMany(
        answerDocuments
      );
    }

    // Store skipped optional parts as 0/0 during calculation.
    await calculateSubmissionScores(
      submission._id
    );

    const populatedSubmission =
      await AssessmentSubmission.findById(
        submission._id
      )
        .populate(
          'student',
          'name rollNumber'
        )
        .populate(
          'assessment',
          'name weekNumber code'
        );

    return res.status(201).json({
      success: true,
      data: populatedSubmission,
    });
  } catch (error) {
    console.error(
      'CREATE SUBMISSION ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// GET SUBMISSIONS
// ============================================================

exports.getSubmissions = async (req, res) => {
  try {
    const { assessmentId } = req.params;

    const {
      status,
      page = 1,
      limit = 50,
    } = req.query;

    const assessment =
      await Assessment.findById(
        assessmentId
      );

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found',
      });
    }

    if (
      isTeacher(req) &&
      !isTeacherAssignedToBatch(
        req,
        assessment.batch
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          'You are not authorized for this assessment',
      });
    }

    const filter = {
      assessment: assessmentId,
    };

    if (status) {
      filter.status = status;
    }

    const pageNumber =
      Math.max(parseInt(page, 10) || 1, 1);

    const limitNumber =
      Math.min(
        Math.max(parseInt(limit, 10) || 50, 1),
        100
      );

    const skip =
      (pageNumber - 1) *
      limitNumber;

    const [
      submissions,
      total,
    ] = await Promise.all([
      AssessmentSubmission.find(filter)
        .populate(
          'student',
          'name rollNumber'
        )
        .populate(
          'submittedBy',
          'name'
        )
        .sort({
          submittedAt: -1,
        })
        .skip(skip)
        .limit(limitNumber),

      AssessmentSubmission.countDocuments(
        filter
      ),
    ]);

    return res.json({
      success: true,
      data: submissions,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// GET SINGLE SUBMISSION
// ============================================================

exports.getSubmission = async (req, res) => {
  try {
    const submission =
      await AssessmentSubmission.findById(
        req.params.id
      )
        .populate(
          'student',
          'name rollNumber fatherName'
        )
        .populate(
          'assessment',
          'name weekNumber code'
        )
        .populate(
          'batch',
          'name'
        );

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    const answers =
      await AssessmentAnswer.find({
        submission: submission._id,
      })
        .populate(
          'question',
          'questionText questionType maxPoints'
        )
        .sort({
          'questionSnapshot.partDisplayOrder': 1,
          'questionSnapshot.sectionDisplayOrder': 1,
          'questionSnapshot.displayOrder': 1,
        });

    return res.json({
      success: true,
      data: {
        submission,
        answers,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// BATCH COMPLETION STATUS
// ============================================================

exports.getBatchCompletionStatus =
  async (req, res) => {
    try {
      const { assessmentId } = req.params;

      const assessment =
        await Assessment.findById(
          assessmentId
        );

      if (!assessment) {
        return res.status(404).json({
          success: false,
          message: 'Assessment not found',
        });
      }

      const totalStudents =
        await Student.countDocuments({
          batch: assessment.batch,
          isActive: true,
        });

      const completedSubmissions =
        await AssessmentSubmission.countDocuments({
          assessment: assessmentId,
          status: 'COMPLETED',
        });

      const pending =
        Math.max(
          totalStudents -
            completedSubmissions,
          0
        );

      return res.json({
        success: true,
        data: {
          totalStudents,
          completed:
            completedSubmissions,
          pending,
          completionRate:
            totalStudents > 0
              ? round2(
                  (completedSubmissions /
                    totalStudents) *
                    100
                )
              : 0,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

// ============================================================
// GET STUDENTS FOR MARKS
// ============================================================

exports.getAssessmentStudentsForMarks =
  async (req, res) => {
    try {
      const {
        assessmentId,
      } = req.params;

      const { search } = req.query;

      const assessment =
        await Assessment.findById(
          assessmentId
        )
          .populate(
            'batch',
            'name'
          )
          .populate(
            'course',
            'name'
          )
          .populate(
            'organisation',
            'name'
          )
          .populate(
            'centre',
            'name'
          );

      if (!assessment) {
        return res.status(404).json({
          success: false,
          message:
            'Assessment not found',
        });
      }

      if (
        isTeacher(req) &&
        !isTeacherAssignedToBatch(
          req,
          assessment.batch?._id ||
            assessment.batch
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            'You are not authorized for this batch',
        });
      }

      const batchId =
        assessment.batch?._id ||
        assessment.batch;

      const studentFilter = {
        batch: batchId,
        isActive: true,
      };

      if (search) {
        studentFilter.$or = [
          {
            name: {
              $regex: search,
              $options: 'i',
            },
          },
          {
            rollNumber: {
              $regex: search,
              $options: 'i',
            },
          },
        ];
      }

      const students =
        await Student.find(
          studentFilter
        ).sort({
          rollNumber: 1,
        });

      const submissions =
        await AssessmentSubmission.find({
          assessment: assessmentId,
        }).select(
          'student status totalObtained totalMax overallPercentage submittedAt updatedAt'
        );

      const submissionMap =
        new Map();

      submissions.forEach(
        (submission) => {
          submissionMap.set(
            submission.student.toString(),
            submission
          );
        }
      );

      const data =
        students.map(
          (student) => {
            const submission =
              submissionMap.get(
                student._id.toString()
              );

            return {
              student: {
                _id: student._id,
                name: student.name,
                rollNumber:
                  student.rollNumber,
              },

              submission:
                submission
                  ? {
                      _id:
                        submission._id,
                      status:
                        submission.status,
                      totalObtained:
                        Number(
                          submission.totalObtained ||
                            0
                        ),
                      totalMax:
                        Number(
                          submission.totalMax ||
                            assessment.totalMarks ||
                            0
                        ),
                      overallPercentage:
                        Number(
                          submission.overallPercentage ||
                            0
                        ),
                      submittedAt:
                        submission.submittedAt ||
                        null,
                    }
                  : null,
            };
          }
        );

      return res.json({
        success: true,
        data: {
          assessment: {
            _id:
              assessment._id,
            name:
              assessment.name,
            code:
              assessment.code,
            weekNumber:
              assessment.weekNumber,
            totalMarks:
              assessment.totalMarks,
            hasParts:
              assessment.hasParts === true,
            status:
              assessment.status,
            batch:
              assessment.batch,
            course:
              assessment.course,
            organisation:
              assessment.organisation,
            centre:
              assessment.centre,
          },

          students: data,
        },
      });
    } catch (error) {
      console.error(
        'GET ASSESSMENT STUDENTS FOR MARKS ERROR:',
        error
      );

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

// ============================================================
// GET STUDENT MARK ENTRY
// ============================================================

exports.getStudentMarksEntry =
  async (req, res) => {
    try {
      const {
        assessmentId,
        studentId,
      } = req.params;

      const structure =
        await buildAssessmentSnapshot(
          assessmentId
        );

      const {
        assessment,
        hasParts,
        parts,
        sections,
      } = structure;

      const student =
        await Student.findById(
          studentId
        )
          .populate(
            'batch',
            'name'
          )
          .populate(
            'course',
            'name'
          );

      if (!student) {
        return res.status(404).json({
          success: false,
          message: 'Student not found',
        });
      }

      if (
        student.batch?.toString() !==
        assessment.batch?.toString()
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Student does not belong to this assessment batch',
        });
      }

      const submission =
        await AssessmentSubmission.findOne({
          assessment: assessmentId,
          student: studentId,
          attemptNumber: 1,
        });

      const answers =
        submission
          ? await AssessmentAnswer.find({
              submission:
                submission._id,
            })
          : [];

      const answerMap =
        new Map();

      answers.forEach(
        (answer) => {
          answerMap.set(
            answer.question.toString(),
            answer
          );
        }
      );

      const buildSectionData =
        async (
          sectionItem,
          part = null
        ) => {
          const {
            section,
            questions,
          } = sectionItem;

          const questionsData =
            questions.map(
              (question) => {
                const answer =
                  answerMap.get(
                    question._id.toString()
                  );

                return {
                  _id:
                    question._id,
                  questionText:
                    question.questionText,
                  questionType:
                    question.questionType,
                  maxPoints:
                    Number(
                      question.maxPoints ||
                        0
                    ),
                  displayOrder:
                    question.displayOrder,

                  answerId:
                    answer?._id ||
                    null,

                  awardedScore:
                    answer
                      ? Number(
                          answer.awardedScore ||
                            0
                        )
                      : null,

                  answerValue:
                    answer?.answerValue ||
                    '',
                };
              }
            );

          const totalMarks =
            questionsData.reduce(
              (sum, question) =>
                sum +
                Number(
                  question.maxPoints ||
                    0
                ),
              0
            );

          const obtainedMarks =
            questionsData.reduce(
              (sum, question) =>
                sum +
                Number(
                  question.awardedScore ||
                    0
                ),
              0
            );

          return {
            _id:
              section._id,
            name:
              section.name,
            description:
              section.description ||
              '',
            displayOrder:
              section.displayOrder,
            partId:
              part?._id || null,
            partName:
              part?.name || '',
            partOptional:
              part?.isOptional === true,
            totalMarks,
            obtainedMarks,
            questions:
              questionsData,
          };
        };

      const responseParts = [];

      if (hasParts) {
        for (const partItem of parts) {
          const sectionData = [];

          for (
            const sectionItem of
              partItem.sections
          ) {
            sectionData.push(
              await buildSectionData(
                sectionItem,
                partItem.part
              )
            );
          }

          responseParts.push({
            _id:
              partItem.part._id,
            name:
              partItem.part.name,
            code:
              partItem.part.code ||
              '',
            description:
              partItem.part
                .description ||
              '',
            isOptional:
              partItem.part
                .isOptional === true,
            displayOrder:
              partItem.part
                .displayOrder,
            totalMarks:
              sectionData.reduce(
                (sum, section) =>
                  sum +
                  section.totalMarks,
                0
              ),
            obtainedMarks:
              sectionData.reduce(
                (sum, section) =>
                  sum +
                  section.obtainedMarks,
                0
              ),
            sections:
              sectionData,
          });
        }
      }

      const responseSections = [];

      if (!hasParts) {
        for (const sectionItem of sections) {
          responseSections.push(
            await buildSectionData(
              sectionItem
            )
          );
        }
      }

      return res.json({
        success: true,
        data: {
          assessment: {
            _id:
              assessment._id,
            name:
              assessment.name,
            code:
              assessment.code,
            weekNumber:
              assessment.weekNumber,
            totalMarks:
              assessment.totalMarks,
            hasParts,
            status:
              assessment.status,
          },

          student: {
            _id:
              student._id,
            name:
              student.name,
            rollNumber:
              student.rollNumber,
            batch:
              student.batch,
            course:
              student.course,
          },

          submission: submission
            ? {
                _id:
                  submission._id,
                status:
                  submission.status,
                totalObtained:
                  submission.totalObtained ||
                  0,
                totalMax:
                  submission.totalMax ||
                  assessment.totalMarks ||
                  0,
                overallPercentage:
                  submission.overallPercentage ||
                  0,
                partScores:
                  submission.partScores ||
                  [],
                sectionScores:
                  submission.sectionScores ||
                  [],
              }
            : null,

          parts:
            responseParts,

          sections:
            responseSections,
        },
      });
    } catch (error) {
      console.error(
        'GET STUDENT MARKS ENTRY ERROR:',
        error
      );

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

// ============================================================
// SAVE TEACHER MARKS
// ============================================================

exports.saveStudentMarks =
  async (req, res) => {
    try {
      const {
        assessmentId,
        studentId,
      } = req.params;

      const {
        marks,
        partSelections = [],
      } = req.body;

      if (!Array.isArray(marks)) {
        return res.status(400).json({
          success: false,
          message:
            'Marks must be an array',
        });
      }

      const structure =
        await buildAssessmentSnapshot(
          assessmentId
        );

      const {
        assessment,
        hasParts,
        parts,
        sections,
        calculatedAssessmentMax,
      } = structure;

      if (
        ![
          ASSESSMENT_STATUS.PUBLISHED,
          ASSESSMENT_STATUS.CLOSED,
        ].includes(
          assessment.status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Assessment must be published before marks can be entered',
        });
      }

      if (
        isTeacher(req) &&
        !isTeacherAssignedToBatch(
          req,
          assessment.batch
        )
      ) {
        return res.status(403).json({
          success: false,
          message:
            'You are not authorized for this batch',
        });
      }

      const student =
        await Student.findById(
          studentId
        );

      if (!student) {
        return res.status(404).json({
          success: false,
          message:
            'Student not found',
        });
      }

      if (
        student.batch?.toString() !==
        assessment.batch?.toString()
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Student does not belong to this assessment batch',
        });
      }

      // ========================================================
      // FLATTEN QUESTIONS
      // ========================================================

      const allQuestions = [];

      if (hasParts) {
        for (const partItem of parts) {
          for (
            const sectionItem of
              partItem.sections
          ) {
            for (
              const question of
                sectionItem.questions
            ) {
              allQuestions.push({
                question,
                section:
                  sectionItem.section,
                part:
                  partItem.part,
              });
            }
          }
        }
      } else {
        for (const sectionItem of sections) {
          for (
            const question of
              sectionItem.questions
          ) {
            allQuestions.push({
              question,
              section:
                sectionItem.section,
              part: null,
            });
          }
        }
      }

      if (!allQuestions.length) {
        return res.status(400).json({
          success: false,
          message:
            'No questions found for this assessment',
        });
      }

      // ========================================================
      // PART SELECTIONS
      // ========================================================

      const selectionMap =
        new Map();

      for (const partItem of parts) {
        const part =
          partItem.part;

        const incoming =
          partSelections.find(
            (item) =>
              item?.partId?.toString() ===
              part._id.toString()
          );

        if (part.isOptional) {
          selectionMap.set(
            part._id.toString(),
            incoming
              ? incoming.attempted !== false
              : false
          );
        } else {
          selectionMap.set(
            part._id.toString(),
            true
          );
        }
      }

      // If marks exist for an optional part,
      // automatically consider it attempted.
      for (const item of allQuestions) {
        if (!item.part?.isOptional) {
          continue;
        }

        const key =
          item.part._id.toString();

        const hasMark =
          marks.some(
            (mark) =>
              mark.questionId?.toString() ===
                item.question._id.toString()
          );

        if (hasMark) {
          selectionMap.set(
            key,
            true
          );
        }
      }

      // ========================================================
      // MARK MAP
      // ========================================================

      const marksMap =
        new Map();

      for (const item of marks) {
        if (!item?.questionId) {
          return res.status(400).json({
            success: false,
            message:
              'questionId is required',
          });
        }

        const questionExists =
          allQuestions.find(
            (q) =>
              q.question._id.toString() ===
              item.questionId.toString()
          );

        if (!questionExists) {
          return res.status(400).json({
            success: false,
            message:
              'Invalid questionId supplied',
          });
        }

        const awardedScore =
          Number(
            item.awardedScore
          );

        if (
          Number.isNaN(
            awardedScore
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              'Marks must be a valid number',
          });
        }

        if (
          marksMap.has(
            item.questionId.toString()
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              'Duplicate questionId in marks',
          });
        }

        marksMap.set(
          item.questionId.toString(),
          awardedScore
        );
      }

      // ========================================================
      // VALIDATE QUESTIONS
      // ========================================================

      for (const item of allQuestions) {
        const {
          question,
          part,
        } = item;

        const questionId =
          question._id.toString();

        const optionalPartSkipped =
          part?.isOptional === true &&
          selectionMap.get(
            part._id.toString()
          ) === false;

        if (optionalPartSkipped) {
          continue;
        }

        if (
          !marksMap.has(
            questionId
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              `Marks missing for question: ${question.questionText}`,
          });
        }

        const awardedScore =
          marksMap.get(
            questionId
          );

        const maxPoints =
          Number(
            question.maxPoints || 0
          );

        if (
          awardedScore < 0 ||
          awardedScore > maxPoints
        ) {
          return res.status(400).json({
            success: false,
            message:
              `Invalid marks for question "${question.questionText}". Marks must be between 0 and ${maxPoints}.`,
          });
        }
      }

      // ========================================================
      // SNAPSHOT
      // ========================================================

      const assessmentSnapshot = {
        name:
          assessment.name,
        code:
          assessment.code,
        weekNumber:
          assessment.weekNumber,
        totalMarks:
          calculatedAssessmentMax,
        hasParts,
        parts:
          parts.map(
            (item) => ({
              partId:
                item.part._id,
              name:
                item.part.name,
              code:
                item.part.code ||
                '',
              description:
                item.part.description ||
                '',
              isOptional:
                item.part.isOptional ===
                true,
              displayOrder:
                item.part.displayOrder,
              totalMarks:
                item.sections.reduce(
                  (
                    sum,
                    sectionItem
                  ) =>
                    sum +
                    sectionItem.questions.reduce(
                      (
                        qSum,
                        q
                      ) =>
                        qSum +
                        Number(
                          q.maxPoints ||
                            0
                        ),
                      0
                    ),
                  0
                ),
              totalQuestions:
                item.sections.reduce(
                  (
                    sum,
                    sectionItem
                  ) =>
                    sum +
                    sectionItem.questions.length,
                  0
                ),
            })
          ),
        sections:
          hasParts
            ? parts.flatMap(
                (partItem) =>
                  partItem.sections.map(
                    (
                      sectionItem
                    ) => ({
                      sectionId:
                        sectionItem.section._id,
                      name:
                        sectionItem.section.name,
                      description:
                        sectionItem.section.description ||
                        '',
                      displayOrder:
                        sectionItem.section.displayOrder,
                      partId:
                        partItem.part._id,
                      partName:
                        partItem.part.name,
                      partDisplayOrder:
                        partItem.part.displayOrder,
                      totalMarks:
                        sectionItem.questions.reduce(
                          (
                            sum,
                            q
                          ) =>
                            sum +
                            Number(
                              q.maxPoints ||
                                0
                            ),
                          0
                        ),
                      totalQuestions:
                        sectionItem.questions.length,
                    })
                  )
              )
            : sections.map(
                (
                  sectionItem
                ) => ({
                  sectionId:
                    sectionItem.section._id,
                  name:
                    sectionItem.section.name,
                  description:
                    sectionItem.section.description ||
                    '',
                  displayOrder:
                    sectionItem.section.displayOrder,
                  partId:
                    null,
                  partName:
                    '',
                  partDisplayOrder:
                    0,
                  totalMarks:
                    sectionItem.questions.reduce(
                      (
                        sum,
                        q
                      ) =>
                        sum +
                        Number(
                          q.maxPoints ||
                            0
                        ),
                      0
                    ),
                  totalQuestions:
                    sectionItem.questions.length,
                })
              ),
      };

      let submission =
        await AssessmentSubmission.findOne({
          assessment:
            assessmentId,
          student:
            studentId,
          attemptNumber:
            1,
        });

      if (!submission) {
        submission =
          await AssessmentSubmission.create({
            assessment:
              assessmentId,
            student:
              studentId,
            batch:
              assessment.batch,
            attemptNumber:
              1,
            assessmentSnapshot,
            status:
              'PENDING',
            submittedAt:
              new Date(),
            submittedBy:
              getUserId(req),
          });
      } else {
        submission.assessmentSnapshot =
          assessmentSnapshot;

        submission.submittedAt =
          new Date();

        submission.submittedBy =
          getUserId(req);

        await submission.save();
      }

      // ========================================================
      // DELETE OLD ANSWERS
      // ========================================================

      await AssessmentAnswer.deleteMany({
        submission:
          submission._id,
      });

      // ========================================================
      // CREATE ANSWERS
      // ========================================================

      const answerDocuments = [];

      for (const item of allQuestions) {
        const {
          question,
          section,
          part,
        } = item;

        const partSkipped =
          part?.isOptional === true &&
          selectionMap.get(
            part._id.toString()
          ) === false;

        if (partSkipped) {
          continue;
        }

        const awardedScore =
          marksMap.get(
            question._id.toString()
          );

        answerDocuments.push({
          submission:
            submission._id,
          assessment:
            assessmentId,
          student:
            studentId,
          question:
            question._id,
          section:
            section._id,
          part:
            part?._id || null,

          questionSnapshot: {
            questionText:
              question.questionText,
            questionType:
              question.questionType,
            maxPoints:
              Number(
                question.maxPoints ||
                  0
              ),
            sectionId:
              section._id,
            sectionName:
              section.name,
            sectionDisplayOrder:
              section.displayOrder,
            partId:
              part?._id || null,
            partName:
              part?.name || '',
            partDisplayOrder:
              part?.displayOrder ||
              0,
            displayOrder:
              question.displayOrder,
          },

          partSnapshot: part
            ? {
                partId:
                  part._id,
                name:
                  part.name,
                code:
                  part.code || '',
                isOptional:
                  part.isOptional ===
                  true,
                displayOrder:
                  part.displayOrder ||
                  0,
              }
            : undefined,

          // Teacher marks entry does not replace
          // student's original answer.
          answerValue: '',

          awardedScore:
            Number(
              awardedScore || 0
            ),

          gradedBy:
            getUserId(req),
          gradedAt:
            new Date(),
        });
      }

      if (answerDocuments.length) {
        await AssessmentAnswer.insertMany(
          answerDocuments
        );
      }

      await calculateSubmissionScores(
        submission._id
      );

      const savedSubmission =
        await AssessmentSubmission.findById(
          submission._id
        )
          .populate(
            'student',
            'name rollNumber'
          )
          .populate(
            'assessment',
            'name code weekNumber totalMarks'
          );

      return res.json({
        success: true,
        message:
          'Marks saved successfully',
        data: {
          submissionId:
            savedSubmission._id,
          student:
            savedSubmission.student,
          totalObtained:
            savedSubmission.totalObtained,
          totalMax:
            savedSubmission.totalMax,
          overallPercentage:
            savedSubmission.overallPercentage,
          partScores:
            savedSubmission.partScores,
          sectionScores:
            savedSubmission.sectionScores,
          status:
            savedSubmission.status,
        },
      });
    } catch (error) {
      console.error(
        'SAVE STUDENT MARKS ERROR:',
        error
      );

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

// ============================================================
// EXPORT
// ============================================================

exports.calculateSubmissionScores =
  calculateSubmissionScores;
