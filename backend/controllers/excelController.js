const xlsx = require("xlsx");

const Assessment = require("../models/Assessment");
const AssessmentPart = require("../models/AssessmentPart");
const AssessmentSection = require("../models/AssessmentSection");
const AssessmentQuestion = require("../models/AssessmentQuestion");
const AssessmentSubmission = require("../models/AssessmentSubmission");
const AssessmentAnswer = require("../models/AssessmentAnswer");
const Student = require("../models/Student");
const Batch = require("../models/Batch");

const {
  calculateSubmissionScores,
} = require("./submissionController");

// ============================================================
// HELPERS
// ============================================================

const getUserId = (req) =>
  req.user?._id || req.user?.id;

const round2 = (value) =>
  Math.round(Number(value || 0) * 100) / 100;

const safeFileName = (value) =>
  String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "_");

// ============================================================
// ID HELPERS
// ============================================================

const getId = (value) => {
  if (!value) return null;

  if (typeof value === "object") {
    return value._id || value.id || null;
  }

  return value;
};

const sameId = (a, b) => {
  const first = getId(a);
  const second = getId(b);

  if (!first || !second) return false;

  return String(first) === String(second);
};
// ============================================================
// GET ASSESSMENT STRUCTURE
// ============================================================

const getAssessmentStructure = async (assessmentId) => {
  const assessment = await Assessment.findById(
    assessmentId
  );

  if (!assessment) {
    throw new Error("Assessment not found");
  }

  const hasParts = assessment.hasParts === true;

  const parts = [];
  const sections = [];

  // ==========================================================
  // PART MODE
  // ==========================================================

  if (hasParts) {
    const dbParts = await AssessmentPart.find({
      assessment: assessmentId,
      isActive: true,
    }).sort({
      displayOrder: 1,
      createdAt: 1,
    });

    for (const part of dbParts) {
      const partSections =
        await AssessmentSection.find({
          assessment: assessmentId,
          part: part._id,
          isActive: true,
        }).sort({
          displayOrder: 1,
          createdAt: 1,
        });

      const sectionData = [];

      for (const section of partSections) {
        const questions =
          await AssessmentQuestion.find({
            assessment: assessmentId,
            section: section._id,
            part: part._id,
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
        sections: sectionData,
      });
    }
  }

  // ==========================================================
  // DIRECT SECTION MODE
  // ==========================================================

  else {
    const dbSections =
      await AssessmentSection.find({
        assessment: assessmentId,
        isActive: true,
        $or: [
          {
            part: null,
          },
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

    for (const section of dbSections) {
      const questions =
        await AssessmentQuestion.find({
          assessment: assessmentId,
          section: section._id,
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

exports.exportTemplate = async (req, res) => {
  try {
    const { assessmentId } = req.params;

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

    // ========================================================
    // POPULATED ASSESSMENT
    // ========================================================

    const populatedAssessment =
      await Assessment.findById(
        assessmentId
      )
        .populate("batch", "name")
        .populate("course", "name")
        .populate("centre", "name")
        .populate("organisation", "name");

    // ========================================================
    // STUDENTS
    // ========================================================

    const students =
      await Student.find({
        batch: assessment.batch,
        isActive: true,
      })
        .sort({
          rollNumber: 1,
        })
        .select(
          "rollNumber name"
        );

    // ========================================================
    // HEADERS
    // ========================================================

    const headers = [
      "Roll Number",
      "Student Name",
    ];

    const questionColumns = [];

    // ========================================================
    // PART MODE
    // ========================================================

    if (hasParts) {
      for (const partItem of parts) {
        const part = partItem.part;

        headers.push(
          `PART: ${part.name}`
        );

        for (const sectionItem of partItem.sections) {
          const section =
            sectionItem.section;

          for (const question of sectionItem.questions) {
            const key =
              `P:${part._id} | S:${section._id} | Q:${question._id}`;

            const header =
              `${part.name} - ${section.name} - ${question.questionText} (Max: ${question.maxPoints})`;

            headers.push(header);

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
                  question.maxPoints || 0
                ),
              isOptionalPart:
                part.isOptional === true,
            });
          }
        }
      }
    }

    // ========================================================
    // DIRECT SECTION MODE
    // ========================================================

    else {
      for (const sectionItem of sections) {
        const section =
          sectionItem.section;

        for (const question of sectionItem.questions) {
          const key =
            `S:${section._id} | Q:${question._id}`;

          const header =
            `${section.name} - ${question.questionText} (Max: ${question.maxPoints})`;

          headers.push(header);

          questionColumns.push({
            key,
            header,
            questionId:
              question._id,
            sectionId:
              section._id,
            partId: null,
            maxPoints:
              Number(
                question.maxPoints || 0
              ),
            isOptionalPart: false,
          });
        }
      }
    }

    // ========================================================
    // FINAL COLUMNS
    // ========================================================

    headers.push(
      "Total",
      "Percentage",
      "Status"
    );

    // ========================================================
    // ROWS
    // ========================================================

    const rows = students.map(
      (student) => {
        const row = {
          "Roll Number":
            student.rollNumber,
          "Student Name":
            student.name,
        };

        questionColumns.forEach(
          (column) => {
            row[column.header] = "";
          }
        );

        row["Total"] = "";
        row["Percentage"] = "";
        row["Status"] = "PENDING";

        return row;
      }
    );

    // ========================================================
    // WORKSHEET
    // IMPORTANT: header: headers
    // ========================================================

    const ws =
      xlsx.utils.json_to_sheet(
        rows,
        {
          header: headers,
        }
      );

    ws["!cols"] = [
      {
        wch: 16,
      },
      {
        wch: 28,
      },
      ...questionColumns.map(
        () => ({
          wch: 42,
        })
      ),
      {
        wch: 14,
      },
      {
        wch: 14,
      },
      {
        wch: 14,
      },
    ];

    const wb =
      xlsx.utils.book_new();

    xlsx.utils.book_append_sheet(
      wb,
      ws,
      "Marks Entry"
    );

    // ========================================================
    // METADATA
    // ========================================================

    const metaData = [
      [
        "Assessment",
        populatedAssessment.name,
      ],
      [
        "Code",
        populatedAssessment.code || "",
      ],
      [
        "Week",
        populatedAssessment.weekNumber,
      ],
      [
        "Batch",
        populatedAssessment.batch?.name ||
          "",
      ],
      [
        "Course",
        populatedAssessment.course?.name ||
          "",
      ],
      [
        "Centre",
        populatedAssessment.centre?.name ||
          "",
      ],
      [
        "Organisation",
        populatedAssessment.organisation?.name ||
          "",
      ],
      [
        "Has Parts",
        hasParts ? "YES" : "NO",
      ],
      [
        "Total Marks",
        populatedAssessment.totalMarks ||
          0,
      ],
      [
        "Instructions",
        hasParts
          ? "For optional Parts, use the Part Selection sheet. Skipped optional Parts are completely excluded from Total Max and Percentage."
          : "Enter marks only. Total and Percentage are recalculated by backend.",
      ],
    ];

    const metaWs =
      xlsx.utils.aoa_to_sheet(
        metaData
      );

    metaWs["!cols"] = [
      {
        wch: 25,
      },
      {
        wch: 100,
      },
    ];

    xlsx.utils.book_append_sheet(
      wb,
      metaWs,
      "Metadata"
    );

    // ========================================================
    // PART SELECTION
    // ========================================================

    if (hasParts) {
      const partHeaders = [
        "Roll Number",
        "Student Name",
      ];

      const partColumns = [];

      for (const partItem of parts) {
        const part =
          partItem.part;

        const header =
          `PART SELECT: ${part.name}`;

        partHeaders.push(header);

        partColumns.push({
          partId: part._id,
          header,
          optional:
            part.isOptional === true,
        });
      }

      const partRows =
        students.map(
          (student) => {
            const row = {
              "Roll Number":
                student.rollNumber,
              "Student Name":
                student.name,
            };

            partColumns.forEach(
              (column) => {
                row[column.header] =
                  column.optional
                    ? "NO"
                    : "YES";
              }
            );

            return row;
          }
        );

      const partWs =
        xlsx.utils.json_to_sheet(
          partRows,
          {
            header: partHeaders,
          }
        );

      partWs["!cols"] = [
        {
          wch: 16,
        },
        {
          wch: 28,
        },
        ...partColumns.map(
          () => ({
            wch: 25,
          })
        ),
      ];

      xlsx.utils.book_append_sheet(
        wb,
        partWs,
        "Part Selection"
      );
    }

    // ========================================================
    // WRITE FILE
    // ========================================================

    const buffer =
      xlsx.write(wb, {
        type: "buffer",
        bookType: "xlsx",
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
      ).padStart(2, "0")}.xlsx`;

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    return res.send(buffer);
  } catch (error) {
    console.error(
      "EXPORT TEMPLATE ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================================
// EXPORT RESULTS
// ============================================================
// ============================================================
// EXPORT RESULTS
// ============================================================
exports.exportResults = async (req, res) => {
  try {
    const { assessmentId } = req.params;

    // ========================================================
    // PARSE OPTIONS
    // ========================================================

    let options = {};

    if (req.query.options) {
      try {
        options = JSON.parse(req.query.options);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Invalid export options",
        });
      }
    }

    // ========================================================
    // ASSESSMENT STRUCTURE
    // ========================================================

    const structure =
      await getAssessmentStructure(assessmentId);

    if (!structure) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    const {
      assessment,
      hasParts,
      parts,
      sections,
    } = structure;

    // ========================================================
    // IMPORTANT:
    // Part mode me sections nested hain:
    // parts[].sections[]
    //
    // Excel export ke liye flat sections chahiye.
    // ========================================================

    const exportSections = hasParts
      ? parts.flatMap((partItem) =>
          (partItem.sections || []).map(
            (sectionItem) => ({
              ...sectionItem,
              part: partItem.part,
            })
          )
        )
      : sections;

    // ========================================================
    // POPULATE ASSESSMENT
    // ========================================================

    const populatedAssessment =
      await Assessment.findById(assessmentId)
        .populate("batch", "name code")
        .populate("course", "name code")
        .populate("centre", "name")
        .populate("organisation", "name")
        .lean();

    if (!populatedAssessment) {
      return res.status(404).json({
        success: false,
        message: "Assessment not found",
      });
    }

    // ========================================================
    // STUDENTS
    // ========================================================

    const students =
      await Student.find({
        batch:
          populatedAssessment.batch?._id ||
          populatedAssessment.batch,

        isActive: {
          $ne: false,
        },
      })
        .sort({
          rollNumber: 1,
          name: 1,
        })
        .lean();

    // ========================================================
    // SUBMISSIONS
    // ========================================================

    const submissions =
      await AssessmentSubmission.find({
        assessment: assessmentId,
      })
        .sort({
          attemptNumber: -1,
        })
        .lean();

    // ========================================================
    // LATEST SUBMISSION
    // ========================================================

    const submissionMap = new Map();

    submissions.forEach((submission) => {
      const studentId =
        getId(submission.student);

      if (!studentId) return;

      const key = String(studentId);

      if (!submissionMap.has(key)) {
        submissionMap.set(
          key,
          submission
        );
      }
    });

    // ========================================================
    // OPTIONS
    // ========================================================

    const studentOptions =
      options.student || {};

    const overallOptions =
      options.overall || {};

    const partOptions =
      options.parts || {};

    const sectionOptions =
      options.sections || {};

    const isSelected = (
      object,
      key
    ) => Boolean(object?.[key]);

    // ========================================================
    // HEADERS
    // ========================================================

    const headers = [];

    // ========================================================
    // STUDENT HEADERS
    // ========================================================

    if (
      isSelected(
        studentOptions,
        "rollNumber"
      )
    ) {
      headers.push("Roll Number");
    }

    if (
      isSelected(
        studentOptions,
        "name"
      )
    ) {
      headers.push("Student Name");
    }

    // ========================================================
    // PART HEADERS
    // ========================================================

    if (hasParts) {
      parts.forEach(
        (partItem, partIndex) => {
          const part =
            partItem.part ||
            partItem;

          const partId =
            getId(part);

          if (!partId) return;

          const selected =
            partOptions[
              String(partId)
            ] || {};

          const partName =
            part?.name ||
            part?.partName ||
            `Part ${partIndex + 1}`;

          if (
            isSelected(
              selected,
              "attempted"
            )
          ) {
            headers.push(
              `${partName} - Attempted`
            );
          }

          if (
            isSelected(
              selected,
              "obtained"
            )
          ) {
            headers.push(
              `${partName} - Obtained`
            );
          }

          if (
            isSelected(
              selected,
              "max"
            )
          ) {
            headers.push(
              `${partName} - Max Marks`
            );
          }

          if (
            isSelected(
              selected,
              "percentage"
            )
          ) {
            headers.push(
              `${partName} - Percentage`
            );
          }
        }
      );
    }

    // ========================================================
    // SECTION HEADERS
    // ========================================================

    exportSections.forEach(
      (sectionItem, sectionIndex) => {
        const section =
          sectionItem.section ||
          sectionItem;

        const sectionId =
          getId(section);

        if (!sectionId) return;

        const selected =
          sectionOptions[
            String(sectionId)
          ] || {};

        const sectionName =
          section?.name ||
          section?.sectionName ||
          `Section ${sectionIndex + 1}`;

        let prefix =
          sectionName;

        // Part mode me actual part exportSections
        // ke andar available hai.
        if (hasParts) {
          const part =
            sectionItem.part ||
            section?.part;

          const partName =
            part?.name ||
            sectionItem.partName ||
            section?.partName;

          if (partName) {
            prefix =
              `${partName} - ${sectionName}`;
          }
        }

        if (
          isSelected(
            selected,
            "obtained"
          )
        ) {
          headers.push(
            `${prefix} - Obtained`
          );
        }

        if (
          isSelected(
            selected,
            "max"
          )
        ) {
          headers.push(
            `${prefix} - Max Marks`
          );
        }

        if (
          isSelected(
            selected,
            "percentage"
          )
        ) {
          headers.push(
            `${prefix} - Percentage`
          );
        }
      }
    );

    // ========================================================
    // OVERALL HEADERS
    // ========================================================

    if (
      isSelected(
        overallOptions,
        "totalObtained"
      )
    ) {
      headers.push(
        "Total Obtained"
      );
    }

    if (
      isSelected(
        overallOptions,
        "totalMax"
      )
    ) {
      headers.push(
        "Total Max"
      );
    }

    if (
      isSelected(
        overallOptions,
        "percentage"
      )
    ) {
      headers.push(
        "Overall Percentage"
      );
    }

    if (
      isSelected(
        overallOptions,
        "status"
      )
    ) {
      headers.push("Status");
    }

    // ========================================================
    // VALIDATION
    // ========================================================

    if (headers.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "Please select at least one field for export",
      });
    }

    // ========================================================
    // SCORE HELPERS
    // ========================================================

    const findPartScore = (
      submission,
      partId
    ) => {
      const scores =
        Array.isArray(
          submission?.partScores
        )
          ? submission.partScores
          : [];

      return (
        scores.find(
          (score) =>
            sameId(
              score?.partId ||
                score?._id,
              partId
            )
        ) || null
      );
    };

    const findSectionScore = (
      submission,
      sectionId
    ) => {
      const scores =
        Array.isArray(
          submission?.sectionScores
        )
          ? submission.sectionScores
          : [];

      return (
        scores.find(
          (score) =>
            sameId(
              score?.sectionId ||
                score?._id,
              sectionId
            )
        ) || null
      );
    };

    // ========================================================
    // BUILD ROWS
    // ========================================================

    const rows = students.map(
      (student) => {
        const row = {};

        const studentId =
          getId(student);

        const submission =
          submissionMap.get(
            String(studentId)
          );

        // ----------------------------------------------------
        // STUDENT
        // ----------------------------------------------------

        if (
          isSelected(
            studentOptions,
            "rollNumber"
          )
        ) {
          row["Roll Number"] =
            student?.rollNumber ||
            student?.rollNo ||
            "";
        }

        if (
          isSelected(
            studentOptions,
            "name"
          )
        ) {
          row["Student Name"] =
            student?.name ||
            student?.fullName ||
            "";
        }

        // ----------------------------------------------------
        // PARTS
        // ----------------------------------------------------

        if (hasParts) {
          parts.forEach(
            (
              partItem,
              partIndex
            ) => {
              const part =
                partItem.part ||
                partItem;

              const partId =
                getId(part);

              if (!partId) return;

              const selected =
                partOptions[
                  String(partId)
                ] || {};

              const partName =
                part?.name ||
                part?.partName ||
                `Part ${partIndex + 1}`;

              const score =
                submission
                  ? findPartScore(
                      submission,
                      partId
                    )
                  : null;

              const attempted =
                score?.attempted !==
                undefined
                  ? score.attempted
                  : false;

              const obtained =
                Number(
                  score?.obtainedMarks ??
                    score?.obtained ??
                    0
                ) || 0;

              const max =
                Number(
                  score?.maxMarks ??
                    score?.max ??
                    0
                ) || 0;

              const percentage =
                score?.percentage !==
                undefined &&
                score?.percentage !==
                null
                  ? round2(
                      score.percentage
                    )
                  : max > 0
                    ? round2(
                        (obtained /
                          max) *
                          100
                      )
                    : 0;

              if (
                isSelected(
                  selected,
                  "attempted"
                )
              ) {
                row[
                  `${partName} - Attempted`
                ] =
                  attempted
                    ? "YES"
                    : "NO";
              }

              if (
                isSelected(
                  selected,
                  "obtained"
                )
              ) {
                row[
                  `${partName} - Obtained`
                ] = obtained;
              }

              if (
                isSelected(
                  selected,
                  "max"
                )
              ) {
                row[
                  `${partName} - Max Marks`
                ] = max;
              }

              if (
                isSelected(
                  selected,
                  "percentage"
                )
              ) {
                row[
                  `${partName} - Percentage`
                ] = percentage;
              }
            }
          );
        }

        // ----------------------------------------------------
        // SECTIONS
        // ----------------------------------------------------

        exportSections.forEach(
          (
            sectionItem,
            sectionIndex
          ) => {
            const section =
              sectionItem.section ||
              sectionItem;

            const sectionId =
              getId(section);

            if (!sectionId) return;

            const selected =
              sectionOptions[
                String(sectionId)
              ] || {};

            const sectionName =
              section?.name ||
              section?.sectionName ||
              `Section ${sectionIndex + 1}`;

            let prefix =
              sectionName;

            if (hasParts) {
              const part =
                sectionItem.part ||
                section?.part;

              const partName =
                part?.name ||
                sectionItem.partName ||
                section?.partName;

              if (partName) {
                prefix =
                  `${partName} - ${sectionName}`;
              }
            }

            const score =
              submission
                ? findSectionScore(
                    submission,
                    sectionId
                  )
                : null;

            const obtained =
              Number(
                score?.obtainedMarks ??
                  score?.obtained ??
                  0
              ) || 0;

            const max =
              Number(
                score?.maxMarks ??
                  score?.max ??
                  0
              ) || 0;

            const percentage =
              score?.percentage !==
                undefined &&
              score?.percentage !==
                null
                ? round2(
                    score.percentage
                  )
                : max > 0
                  ? round2(
                      (obtained /
                        max) *
                        100
                    )
                  : 0;

            if (
              isSelected(
                selected,
                "obtained"
              )
            ) {
              row[
                `${prefix} - Obtained`
              ] = obtained;
            }

            if (
              isSelected(
                selected,
                "max"
              )
            ) {
              row[
                `${prefix} - Max Marks`
              ] = max;
            }

            if (
              isSelected(
                selected,
                "percentage"
              )
            ) {
              row[
                `${prefix} - Percentage`
              ] = percentage;
            }
          }
        );

        // ----------------------------------------------------
        // OVERALL
        // ----------------------------------------------------

        const totalObtained =
          Number(
            submission?.totalObtained
          ) || 0;

        const totalMax =
          Number(
            submission?.totalMax
          ) || 0;

        const overallPercentage =
          submission?.overallPercentage !==
            undefined &&
          submission?.overallPercentage !==
            null
            ? round2(
                submission.overallPercentage
              )
            : totalMax > 0
              ? round2(
                  (totalObtained /
                    totalMax) *
                    100
                )
              : 0;

        const status =
          String(
            submission?.status ||
              "PENDING"
          ).toUpperCase();

        if (
          isSelected(
            overallOptions,
            "totalObtained"
          )
        ) {
          row["Total Obtained"] =
            totalObtained;
        }

        if (
          isSelected(
            overallOptions,
            "totalMax"
          )
        ) {
          row["Total Max"] =
            totalMax;
        }

        if (
          isSelected(
            overallOptions,
            "percentage"
          )
        ) {
          row["Overall Percentage"] =
            overallPercentage;
        }

        if (
          isSelected(
            overallOptions,
            "status"
          )
        ) {
          row["Status"] = status;
        }

        return row;
      }
    );

    // ========================================================
    // WORKBOOK
    // ========================================================

    const worksheet =
      xlsx.utils.json_to_sheet(
        rows,
        {
          header: headers,
        }
      );

    worksheet["!cols"] =
      headers.map(
        (header) => ({
          wch: Math.min(
            Math.max(
              String(header).length +
                4,
              15
            ),
            40
          ),
        })
      );

    const workbook =
      xlsx.utils.book_new();

    xlsx.utils.book_append_sheet(
      workbook,
      worksheet,
      "Results"
    );

    // ========================================================
    // METADATA
    // ========================================================

    const metadata = [
      {
        Field: "Assessment",
        Value:
          populatedAssessment?.name ||
          populatedAssessment?.assessmentName ||
          "",
      },
      {
        Field: "Batch",
        Value:
          populatedAssessment?.batch
            ?.name || "",
      },
      {
        Field: "Course",
        Value:
          populatedAssessment?.course
            ?.name || "",
      },
      {
        Field: "Export Date",
        Value:
          new Date().toLocaleString(),
      },
      {
        Field: "Export Type",
        Value:
          "Dynamic Assessment Results",
      },
    ];

    const metadataSheet =
      xlsx.utils.json_to_sheet(
        metadata
      );

    metadataSheet["!cols"] = [
      { wch: 25 },
      { wch: 50 },
    ];

    xlsx.utils.book_append_sheet(
      workbook,
      metadataSheet,
      "Metadata"
    );

    // ========================================================
    // FILE
    // ========================================================

    const buffer =
      xlsx.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      });

    const organisationName =
      populatedAssessment
        ?.organisation?.name ||
      "Organisation";

    const centreName =
      populatedAssessment
        ?.centre?.name ||
      "Centre";

    const courseName =
      populatedAssessment
        ?.course?.name ||
      "Course";

    const batchName =
      populatedAssessment
        ?.batch?.name ||
      "Batch";

    const fileName =
      `${safeFileName(
        organisationName
      )}_${safeFileName(
        centreName
      )}_${safeFileName(
        courseName
      )}_${safeFileName(
        batchName
      )}_Dynamic_Results.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    return res.send(buffer);

  } catch (error) {
    console.error(
      "Export Results Error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to export results",
    });
  }
};

// ============================================================
// IMPORT MARKS
// ============================================================

exports.importMarks = async (
  req,
  res
) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message:
          "No file uploaded",
      });
    }

    const { assessmentId } =
      req.params;

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

    // ========================================================
    // STATUS
    // ========================================================

    if (
      assessment.status !==
      "PUBLISHED"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Assessment must be published to import marks",
      });
    }

    // ========================================================
    // READ WORKBOOK
    // ========================================================

    const workbook =
      xlsx.read(
        req.file.buffer,
        {
          type: "buffer",
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
          defval: "",
        }
      );

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message:
          "Excel file contains no data",
      });
    }

    // ========================================================
    // QUESTION COLUMN MAP
    // ========================================================

    const questionColumns = [];

    if (hasParts) {
      for (const partItem of parts) {
        const part =
          partItem.part;

        for (const sectionItem of partItem.sections) {
          const section =
            sectionItem.section;

          for (const question of sectionItem.questions) {
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
      for (const sectionItem of sections) {
        const section =
          sectionItem.section;

        for (const question of sectionItem.questions) {
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
        batch: assessment.batch,
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
    // PART SELECTION
    // ========================================================

    const partSelectionMap =
      new Map();

    if (hasParts) {
      const partSheet =
        workbook.Sheets[
          "Part Selection"
        ];

      if (partSheet) {
        const partRows =
          xlsx.utils.sheet_to_json(
            partSheet,
            {
              defval: "",
            }
          );

        for (const row of partRows) {
          const roll =
            String(
              row[
                "Roll Number"
              ] || ""
            ).trim();

          if (!roll) continue;

          const selections = {};

          for (const partItem of parts) {
            const part =
              partItem.part;

            const header =
              `PART SELECT: ${part.name}`;

            const value =
              String(
                row[header] || ""
              )
                .trim()
                .toUpperCase();

            if (
              part.isOptional === true
            ) {
              selections[
                part._id.toString()
              ] =
                value === "YES";
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
      const row = rows[i];

      const rollNumber =
        String(
          row[
            "Roll Number"
          ] || ""
        ).trim();

      if (!rollNumber) {
        results.failed.push({
          row: i + 2,
          reason:
            "Roll Number missing",
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
            "Student not found in batch",
        });

        continue;
      }

      // ======================================================
      // PART SELECTION
      // ======================================================

      const selections =
        partSelectionMap.get(
          rollNumber
        ) || {};

      if (hasParts) {
        for (const partItem of parts) {
          const part =
            partItem.part;

          if (
            part.isOptional === true
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

      // ======================================================
      // MARKS
      // ======================================================

      const marks = [];

      let hasData = false;
      let invalidRow = false;

      for (const column of questionColumns) {
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

        // Skip entire optional part
        if (
          optionalPartSkipped
        ) {
          continue;
        }

        const value =
          row[header];

        if (
          value === "" ||
          value === null ||
          value === undefined
        ) {
          results.failed.push({
            row: i + 2,
            rollNumber,
            reason:
              `Marks missing for question: ${question.questionText}`,
          });

          invalidRow = true;

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

          invalidRow = true;

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

          invalidRow = true;

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
            "No marks found for student",
        });

        continue;
      }

      // ======================================================
      // FIND / CREATE SUBMISSION
      // ======================================================

      let submission =
        await AssessmentSubmission.findOne(
          {
            assessment:
              assessmentId,
            student:
              student._id,
            attemptNumber: 1,
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
              attemptNumber: 1,
              status:
                "PENDING",
              submittedAt:
                new Date(),
              submittedBy:
                getUserId(req),
            }
          );
      }

      // ======================================================
      // SNAPSHOT PARTS
      // ======================================================

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
                    part.code || "",
                  description:
                    part.description ||
                    "",
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

      // ======================================================
      // SNAPSHOT SECTIONS
      // ======================================================

      const snapshotSections =
        hasParts
          ? parts.flatMap(
              (partItem) =>
                partItem.sections.map(
                  (sectionItem) => ({
                    sectionId:
                      sectionItem.section
                        ._id,

                    name:
                      sectionItem.section
                        .name,

                    description:
                      sectionItem.section
                        .description ||
                      "",

                    displayOrder:
                      sectionItem.section
                        .displayOrder,

                    partId:
                      partItem.part
                        ._id,

                    partName:
                      partItem.part
                        .name,

                    partDisplayOrder:
                      partItem.part
                        .displayOrder,

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
                      sectionItem.questions
                        .length,
                  })
                )
            )
          : sections.map(
              (sectionItem) => ({
                sectionId:
                  sectionItem.section
                    ._id,

                name:
                  sectionItem.section
                    .name,

                description:
                  sectionItem.section
                    .description ||
                  "",

                displayOrder:
                  sectionItem.section
                    .displayOrder,

                partId: null,
                partName: "",
                partDisplayOrder: 0,

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
                  sectionItem.questions
                    .length,
              })
            );

      // ======================================================
      // SNAPSHOT TOTAL
      // ======================================================

      // IMPORTANT:
      // Snapshot stores complete structure.
      // Actual scoring will exclude skipped optional parts
      // through calculateSubmissionScores().

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

      // ======================================================
      // DELETE OLD ANSWERS
      // ======================================================

      await AssessmentAnswer.deleteMany(
        {
          submission:
            submission._id,
        }
      );

      // ======================================================
      // CREATE ANSWERS
      // ======================================================

      const answerDocuments = [];

      for (const mark of marks) {
        const column =
          questionColumns.find(
            (item) =>
              item.question._id.toString() ===
              mark.questionId.toString()
          );

        if (!column) {
          continue;
        }

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
            part?._id || null,

          // ==================================================
          // QUESTION SNAPSHOT
          // ==================================================

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
              part?.name || "",

            partDisplayOrder:
              part?.displayOrder ||
              0,

            displayOrder:
              question.displayOrder,
          },

          // ==================================================
          // PART SNAPSHOT
          // ==================================================

          partSnapshot:
            part
              ? {
                  partId:
                    part._id,

                  name:
                    part.name,

                  code:
                    part.code || "",

                  isOptional:
                    part.isOptional ===
                    true,

                  displayOrder:
                    part.displayOrder ||
                    0,
                }
              : undefined,

          // ==================================================
          // IMPORTED MARKS
          // ==================================================

          answerValue: "",

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

      // ======================================================
      // RECALCULATE SCORES
      // ======================================================

      await calculateSubmissionScores(
        submission._id
      );

      results.success.push({
        row: i + 2,
        rollNumber,
        name: student.name,
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
      "IMPORT MARKS ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
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
            "No file uploaded",
        });
      }

      const { batchId } =
        req.body;

      if (!batchId) {
        return res.status(400).json({
          success: false,
          message:
            "batchId is required",
        });
      }

      const batch =
        await Batch.findById(
          batchId
        )
          .populate("course")
          .populate("centre")
          .populate("organisation");

      if (!batch) {
        return res.status(404).json({
          success: false,
          message:
            "Batch not found",
        });
      }

      // ========================================================
      // READ WORKBOOK
      // ========================================================

      const workbook =
        xlsx.read(
          req.file.buffer,
          {
            type: "buffer",
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
            defval: "",
          }
        );

      if (!rows.length) {
        return res.status(400).json({
          success: false,
          message:
            "Excel file contains no data",
        });
      }

      // ========================================================
      // REQUIRED HEADERS
      // ========================================================

      const requiredHeaders = [
        "Roll Number",
        "Student Name",
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
            `Missing required headers: ${missingHeaders.join(
              ", "
            )}`,
        });
      }

      // ========================================================
      // EXISTING STUDENTS
      // ========================================================

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

      // ========================================================
      // IMPORT EACH ROW
      // ========================================================

      for (
        let i = 0;
        i < rows.length;
        i++
      ) {
        const row = rows[i];

        const rollNumber =
          String(
            row[
              "Roll Number"
            ] || ""
          ).trim();

        const name =
          String(
            row[
              "Student Name"
            ] || ""
          ).trim();

        // ------------------------------------------------------
        // ROLL NUMBER
        // ------------------------------------------------------

        if (!rollNumber) {
          results.failed.push({
            row: i + 2,
            reason:
              "Roll Number missing",
          });

          continue;
        }

        // ------------------------------------------------------
        // NAME
        // ------------------------------------------------------

        if (!name) {
          results.failed.push({
            row: i + 2,
            rollNumber,
            reason:
              "Student Name missing",
          });

          continue;
        }

        // ------------------------------------------------------
        // DUPLICATE ROLL
        // ------------------------------------------------------

        if (
          existingRolls.has(
            rollNumber
          )
        ) {
          results.failed.push({
            row: i + 2,
            rollNumber,
            reason:
              "Duplicate Roll Number",
          });

          continue;
        }

        // ------------------------------------------------------
        // DUPLICATE NAME
        // ------------------------------------------------------

        if (
          existingNames.has(
            name.toLowerCase()
          )
        ) {
          results.failed.push({
            row: i + 2,
            rollNumber,
            reason:
              "Duplicate Student Name",
          });

          continue;
        }

        // ------------------------------------------------------
        // MOBILE
        // ------------------------------------------------------

        const mobile =
          String(
            row["Mobile"] || ""
          ).trim();

        const normalizedMobile =
          mobile.replace(
            /[^0-9]/g,
            ""
          );

        if (
          mobile &&
          !/^[0-9]{10,15}$/.test(
            normalizedMobile
          )
        ) {
          results.failed.push({
            row: i + 2,
            rollNumber,
            reason:
              "Invalid mobile number",
          });

          continue;
        }

        // ------------------------------------------------------
        // CREATE STUDENT
        // ------------------------------------------------------

        await Student.create({
          rollNumber,

          name,

          fatherName:
            String(
              row[
                "Father Name"
              ] || ""
            ).trim(),

          motherName:
            String(
              row[
                "Mother Name"
              ] || ""
            ).trim(),

          mobile:
            mobile || "",

          email:
            String(
              row[
                "Email"
              ] || ""
            ).trim(),

          gender:
            String(
              row[
                "Gender"
              ] || ""
            ).trim(),

          dateOfBirth:
            row["DOB"] || null,

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
        "IMPORT STUDENTS ERROR:",
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
      const { batchId } =
        req.query;

      if (!batchId) {
        return res.status(400).json({
          success: false,
          message:
            "batchId is required",
        });
      }

      // ========================================================
      // BATCH
      // ========================================================

      const batch =
        await Batch.findById(
          batchId
        )
          .populate(
            "course",
            "name code"
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

      // ========================================================
      // HEADERS
      // ========================================================

      const headers = [
        "Roll Number",
        "Student Name",
        "Father Name",
        "Mother Name",
        "Mobile",
        "Email",
        "Gender",
        "DOB",
      ];

      // ========================================================
      // SAMPLE ROW
      // ========================================================

      const rows = [
        {
          "Roll Number": "",
          "Student Name": "",
          "Father Name": "",
          "Mother Name": "",
          Mobile: "",
          Email: "",
          Gender: "",
          DOB: "",
        },
      ];

      // ========================================================
      // WORKSHEET
      // IMPORTANT: header: headers
      // ========================================================

      const ws =
        xlsx.utils.json_to_sheet(
          rows,
          {
            header: headers,
          }
        );

      ws["!cols"] = [
        {
          wch: 16,
        },
        {
          wch: 28,
        },
        {
          wch: 25,
        },
        {
          wch: 25,
        },
        {
          wch: 16,
        },
        {
          wch: 30,
        },
        {
          wch: 12,
        },
        {
          wch: 16,
        },
      ];

      const wb =
        xlsx.utils.book_new();

      xlsx.utils.book_append_sheet(
        wb,
        ws,
        "Students"
      );

      // ========================================================
      // INSTRUCTIONS
      // ========================================================

      const instructions = [
        [
          "Student Import Template",
        ],

        [""],

        [
          "Batch",
          batch.name || "",
        ],

        [
          "Course",
          batch.course?.name || "",
        ],

        [
          "Course Code",
          batch.course?.code || "",
        ],

        [
          "Centre",
          batch.centre?.name || "",
        ],

        [
          "Organisation",
          batch.organisation?.name ||
            "",
        ],

        [""],

        [
          "Instructions",
        ],

        [
          "1. Roll Number is required.",
        ],

        [
          "2. Student Name is required.",
        ],

        [
          "3. Mobile should contain 10 to 15 digits.",
        ],

        [
          "4. Gender should be Male, Female or Other.",
        ],

        [
          "5. DOB should be entered as YYYY-MM-DD.",
        ],

        [
          "6. Do not change the column names.",
        ],

        [
          "7. Do not add Organisation, Centre, Course or Batch columns.",
        ],

        [
          "8. Organisation, Centre, Course and Batch are automatically taken from the selected Batch.",
        ],
      ];

      const instructionWs =
        xlsx.utils.aoa_to_sheet(
          instructions
        );

      instructionWs["!cols"] = [
        {
          wch: 85,
        },
        {
          wch: 30,
        },
      ];

      xlsx.utils.book_append_sheet(
        wb,
        instructionWs,
        "Instructions"
      );

      // ========================================================
      // WRITE
      // ========================================================

      const buffer =
        xlsx.write(wb, {
          type: "buffer",
          bookType: "xlsx",
        });

      const safeBatchName =
        safeFileName(
          batch.name ||
            "Batch"
        );

      const filename =
        `Student_Import_Template_${safeBatchName}.xlsx`;

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      return res.send(buffer);
    } catch (error) {
      console.error(
        "DOWNLOAD STUDENT TEMPLATE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message,
      });
    }
  };