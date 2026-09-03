
const xlsx = require('xlsx');

const Assessment = require('../models/Assessment');
const AssessmentPart = require('../models/AssessmentPart');
const AssessmentSection = require('../models/AssessmentSection');
const AssessmentQuestion = require('../models/AssessmentQuestion');
const AssessmentSubmission = require('../models/AssessmentSubmission');
const AssessmentAnswer = require('../models/AssessmentAnswer');
const Student = require('../models/Student');
const Batch = require('../models/Batch');

const {
  calculateSubmissionScores,
} = require('./submissionController');

// ============================================================
// HELPERS
// ============================================================

const getUserId = (req) =>
  req.user?._id || req.user?.id;

const round2 = (value) =>
  Math.round(Number(value || 0) * 100) / 100;

const safeFileName = (value) =>
  String(value || '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');

const getAssessmentStructure =
  async (assessmentId) => {
    const assessment =
      await Assessment.findById(
        assessmentId
      );

    if (!assessment) {
      throw new Error(
        'Assessment not found'
      );
    }

    const hasParts =
      assessment.hasParts === true;

    const parts = [];
    const sections = [];

    if (hasParts) {
      const dbParts =
        await AssessmentPart.find({
          assessment:
            assessmentId,
          isActive: true,
        }).sort({
          displayOrder: 1,
          createdAt: 1,
        });

      for (const part of dbParts) {
        const partSections =
          await AssessmentSection.find({
            assessment:
              assessmentId,
            part:
              part._id,
            isActive: true,
          }).sort({
            displayOrder: 1,
            createdAt: 1,
          });

        const sectionData = [];

        for (
          const section of
            partSections
        ) {
          const questions =
            await AssessmentQuestion.find({
              assessment:
                assessmentId,
              section:
                section._id,
              part:
                part._id,
              isActive: true,
            }).sort({
              displayOrder: 1,
              createdAt: 1,
            });

          sectionData.push({
            section,
            questions,
          });
        }

        parts.push({
          part,
          sections:
            sectionData,
        });
      }
    } else {
      const dbSections =
        await AssessmentSection.find({
          assessment:
            assessmentId,
          isActive: true,
          $or: [
            { part: null },
            {
              part: {
                $exists: false,
              },
            },
          ],
        }).sort({
          displayOrder: 1,
          createdAt: 1,
        });

      for (
        const section of
          dbSections
      ) {
        const questions =
          await AssessmentQuestion.find({
            assessment:
              assessmentId,
            section:
              section._id,
            isActive: true,
          }).sort({
            displayOrder: 1,
            createdAt: 1,
          });

        sections.push({
          section,
          questions,
        });
      }
    }

    return {
      assessment,
      hasParts,
      parts,
      sections,
    };
  };

// ============================================================
// EXPORT MARKS TEMPLATE
// ============================================================

