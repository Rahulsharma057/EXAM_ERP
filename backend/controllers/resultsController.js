
const Assessment = require('../models/Assessment');
const AssessmentSubmission = require('../models/AssessmentSubmission');
const AssessmentAnswer = require('../models/AssessmentAnswer');
const AssessmentSection = require('../models/AssessmentSection');
const AssessmentQuestion = require('../models/AssessmentQuestion');
const Student = require('../models/Student');
const Batch = require('../models/Batch');


// ============================================================
// GET ASSESSMENT RESULTS
// ============================================================

exports.getAssessmentResults = async (req, res) => {
  try {
    const { assessmentId } = req.params;

    const {
      search,
      status,
      sortBy = 'overallPercentage',
      sortOrder = 'desc',
      page = 1,
      limit = 50
    } = req.query;

    const assessment = await Assessment.findById(assessmentId)
      .populate('batch', 'name')
      .populate('course', 'name');

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    const studentFilter = {
      batch: assessment.batch._id || assessment.batch,
      isActive: true
    };

    if (search) {
      studentFilter.$or = [
        {
          name: {
            $regex: search,
            $options: 'i'
          }
        },
        {
          rollNumber: {
            $regex: search,
            $options: 'i'
          }
        }
      ];
    }

    const students = await Student.find(studentFilter)
      .sort({ rollNumber: 1 });

    const submissions = await AssessmentSubmission.find({
      assessment: assessmentId
    }).populate('student', 'name rollNumber');

    const submissionMap = {};

    submissions.forEach((sub) => {
      if (sub.student) {
        submissionMap[sub.student._id.toString()] = sub;
      }
    });

    const results = students.map((student) => {
      const sub = submissionMap[student._id.toString()];

      return {
        student: {
          _id: student._id,
          name: student.name,
          rollNumber: student.rollNumber
        },

        status: sub ? sub.status : 'PENDING',

        sectionScores: sub
          ? sub.sectionScores
          : [],

        totalObtained: sub
          ? sub.totalObtained
          : 0,

        totalMax: sub
          ? sub.totalMax
          : assessment.totalMarks,

        overallPercentage: sub
          ? sub.overallPercentage
          : 0,

        submittedAt: sub
          ? sub.submittedAt
          : null
      };
    });

    let filtered = results;

    if (status) {
      filtered = filtered.filter(
        (result) => result.status === status
      );
    }

    filtered.sort((a, b) => {
      let aVal = a[sortBy] || 0;
      let bVal = b[sortBy] || 0;

      if (sortOrder === 'asc') {
        return aVal - bVal;
      }

      return bVal - aVal;
    });

    const pageNumber = parseInt(page);
    const pageLimit = parseInt(limit);

    const total = filtered.length;

    const skip =
      (pageNumber - 1) * pageLimit;

    const paginated =
      filtered.slice(
        skip,
        skip + pageLimit
      );

    const completed =
      results.filter(
        (result) =>
          result.status === 'COMPLETED'
      );

    const avgScore =
      completed.length > 0
        ? completed.reduce(
            (sum, result) =>
              sum + Number(
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
          totalMarks: assessment.totalMarks,
          batch: assessment.batch,
          course: assessment.course
        },

        stats: {
          totalStudents: results.length,
          completed: completed.length,
          pending:
            results.length -
            completed.length,

          averageScore:
            Math.round(
              avgScore * 100
            ) / 100,

          highestScore:
            Math.round(
              highest * 100
            ) / 100,

          lowestScore:
            Math.round(
              lowest * 100
            ) / 100
        },

        results: paginated,

        pagination: {
          page: pageNumber,
          limit: pageLimit,
          total
        }
      }
    });

  } catch (error) {
    console.error(
      'GET ASSESSMENT RESULTS ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// ============================================================
// GET STUDENT RESULTS
// ============================================================

exports.getStudentResults = async (req, res) => {
  try {
    const { studentId } = req.params;

    const student =
      await Student.findById(studentId)
        .populate('organisation', 'name')
        .populate('centre', 'name')
        .populate('course', 'name')
        .populate('batch', 'name');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    const submissions =
      await AssessmentSubmission.find({
        student: studentId,
        status: 'COMPLETED'
      })
        .populate(
          'assessment',
          'name weekNumber code totalMarks'
        )
        .sort({
          'assessment.weekNumber': 1
        });

    const weeklyPerformance =
      submissions
        .filter((sub) => sub.assessment)
        .map((sub) => ({
          weekNumber:
            sub.assessment.weekNumber,

          assessmentName:
            sub.assessment.name,

          assessmentId:
            sub.assessment._id,

          totalObtained:
            sub.totalObtained,

          totalMax:
            sub.totalMax,

          percentage:
            sub.overallPercentage,

          sectionScores:
            sub.sectionScores,

          submittedAt:
            sub.submittedAt
        }));

    return res.json({
      success: true,

      data: {
        student: {
          _id: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          organisation: student.organisation,
          centre: student.centre,
          course: student.course,
          batch: student.batch
        },

        weeklyPerformance
      }
    });

  } catch (error) {
    console.error(
      'GET STUDENT RESULTS ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// ============================================================
// GET BATCH RESULTS
// ============================================================

exports.getBatchResults = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { weekNumber } = req.query;

    const batch =
      await Batch.findById(batchId)
        .populate('course', 'name')
        .populate('centre', 'name')
        .populate('organisation', 'name');

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    const assessmentFilter = {
      batch: batchId,
      status: {
        $in: [
          'PUBLISHED',
          'CLOSED',
          'ARCHIVED'
        ]
      }
    };

    if (weekNumber) {
      assessmentFilter.weekNumber =
        parseInt(weekNumber);
    }

    const assessments =
      await Assessment.find(
        assessmentFilter
      ).sort({
        weekNumber: 1
      });

    const totalStudents =
      await Student.countDocuments({
        batch: batchId,
        isActive: true
      });

    const results =
      await Promise.all(
        assessments.map(
          async (assessment) => {
            const submissions =
              await AssessmentSubmission.find({
                assessment:
                  assessment._id,

                status: 'COMPLETED'
              });

            const avgPercentage =
              submissions.length > 0
                ? submissions.reduce(
                    (sum, submission) =>
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
                _id: assessment._id,
                name: assessment.name,
                weekNumber:
                  assessment.weekNumber,
                totalMarks:
                  assessment.totalMarks
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
                Math.round(
                  avgPercentage * 100
                ) / 100
            };
          }
        )
      );

    return res.json({
      success: true,
      data: {
        batch,
        results
      }
    });

  } catch (error) {
    console.error(
      'GET BATCH RESULTS ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// ============================================================
// GET STUDENT WISE SECTION RESULTS
// ============================================================

// ============================================================
// GET STUDENT WISE SECTION RESULTS
// ============================================================

exports.getStudentWiseSectionResults = async (req, res) => {
  try {
    const { assessmentId, studentId } = req.params;

    // ----------------------------------------------------------
    // FIND ASSESSMENT
    // ----------------------------------------------------------

    const assessment = await Assessment.findById(assessmentId)
      .populate('batch', 'name')
      .populate('course', 'name');

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    // ----------------------------------------------------------
    // FIND STUDENT
    // ----------------------------------------------------------

    const student = await Student.findOne({
      _id: studentId,
      batch: assessment.batch?._id || assessment.batch,
      isActive: true
    }).select('name rollNumber fatherName');

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student does not belong to this assessment batch'
      });
    }

    // ----------------------------------------------------------
    // FIND SUBMISSION
    // ----------------------------------------------------------

    const submission = await AssessmentSubmission.findOne({
      assessment: assessmentId,
      student: studentId
    }).populate(
      'student',
      'name rollNumber'
    );

    // ----------------------------------------------------------
    // NO SUBMISSION
    // ----------------------------------------------------------

    // IMPORTANT:
    // Student ne abhi marks submit nahi kiye hain.
    // Isko error nahi banana hai.
    if (!submission) {
      return res.json({
        success: true,

        data: {
          student: {
            _id: student._id,
            name: student.name,
            rollNumber: student.rollNumber
          },

          assessment: {
            _id: assessment._id,
            name: assessment.name,
            code: assessment.code,
            weekNumber: assessment.weekNumber,
            totalMarks: assessment.totalMarks || 0,
            batch: assessment.batch,
            course: assessment.course
          },

          status: 'PENDING',

          sections: [],

          totalObtained: 0,

          totalMax: assessment.totalMarks || 0,

          overallPercentage: 0
        }
      });
    }

    // ----------------------------------------------------------
    // FIND ANSWERS
    // ----------------------------------------------------------

    const answers = await AssessmentAnswer.find({
      submission: submission._id
    }).sort('questionSnapshot.displayOrder');

    // ----------------------------------------------------------
    // BUILD SECTION-WISE RESULT
    // ----------------------------------------------------------

    const sectionWise = {};

    answers.forEach((answer) => {
      const sectionName =
        answer.questionSnapshot?.sectionName || 'General';

      if (!sectionWise[sectionName]) {
        sectionWise[sectionName] = {
          sectionName,
          questions: [],
          obtained: 0,
          max: 0
        };
      }

      const maxPoints = Number(
        answer.questionSnapshot?.maxPoints || 0
      );

      const awardedScore = Number(
        answer.awardedScore || 0
      );

      sectionWise[sectionName].questions.push({
        questionText:
          answer.questionSnapshot?.questionText || '',

        questionType:
          answer.questionSnapshot?.questionType || '',

        maxPoints,

        answerValue:
          answer.answerValue || '',

        awardedScore
      });

      sectionWise[sectionName].obtained += awardedScore;

      sectionWise[sectionName].max += maxPoints;
    });

    // ----------------------------------------------------------
    // FORMAT SECTIONS
    // ----------------------------------------------------------

    const sections = Object.values(sectionWise).map(
      (section) => ({
        ...section,

        percentage:
          section.max > 0
            ? Math.round(
                (section.obtained / section.max) * 10000
              ) / 100
            : 0
      })
    );

    // ----------------------------------------------------------
    // RESPONSE
    // ----------------------------------------------------------

    return res.json({
      success: true,

      data: {
        student: submission.student,

        assessment: {
          _id: assessment._id,
          name: assessment.name,
          code: assessment.code,
          weekNumber: assessment.weekNumber,
          totalMarks: assessment.totalMarks || 0,
          batch: assessment.batch,
          course: assessment.course
        },

        status: submission.status || 'COMPLETED',

        sections,

        totalObtained:
          Number(submission.totalObtained || 0),

        totalMax:
          Number(
            submission.totalMax ||
            assessment.totalMarks ||
            0
          ),

        overallPercentage:
          Number(
            submission.overallPercentage || 0
          ),

        submittedAt:
          submission.submittedAt || null
      }
    });

  } catch (error) {
    console.error(
      'GET STUDENT SECTION RESULTS ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// ============================================================
// TEACHER MARKS ENTRY
// GET STUDENTS OF ASSESSMENT BATCH
// ============================================================

exports.getAssessmentStudentsForMarks =
  async (req, res) => {
    try {
      const { assessmentId } =
        req.params;

      const { search } =
        req.query;

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
            'Assessment not found'
        });
      }

      const batchId =
        assessment.batch?._id ||
        assessment.batch;

      const studentFilter = {
        batch: batchId,
        isActive: true
      };

      if (search) {
        studentFilter.$or = [
          {
            name: {
              $regex: search,
              $options: 'i'
            }
          },
          {
            rollNumber: {
              $regex: search,
              $options: 'i'
            }
          }
        ];
      }

      const students =
        await Student.find(
          studentFilter
        ).sort({
          rollNumber: 1
        });

      const submissions =
        await AssessmentSubmission.find({
          assessment:
            assessmentId
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
                student.fatherName || '',

              submission:
                submission
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

                      submittedAt:
                        submission.submittedAt ||
                        null,

                      updatedAt:
                        submission.updatedAt ||
                        null
                    }
                  : null
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

            status:
              assessment.status,

            batch:
              assessment.batch,

            course:
              assessment.course,

            organisation:
              assessment.organisation,

            centre:
              assessment.centre
          },

          students:
            studentData
        }
      });

    } catch (error) {
      console.error(
        'GET ASSESSMENT STUDENTS FOR MARKS ERROR:',
        error
      );

      return res.status(500).json({
        success: false,
        message: error.message
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
        studentId
      } = req.params;

      const assessment =
        await Assessment.findById(
          assessmentId
        );

      if (!assessment) {
        return res.status(404).json({
          success: false,
          message:
            'Assessment not found'
        });
      }

      const student =
        await Student.findOne({
          _id: studentId,
          batch: assessment.batch,
          isActive: true
        })
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
          message:
            'Student does not belong to this assessment batch'
        });
      }

      const sections =
        await AssessmentSection.find({
          assessment:
            assessmentId,
          isActive: true
        }).sort({
          displayOrder: 1
        });

      const submission =
        await AssessmentSubmission.findOne({
          assessment:
            assessmentId,
          student:
            studentId
        });

      const sectionData = [];

      let calculatedTotalMax = 0;

      for (const section of sections) {
        const questions =
          await AssessmentQuestion.find({
            section:
              section._id,
            isActive: true
          }).sort({
            displayOrder: 1
          });

        const questionIds =
          questions.map(
            (question) =>
              question._id
          );

        const answers =
          submission
            ? await AssessmentAnswer.find({
                submission:
                  submission._id,

                question: {
                  $in: questionIds
                }
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

        calculatedTotalMax +=
          sectionTotal;

        sectionData.push({
          _id:
            section._id,

          name:
            section.name,

          description:
            section.description ||
            '',

          displayOrder:
            section.displayOrder,

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

                  displayOrder:
                    question.displayOrder,

                  awardedScore:
                    answer
                      ? Number(
                          answer.awardedScore ||
                            0
                        )
                      : null
                };
              }
            )
        });
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
              assessment.totalMarks ||
              calculatedTotalMax,

            status:
              assessment.status
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
              '',

            batch:
              student.batch,

            course:
              student.course
          },

          submission:
            submission
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
                    calculatedTotalMax,

                  overallPercentage:
                    submission.overallPercentage ||
                    0,

                  submittedAt:
                    submission.submittedAt ||
                    null
                }
              : null,

          sections:
            sectionData
        }
      });

    } catch (error) {
      console.error(
        'GET STUDENT MARKS ENTRY ERROR:',
        error
      );

      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };


