const Assessment = require('../models/Assessment');
const AssessmentSection = require('../models/AssessmentSection');
const AssessmentQuestion = require('../models/AssessmentQuestion');
const AssessmentSubmission = require('../models/AssessmentSubmission');
const AssessmentAnswer = require('../models/AssessmentAnswer');
const Student = require('../models/Student');
const { ASSESSMENT_STATUS, QUESTION_TYPES } = require('../config/constants');

// ============================================================
// CALCULATE SCORE FOR SINGLE ANSWER
// ============================================================

const calculateAnswerScore = (question, answerValue) => {
  if (question.questionType === QUESTION_TYPES.YES_NO) {
    return answerValue === 'YES' ? Number(question.maxPoints || 0) : 0;
  }

  // Other question types are manually graded by teacher
  return 0;
};

// ============================================================
// CALCULATE SUBMISSION TOTALS
// ============================================================

const calculateSubmissionScores = async (submissionId) => {
  const submission = await AssessmentSubmission.findById(submissionId);

  if (!submission) {
    throw new Error('Submission not found');
  }

  const answers = await AssessmentAnswer.find({
    submission: submissionId
  });

  const sectionScores = [];

  let totalObtained = 0;
  let totalMax = 0;

  const snapshotSections =
    submission.assessmentSnapshot?.sections || [];

  for (const section of snapshotSections) {
    const sectionAnswers = answers.filter(
      (answer) =>
        answer.questionSnapshot?.sectionName === section.name
    );

    const sectionObtained = sectionAnswers.reduce(
      (sum, answer) =>
        sum + Number(answer.awardedScore || 0),
      0
    );

    const sectionMax = Number(section.totalMarks || 0);

    const sectionPercentage =
      sectionMax > 0
        ? (sectionObtained / sectionMax) * 100
        : 0;

    sectionScores.push({
      sectionId: section.sectionId,
      sectionName: section.name,
      obtainedMarks: sectionObtained,
      maxMarks: sectionMax,
      percentage:
        Math.round(sectionPercentage * 100) / 100
    });

    totalObtained += sectionObtained;
    totalMax += sectionMax;
  }

  const overallPercentage =
    totalMax > 0
      ? (totalObtained / totalMax) * 100
      : 0;

  submission.sectionScores = sectionScores;
  submission.totalObtained = totalObtained;
  submission.totalMax = totalMax;

  submission.overallPercentage =
    Math.round(overallPercentage * 100) / 100;

  submission.status = 'COMPLETED';

  await submission.save();

  return submission;
};

// ============================================================
// STUDENT SUBMISSION
// ============================================================

