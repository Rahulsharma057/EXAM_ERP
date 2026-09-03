const Assessment = require("../models/Assessment");
const AssessmentSubmission = require("../models/AssessmentSubmission");
const AssessmentAnswer = require("../models/AssessmentAnswer");
const AssessmentSection = require("../models/AssessmentSection");
const AssessmentQuestion = require("../models/AssessmentQuestion");
const AssessmentPart = require("../models/AssessmentPart");
const Student = require("../models/Student");
const Batch = require("../models/Batch");

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

const round2 = (value) => {
  return Math.round(Number(value || 0) * 100) / 100;
};

// ============================================================
// GET ASSESSMENT STRUCTURE
// ============================================================

const getAssessmentStructure = async (assessmentId) => {
  const assessment = await Assessment.findById(assessmentId);

  if (!assessment) {
    return null;
  }

  const [parts, sections, questions] = await Promise.all([
    assessment.hasParts
      ? AssessmentPart.find({
          assessment: assessmentId,
          isActive: true,
        }).sort({
          displayOrder: 1,
          createdAt: 1,
        })
      : [],

    AssessmentSection.find({
      assessment: assessmentId,
      isActive: true,
    }).sort({
      displayOrder: 1,
      createdAt: 1,
    }),

    AssessmentQuestion.find({
      assessment: assessmentId,
      isActive: true,
    }).sort({
      displayOrder: 1,
      createdAt: 1,
    }),
  ]);

  const questionsBySection = new Map();

  for (const question of questions) {
    const key = question.section?.toString();

    if (!key) continue;

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
// BUILD CURRENT TEMPLATE STRUCTURE
// Used for pending students / marks entry / results structure
// ============================================================

const buildTemplateStructure = async (assessmentId) => {
  const structure = await getAssessmentStructure(assessmentId);

  if (!structure) {
    return null;
  }

  const { assessment, parts, sections } = structure;

  if (!assessment.hasParts) {
    return {
      hasParts: false,
      parts: [],
      sections: sections.map(({ section, questions }) => ({
        _id: section._id,
        name: section.name,
        description: section.description || "",
        displayOrder: section.displayOrder,
        part: null,
        totalMarks: questions.reduce(
          (sum, question) =>
            sum + Number(question.maxPoints || 0),
          0
        ),
        questions: questions.map((question) => ({
          _id: question._id,
          questionText: question.questionText,
          questionType: question.questionType,
          maxPoints: Number(question.maxPoints || 0),
          isRequired: question.isRequired,
          displayOrder: question.displayOrder,
        })),
      })),
    };
  }

  const sectionsByPart = new Map();

  for (const part of parts) {
    sectionsByPart.set(part._id.toString(), []);
  }

  for (const { section, questions } of sections) {
    if (!section.part) continue;

    const key = section.part.toString();

    if (!sectionsByPart.has(key)) {
      sectionsByPart.set(key, []);
    }

    sectionsByPart.get(key).push({
      _id: section._id,
      name: section.name,
      description: section.description || "",
      displayOrder: section.displayOrder,
      part: section.part,
      totalMarks: questions.reduce(
        (sum, question) =>
          sum + Number(question.maxPoints || 0),
        0
      ),
      questions: questions.map((question) => ({
        _id: question._id,
        questionText: question.questionText,
        questionType: question.questionType,
        maxPoints: Number(question.maxPoints || 0),
        isRequired: question.isRequired,
        displayOrder: question.displayOrder,
      })),
    });
  }

  return {
    hasParts: true,

    parts: parts.map((part) => ({
      _id: part._id,
      name: part.name,
      code: part.code,
      description: part.description || "",
      isOptional: Boolean(part.isOptional),
      displayOrder: part.displayOrder,
      totalMarks: Number(part.totalMarks || 0),
      totalQuestions: Number(part.totalQuestions || 0),
      sections:
        sectionsByPart.get(part._id.toString()) || [],
    })),

    sections: [],
  };
};

// ============================================================
// GET ASSESSMENT RESULTS
// ============================================================

exports.getAssessmentResults = async (req, res) => {
  try {
    const { assessmentId } = req.params;

    const {
      search,
      status,
      sortBy = "overallPercentage",
      sortOrder = "desc",
      page = 1,
      limit = 50,
    } = req.query;

    const { assessment, error } =
      await getAccessibleAssessment(
        assessmentId,
        req.user
      );

    if (error) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    await assessment.populate([
      {
        path: "batch",
        select: "name",
      },
      {
        path: "course",
        select: "name",
      },
    ]);

    const batchId =
      assessment.batch?._id || assessment.batch;

    const studentFilter = {
      batch: batchId,
      isActive: true,
    };

    if (search) {
      studentFilter.$or = [
        {
          name: {
            $regex: search,
            $options: "i",
          },
        },
        {
          rollNumber: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    // ========================================================
    // STUDENTS + SUBMISSIONS + STRUCTURE (Parts/Sections)
    //
    // IMPORTANT:
    // "structure" (parts/sections list) is needed by the
    // frontend to build part-wise / section-wise columns
    // in the results table AND the export field checkboxes.
    // Without this, ResultsTable receives empty parts/sections
    // and the Excel export options for Parts/Sections stay
    // empty, so those fields never get exported.
    // ========================================================

    const [students, submissions, structure] =
      await Promise.all([
        Student.find(studentFilter).sort({
          rollNumber: 1,
        }),

        AssessmentSubmission.find({
          assessment: assessmentId,
        }).populate(
          "student",
          "name rollNumber"
        ),

        buildTemplateStructure(assessmentId),
      ]);

    const submissionMap = new Map();

    submissions.forEach((sub) => {
      if (sub.student) {
        submissionMap.set(
          sub.student._id.toString(),
          sub
        );
      }
    });

    const results = students.map((student) => {
      const sub =
        submissionMap.get(
          student._id.toString()
        );

      return {
        student: {
          _id: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
        },

        status: sub
          ? sub.status
          : "PENDING",

        partScores: sub
          ? sub.partScores || []
          : [],

        sectionScores: sub
          ? sub.sectionScores || []
          : [],

        totalObtained: sub
          ? Number(sub.totalObtained || 0)
          : 0,

        totalMax: sub
          ? Number(sub.totalMax || 0)
          : Number(assessment.totalMarks || 0),

        overallPercentage: sub
          ? Number(sub.overallPercentage || 0)
          : 0,

        submittedAt: sub
          ? sub.submittedAt
          : null,

        updatedAt: sub
          ? sub.updatedAt
          : null,
      };
    });

    let filtered = results;

    if (status) {
      filtered = filtered.filter(
        (result) =>
          result.status === status
      );
    }

    // ========================================================
    // SAFE SORT
    // ========================================================

    const allowedSortFields = new Set([
      "overallPercentage",
      "totalObtained",
      "totalMax",
      "submittedAt",
      "student.name",
      "student.rollNumber",
    ]);

    const safeSortBy =
      allowedSortFields.has(sortBy)
        ? sortBy
        : "overallPercentage";

    const getSortValue = (result) => {
      if (safeSortBy === "student.name") {
        return String(
          result.student?.name || ""
        ).toLowerCase();
      }

      if (safeSortBy === "student.rollNumber") {
        return String(
          result.student?.rollNumber || ""
        ).toLowerCase();
      }

      return result[safeSortBy];
    };

    filtered.sort((a, b) => {
      const aVal = getSortValue(a);
      const bVal = getSortValue(b);

      if (
        typeof aVal === "string" ||
        typeof bVal === "string"
      ) {
        const comparison = String(aVal).localeCompare(
          String(bVal)
        );

        return sortOrder === "asc"
          ? comparison
          : -comparison;
      }

      const aNumber = Number(aVal || 0);
      const bNumber = Number(bVal || 0);

      return sortOrder === "asc"
        ? aNumber - bNumber
        : bNumber - aNumber;
    });

    // ========================================================
    // PAGINATION
    // ========================================================

    const pageNumber = Math.max(
      parseInt(page, 10) || 1,
      1
    );

    const pageLimit = Math.min(
      Math.max(parseInt(limit, 10) || 50, 1),
      200
    );

    const total = filtered.length;

    const skip =
      (pageNumber - 1) * pageLimit;

    const paginated = filtered.slice(
      skip,
      skip + pageLimit
    );

    // ========================================================
    // STATS
    // ========================================================

    const completed = results.filter(
      (result) =>
        result.status === "COMPLETED"
    );

    const avgScore =
      completed.length > 0
        ? completed.reduce(
            (sum, result) =>
              sum +
              Number(
                result.overallPercentage || 0
              ),
            0
          ) / completed.length
        : 0;

    const highest =
      completed.length > 0
        ? Math.max(
            ...completed.map(
              (result) =>
                Number(
                  result.overallPercentage || 0
                )
            )
          )
        : 0;

    const lowest =
      completed.length > 0
        ? Math.min(
            ...completed.map(
              (result) =>
                Number(
                  result.overallPercentage || 0
                )
            )
          )
        : 0;

    return res.json({
      success: true,

      data: {
        assessment: {
          _id: assessment._id,
          name: assessment.name,
          code: assessment.code,
          weekNumber: assessment.weekNumber,

          hasParts: Boolean(
            assessment.hasParts
          ),

          totalMarks:
            Number(
              assessment.totalMarks || 0
            ),

          batch: assessment.batch,
          course: assessment.course,
        },

        // ====================================================
        // NEW: Parts / Sections structure
        //
        // Needed by the frontend (ResultsTable) to:
        //  1. Render part-wise / section-wise columns
        //  2. Build the Export dialog's Part/Section checkboxes
        //
        // Direct-section assessments -> hasParts=false ->
        //   parts=[] and sections=[...] (flat list)
        // Part-based assessments -> hasParts=true ->
        //   parts=[{ ...part, sections:[...] }] and sections=[]
        // ====================================================

        hasParts: Boolean(assessment.hasParts),

        parts: structure?.parts || [],

        sections: structure?.sections || [],

        stats: {
          totalStudents: results.length,

          completed:
            completed.length,

          pending:
            results.length -
            completed.length,

          averageScore:
            round2(avgScore),

          highestScore:
            round2(highest),

          lowestScore:
            round2(lowest),
        },

        results: paginated,

        pagination: {
          page: pageNumber,
          limit: pageLimit,
          total,
          totalPages:
            Math.ceil(
              total / pageLimit
            ),
        },
      },
    });
  } catch (error) {
    console.error(
      "GET ASSESSMENT RESULTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// GET STUDENT RESULTS
// ============================================================

exports.getStudentResults = async (
  req,
  res
) => {
  try {
    const { studentId } =
      req.params;

    const student =
      await Student.findById(
        studentId
      )
        .populate(
          "organisation",
          "name"
        )
        .populate(
          "centre",
          "name"
        )
        .populate(
          "course",
          "name"
        )
        .populate(
          "batch",
          "name"
        );

    if (!student) {
      return res.status(404).json({
        success: false,
        message:
          "Student not found",
      });
    }

    const submissions =
      await AssessmentSubmission.find({
        student: studentId,
        status: "COMPLETED",
      })
        .populate(
          "assessment",
          "name weekNumber code totalMarks hasParts"
        )
        .sort({
          "assessment.weekNumber": 1,
        });

    const weeklyPerformance =
      submissions
        .filter(
          (sub) =>
            sub.assessment
        )
        .map((sub) => ({
          weekNumber:
            sub.assessment
              .weekNumber,

          assessmentName:
            sub.assessment.name,

          assessmentId:
            sub.assessment._id,

          code:
            sub.assessment.code,

          hasParts:
            Boolean(
              sub.assessment.hasParts
            ),

          totalObtained:
            Number(
              sub.totalObtained || 0
            ),

          totalMax:
            Number(
              sub.totalMax || 0
            ),

          percentage:
            Number(
              sub.overallPercentage || 0
            ),

          partScores:
            sub.partScores || [],

          sectionScores:
            sub.sectionScores || [],

          submittedAt:
            sub.submittedAt,
        }));

    return res.json({
      success: true,

      data: {
        student: {
          _id: student._id,
          name: student.name,
          rollNumber:
            student.rollNumber,

          organisation:
            student.organisation,

          centre:
            student.centre,

          course:
            student.course,

          batch:
            student.batch,
        },

        weeklyPerformance,
      },
    });
  } catch (error) {
    console.error(
      "GET STUDENT RESULTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// GET BATCH RESULTS
// ============================================================

exports.getBatchResults = async (
  req,
  res
) => {
  try {
    const { batchId } =
      req.params;

    const { weekNumber } =
      req.query;

    const batch =
      await Batch.findById(
        batchId
      )
        .populate(
          "course",
          "name"
        )
        .populate(
          "centre",
          "name"
        )
        .populate(
          "organisation",
          "name"
        );

    if (!batch) {
      return res.status(404).json({
        success: false,
        message:
          "Batch not found",
      });
    }

    if (
      isTeacher(req.user) &&
      !isTeacherAssignedToBatch(
        req.user,
        batchId
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You are not authorized to access this batch",
      });
    }

    const assessmentFilter = {
      batch: batchId,

      status: {
        $in: [
          "PUBLISHED",
          "CLOSED",
          "ARCHIVED",
        ],
      },
    };

    if (weekNumber) {
      assessmentFilter.weekNumber =
        parseInt(
          weekNumber,
          10
        );
    }

    const assessments =
      await Assessment.find(
        assessmentFilter
      ).sort({
        weekNumber: 1,
      });

    const totalStudents =
      await Student.countDocuments({
        batch: batchId,
        isActive: true,
      });

    const results =
      await Promise.all(
        assessments.map(
          async (assessment) => {
            const submissions =
              await AssessmentSubmission.find({
                assessment:
                  assessment._id,

                status:
                  "COMPLETED",
              }).select(
                "student totalObtained totalMax overallPercentage"
              );

            const avgPercentage =
              submissions.length > 0
                ? submissions.reduce(
                    (
                      sum,
                      submission
                    ) =>
                      sum +
                      Number(
                        submission.overallPercentage ||
                          0
                      ),
                    0
                  ) /
                  submissions.length
                : 0;

            return {
              assessment: {
                _id:
                  assessment._id,

                name:
                  assessment.name,

                code:
                  assessment.code,

                weekNumber:
                  assessment.weekNumber,

                hasParts:
                  Boolean(
                    assessment.hasParts
                  ),

                totalMarks:
                  Number(
                    assessment.totalMarks ||
                      0
                  ),
              },

              totalStudents,

              completed:
                submissions.length,

              pending:
                Math.max(
                  totalStudents -
                    submissions.length,
                  0
                ),

              averagePercentage:
                round2(
                  avgPercentage
                ),
            };
          }
        )
      );

    return res.json({
      success: true,

      data: {
        batch,

        results,
      },
    });
  } catch (error) {
    console.error(
      "GET BATCH RESULTS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// GET STUDENT WISE SECTION + PART RESULTS
// ============================================================

exports.getStudentWiseSectionResults =
  async (req, res) => {
    try {
      const {
        assessmentId,
        studentId,
      } = req.params;

      const { assessment, error } =
        await getAccessibleAssessment(
          assessmentId,
          req.user
        );

      if (error) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
        });
      }

      await assessment.populate([
        {
          path: "batch",
          select: "name",
        },
        {
          path: "course",
          select: "name",
        },
      ]);

      const batchId =
        assessment.batch?._id ||
        assessment.batch;

      const student =
        await Student.findOne({
          _id: studentId,
          batch: batchId,
          isActive: true,
        }).select(
          "name rollNumber fatherName"
        );

      if (!student) {
        return res.status(404).json({
          success: false,
          message:
            "Student does not belong to this assessment batch",
        });
      }

      const submission =
        await AssessmentSubmission.findOne({
          assessment:
            assessmentId,

          student:
            studentId,
        }).populate(
          "student",
          "name rollNumber"
        );

      // ======================================================
      // NO SUBMISSION
      // ======================================================

      if (!submission) {
        const structure =
          await buildTemplateStructure(
            assessmentId
          );

        return res.json({
          success: true,

          data: {
            student: {
              _id: student._id,
              name: student.name,
              rollNumber:
                student.rollNumber,
            },

            assessment: {
              _id:
                assessment._id,

              name:
                assessment.name,

              code:
                assessment.code,

              weekNumber:
                assessment.weekNumber,

              hasParts:
                Boolean(
                  assessment.hasParts
                ),

              totalMarks:
                Number(
                  assessment.totalMarks ||
                    0
                ),

              batch:
                assessment.batch,

              course:
                assessment.course,
            },

            status:
              "PENDING",

            parts:
              structure?.parts ||
              [],

            sections:
              structure?.sections ||
              [],

            totalObtained: 0,

            totalMax:
              Number(
                assessment.totalMarks ||
                  0
              ),

            overallPercentage: 0,
          },
        });
      }

      // ======================================================
      // ANSWERS
      // ======================================================

      const answers =
        await AssessmentAnswer.find({
          submission:
            submission._id,
        }).sort({
          "questionSnapshot.displayOrder":
            1,
        });

      // ======================================================
      // USE SNAPSHOT IDS
      //
      // Never group by section name because two sections can
      // have same name.
      // ======================================================

      const sectionMap = new Map();
      const partMap = new Map();

      for (const answer of answers) {
        const snapshot =
          answer.questionSnapshot ||
          {};

        const sectionId =
          snapshot.sectionId
            ?.toString() ||
          answer.section?.toString() ||
          `section-${answer._id}`;

        const partId =
          snapshot.partId?.toString() ||
          answer.part?.toString() ||
          null;

        const sectionName =
          snapshot.sectionName ||
          "General";

        const maxPoints =
          Number(
            snapshot.maxPoints ||
              0
          );

        const awardedScore =
          Number(
            answer.awardedScore ||
              0
          );

        if (!sectionMap.has(sectionId)) {
          sectionMap.set(
            sectionId,
            {
              sectionId:
                snapshot.sectionId ||
                answer.section ||
                null,

              sectionName,

              partId:
                snapshot.partId ||
                answer.part ||
                null,

              partName:
                snapshot.partName ||
                null,

              partDisplayOrder:
                Number(
                  snapshot.partDisplayOrder ||
                    0
                ),

              sectionDisplayOrder:
                Number(
                  snapshot.sectionDisplayOrder ||
                    0
                ),

              questions: [],

              obtained: 0,

              max: 0,
            }
          );
        }

        const section =
          sectionMap.get(
            sectionId
          );

        section.questions.push({
          questionId:
            answer.question,

          questionText:
            snapshot.questionText ||
            "",

          questionType:
            snapshot.questionType ||
            "",

          maxPoints,

          answerValue:
            answer.answerValue ?? "",

          awardedScore,

          displayOrder:
            Number(
              snapshot.displayOrder ||
                0
            ),
        });

        section.obtained +=
          awardedScore;

        section.max +=
          maxPoints;
      }

      // ======================================================
      // SECTION SCORES FROM SUBMISSION SNAPSHOT
      //
      // This is important for skipped optional Parts.
      // ======================================================

      const snapshotSectionScores =
        submission.sectionScores ||
        [];

      const sections =
        Array.from(
          sectionMap.values()
        ).map((section) => {
          const savedScore =
            snapshotSectionScores.find(
              (item) =>
                item.sectionId &&
                section.sectionId &&
                item.sectionId.toString() ===
                  section.sectionId.toString()
            );

          const obtained =
            savedScore
              ? Number(
                  savedScore.obtainedMarks ||
                    0
                )
              : section.obtained;

          const max =
            savedScore
              ? Number(
                  savedScore.maxMarks ||
                    0
                )
              : section.max;

          return {
            ...section,

            obtained,

            max,

            percentage:
              max > 0
                ? round2(
                    (obtained /
                      max) *
                      100
                  )
                : 0,
          };
        });

      // ======================================================
      // PART SCORES
      // ======================================================

      const partScores =
        (submission.partScores || []).map(
          (part) => ({
            ...part.toObject?.() ||
              part,

            obtainedMarks:
              Number(
                part.obtainedMarks ||
                  0
              ),

            maxMarks:
              Number(
                part.maxMarks ||
                  0
              ),

            percentage:
              Number(
                part.percentage ||
                  0
              ),

            attempted:
              Boolean(
                part.attempted
              ),

            skipped:
              !Boolean(
                part.attempted
              ),
          })
        );

      // ======================================================
      // GROUP SECTIONS INSIDE PARTS
      // ======================================================

      const partResultMap =
        new Map();

      for (const part of partScores) {
        partResultMap.set(
          part.partId?.toString(),
          {
            ...part,

            sections: [],
          }
        );
      }

      const directSections = [];

      for (const section of sections) {
        if (
          section.partId &&
          partResultMap.has(
            section.partId.toString()
          )
        ) {
          partResultMap
            .get(
              section.partId.toString()
            )
            .sections.push(
              section
            );
        } else {
          directSections.push(
            section
          );
        }
      }

      const parts =
        Array.from(
          partResultMap.values()
        ).sort(
          (a, b) =>
            Number(
              a.displayOrder || 0
            ) -
            Number(
              b.displayOrder || 0
            )
        );

      return res.json({
        success: true,

        data: {
          student:
            submission.student,

          assessment: {
            _id:
              assessment._id,

            name:
              assessment.name,

            code:
              assessment.code,

            weekNumber:
              assessment.weekNumber,

            hasParts:
              Boolean(
                assessment.hasParts
              ),

            totalMarks:
              Number(
                assessment.totalMarks ||
                  0
              ),

            batch:
              assessment.batch,

            course:
              assessment.course,
          },

          status:
            submission.status ||
            "COMPLETED",

          parts,

          sections:
            directSections,

          totalObtained:
            Number(
              submission.totalObtained ||
                0
            ),

          totalMax:
            Number(
              submission.totalMax ||
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
        },
      });
    } catch (error) {
      console.error(
        "GET STUDENT SECTION RESULTS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

// ============================================================
// GET ASSESSMENT STUDENTS FOR MARKS
// ============================================================

exports.getAssessmentStudentsForMarks =
  async (req, res) => {
    try {
      const { assessmentId } =
        req.params;

      const { search } =
        req.query;

      const { assessment, error } =
        await getAccessibleAssessment(
          assessmentId,
          req.user
        );

      if (error) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
        });
      }

      await assessment.populate([
        {
          path: "batch",
          select: "name",
        },
        {
          path: "course",
          select: "name",
        },
        {
          path: "organisation",
          select: "name",
        },
        {
          path: "centre",
          select: "name",
        },
      ]);

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
              $options: "i",
            },
          },
          {
            rollNumber: {
              $regex: search,
              $options: "i",
            },
          },
        ];
      }

      const [
        students,
        submissions,
        structure,
      ] = await Promise.all([
        Student.find(
          studentFilter
        ).sort({
          rollNumber: 1,
        }),

        AssessmentSubmission.find({
          assessment:
            assessmentId,
        }).select(
          "student status totalObtained totalMax overallPercentage submittedAt updatedAt partScores sectionScores"
        ),

        buildTemplateStructure(
          assessmentId
        ),
      ]);

      const submissionMap =
        new Map();

      submissions.forEach(
        (submission) => {
          if (!submission.student)
            return;

          submissionMap.set(
            submission.student.toString(),
            submission
          );
        }
      );

      const studentData =
        students.map(
          (student) => {
            const submission =
              submissionMap.get(
                student._id.toString()
              );

            return {
              _id:
                student._id,

              name:
                student.name,

              rollNumber:
                student.rollNumber,

              fatherName:
                student.fatherName ||
                "",

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
                            0
                        ),

                      overallPercentage:
                        Number(
                          submission.overallPercentage ||
                            0
                        ),

                      partScores:
                        submission.partScores ||
                        [],

                      sectionScores:
                        submission.sectionScores ||
                        [],

                      submittedAt:
                        submission.submittedAt ||
                        null,

                      updatedAt:
                        submission.updatedAt ||
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

            hasParts:
              Boolean(
                assessment.hasParts
              ),

            totalMarks:
              Number(
                assessment.totalMarks ||
                  0
              ),

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

            structure:
              structure || null,
          },

          students:
            studentData,
        },
      });
    } catch (error) {
      console.error(
        "GET ASSESSMENT STUDENTS FOR MARKS ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

// ============================================================
// GET ONE STUDENT QUESTIONS + EXISTING MARKS
// ============================================================

exports.getStudentMarksEntry =
  async (req, res) => {
    try {
      const {
        assessmentId,
        studentId,
      } = req.params;

      const { assessment, error } =
        await getAccessibleAssessment(
          assessmentId,
          req.user
        );

      if (error) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
        });
      }

      const student =
        await Student.findOne({
          _id: studentId,
          batch: assessment.batch,
          isActive: true,
        })
          .populate(
            "batch",
            "name"
          )
          .populate(
            "course",
            "name"
          );

      if (!student) {
        return res.status(404).json({
          success: false,
          message:
            "Student does not belong to this assessment batch",
        });
      }

      const structure =
        await getAssessmentStructure(
          assessmentId
        );

      const submission =
        await AssessmentSubmission.findOne({
          assessment:
            assessmentId,

          student:
            studentId,
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
          if (answer.question) {
            answerMap.set(
              answer.question.toString(),
              answer
            );
          }
        }
      );

      // ======================================================
      // DIRECT SECTION MODE
      // ======================================================

      if (!assessment.hasParts) {
        const sections =
          structure.sections.map(
            ({
              section,
              questions,
            }) => ({
              _id:
                section._id,

              name:
                section.name,

              description:
                section.description ||
                "",

              displayOrder:
                section.displayOrder,

              part: null,

              totalMarks:
                questions.reduce(
                  (
                    sum,
                    question
                  ) =>
                    sum +
                    Number(
                      question.maxPoints ||
                        0
                    ),
                  0
                ),

              questions:
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

                      isRequired:
                        question.isRequired,

                      displayOrder:
                        question.displayOrder,

                      awardedScore:
                        answer
                          ? Number(
                              answer.awardedScore ||
                                0
                            )
                          : null,

                      answerValue:
                        answer
                          ? answer.answerValue ??
                            ""
                          : "",
                    };
                  }
                ),
            })
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

              hasParts: false,

              totalMarks:
                Number(
                  assessment.totalMarks ||
                    0
                ),

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

              fatherName:
                student.fatherName ||
                "",

              batch:
                student.batch,

              course:
                student.course,
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

            parts: [],

            sections,
          },
        });
      }

      // ======================================================
      // PART MODE
      // ======================================================

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
        if (!section.part) continue;

        const sectionTotal =
          questions.reduce(
            (sum, question) =>
              sum +
              Number(
                question.maxPoints ||
                  0
              ),
            0
          );

        sectionsByPart
          .get(
            section.part.toString()
          )
          ?.push({
            _id:
              section._id,

            name:
              section.name,

            description:
              section.description ||
              "",

            displayOrder:
              section.displayOrder,

            part:
              section.part,

            totalMarks:
              sectionTotal,

            questions:
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

                    isRequired:
                      question.isRequired,

                    displayOrder:
                      question.displayOrder,

                    awardedScore:
                      answer
                        ? Number(
                            answer.awardedScore ||
                              0
                          )
                        : null,

                    answerValue:
                      answer
                        ? answer.answerValue ??
                          ""
                        : "",
                  };
                }
              ),
          });
      }

      const savedPartScores =
        submission?.partScores ||
        [];

      const parts =
        structure.parts.map(
          (part) => {
            const savedPart =
              savedPartScores.find(
                (item) =>
                  item.partId &&
                  item.partId.toString() ===
                    part._id.toString()
              );

            return {
              _id:
                part._id,

              name:
                part.name,

              code:
                part.code,

              description:
                part.description ||
                "",

              isOptional:
                Boolean(
                  part.isOptional
                ),

              displayOrder:
                part.displayOrder,

              totalMarks:
                Number(
                  part.totalMarks ||
                    0
                ),

              totalQuestions:
                Number(
                  part.totalQuestions ||
                    0
                ),

              attempted:
                savedPart
                  ? Boolean(
                      savedPart.attempted
                    )
                  : !part.isOptional,

              skipped:
                savedPart
                  ? !Boolean(
                      savedPart.attempted
                    )
                  : false,

              obtainedMarks:
                savedPart
                  ? Number(
                      savedPart.obtainedMarks ||
                        0
                    )
                  : 0,

              maxMarks:
                savedPart
                  ? Number(
                      savedPart.maxMarks ||
                        0
                    )
                  : Number(
                      part.totalMarks ||
                        0
                    ),

              percentage:
                savedPart
                  ? Number(
                      savedPart.percentage ||
                        0
                    )
                  : 0,

              sections:
                sectionsByPart.get(
                  part._id.toString()
                ) || [],
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

            hasParts: true,

            totalMarks:
              Number(
                assessment.totalMarks ||
                  0
              ),

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

            fatherName:
              student.fatherName ||
              "",

            batch:
              student.batch,

            course:
              student.course,
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

          parts,

          sections: [],
        },
      });
    } catch (error) {
      console.error(
        "GET STUDENT MARKS ENTRY ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  };

// ============================================================
// SAVE STUDENT MARKS
//
// Supports:
// 1. Assessment -> Sections -> Questions
// 2. Assessment -> Parts -> Sections -> Questions
//
// Optional Part:
// attempted=false
// => obtained=0, max=0
// => completely excluded from denominator
// ============================================================

exports.saveStudentMarks =
  async (req, res) => {
    try {
      const {
        assessmentId,
        studentId,
      } = req.params;

      const {
        marks = [],
        partSelections = [],
      } = req.body;

      if (!Array.isArray(marks)) {
        return res.status(400).json({
          success: false,
          message:
            "Marks must be an array",
        });
      }

      const assessment =
        await Assessment.findById(
          assessmentId
        );

      if (!assessment) {
        return res.status(404).json({
          success: false,
          message:
            "Assessment not found",
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
          message:
            "You are not authorized to enter marks for this assessment",
        });
      }

      if (
        ![
          "PUBLISHED",
          "CLOSED",
        ].includes(
          assessment.status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Marks can only be entered for published or closed assessments",
        });
      }

      const student =
        await Student.findOne({
          _id: studentId,
          batch: assessment.batch,
          isActive: true,
        });

      if (!student) {
        return res.status(400).json({
          success: false,
          message:
            "Student does not belong to this assessment batch",
        });
      }

      const structure =
        await getAssessmentStructure(
          assessmentId
        );

      if (!structure) {
        return res.status(404).json({
          success: false,
          message:
            "Assessment structure not found",
        });
      }

      if (
        !structure.sections.length
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Assessment has no sections",
        });
      }

      const existingSubmission =
        await AssessmentSubmission.findOne({
          assessment:
            assessmentId,

          student:
            studentId,

          attemptNumber: 1,
        });

      // ========================================================
      // PART SELECTION MAP
      // ========================================================

      const partSelectionMap =
        new Map();

      if (
        Array.isArray(
          partSelections
        )
      ) {
        for (const selection of partSelections) {
          if (
            !selection?.partId
          ) {
            continue;
          }

          partSelectionMap.set(
            selection.partId.toString(),
            Boolean(
              selection.attempted
            )
          );
        }
      }

      // ========================================================
      // DETERMINE PART ATTEMPT STATUS
      // ========================================================

      const partAttemptMap =
        new Map();

      if (assessment.hasParts) {
        for (const part of structure.parts) {
          if (!part.isOptional) {
            // Required Part
            partAttemptMap.set(
              part._id.toString(),
              true
            );

            continue;
          }

          // Explicit selection wins
          if (
            partSelectionMap.has(
              part._id.toString()
            )
          ) {
            partAttemptMap.set(
              part._id.toString(),
              partSelectionMap.get(
                part._id.toString()
              )
            );

            continue;
          }

          // Existing submission selection
          const existingPart =
            existingSubmission?.partScores?.find(
              (item) =>
                item.partId &&
                item.partId.toString() ===
                  part._id.toString()
            );

          if (existingPart) {
            partAttemptMap.set(
              part._id.toString(),
              Boolean(
                existingPart.attempted
              )
            );

            continue;
          }

          // Default optional Part = attempted
          partAttemptMap.set(
            part._id.toString(),
            true
          );
        }
      }

      // ========================================================
      // ALL ACTIVE QUESTIONS
      // ========================================================

      const allQuestions = [];

      for (const {
        section,
        questions,
      } of structure.sections) {
        for (const question of questions) {
          allQuestions.push({
            question,
            section,
          });
        }
      }

      if (!allQuestions.length) {
        return res.status(400).json({
          success: false,
          message:
            "Assessment has no questions",
        });
      }

      // ========================================================
      // MARKS MAP
      // ========================================================

      const marksMap = new Map();

      for (const item of marks) {
        if (!item?.questionId) {
          return res.status(400).json({
            success: false,
            message:
              "questionId is required",
          });
        }

        const questionId =
          item.questionId.toString();

        const score =
          Number(
            item.awardedScore
          );

        if (
          !Number.isFinite(score)
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Marks must be valid numbers",
          });
        }

        marksMap.set(
          questionId,
          score
        );
      }

      // ========================================================
      // VALIDATE MARKS
      // ========================================================

      for (const {
        question,
        section,
      } of allQuestions) {
        const questionId =
          question._id.toString();

        const partId =
          section.part?.toString();

        const partAttempted =
          !assessment.hasParts ||
          !partId ||
          partAttemptMap.get(
            partId
          ) !== false;

        // ------------------------------------------------------
        // SKIPPED OPTIONAL PART
        // ------------------------------------------------------

        if (!partAttempted) {
          // If marks are sent for skipped Part,
          // reject instead of silently accepting.
          if (
            marksMap.has(
              questionId
            ) &&
            Number(
              marksMap.get(
                questionId
              )
            ) !== 0
          ) {
            return res.status(400).json({
              success: false,
              message:
                `Marks cannot be entered for skipped optional Part question: ${question.questionText}`,
            });
          }

          continue;
        }

        // ------------------------------------------------------
        // INCLUDED QUESTION
        // ------------------------------------------------------

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

        const score =
          Number(
            marksMap.get(
              questionId
            )
          );

        const maxPoints =
          Number(
            question.maxPoints ||
              0
          );

        if (
          score < 0 ||
          score > maxPoints
        ) {
          return res.status(400).json({
            success: false,
            message:
              `Marks for "${question.questionText}" must be between 0 and ${maxPoints}`,
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

        hasParts:
          Boolean(
            assessment.hasParts
          ),

        parts:
          assessment.hasParts
            ? structure.parts.map(
                (part) => ({
                  partId:
                    part._id,

                  name:
                    part.name,

                  code:
                    part.code,

                  isOptional:
                    Boolean(
                      part.isOptional
                    ),

                  displayOrder:
                    part.displayOrder,

                  totalMarks:
                    Number(
                      part.totalMarks ||
                        0
                    ),

                  totalQuestions:
                    Number(
                      part.totalQuestions ||
                        0
                    ),
                })
              )
            : [],

        sections:
          structure.sections.map(
            ({
              section,
              questions,
            }) => ({
              sectionId:
                section._id,

              name:
                section.name,

              description:
                section.description ||
                "",

              partId:
                section.part ||
                null,

              partName:
                assessment.hasParts &&
                section.part
                  ? structure.parts.find(
                      (part) =>
                        part._id.toString() ===
                        section.part.toString()
                    )?.name ||
                    null
                  : null,

              partDisplayOrder:
                assessment.hasParts &&
                section.part
                  ? Number(
                      structure.parts.find(
                        (part) =>
                          part._id.toString() ===
                          section.part.toString()
                      )?.displayOrder ||
                        0
                    )
                  : 0,

              displayOrder:
                section.displayOrder,

              totalMarks:
                questions.reduce(
                  (
                    sum,
                    question
                  ) =>
                    sum +
                    Number(
                      question.maxPoints ||
                        0
                    ),
                  0
                ),

              totalQuestions:
                questions.length,
            })
          ),
      };

      // ========================================================
      // CREATE / UPDATE SUBMISSION
      // ========================================================

      let submission =
        existingSubmission;

      if (!submission) {
        submission =
          new AssessmentSubmission({
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
              "COMPLETED",

            submittedAt:
              new Date(),

            submittedBy:
              getUserId(req),
          });
      } else {
        // Keep old snapshot if submission already exists.
        // This is important for version safety.
        if (
          !submission.assessmentSnapshot ||
          !submission.assessmentSnapshot
            .sections?.length
        ) {
          submission.assessmentSnapshot =
            assessmentSnapshot;
        }

        submission.status =
          "COMPLETED";

        submission.submittedAt =
          new Date();

        submission.submittedBy =
          getUserId(req);
      }

      await submission.save();

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

      const answerDocuments =
        [];

      for (const {
        question,
        section,
      } of allQuestions) {
        const questionId =
          question._id.toString();

        const partId =
          section.part?.toString();

        const partAttempted =
          !assessment.hasParts ||
          !partId ||
          partAttemptMap.get(
            partId
          ) !== false;

        const awardedScore =
          partAttempted
            ? Number(
                marksMap.get(
                  questionId
                ) || 0
              )
            : 0;

        const part =
          assessment.hasParts &&
          partId
            ? structure.parts.find(
                (item) =>
                  item._id.toString() ===
                  partId
              )
            : null;

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
              part?.name || null,

            partDisplayOrder:
              part?.displayOrder || 0,

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
                  part.code,

                isOptional:
                  Boolean(
                    part.isOptional
                  ),

                displayOrder:
                  part.displayOrder,
              }
            : undefined,

          answerValue: "",

          awardedScore,

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

      // ========================================================
      // SECTION SCORES
      // ========================================================

      const sectionScores =
        [];

      for (const {
        section,
        questions,
      } of structure.sections) {
        const partId =
          section.part?.toString();

        const attempted =
          !assessment.hasParts ||
          !partId ||
          partAttemptMap.get(
            partId
          ) !== false;

        let obtainedMarks = 0;
        let maxMarks = 0;

        if (attempted) {
          for (const question of questions) {
            obtainedMarks +=
              Number(
                marksMap.get(
                  question._id.toString()
                ) || 0
              );

            maxMarks +=
              Number(
                question.maxPoints ||
                  0
              );
          }
        }

        const percentage =
          maxMarks > 0
            ? (obtainedMarks /
                maxMarks) *
              100
            : 0;

        const part =
          assessment.hasParts &&
          partId
            ? structure.parts.find(
                (item) =>
                  item._id.toString() ===
                  partId
              )
            : null;

        sectionScores.push({
          sectionId:
            section._id,

          sectionName:
            section.name,

          partId:
            part?._id || null,

          partName:
            part?.name || null,

          partDisplayOrder:
            part?.displayOrder || 0,

          displayOrder:
            section.displayOrder,

          obtainedMarks,

          maxMarks,

          percentage:
            round2(
              percentage
            ),
        });
      }

      // ========================================================
      // PART SCORES
      // ========================================================

      const partScores =
        [];

      if (assessment.hasParts) {
        for (const part of structure.parts) {
          const attempted =
            partAttemptMap.get(
              part._id.toString()
            ) !== false;

          if (!attempted) {
            // IMPORTANT:
            // maxMarks = 0 means this optional Part
            // is completely excluded from final denominator.
            partScores.push({
              partId:
                part._id,

              partName:
                part.name,

              partCode:
                part.code,

              isOptional:
                Boolean(
                  part.isOptional
                ),

              attempted:
                false,

              obtainedMarks: 0,

              maxMarks: 0,

              percentage: 0,

              displayOrder:
                part.displayOrder,
            });

            continue;
          }

          const partSections =
            sectionScores.filter(
              (section) =>
                section.partId &&
                section.partId.toString() ===
                  part._id.toString()
            );

          const obtainedMarks =
            partSections.reduce(
              (
                sum,
                section
              ) =>
                sum +
                Number(
                  section.obtainedMarks ||
                    0
                ),
              0
            );

          const maxMarks =
            partSections.reduce(
              (
                sum,
                section
              ) =>
                sum +
                Number(
                  section.maxMarks ||
                    0
                ),
              0
            );

          const percentage =
            maxMarks > 0
              ? (obtainedMarks /
                  maxMarks) *
                100
              : 0;

          partScores.push({
            partId:
              part._id,

            partName:
              part.name,

            partCode:
              part.code,

            isOptional:
              Boolean(
                part.isOptional
              ),

            attempted: true,

            obtainedMarks,

            maxMarks,

            percentage:
              round2(
                percentage
              ),

            displayOrder:
              part.displayOrder,
          });
        }
      }

      // ========================================================
      // OVERALL
      //
      // totalMax only contains ATTEMPTED parts.
      // ========================================================

      let totalObtained = 0;
      let totalMax = 0;

      if (assessment.hasParts) {
        for (const part of partScores) {
          if (!part.attempted) {
            continue;
          }

          totalObtained +=
            Number(
              part.obtainedMarks ||
                0
            );

          totalMax +=
            Number(
              part.maxMarks ||
                0
            );
        }
      } else {
        for (const section of sectionScores) {
          totalObtained +=
            Number(
              section.obtainedMarks ||
                0
            );

          totalMax +=
            Number(
              section.maxMarks ||
                0
            );
        }
      }

      const overallPercentage =
        totalMax > 0
          ? (totalObtained /
              totalMax) *
            100
          : 0;

      submission.partScores =
        partScores;

      submission.sectionScores =
        sectionScores;

      submission.totalObtained =
        totalObtained;

      submission.totalMax =
        totalMax;

      submission.overallPercentage =
        round2(
          overallPercentage
        );

      submission.status =
        "COMPLETED";

      submission.submittedAt =
        new Date();

      submission.submittedBy =
        getUserId(req);

      await submission.save();

      return res.json({
        success: true,

        message:
          "Marks saved successfully",

        data: {
          submissionId:
            submission._id,

          student: {
            _id:
              student._id,

            name:
              student.name,

            rollNumber:
              student.rollNumber,
          },

          partScores:
            submission.partScores,

          sectionScores:
            submission.sectionScores,

          totalObtained:
            submission.totalObtained,

          totalMax:
            submission.totalMax,

          overallPercentage:
            submission.overallPercentage,
        },
      });
    } catch (error) {
      console.error(
        "SAVE STUDENT MARKS ERROR:",
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

exports.getAssessmentStructure =
  getAssessmentStructure;