// ============================================================
// SAVE STUDENT MARKS
// ============================================================

exports.saveStudentMarks =
  async (req, res) => {
    try {
      const {
        assessmentId,
        studentId
      } = req.params;

      const {
        marks = []
      } = req.body;

      if (!Array.isArray(marks)) {
        return res.status(400).json({
          success: false,
          message:
            'Marks must be an array'
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
            'Assessment not found'
        });
      }

      const student =
        await Student.findOne({
          _id: studentId,
          batch: assessment.batch,
          isActive: true
        });

      if (!student) {
        return res.status(400).json({
          success: false,
          message:
            'Student does not belong to this assessment batch'
        });
      }

      const sections =
        await AssessmentSection.find({
          assessment:
            assessmentId,
          isActive: true
        }).sort({
          displayOrder: 1
        });

      if (!sections.length) {
        return res.status(400).json({
          success: false,
          message:
            'Assessment has no sections'
        });
      }

      // --------------------------------------------------------
      // LOAD ALL QUESTIONS
      // --------------------------------------------------------

      const allQuestions = [];

      for (const section of sections) {
        const questions =
          await AssessmentQuestion.find({
            section:
              section._id,
            isActive: true
          }).sort({
            displayOrder: 1
          });

        questions.forEach(
          (question) => {
            allQuestions.push({
              question,
              section
            });
          }
        );
      }

      if (!allQuestions.length) {
        return res.status(400).json({
          success: false,
          message:
            'Assessment has no questions'
        });
      }

      // --------------------------------------------------------
      // MARKS MAP
      // --------------------------------------------------------

      const marksMap =
        new Map();

      for (const item of marks) {
        if (
          !item.questionId
        ) {
          return res.status(400).json({
            success: false,
            message:
              'questionId is required'
          });
        }

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
              'Marks must be valid numbers'
          });
        }

        marksMap.set(
          String(
            item.questionId
          ),
          score
        );
      }

      // --------------------------------------------------------
      // VALIDATE EVERY QUESTION
      // --------------------------------------------------------

      for (const item of allQuestions) {
        const question =
          item.question;

        const key =
          question._id.toString();

        if (!marksMap.has(key)) {
          return res.status(400).json({
            success: false,
            message:
              `Marks missing for question: ${question.questionText}`
          });
        }

        const score =
          marksMap.get(key);

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
              `Marks for "${question.questionText}" must be between 0 and ${maxPoints}`
          });
        }
      }

      // --------------------------------------------------------
      // FIND / CREATE SUBMISSION
      // --------------------------------------------------------

      let submission =
        await AssessmentSubmission.findOne({
          assessment:
            assessmentId,
          student:
            studentId,
          attemptNumber: 1
        });

      const sectionsSnapshot =
        sections.map(
          (section) => {
            const sectionQuestions =
              allQuestions.filter(
                (item) =>
                  item.section._id.toString() ===
                  section._id.toString()
              );

            const sectionTotal =
              sectionQuestions.reduce(
                (sum, item) =>
                  sum +
                  Number(
                    item.question.maxPoints ||
                      0
                  ),
                0
              );

            return {
              sectionId:
                section._id,

              name:
                section.name,

              displayOrder:
                section.displayOrder,

              totalMarks:
                sectionTotal
            };
          }
        );

      const assessmentSnapshot = {
        name:
          assessment.name,

        code:
          assessment.code,

        weekNumber:
          assessment.weekNumber,

        sections:
          sectionsSnapshot
      };

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
              'COMPLETED',

            submittedAt:
              new Date(),

            submittedBy:
              req.user?.id
          });
      } else {
        submission.assessmentSnapshot =
          assessmentSnapshot;

        submission.status =
          'COMPLETED';

        submission.submittedAt =
          new Date();

        submission.submittedBy =
          req.user?.id;
      }

      await submission.save();

      // --------------------------------------------------------
      // DELETE OLD ANSWERS
      // --------------------------------------------------------

      await AssessmentAnswer.deleteMany({
        submission:
          submission._id
      });

      // --------------------------------------------------------
      // CREATE ANSWERS WITH MARKS
      // --------------------------------------------------------

      const answerDocuments =
        allQuestions.map(
          ({
            question,
            section
          }) => {
            const awardedScore =
              marksMap.get(
                question._id.toString()
              );

            return {
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

                sectionName:
                  section.name,

                displayOrder:
                  question.displayOrder
              },

              answerValue:
                '',

              awardedScore,

              gradedBy:
                req.user?.id,

              gradedAt:
                new Date()
            };
          }
        );

      await AssessmentAnswer.insertMany(
        answerDocuments
      );

      // --------------------------------------------------------
      // CALCULATE SECTION + TOTAL
      // --------------------------------------------------------

      const sectionScores =
        [];

      let totalObtained = 0;
      let totalMax = 0;

      for (const section of sections) {
        const sectionQuestions =
          allQuestions.filter(
            (item) =>
              item.section._id.toString() ===
              section._id.toString()
          );

        const sectionObtained =
          sectionQuestions.reduce(
            (sum, item) =>
              sum +
              Number(
                marksMap.get(
                  item.question._id.toString()
                ) || 0
              ),
            0
          );

        const sectionMax =
          sectionQuestions.reduce(
            (sum, item) =>
              sum +
              Number(
                item.question.maxPoints ||
                  0
              ),
            0
          );

        const percentage =
          sectionMax > 0
            ? (
                sectionObtained /
                sectionMax
              ) *
              100
            : 0;

        sectionScores.push({
          sectionId:
            section._id,

          sectionName:
            section.name,

          obtainedMarks:
            sectionObtained,

          maxMarks:
            sectionMax,

          percentage:
            Math.round(
              percentage * 100
            ) / 100
        });

        totalObtained +=
          sectionObtained;

        totalMax +=
          sectionMax;
      }

      const overallPercentage =
        totalMax > 0
          ? (
              totalObtained /
              totalMax
            ) *
            100
          : 0;

      submission.sectionScores =
        sectionScores;

      submission.totalObtained =
        totalObtained;

      submission.totalMax =
        totalMax;

      submission.overallPercentage =
        Math.round(
          overallPercentage * 100
        ) / 100;

      submission.status =
        'COMPLETED';

      submission.submittedAt =
        new Date();

      submission.submittedBy =
        req.user?.id;

      await submission.save();

      return res.json({
        success: true,

        message:
          'Marks saved successfully',

        data: {
          submissionId:
            submission._id,

          student: {
            _id:
              student._id,

            name:
              student.name,

            rollNumber:
              student.rollNumber
          },

          totalObtained:
            submission.totalObtained,

          totalMax:
            submission.totalMax,

          overallPercentage:
            submission.overallPercentage,

          sectionScores:
            submission.sectionScores
        }
      });

    } catch (error) {
      console.error(
        'SAVE STUDENT MARKS ERROR:',
        error
      );

      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  };