exports.createSubmission = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { studentId, answers } = req.body;

    const assessment = await Assessment.findById(
      assessmentId
    );

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    if (
      assessment.status !==
      ASSESSMENT_STATUS.PUBLISHED
    ) {
      return res.status(400).json({
        success: false,
        message: 'Assessment is not published'
      });
    }

    if (
      assessment.closeDate &&
      new Date() > new Date(assessment.closeDate)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Assessment is closed'
      });
    }

    const student = await Student.findById(studentId);

    if (
      !student ||
      student.batch.toString() !==
        assessment.batch.toString()
    ) {
      return res.status(400).json({
        success: false,
        message: 'Student does not belong to this batch'
      });
    }

    const existingSubmission =
      await AssessmentSubmission.findOne({
        assessment: assessmentId,
        student: studentId,
        attemptNumber: 1
      });

    if (
      existingSubmission &&
      existingSubmission.status === 'COMPLETED'
    ) {
      return res.status(400).json({
        success: false,
        message:
          'Assessment already submitted for this student'
      });
    }

    const sections =
      await AssessmentSection.find({
        assessment: assessmentId,
        isActive: true
      }).sort('displayOrder');

    const sectionsSnapshot = [];

    for (const section of sections) {
      const questions =
        await AssessmentQuestion.find({
          section: section._id,
          isActive: true
        }).sort('displayOrder');

      const sectionTotal = questions.reduce(
        (sum, question) =>
          sum + Number(question.maxPoints || 0),
        0
      );

      sectionsSnapshot.push({
        sectionId: section._id,
        name: section.name,
        displayOrder: section.displayOrder,
        totalMarks: sectionTotal
      });
    }

    let submission;

    if (existingSubmission) {
      submission = existingSubmission;

      submission.submittedAt = new Date();
      submission.submittedBy = req.user.id;

      submission.assessmentSnapshot = {
        name: assessment.name,
        weekNumber: assessment.weekNumber,
        totalMarks: assessment.totalMarks,
        sections: sectionsSnapshot
      };

      await submission.save();
    } else {
      submission =
        await AssessmentSubmission.create({
          assessment: assessmentId,
          student: studentId,
          batch: assessment.batch,
          attemptNumber: 1,

          assessmentSnapshot: {
            name: assessment.name,
            weekNumber: assessment.weekNumber,
            totalMarks: assessment.totalMarks,
            sections: sectionsSnapshot
          },

          submittedBy: req.user.id
        });
    }

    await AssessmentAnswer.deleteMany({
      submission: submission._id
    });

    const answerDocs = [];

    for (const ans of answers || []) {
      const question =
        await AssessmentQuestion.findById(
          ans.questionId
        );

      if (!question || !question.isActive) {
        continue;
      }

      const section =
        await AssessmentSection.findById(
          question.section
        );

      const score = calculateAnswerScore(
        question,
        ans.answerValue
      );

      answerDocs.push({
        submission: submission._id,
        assessment: assessmentId,
        student: studentId,
        question: question._id,
        section: question.section,

        questionSnapshot: {
          questionText: question.questionText,
          questionType: question.questionType,
          maxPoints: question.maxPoints,
          sectionName: section?.name || '',
          displayOrder: question.displayOrder
        },

        answerValue: ans.answerValue,
        awardedScore: score,

        gradedBy: req.user.id,
        gradedAt: new Date()
      });
    }

    if (answerDocs.length > 0) {
      await AssessmentAnswer.insertMany(
        answerDocs
      );
    }

    await calculateSubmissionScores(
      submission._id
    );

    const populatedSubmission =
      await AssessmentSubmission.findById(
        submission._id
      )
        .populate('student', 'name rollNumber')
        .populate(
          'assessment',
          'name weekNumber code'
        );

    return res.status(201).json({
      success: true,
      data: populatedSubmission
    });

  } catch (error) {
    console.error(
      'CREATE SUBMISSION ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message
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
      limit = 50
    } = req.query;

    const filter = {
      assessment: assessmentId
    };

    if (status) {
      filter.status = status;
    }

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);

    const skip =
      (pageNumber - 1) * limitNumber;

    const [
      submissions,
      total
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
          submittedAt: -1
        })
        .skip(skip)
        .limit(limitNumber),

      AssessmentSubmission.countDocuments(
        filter
      )
    ]);

    return res.json({
      success: true,
      data: submissions,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
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
        message: 'Submission not found'
      });
    }

    const answers =
      await AssessmentAnswer.find({
        submission: submission._id
      })
        .populate(
          'question',
          'questionText questionType maxPoints'
        )
        .sort(
          'questionSnapshot.displayOrder'
        );

    return res.json({
      success: true,
      data: {
        submission,
        answers
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============================================================
// BATCH COMPLETION STATUS
// ============================================================

exports.getBatchCompletionStatus = async (
  req,
  res
) => {
  try {
    const { assessmentId } = req.params;

    const assessment =
      await Assessment.findById(
        assessmentId
      );

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    const totalStudents =
      await Student.countDocuments({
        batch: assessment.batch,
        isActive: true
      });

    const completedSubmissions =
      await AssessmentSubmission.countDocuments({
        assessment: assessmentId,
        status: 'COMPLETED'
      });

    const pending =
      totalStudents - completedSubmissions;

    return res.json({
      success: true,
      data: {
        totalStudents,
        completed: completedSubmissions,
        pending:
          pending > 0 ? pending : 0,
        completionRate:
          totalStudents > 0
            ? Math.round(
                (completedSubmissions /
                  totalStudents) *
                  10000
              ) / 100
            : 0
      }
    });

  } catch (error) {
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
          message: 'Assessment not found'
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
          assessment: assessmentId
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
                  student.rollNumber
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
                        assessment.totalMarks ||
                        0,
                      overallPercentage:
                        submission.overallPercentage ||
                        0,
                      submittedAt:
                        submission.submittedAt ||
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
            _id: assessment._id,
            name: assessment.name,
            code: assessment.code,
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

          students: data
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
// TEACHER MARKS ENTRY
// GET SELECTED STUDENT QUESTIONS
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
          message: 'Assessment not found'
        });
      }

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
          message: 'Student not found'
        });
      }

      const studentBatchId =
        student.batch?._id ||
        student.batch;

      if (
        studentBatchId.toString() !==
        assessment.batch.toString()
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Student does not belong to this assessment batch'
        });
      }

      const sections =
        await AssessmentSection.find({
          assessment: assessmentId,
          isActive: true
        }).sort({
          displayOrder: 1
        });

      const submission =
        await AssessmentSubmission.findOne({
          assessment: assessmentId,
          student: studentId
        });

      const sectionData = [];

      for (const section of sections) {
        const questions =
          await AssessmentQuestion.find({
            section: section._id,
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

        const questionsData =
          questions.map(
            (question) => {
              const answer =
                answerMap.get(
                  question._id.toString()
                );

              return {
                _id: question._id,
                questionText:
                  question.questionText,
                questionType:
                  question.questionType,
                maxPoints:
                  Number(
                    question.maxPoints || 0
                  ),
                displayOrder:
                  question.displayOrder,

                answerId:
                  answer?._id || null,

                awardedScore:
                  answer
                    ? Number(
                        answer.awardedScore ||
                          0
                      )
                    : null,

                answerValue:
                  answer?.answerValue || ''
              };
            }
          );

        const totalMarks =
          questionsData.reduce(
            (sum, question) =>
              sum +
              Number(
                question.maxPoints || 0
              ),
            0
          );

        const obtainedMarks =
          questionsData.reduce(
            (sum, question) =>
              sum +
              Number(
                question.awardedScore || 0
              ),
            0
          );

        sectionData.push({
          _id: section._id,
          name: section.name,
          description:
            section.description || '',
          totalMarks,
          obtainedMarks,
          questions:
            questionsData
        });
      }

      return res.json({
        success: true,
        data: {
          assessment: {
            _id: assessment._id,
            name: assessment.name,
            code: assessment.code,
            weekNumber:
              assessment.weekNumber,
            totalMarks:
              assessment.totalMarks,
            status:
              assessment.status
          },

          student: {
            _id: student._id,
            name: student.name,
            rollNumber:
              student.rollNumber,
            batch: student.batch,
            course: student.course
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
                  0
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
// TEACHER MARKS ENTRY
// SAVE STUDENT MARKS
// ============================================================

exports.saveStudentMarks =
  async (req, res) => {
    try {
      const {
        assessmentId,
        studentId
      } = req.params;

      const { marks } = req.body;

      /*
        marks:

        [
          {
            questionId: "...",
            awardedScore: 8
          }
        ]
      */

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

      // Teacher can enter marks when
      // assessment is published or closed.
      const allowedStatuses = [
        ASSESSMENT_STATUS.PUBLISHED,
        ASSESSMENT_STATUS.CLOSED
      ];

      if (
        !allowedStatuses.includes(
          assessment.status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Assessment must be published before marks can be entered'
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
            'Student not found'
        });
      }

      if (
        student.batch.toString() !==
        assessment.batch.toString()
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Student does not belong to this assessment batch'
        });
      }

      // --------------------------------------------------------
      // GET QUESTIONS
      // --------------------------------------------------------

      const sections =
        await AssessmentSection.find({
          assessment: assessmentId,
          isActive: true
        }).sort({
          displayOrder: 1
        });

      if (!sections.length) {
        return res.status(400).json({
          success: false,
          message:
            'No sections found for this assessment'
        });
      }

      const allQuestions = [];

      const sectionsSnapshot = [];

      for (const section of sections) {
        const questions =
          await AssessmentQuestion.find({
            section: section._id,
            isActive: true
          }).sort({
            displayOrder: 1
          });

        const sectionTotal =
          questions.reduce(
            (sum, question) =>
              sum +
              Number(
                question.maxPoints || 0
              ),
            0
          );

        sectionsSnapshot.push({
          sectionId:
            section._id,
          name: section.name,
          displayOrder:
            section.displayOrder,
          totalMarks:
            sectionTotal
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

      // --------------------------------------------------------
      // VALIDATE QUESTION COUNT
      // --------------------------------------------------------

      if (
        marks.length !==
        allQuestions.length
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Please enter marks for all ${allQuestions.length} questions`
        });
      }

      // --------------------------------------------------------
      // CREATE MARK MAP
      // --------------------------------------------------------

      const marksMap = new Map();

      for (const item of marks) {
        if (!item.questionId) {
          return res.status(400).json({
            success: false,
            message:
              'questionId is required'
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
              'Marks must be a valid number'
          });
        }

        marksMap.set(
          item.questionId.toString(),
          awardedScore
        );
      }

      // --------------------------------------------------------
      // VALIDATE EVERY QUESTION
      // --------------------------------------------------------

      for (const item of allQuestions) {
        const question =
          item.question;

        const questionId =
          question._id.toString();

        if (
          !marksMap.has(
            questionId
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              `Marks missing for question: ${question.questionText}`
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
              `Invalid marks for question "${question.questionText}". Marks must be between 0 and ${maxPoints}.`
          });
        }
      }

      // --------------------------------------------------------
      // FIND OR CREATE SUBMISSION
      // --------------------------------------------------------

      let submission =
        await AssessmentSubmission.findOne({
          assessment: assessmentId,
          student: studentId,
          attemptNumber: 1
        });

      if (!submission) {
        submission =
          await AssessmentSubmission.create({
            assessment: assessmentId,
            student: studentId,
            batch: assessment.batch,
            attemptNumber: 1,

            assessmentSnapshot: {
              name:
                assessment.name,
              code:
                assessment.code,
              weekNumber:
                assessment.weekNumber,
              totalMarks:
                assessment.totalMarks,
              sections:
                sectionsSnapshot
            },

            status:
              'COMPLETED',

            submittedAt:
              new Date(),

            submittedBy:
              req.user?.id
          });
      } else {
        submission.assessmentSnapshot = {
          name:
            assessment.name,
          code:
            assessment.code,
          weekNumber:
            assessment.weekNumber,
          totalMarks:
            assessment.totalMarks,
          sections:
            sectionsSnapshot
        };

        submission.submittedAt =
          new Date();

        submission.submittedBy =
          req.user?.id;

        await submission.save();
      }

      // --------------------------------------------------------
      // DELETE OLD MARKS
      // --------------------------------------------------------

      await AssessmentAnswer.deleteMany({
        submission:
          submission._id
      });

      // --------------------------------------------------------
      // CREATE NEW MARK RECORDS
      // --------------------------------------------------------

      const answerDocuments = [];

      for (const item of allQuestions) {
        const question =
          item.question;

        const section =
          item.section;

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
            question.section,

          questionSnapshot: {
            questionText:
              question.questionText,

            questionType:
              question.questionType,

            maxPoints:
              Number(
                question.maxPoints || 0
              ),

            sectionName:
              section.name,

            displayOrder:
              question.displayOrder
          },

          answerValue: '',

          awardedScore:
            awardedScore,

          gradedBy:
            req.user?.id,

          gradedAt:
            new Date()
        });
      }

      await AssessmentAnswer.insertMany(
        answerDocuments
      );

      // --------------------------------------------------------
      // CALCULATE TOTALS
      // --------------------------------------------------------

      await calculateSubmissionScores(
        submission._id
      );

      // --------------------------------------------------------
      // FINAL RESPONSE
      // --------------------------------------------------------

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

          sectionScores:
            savedSubmission.sectionScores,

          status:
            savedSubmission.status
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

// ============================================================
// EXPORT CALCULATION FUNCTION
// IMPORTANT
// ============================================================

exports.calculateSubmissionScores =
  calculateSubmissionScores;