exports.exportTemplate =
  async (req, res) => {
    try {
      const {
        assessmentId,
      } = req.params;

      const structure =
        await getAssessmentStructure(
          assessmentId
        );

      const {
        assessment,
        hasParts,
        parts,
        sections,
      } = structure;

      const populatedAssessment =
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
            'centre',
            'name'
          )
          .populate(
            'organisation',
            'name'
          );

      const students =
        await Student.find({
          batch:
            assessment.batch,
          isActive: true,
        })
          .sort({
            rollNumber: 1,
          })
          .select(
            'rollNumber name'
          );

      const headers = [
        'Roll Number',
        'Student Name',
      ];

      const questionColumns = [];

      // ========================================================
      // PART MODE
      // ========================================================

      if (hasParts) {
        for (
          const partItem of
            parts
        ) {
          const part =
            partItem.part;

          headers.push(
            `PART: ${part.name}`
          );

          for (
            const sectionItem of
              partItem.sections
          ) {
            const section =
              sectionItem.section;

            for (
              const question of
                sectionItem.questions
            ) {
              const key =
                `P:${part._id} | S:${section._id} | Q:${question._id}`;

              const header =
                `${part.name} - ${section.name} - ${question.questionText} (Max: ${question.maxPoints})`;

              headers.push(
                header
              );

              questionColumns.push({
                key,
                header,
                questionId:
                  question._id,
                sectionId:
                  section._id,
                partId:
                  part._id,
                maxPoints:
                  Number(
                    question.maxPoints ||
                      0
                  ),
                isOptionalPart:
                  part.isOptional ===
                  true,
              });
            }
          }
        }
      } else {
        // ======================================================
        // DIRECT SECTION MODE
        // ======================================================

        for (
          const sectionItem of
            sections
        ) {
          const section =
            sectionItem.section;

          for (
            const question of
              sectionItem.questions
          ) {
            const key =
              `S:${section._id} | Q:${question._id}`;

            const header =
              `${section.name} - ${question.questionText} (Max: ${question.maxPoints})`;

            headers.push(
              header
            );

            questionColumns.push({
              key,
              header,
              questionId:
                question._id,
              sectionId:
                section._id,
              partId:
                null,
              maxPoints:
                Number(
                  question.maxPoints ||
                    0
                ),
              isOptionalPart:
                false,
            });
          }
        }
      }

      headers.push(
        'Total',
        'Percentage',
        'Status'
      );

      const rows =
        students.map(
          (student) => {
            const row = {
              'Roll Number':
                student.rollNumber,
              'Student Name':
                student.name,
            };

            questionColumns.forEach(
              (column) => {
                row[column.header] =
                  '';
              }
            );

            row['Total'] = '';
            row['Percentage'] = '';
            row['Status'] =
              'PENDING';

            return row;
          }
        );

      const ws =
        xlsx.utils.json_to_sheet(
          rows,
          {
            header,
          }
        );

      ws['!cols'] = [
        { wch: 16 },
        { wch: 28 },
        ...questionColumns.map(
          () => ({
            wch: 42,
          })
        ),
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
      ];

      const wb =
        xlsx.utils.book_new();

      xlsx.utils.book_append_sheet(
        wb,
        ws,
        'Marks Entry'
      );

      // ========================================================
      // METADATA
      // ========================================================

      const metaData = [
        [
          'Assessment',
          populatedAssessment.name,
        ],
        [
          'Code',
          populatedAssessment.code ||
            '',
        ],
        [
          'Week',
          populatedAssessment.weekNumber,
        ],
        [
          'Batch',
          populatedAssessment.batch
            ?.name || '',
        ],
        [
          'Course',
          populatedAssessment.course
            ?.name || '',
        ],
        [
          'Centre',
          populatedAssessment.centre
            ?.name || '',
        ],
        [
          'Organisation',
          populatedAssessment.organisation
            ?.name || '',
        ],
        [
          'Has Parts',
          hasParts ? 'YES' : 'NO',
        ],
        [
          'Total Marks',
          populatedAssessment.totalMarks ||
            0,
        ],
        [
          'Instructions',
          hasParts
            ? 'For optional Parts, use the Part selection sheet/column. Skipped optional Parts are excluded completely from Total Max.'
            : 'Enter marks only. Total and Percentage are recalculated by backend.',
        ],
      ];

      const metaWs =
        xlsx.utils.aoa_to_sheet(
          metaData
        );

      metaWs['!cols'] = [
        { wch: 25 },
        { wch: 100 },
      ];

      xlsx.utils.book_append_sheet(
        wb,
        metaWs,
        'Metadata'
      );

      // ========================================================
      // PART SELECTION SHEET
      // ========================================================

      if (hasParts) {
        const partHeaders = [
          'Roll Number',
          'Student Name',
        ];

        const partColumns = [];

        for (
          const partItem of
            parts
        ) {
          const part =
            partItem.part;

          const header =
            `PART SELECT: ${part.name}`;

          partHeaders.push(
            header
          );

          partColumns.push({
            partId:
              part._id,
            header,
            optional:
              part.isOptional ===
              true,
          });
        }

        const partRows =
          students.map(
            (student) => {
              const row = {
                'Roll Number':
                  student.rollNumber,
                'Student Name':
                  student.name,
              };

              partColumns.forEach(
                (column) => {
                  row[column.header] =
                    column.optional
                      ? 'NO'
                      : 'YES';
                }
              );

              return row;
            }
          );

        const partWs =
          xlsx.utils.json_to_sheet(
            partRows,
            {
              header:
                partHeaders,
            }
          );

        partWs['!cols'] = [
          { wch: 16 },
          { wch: 28 },
          ...partColumns.map(
            () => ({
              wch: 25,
            })
          ),
        ];

        xlsx.utils.book_append_sheet(
          wb,
          partWs,
          'Part Selection'
        );
      }

      const buffer =
        xlsx.write(wb, {
          type: 'buffer',
          bookType: 'xlsx',
        });

      const filename =
        `${safeFileName(
          populatedAssessment.organisation?.name
        )}_${safeFileName(
          populatedAssessment.centre?.name
        )}_${safeFileName(
          populatedAssessment.course?.name
        )}_${safeFileName(
          populatedAssessment.batch?.name
        )}_Week${String(
          populatedAssessment.weekNumber
        ).padStart(2, '0')}.xlsx`;

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`
      );

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      return res.send(
        buffer
      );
    } catch (error) {
      console.error(
        'EXPORT TEMPLATE ERROR:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// ============================================================
// EXPORT RESULTS
// ============================================================

exports.exportResults =
  async (req, res) => {
    try {
      const {
        assessmentId,
      } = req.params;

      const structure =
        await getAssessmentStructure(
          assessmentId
        );

      const {
        assessment,
        hasParts,
        parts,
        sections,
      } = structure;

      const populatedAssessment =
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
            'centre',
            'name'
          )
          .populate(
            'organisation',
            'name'
          );

      const students =
        await Student.find({
          batch:
            assessment.batch,
          isActive: true,
        }).sort({
          rollNumber: 1,
        });

      const submissions =
        await AssessmentSubmission.find({
          assessment:
            assessmentId,
        }).populate(
          'student',
          'rollNumber'
        );

      const subMap =
        new Map();

      submissions.forEach(
        (submission) => {
          subMap.set(
            submission.student._id.toString(),
            submission
          );
        }
      );

      const headers = [
        'Roll Number',
        'Student Name',
      ];

      // ========================================================
      // PART RESULT COLUMNS
      // ========================================================

      if (hasParts) {
        for (
          const partItem of
            parts
        ) {
          const part =
            partItem.part;

          headers.push(
            `${part.name} (Attempted)`,
            `${part.name} (Obtained)`,
            `${part.name} (Max)`,
            `${part.name} (%)`
          );
        }
      }

      // ========================================================
      // SECTION RESULT COLUMNS
      // ========================================================

      if (hasParts) {
        for (
          const partItem of
            parts
        ) {
          for (
            const sectionItem of
              partItem.sections
          ) {
            const section =
              sectionItem.section;

            headers.push(
              `${part.name} - ${section.name} (Obtained)`,
              `${part.name} - ${section.name} (Max)`,
              `${part.name} - ${section.name} (%)`
            );
          }
        }
      } else {
        for (
          const sectionItem of
            sections
        ) {
          const section =
            sectionItem.section;

          headers.push(
            `${section.name} (Obtained)`,
            `${section.name} (Max)`,
            `${section.name} (%)`
          );
        }
      }

      headers.push(
        'Total Obtained',
        'Total Max',
        'Overall %',
        'Status'
      );

      // ========================================================
      // BUILD ROWS
      // ========================================================

      const rows =
        students.map(
          (student) => {
            const submission =
              subMap.get(
                student._id.toString()
              );

            const row = {
              'Roll Number':
                student.rollNumber,
              'Student Name':
                student.name,
            };

            const partScores =
              submission?.partScores ||
              [];

            const sectionScores =
              submission?.sectionScores ||
              [];

            // ------------------------------
            // PART SCORES
            // ------------------------------

            if (hasParts) {
              for (
                const partItem of
                  parts
              ) {
                const part =
                  partItem.part;

                const score =
                  partScores.find(
                    (item) =>
                      item.partId?.toString() ===
                      part._id.toString()
                  );

                const attempted =
                  score?.attempted === true;

                const obtained =
                  attempted
                    ? Number(
                        score?.obtainedMarks ||
                          0
                      )
                    : 0;

                const max =
                  attempted
                    ? Number(
                        score?.maxMarks ||
                          0
                      )
                    : 0;

                const percentage =
                  max > 0
                    ? `${round2(
                        (obtained /
                          max) *
                          100
                      )}%`
                    : '0%';

                row[
                  `${part.name} (Attempted)`
                ] =
                  attempted
                    ? 'YES'
                    : 'NO';

                row[
                  `${part.name} (Obtained)`
                ] = obtained;

                row[
                  `${part.name} (Max)`
                ] = max;

                row[
                  `${part.name} (%)`
                ] = percentage;
              }
            }

            // ------------------------------
            // SECTION SCORES
            // ------------------------------

            if (hasParts) {
              for (
                const partItem of
                  parts
              ) {
                const part =
                  partItem.part;

                for (
                  const sectionItem of
                    partItem.sections
                ) {
                  const section =
                    sectionItem.section;

                  const score =
                    sectionScores.find(
                      (item) =>
                        item.sectionId?.toString() ===
                          section._id.toString() &&
                        item.partId?.toString() ===
                          part._id.toString()
                    );

                  const obtained =
                    Number(
                      score?.obtainedMarks ||
                        0
                    );

                  const max =
                    Number(
                      score?.maxMarks ||
                        0
                    );

                  const percentage =
                    max > 0
                      ? `${round2(
                          (obtained /
                            max) *
                            100
                        )}%`
                      : '0%';

                  row[
                    `${part.name} - ${section.name} (Obtained)`
                  ] = obtained;

                  row[
                    `${part.name} - ${section.name} (Max)`
                  ] = max;

                  row[
                    `${part.name} - ${section.name} (%)`
                  ] =
                    percentage;
                }
              }
            } else {
              for (
                const sectionItem of
                  sections
              ) {
                const section =
                  sectionItem.section;

                const score =
                  sectionScores.find(
                    (item) =>
                      item.sectionId?.toString() ===
                      section._id.toString()
                  );

                const obtained =
                  Number(
                    score?.obtainedMarks ||
                      0
                  );

                const max =
                  Number(
                    score?.maxMarks ||
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
                      )
                  );

                const percentage =
                  max > 0
                    ? `${round2(
                        (obtained /
                          max) *
                          100
                      )}%`
                    : '0%';

                row[
                  `${section.name} (Obtained)`
                ] = obtained;

                row[
                  `${section.name} (Max)`
                ] = max;

                row[
                  `${section.name} (%)`
                ] =
                  percentage;
              }
            }

            // IMPORTANT:
            // Use backend-calculated totals.
            // Never calculate final total from Excel columns.

            row[
              'Total Obtained'
            ] =
              Number(
                submission?.totalObtained ||
                  0
              );

            row[
              'Total Max'
            ] =
              Number(
                submission?.totalMax ||
                  0
              );

            row[
              'Overall %'
            ] =
              submission
                ? `${round2(
                    submission.overallPercentage ||
                      0
                  )}%`
                : '0%';

            row[
              'Status'
            ] =
              submission?.status ||
              'PENDING';

            return row;
          }
        );

      const ws =
        xlsx.utils.json_to_sheet(
          rows,
          {
            header,
          }
        );

      const wb =
        xlsx.utils.book_new();

      xlsx.utils.book_append_sheet(
        wb,
        ws,
        'Results'
      );

      const buffer =
        xlsx.write(wb, {
          type: 'buffer',
          bookType: 'xlsx',
        });

      const filename =
        `${safeFileName(
          populatedAssessment.organisation?.name
        )}_${safeFileName(
          populatedAssessment.centre?.name
        )}_${safeFileName(
          populatedAssessment.course?.name
        )}_${safeFileName(
          populatedAssessment.batch?.name
        )}_Week${String(
          populatedAssessment.weekNumber
        ).padStart(2, '0')}_Results.xlsx`;

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`
      );

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      return res.send(
        buffer
      );
    } catch (error) {
      console.error(
        'EXPORT RESULTS ERROR:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// ============================================================
// IMPORT MARKS
// ============================================================

exports.importMarks =
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message:
            'No file uploaded',
        });
      }

      const {
        assessmentId,
      } = req.params;

      const structure =
        await getAssessmentStructure(
          assessmentId
        );

      const {
        assessment,
        hasParts,
        parts,
        sections,
      } = structure;

      if (
        assessment.status !==
        'PUBLISHED'
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Assessment must be published to import marks',
        });
      }

      const workbook =
        xlsx.read(
          req.file.buffer,
          {
            type: 'buffer',
          }
        );

      const firstSheet =
        workbook.Sheets[
          workbook.SheetNames[0]
        ];

      const rows =
        xlsx.utils.sheet_to_json(
          firstSheet,
          {
            defval: '',
          }
        );

      if (!rows.length) {
        return res.status(400).json({
          success: false,
          message:
            'Excel file contains no data',
        });
      }

      // ========================================================
      // QUESTION COLUMN MAP
      // ========================================================

      const questionColumns = [];

      if (hasParts) {
        for (
          const partItem of
            parts
        ) {
          const part =
            partItem.part;

          for (
            const sectionItem of
              partItem.sections
          ) {
            const section =
              sectionItem.section;

            for (
              const question of
                sectionItem.questions
            ) {
              questionColumns.push({
                header:
                  `${part.name} - ${section.name} - ${question.questionText} (Max: ${question.maxPoints})`,
                question,
                section,
                part,
              });
            }
          }
        }
      } else {
        for (
          const sectionItem of
            sections
        ) {
          const section =
            sectionItem.section;

          for (
            const question of
              sectionItem.questions
          ) {
            questionColumns.push({
              header:
                `${section.name} - ${question.questionText} (Max: ${question.maxPoints})`,
              question,
              section,
              part: null,
            });
          }
        }
      }

      // ========================================================
      // STUDENTS
      // ========================================================

      const students =
        await Student.find({
          batch:
            assessment.batch,
          isActive: true,
        });

      const studentMap =
        new Map();

      students.forEach(
        (student) => {
          studentMap.set(
            String(
              student.rollNumber
            ).trim(),
            student
          );
        }
      );

      // ========================================================
      // PART SELECTION SHEET
      // ========================================================

      const partSelectionMap =
        new Map();

      if (hasParts) {
        const partSheet =
          workbook.Sheets[
            'Part Selection'
          ];

        if (partSheet) {
          const partRows =
            xlsx.utils.sheet_to_json(
              partSheet,
              {
                defval: '',
              }
            );

          for (
            const row of
              partRows
          ) {
            const roll =
              String(
                row[
                  'Roll Number'
                ] || ''
              ).trim();

            if (!roll) continue;

            const selections =
              {};

            for (
              const partItem of
                parts
            ) {
              const part =
                partItem.part;

              const header =
                `PART SELECT: ${part.name}`;

              const value =
                String(
                  row[header] ||
                    ''
                )
                  .trim()
                  .toUpperCase();

              if (
                part.isOptional
              ) {
                selections[
                  part._id.toString()
                ] =
                  value ===
                  'YES';
              } else {
                selections[
                  part._id.toString()
                ] = true;
              }
            }

            partSelectionMap.set(
              roll,
              selections
            );
          }
        }
      }

      const results = {
        success: [],
        failed: [],
      };

      // ========================================================
      // IMPORT EACH STUDENT
      // ========================================================

      for (
        let i = 0;
        i < rows.length;
        i++
      ) {
        const row =
          rows[i];

        const rollNumber =
          String(
            row[
              'Roll Number'
            ] || ''
          ).trim();

        if (!rollNumber) {
          results.failed.push({
            row: i + 2,
            reason:
              'Roll Number missing',
          });
          continue;
        }

        const student =
          studentMap.get(
            rollNumber
          );

        if (!student) {
          results.failed.push({
            row: i + 2,
            rollNumber,
            reason:
              'Student not found in batch',
          });
          continue;
        }

        // ------------------------------------------------------
        // PART SELECTION
        // ------------------------------------------------------

        const selections =
          partSelectionMap.get(
            rollNumber
          ) || {};

        if (hasParts) {
          for (
            const partItem of
              parts
          ) {
            const part =
              partItem.part;

            if (
              part.isOptional
            ) {
              if (
                selections[
                  part._id.toString()
                ] === undefined
              ) {
                selections[
                  part._id.toString()
                ] = false;
              }
            } else {
              selections[
                part._id.toString()
              ] = true;
            }
          }
        }

        // ------------------------------------------------------
        // MARKS
        // ------------------------------------------------------

        const marks = [];

        let hasData = false;

        let invalidRow =
          false;

        for (
          const column of
            questionColumns
        ) {
          const {
            header,
            question,
            part,
          } = column;

          const optionalPartSkipped =
            part?.isOptional === true &&
            selections[
              part._id.toString()
            ] === false;

          if (
            optionalPartSkipped
          ) {
            continue;
          }

          const value =
            row[header];

          if (
            value === '' ||
            value === null ||
            value === undefined
          ) {
            results.failed.push({
              row: i + 2,
              rollNumber,
              reason:
                `Marks missing for question: ${question.questionText}`,
            });

            invalidRow =
              true;

            continue;
          }

          const awardedScore =
            Number(value);

          if (
            Number.isNaN(
              awardedScore
            )
          ) {
            results.failed.push({
              row: i + 2,
              rollNumber,
              reason:
                `Invalid marks for question: ${question.questionText}`,
            });

            invalidRow =
              true;

            continue;
          }

          const maxPoints =
            Number(
              question.maxPoints ||
                0
            );

          if (
            awardedScore < 0 ||
            awardedScore > maxPoints
          ) {
            results.failed.push({
              row: i + 2,
              rollNumber,
              reason:
                `Invalid marks for "${question.questionText}". Allowed: 0-${maxPoints}`,
            });

            invalidRow =
              true;

            continue;
          }

          hasData = true;

          marks.push({
            questionId:
              question._id.toString(),
            awardedScore,
          });
        }

        if (invalidRow) {
          continue;
        }

        if (!hasData) {
          results.failed.push({
            row: i + 2,
            rollNumber,
            reason:
              'No marks found for student',
          });

          continue;
        }

        // ------------------------------------------------------
        // FIND / CREATE SUBMISSION
        // ------------------------------------------------------

        let submission =
          await AssessmentSubmission.findOne(
            {
              assessment:
                assessmentId,
              student:
                student._id,
              attemptNumber:
                1,
            }
          );

        if (!submission) {
          submission =
            await AssessmentSubmission.create(
              {
                assessment:
                  assessmentId,
                student:
                  student._id,
                batch:
                  assessment.batch,
                attemptNumber:
                  1,
                status:
                  'PENDING',
                submittedAt:
                  new Date(),
                submittedBy:
                  getUserId(req),
              }
            );
        }

        // ------------------------------------------------------
        // SNAPSHOT
        // ------------------------------------------------------

        const snapshotParts =
          hasParts
            ? parts.map(
                (partItem) => {
                  const part =
                    partItem.part;

                  const totalMarks =
                    partItem.sections.reduce(
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
                    );

                  const totalQuestions =
                    partItem.sections.reduce(
                      (
                        sum,
                        sectionItem
                      ) =>
                        sum +
                        sectionItem.questions.length,
                      0
                    );

                  return {
                    partId:
                      part._id,
                    name:
                      part.name,
                    code:
                      part.code ||
                      '',
                    description:
                      part.description ||
                      '',
                    isOptional:
                      part.isOptional ===
                      true,
                    displayOrder:
                      part.displayOrder,
                    totalMarks,
                    totalQuestions,
                  };
                }
              )
            : [];

        const snapshotSections =
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
              );

        submission.assessmentSnapshot = {
          name:
            assessment.name,
          code:
            assessment.code,
          weekNumber:
            assessment.weekNumber,
          totalMarks:
            snapshotSections.reduce(
              (
                sum,
                section
              ) =>
                sum +
                Number(
                  section.totalMarks ||
                    0
                ),
              0
            ),
          hasParts,
          parts:
            snapshotParts,
          sections:
            snapshotSections,
        };

        submission.submittedAt =
          new Date();

        submission.submittedBy =
          getUserId(req);

        await submission.save();

        // ------------------------------------------------------
        // DELETE OLD ANSWERS
        // ------------------------------------------------------

        await AssessmentAnswer.deleteMany({
          submission:
            submission._id,
        });

        // ------------------------------------------------------
        // CREATE ANSWERS
        // ------------------------------------------------------

        const answerDocuments =
          [];

        for (
          const mark of
            marks
        ) {
          const column =
            questionColumns.find(
              (item) =>
                item.question._id.toString() ===
                mark.questionId.toString()
            );

          if (!column) continue;

          const {
            question,
            section,
            part,
          } = column;

          answerDocuments.push({
            submission:
              submission._id,
            assessment:
              assessmentId,
            student:
              student._id,
            question:
              question._id,
            section:
              section._id,
            part:
              part?._id ||
              null,

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
                part?._id ||
                null,
              partName:
                part?.name ||
                '',
              partDisplayOrder:
                part?.displayOrder ||
                0,
              displayOrder:
                question.displayOrder,
            },

            partSnapshot:
              part
                ? {
                    partId:
                      part._id,
                    name:
                      part.name,
                    code:
                      part.code ||
                      '',
                    isOptional:
                      part.isOptional ===
                      true,
                    displayOrder:
                      part.displayOrder ||
                      0,
                  }
                : undefined,

            answerValue: '',
            awardedScore:
              Number(
                mark.awardedScore ||
                  0
              ),
            gradedBy:
              getUserId(req),
            gradedAt:
              new Date(),
          });
        }

        if (
          answerDocuments.length
        ) {
          await AssessmentAnswer.insertMany(
            answerDocuments
          );
        }

        // IMPORTANT:
        // Final marks are ALWAYS recalculated
        // from stored answers + snapshot.
        await calculateSubmissionScores(
          submission._id
        );

        results.success.push({
          row: i + 2,
          rollNumber,
          name:
            student.name,
        });
      }

      return res.json({
        success: true,
        data: {
          totalRows:
            rows.length,
          imported:
            results.success.length,
          failed:
            results.failed.length,
          details:
            results,
        },
      });
    } catch (error) {
      console.error(
        'IMPORT MARKS ERROR:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// ============================================================
// IMPORT STUDENTS
// ============================================================

exports.importStudents =
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message:
            'No file uploaded',
        });
      }

      const {
        batchId,
      } = req.body;

      const batch =
        await Batch.findById(
          batchId
        )
          .populate(
            'course'
          )
          .populate(
            'centre'
          )
          .populate(
            'organisation'
          );

      if (!batch) {
        return res.status(404).json({
          success: false,
          message:
            'Batch not found',
        });
      }

      const workbook =
        xlsx.read(
          req.file.buffer,
          {
            type: 'buffer',
          }
        );

      const ws =
        workbook.Sheets[
          workbook.SheetNames[0]
        ];

      const rows =
        xlsx.utils.sheet_to_json(
          ws,
          {
            defval: '',
          }
        );

      const requiredHeaders = [
        'Roll Number',
        'Student Name',
      ];

      const headers =
        Object.keys(
          rows[0] || {}
        );

      const missingHeaders =
        requiredHeaders.filter(
          (header) =>
            !headers.includes(
              header
            )
        );

      if (
        missingHeaders.length
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Missing required headers: ${missingHeaders.join(', ')}`,
        });
      }

      const existingStudents =
        await Student.find({
          batch: batchId,
        });

      const existingRolls =
        new Set(
          existingStudents.map(
            (student) =>
              String(
                student.rollNumber
              ).trim()
          )
        );

      const existingNames =
        new Set(
          existingStudents.map(
            (student) =>
              String(
                student.name
              )
                .trim()
                .toLowerCase()
          )
        );

      const results = {
        success: [],
        failed: [],
      };

      for (
        let i = 0;
        i < rows.length;
        i++
      ) {
        const row =
          rows[i];

        const rollNumber =
          String(
            row[
              'Roll Number'
            ] || ''
          ).trim();

        const name =
          String(
            row[
              'Student Name'
            ] || ''
          ).trim();

        if (!rollNumber) {
          results.failed.push({
            row: i + 2,
            reason:
              'Roll Number missing',
          });
          continue;
        }

        if (!name) {
          results.failed.push({
            row: i + 2,
            rollNumber,
            reason:
              'Student Name missing',
          });
          continue;
        }

        if (
          existingRolls.has(
            rollNumber
          )
        ) {
          results.failed.push({
            row: i + 2,
            rollNumber,
            reason:
              'Duplicate Roll Number',
          });
          continue;
        }

        if (
          existingNames.has(
            name.toLowerCase()
          )
        ) {
          results.failed.push({
            row: i + 2,
            rollNumber,
            reason:
              'Duplicate Student Name',
          });
          continue;
        }

        const mobile =
          String(
            row['Mobile'] || ''
          ).trim();

        if (
          mobile &&
          !/^[0-9]{10,15}$/.test(
            mobile.replace(
              /[^0-9]/g,
              ''
            )
          )
        ) {
          results.failed.push({
            row: i + 2,
            rollNumber,
            reason:
              'Invalid mobile number',
          });
          continue;
        }

        await Student.create({
          rollNumber,
          name,
          fatherName:
            String(
              row[
                'Father Name'
              ] || ''
            ).trim(),

          motherName:
            String(
              row[
                'Mother Name'
              ] || ''
            ).trim(),

          mobile:
            mobile || '',

          email:
            String(
              row[
                'Email'
              ] || ''
            ).trim(),

          gender:
            String(
              row[
                'Gender'
              ] || ''
            ).trim(),

          dateOfBirth:
            row['DOB'] ||
            null,

          organisation:
            batch.organisation
              ?._id,

          centre:
            batch.centre?._id,

          course:
            batch.course?._id,

          batch:
            batchId,
        });

        existingRolls.add(
          rollNumber
        );

        existingNames.add(
          name.toLowerCase()
        );

        results.success.push({
          row: i + 2,
          rollNumber,
          name,
        });
      }

      return res.json({
        success: true,
        data: {
          totalRows:
            rows.length,
          imported:
            results.success.length,
          failed:
            results.failed.length,
          details:
            results,
        },
      });
    } catch (error) {
      console.error(
        'IMPORT STUDENTS ERROR:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

// ============================================================
// DOWNLOAD STUDENT TEMPLATE
// ============================================================

exports.downloadStudentTemplate =
  async (req, res) => {
    try {
      const {
        batchId,
      } = req.query;

      if (!batchId) {
        return res.status(400).json({
          success: false,
          message:
            'batchId is required',
        });
      }

      const batch =
        await Batch.findById(
          batchId
        )
          .populate(
            'course',
            'name code'
          )
          .populate(
            'centre',
            'name'
          )
          .populate(
            'organisation',
            'name'
          );

      if (!batch) {
        return res.status(404).json({
          success: false,
          message:
            'Batch not found',
        });
      }

      const headers = [
        'Roll Number',
        'Student Name',
        'Father Name',
        'Mother Name',
        'Mobile',
        'Email',
        'Gender',
        'DOB',
      ];

      const rows = [
        {
          'Roll Number':
            '',
          'Student Name':
            '',
          'Father Name':
            '',
          'Mother Name':
            '',
          'Mobile':
            '',
          'Email':
            '',
          'Gender':
            '',
          'DOB':
            '',
        },
      ];

      const ws =
        xlsx.utils.json_to_sheet(
          rows,
          {
            header,
          }
        );

      ws['!cols'] = [
        { wch: 16 },
        { wch: 28 },
        { wch: 25 },
        { wch: 25 },
        { wch: 16 },
        { wch: 30 },
        { wch: 12 },
        { wch: 16 },
      ];

      const wb =
        xlsx.utils.book_new();

      xlsx.utils.book_append_sheet(
        wb,
        ws,
        'Students'
      );

      const instructions = [
        [
          'Student Import Template',
        ],
        [''],
        [
          'Batch',
          batch.name || '',
        ],
        [
          'Course',
          batch.course?.name ||
            '',
        ],
        [
          'Course Code',
          batch.course?.code ||
            '',
        ],
        [
          'Centre',
          batch.centre?.name ||
            '',
        ],
        [
          'Organisation',
          batch.organisation
            ?.name || '',
        ],
        [''],
        [
          'Instructions',
        ],
        [
          '1. Roll Number is required.',
        ],
        [
          '2. Student Name is required.',
        ],
        [
          '3. Mobile should contain 10 to 15 digits.',
        ],
        [
          '4. Gender should be Male, Female or Other.',
        ],
        [
          '5. DOB should be entered as YYYY-MM-DD.',
        ],
        [
          '6. Do not change the column names.',
        ],
        [
          '7. Do not add Organisation, Centre, Course or Batch columns.',
        ],
        [
          '8. Organisation, Centre, Course and Batch are automatically taken from the selected Batch.',
        ],
      ];

      const instructionWs =
        xlsx.utils.aoa_to_sheet(
          instructions
        );

      instructionWs['!cols'] = [
        { wch: 85 },
        { wch: 30 },
      ];

      xlsx.utils.book_append_sheet(
        wb,
        instructionWs,
        'Instructions'
      );

      const buffer =
        xlsx.write(wb, {
          type: 'buffer',
          bookType: 'xlsx',
        });

      const safeBatchName =
        safeFileName(
          batch.name ||
            'Batch'
        );

      const filename =
        `Student_Import_Template_${safeBatchName}.xlsx`;

      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`
      );

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      return res.send(
        buffer
      );
    } catch (error) {
      console.error(
        'DOWNLOAD STUDENT TEMPLATE ERROR:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };

