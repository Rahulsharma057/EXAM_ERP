"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  ArrowBack,
  Save,
  Refresh,
  CheckCircle,
} from "@mui/icons-material";

import { useParams, useRouter } from "next/navigation";

import { api } from "../../../../services/api";

export default function TeacherMarksPage() {
  const params = useParams();
  const router = useRouter();

  const assessmentId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [assessment, setAssessment] = useState(null);
  const [students, setStudents] = useState([]);

  const [selectedStudentId, setSelectedStudentId] =
    useState("");

  const [marksData, setMarksData] = useState(null);

  /*
   * {
   *   questionId: "YES",
   *   questionId2: "NO",
   *   questionId3: "Option A",
   *   questionId4: ["A", "B"]
   * }
   */
  const [answers, setAnswers] = useState({});

  /*
   * {
   *   questionId: 1,
   *   questionId2: 0
   * }
   *
   * Only used internally for YES/NO automatic display.
   * Backend remains final authority.
   */
  const [awardedMarks, setAwardedMarks] =
    useState({});

  /*
   * {
   *   partId: true,
   *   partId2: false
   * }
   *
   * true  = attempt
   * false = skip optional part
   */
  const [partSelections, setPartSelections] =
    useState({});

  const [assessmentSubmitted, setAssessmentSubmitted] =
    useState(false);

  // ==========================================================
  // HELPERS
  // ==========================================================

  const hasParts = Boolean(
    marksData?.assessment?.hasParts ??
      assessment?.hasParts
  );

  const getParts = () => {
    if (!marksData) return [];

    if (Array.isArray(marksData.parts)) {
      return marksData.parts;
    }

    return [];
  };

  const getSections = () => {
    if (!marksData) return [];

    return Array.isArray(marksData.sections)
      ? marksData.sections
      : [];
  };

  const getAllQuestions = () => {
    const result = [];

    if (hasParts) {
      getParts().forEach((part) => {
        (part.sections || []).forEach((section) => {
          (section.questions || []).forEach((question) => {
            result.push({
              ...question,
              partId:
                question.partId ||
                part._id ||
                part.partId,
              sectionId:
                question.sectionId ||
                section._id ||
                section.sectionId,
              part,
              section,
            });
          });
        });
      });

      return result;
    }

    getSections().forEach((section) => {
      (section.questions || []).forEach((question) => {
        result.push({
          ...question,
          sectionId:
            question.sectionId ||
            section._id ||
            section.sectionId,
          section,
        });
      });
    });

    return result;
  };

  const isPartAttempted = (part) => {
    const partId =
      part?._id ||
      part?.partId;

    if (!partId) return true;

    if (!part.isOptional) {
      return true;
    }

    /*
     * Existing backend data can use:
     * attempted
     * selected
     * isAttempted
     *
     * Support all.
     */
    if (
      partSelections[partId] !== undefined
    ) {
      return Boolean(partSelections[partId]);
    }

    if (
      part.attempted !== undefined
    ) {
      return Boolean(part.attempted);
    }

    if (
      part.selected !== undefined
    ) {
      return Boolean(part.selected);
    }

    if (
      part.isAttempted !== undefined
    ) {
      return Boolean(part.isAttempted);
    }

    /*
     * Default optional part = attempted.
     * Teacher can explicitly skip it.
     */
    return true;
  };

  const getQuestionMax = (question) =>
    Number(question?.maxPoints || 0);

  const calculateQuestionMark = (question) => {
    const answer = answers[question._id];

    if (
      question.questionType === "YES_NO"
    ) {
      const normalized = String(
        answer || ""
      ).toUpperCase();

      if (normalized === "YES") {
        return getQuestionMax(question);
      }

      if (normalized === "NO") {
        return 0;
      }

      return "";
    }

    const marks =
      awardedMarks[question._id];

    if (
      marks === undefined ||
      marks === null ||
      marks === ""
    ) {
      return "";
    }

    return Number(marks);
  };

  // ==========================================================
  // LOAD STUDENTS
  // ==========================================================

  const loadStudents = async () => {
    if (!assessmentId) return;

    try {
      setLoading(true);
      setError("");

      const response =
        await api.getAssessmentStudentsForMarks(
          assessmentId
        );

      const data = response?.data || {};

      setAssessment(
        data.assessment || null
      );

      setStudents(
        data.students || []
      );
    } catch (err) {
      console.error(
        "LOAD ASSESSMENT STUDENTS ERROR:",
        err
      );

      setError(
        err?.message ||
          "Failed to load students"
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // LOAD STUDENT MARKS
  // ==========================================================

  const loadStudentMarks = async (
    studentId
  ) => {
    if (!studentId) {
      setMarksData(null);
      setAnswers({});
      setAwardedMarks({});
      setPartSelections({});
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const response =
        await api.getStudentMarksEntry(
          assessmentId,
          studentId
        );

      const data =
        response?.data || {};

      setMarksData(data);

      const initialAnswers = {};
      const initialMarks = {};
      const initialPartSelections = {};

      /*
       * Load optional part selections.
       */
      (
        data.parts || []
      ).forEach((part) => {
        const partId =
          part._id ||
          part.partId;

        if (!partId) return;

        if (
          part.attempted !== undefined
        ) {
          initialPartSelections[
            partId
          ] = Boolean(
            part.attempted
          );
        } else if (
          part.selected !== undefined
        ) {
          initialPartSelections[
            partId
          ] = Boolean(
            part.selected
          );
        } else if (
          part.isAttempted !== undefined
        ) {
          initialPartSelections[
            partId
          ] = Boolean(
            part.isAttempted
          );
        } else if (
          part.isOptional
        ) {
          initialPartSelections[
            partId
          ] = true;
        }
      });

      /*
       * New nested structure:
       *
       * parts
       *   sections
       *     questions
       */
      if (
        Array.isArray(data.parts)
      ) {
        data.parts.forEach((part) => {
          (
            part.sections || []
          ).forEach((section) => {
            (
              section.questions || []
            ).forEach((question) => {
              if (
                question.awardedScore !==
                  null &&
                question.awardedScore !==
                  undefined
              ) {
                initialMarks[
                  question._id
                ] = Number(
                  question.awardedScore
                );
              }

              /*
               * FIX: backend sends answerValue: ""
               * for YES_NO questions (they don't use
               * a free-text/choice answerValue at all —
               * their answer is derived from awardedScore).
               * Treat "" the same as null/undefined so we
               * don't accidentally "lock in" an empty
               * answer and skip the YES_NO derivation
               * block below.
               */
              if (
                question.answerValue !==
                  null &&
                question.answerValue !==
                  undefined &&
                question.answerValue !== ""
              ) {
                initialAnswers[
                  question._id
                ] =
                  question.answerValue;
              }

              /*
               * Backward compatibility
               * for YES_NO.
               */
              if (
                question.questionType ===
                  "YES_NO" &&
                initialAnswers[
                  question._id
                ] === undefined &&
                question.awardedScore !==
                  null &&
                question.awardedScore !==
                  undefined
              ) {
                const maxPoints =
                  Number(
                    question.maxPoints ||
                      0
                  );

                initialAnswers[
                  question._id
                ] =
                  Number(
                    question.awardedScore
                  ) === maxPoints
                    ? "YES"
                    : "NO";
              }
            });
          });
        });
      }

      /*
       * Direct section structure.
       */
      (
        data.sections || []
      ).forEach((section) => {
        (
          section.questions || []
        ).forEach((question) => {
          if (
            question.awardedScore !==
              null &&
            question.awardedScore !==
              undefined
          ) {
            initialMarks[
              question._id
            ] = Number(
              question.awardedScore
            );
          }

          /*
           * FIX: same "" guard as above, for the
           * direct-section (no parts) structure.
           */
          if (
            question.answerValue !==
              null &&
            question.answerValue !==
              undefined &&
            question.answerValue !== ""
          ) {
            initialAnswers[
              question._id
            ] =
              question.answerValue;
          }

          if (
            question.questionType ===
              "YES_NO" &&
            initialAnswers[
              question._id
            ] === undefined &&
            question.awardedScore !==
              null &&
            question.awardedScore !==
              undefined
          ) {
            const maxPoints =
              Number(
                question.maxPoints || 0
              );

            initialAnswers[
              question._id
            ] =
              Number(
                question.awardedScore
              ) === maxPoints
                ? "YES"
                : "NO";
          }
        });
      });

      /*
       * If backend returns partScores,
       * use them for optional-part state.
       */
      (
        data.partScores || []
      ).forEach((partScore) => {
        const partId =
          partScore.partId;

        if (!partId) return;

        if (
          partScore.attempted !==
          undefined
        ) {
          initialPartSelections[
            partId
          ] = Boolean(
            partScore.attempted
          );
        }
      });

      setAnswers(initialAnswers);
      setAwardedMarks(initialMarks);
      setPartSelections(
        initialPartSelections
      );
    } catch (err) {
      console.error(
        "LOAD STUDENT MARKS ERROR:",
        err
      );

      setError(
        err?.message ||
          "Failed to load student marks"
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  useEffect(() => {
    if (assessmentId) {
      loadStudents();
    }
  }, [assessmentId]);

  // ==========================================================
  // STUDENT CHANGE
  // ==========================================================

  const handleStudentChange = async (
    event
  ) => {
    const studentId =
      event.target.value;

    setSelectedStudentId(
      studentId
    );

    await loadStudentMarks(
      studentId
    );
  };

  // ==========================================================
  // PART CHANGE
  // ==========================================================

  const handlePartSelectionChange = (
    partId,
    value
  ) => {
    setPartSelections((prev) => ({
      ...prev,
      [partId]: Boolean(value),
    }));

    setError("");
    setSuccess("");
  };

  // ==========================================================
  // ANSWER CHANGE
  // ==========================================================

  const handleAnswerChange = (
    questionId,
    value,
    maxPoints = null
  ) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));

    /*
     * YES/NO automatic marks.
     * No manual awarded marks field.
     */
    if (maxPoints !== null) {
      setAwardedMarks((prev) => ({
        ...prev,
        [questionId]:
          String(value).toUpperCase() ===
          "YES"
            ? Number(maxPoints)
            : String(value).toUpperCase() ===
              "NO"
            ? 0
            : "",
      }));
    }

    setError("");
    setSuccess("");
  };

  // ==========================================================
  // QUESTION TYPE LABEL
  // ==========================================================

  const getQuestionTypeLabel = (
    type
  ) => {
    switch (type) {
      case "YES_NO":
        return "Yes / No";

      case "TEXT":
        return "Text";

      case "NUMBER":
        return "Number";

      case "SINGLE_CHOICE":
        return "Single Choice";

      case "MULTIPLE_CHOICE":
        return "Multiple Choice";

      default:
        return type || "Question";
    }
  };

  // ==========================================================
  // CURRENT TOTALS
  // ==========================================================

  const currentTotals = useMemo(() => {
    if (!marksData) {
      return {
        obtained: 0,
        max: 0,
        percentage: 0,
      };
    }

    let obtained = 0;
    let max = 0;

    /*
     * PART MODE
     */
    if (hasParts) {
      getParts().forEach((part) => {
        if (
          part.isOptional &&
          !isPartAttempted(part)
        ) {
          return;
        }

        (
          part.sections || []
        ).forEach((section) => {
          (
            section.questions || []
          ).forEach((question) => {
            const maxPoints =
              getQuestionMax(
                question
              );

            max += maxPoints;

            const marks =
              calculateQuestionMark(
                question
              );

            if (
              marks !== "" &&
              marks !== null &&
              marks !== undefined
            ) {
              obtained += Number(
                marks
              );
            }
          });
        });
      });
    } else {
      /*
       * DIRECT SECTION MODE
       */
      getSections().forEach(
        (section) => {
          (
            section.questions || []
          ).forEach((question) => {
            const maxPoints =
              getQuestionMax(
                question
              );

            max += maxPoints;

            const marks =
              calculateQuestionMark(
                question
              );

            if (
              marks !== "" &&
              marks !== null &&
              marks !== undefined
            ) {
              obtained += Number(
                marks
              );
            }
          });
        }
      );
    }

    return {
      obtained,
      max,
      percentage:
        max > 0
          ? (obtained / max) * 100
          : 0,
    };
  }, [
    marksData,
    answers,
    awardedMarks,
    partSelections,
    hasParts,
  ]);

  // ==========================================================
  // CHECK QUESTIONS
  // ==========================================================

  const allQuestionsAnswered =
    useMemo(() => {
      if (!marksData) return false;

      const questions = [];

      if (hasParts) {
        getParts().forEach(
          (part) => {
            if (
              part.isOptional &&
              !isPartAttempted(part)
            ) {
              return;
            }

            (
              part.sections || []
            ).forEach((section) => {
              (
                section.questions || []
              ).forEach((question) => {
                questions.push(
                  question
                );
              });
            });
          }
        );
      } else {
        getSections().forEach(
          (section) => {
            (
              section.questions || []
            ).forEach((question) => {
              questions.push(
                question
              );
            });
          }
        );
      }

      if (questions.length === 0) {
        return false;
      }

      return questions.every(
        (question) => {
          const answer =
            answers[
              question._id
            ];

          /*
           * YES/NO
           */
          if (
            question.questionType ===
            "YES_NO"
          ) {
            return (
              answer === "YES" ||
              answer === "NO"
            );
          }

          /*
           * TEXT
           */
          if (
            question.questionType ===
            "TEXT"
          ) {
            return (
              typeof answer ===
                "string" &&
              answer.trim() !== ""
            );
          }

          /*
           * NUMBER
           */
          if (
            question.questionType ===
            "NUMBER"
          ) {
            return (
              answer !== undefined &&
              answer !== null &&
              String(answer).trim() !== ""
            );
          }

          /*
           * SINGLE CHOICE
           */
          if (
            question.questionType ===
            "SINGLE_CHOICE"
          ) {
            return (
              answer !== undefined &&
              answer !== null &&
              String(answer).trim() !== ""
            );
          }

          /*
           * MULTIPLE CHOICE
           */
          if (
            question.questionType ===
            "MULTIPLE_CHOICE"
          ) {
            return (
              Array.isArray(answer) &&
              answer.length > 0
            );
          }

          return true;
        }
      );
    }, [
      marksData,
      answers,
      partSelections,
      hasParts,
    ]);

  // ==========================================================
  // CURRENT STUDENT
  // ==========================================================

  const currentStudentIndex =
    students.findIndex(
      (student) =>
        student._id ===
        selectedStudentId
    );

  const isLastStudent =
    currentStudentIndex ===
    students.length - 1;

  const isFirstStudent =
    currentStudentIndex <= 0;

  // ==========================================================
  // BUILD MARK PAYLOAD
  // ==========================================================

  const buildMarkPayload = () => {
    const payload = [];

    const questions =
      getAllQuestions();

    for (const question of questions) {
      const part =
        question.part;

      /*
       * Optional skipped part:
       * don't send question marks.
       */
      if (
        part &&
        part.isOptional &&
        !isPartAttempted(part)
      ) {
        continue;
      }

      const marks =
        calculateQuestionMark(
          question
        );

      /*
       * For automatic YES/NO,
       * marks must exist.
       */
      if (
        marks === undefined ||
        marks === null ||
        marks === ""
      ) {
        /*
         * Only required questions block.
         */
        if (
          question.isRequired
        ) {
          throw new Error(
            `Please enter answer for: ${question.questionText}`
          );
        }

        /*
         * Optional question:
         * backend can treat unanswered
         * according to its validation.
         */
        continue;
      }

      const numericMarks =
        Number(marks);

      const maxPoints =
        getQuestionMax(
          question
        );

      if (
        Number.isNaN(
          numericMarks
        ) ||
        numericMarks < 0 ||
        numericMarks > maxPoints
      ) {
        throw new Error(
          `Invalid marks for: ${question.questionText}. Maximum marks are ${maxPoints}.`
        );
      }

      payload.push({
        questionId:
          question._id,
        awardedScore:
          numericMarks,
        answerValue:
          answers[
            question._id
          ],
      });
    }

    return payload;
  };

  // ==========================================================
  // BUILD PART SELECTION PAYLOAD
  // ==========================================================

  const buildPartSelectionPayload =
    () => {
      if (!hasParts) {
        return [];
      }

      return getParts().map(
        (part) => {
          const partId =
            part._id ||
            part.partId;

          return {
            partId,
            attempted:
              part.isOptional
                ? isPartAttempted(
                    part
                  )
                : true,
          };
        }
      );
    };

  // ==========================================================
  // SAVE CURRENT STUDENT
  // ==========================================================

  const saveCurrentStudentMarks =
    async () => {
      if (!selectedStudentId) {
        setError(
          "Please select a student"
        );
        return false;
      }

      if (!marksData) {
        setError(
          "Student marks data not loaded"
        );
        return false;
      }

      let markPayload = [];

      try {
        markPayload =
          buildMarkPayload();
      } catch (validationError) {
        setError(
          validationError.message
        );
        return false;
      }

      /*
       * If no question has been entered,
       * don't submit empty data.
       */
      if (
        markPayload.length === 0
      ) {
        setError(
          "Please enter at least one answer."
        );
        return false;
      }

      const selectionPayload =
        buildPartSelectionPayload();

      try {
        setSaving(true);
        setError("");
        setSuccess("");

        const response =
          await api.saveStudentMarks(
            assessmentId,
            selectedStudentId,
            markPayload,
            selectionPayload
          );

        setSuccess(
          response?.message ||
            "Marks saved successfully"
        );

        /*
         * Reload backend calculated
         * values so frontend never becomes
         * source of truth.
         */
        await loadStudentMarks(
          selectedStudentId
        );

        return true;
      } catch (err) {
        console.error(
          "SAVE MARKS ERROR:",
          err
        );

        setError(
          err?.message ||
            "Failed to save marks"
        );

        return false;
      } finally {
        setSaving(false);
      }
    };

  // ==========================================================
  // SAVE + NEXT
  // ==========================================================

  const handleNextStudent =
    async () => {
      if (!selectedStudentId) {
        setError(
          "Please select a student"
        );
        return;
      }

      if (!allQuestionsAnswered) {
        setError(
          "Please complete all required questions and selected parts."
        );
        return;
      }

      const saved =
        await saveCurrentStudentMarks();

      if (!saved) return;

      if (isLastStudent) {
        setAssessmentSubmitted(
          true
        );
        setSuccess("");
        return;
      }

      const nextStudent =
        students[
          currentStudentIndex + 1
        ];

      if (!nextStudent) return;

      setSelectedStudentId(
        nextStudent._id
      );

      await loadStudentMarks(
        nextStudent._id
      );
    };

  // ==========================================================
  // PREVIOUS
  // ==========================================================

  const handlePreviousStudent =
    async () => {
      if (
        currentStudentIndex <= 0
      ) {
        return;
      }

      const previousStudent =
        students[
          currentStudentIndex - 1
        ];

      setSelectedStudentId(
        previousStudent._id
      );

      await loadStudentMarks(
        previousStudent._id
      );
    };

  // ==========================================================
  // REFRESH
  // ==========================================================

  const handleRefresh =
    async () => {
      const currentStudent =
        selectedStudentId;

      await loadStudents();

      if (currentStudent) {
        await loadStudentMarks(
          currentStudent
        );
      }
    };

  // ==========================================================
  // PART TOTAL
  // ==========================================================

  const calculatePartTotals = (
    part
  ) => {
    if (
      part.isOptional &&
      !isPartAttempted(part)
    ) {
      return {
        obtained: 0,
        max: 0,
        percentage: 0,
        skipped: true,
      };
    }

    let obtained = 0;
    let max = 0;

    (
      part.sections || []
    ).forEach((section) => {
      (
        section.questions || []
      ).forEach((question) => {
        max += getQuestionMax(
          question
        );

        const marks =
          calculateQuestionMark(
            question
          );

        if (
          marks !== "" &&
          marks !== null &&
          marks !== undefined
        ) {
          obtained += Number(
            marks
          );
        }
      });
    });

    return {
      obtained,
      max,
      percentage:
        max > 0
          ? (obtained / max) * 100
          : 0,
      skipped: false,
    };
  };

  // ==========================================================
  // SECTION TOTAL
  // ==========================================================

  const calculateSectionTotals =
    (section) => {
      let obtained = 0;
      let max = 0;

      (
        section.questions || []
      ).forEach((question) => {
        max += getQuestionMax(
          question
        );

        const marks =
          calculateQuestionMark(
            question
          );

        if (
          marks !== "" &&
          marks !== null &&
          marks !== undefined
        ) {
          obtained += Number(
            marks
          );
        }
      });

      return {
        obtained,
        max,
        percentage:
          max > 0
            ? (obtained / max) * 100
            : 0,
      };
    };

  // ==========================================================
  // LOADING
  // ==========================================================

  if (
    loading &&
    !assessment &&
    !marksData
  ) {
    return (
      <Box
        sx={{
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // ==========================================================
  // COMPLETED
  // ==========================================================

  if (assessmentSubmitted) {
    return (
      <Box
        sx={{
          minHeight: "70vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 3,
        }}
      >
        <Card
          sx={{
            maxWidth: 650,
            width: "100%",
            borderRadius: 4,
            textAlign: "center",
          }}
        >
          <CardContent sx={{ p: 5 }}>
            <CheckCircle
              sx={{
                fontSize: 80,
                mb: 2,
              }}
              color="success"
            />

            <Typography
              variant="h4"
              fontWeight={700}
              gutterBottom
            >
              Thank You!
            </Typography>

            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ mb: 2 }}
            >
              Marks Entry Completed
            </Typography>

            {assessment && (
              <Typography
                color="text.secondary"
                sx={{ mb: 3 }}
              >
                {assessment.name}
                {" • "}
                Week{" "}
                {assessment.weekNumber}
                {" • "}
                {assessment.batch?.name}
              </Typography>
            )}

            <Alert
              severity="success"
              sx={{
                mb: 3,
                textAlign: "left",
              }}
            >
              All students' marks have
              been entered successfully.
            </Alert>

            <Stack
              direction={{
                xs: "column",
                sm: "row",
              }}
              spacing={2}
              justifyContent="center"
            >
              <Button
                variant="outlined"
                startIcon={<ArrowBack />}
                onClick={() =>
                  router.back()
                }
              >
                Back
              </Button>

              <Button
                variant="contained"
                onClick={() =>
                  router.push(
                    `/assessments/${assessmentId}/results`
                  )
                }
              >
                View Results
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // ==========================================================
  // MAIN UI
  // ==========================================================

  return (
    <Box
      sx={{
        p: {
          xs: 2,
          md: 3,
        },
      }}
    >
      {/* HEADER */}

      <Stack
        direction={{
          xs: "column",
          md: "row",
        }}
        justifyContent="space-between"
        alignItems={{
          xs: "stretch",
          md: "center",
        }}
        spacing={2}
        mb={3}
      >
        <Box>
          <Button
            startIcon={<ArrowBack />}
            onClick={() =>
              router.back()
            }
            sx={{ mb: 1 }}
          >
            Back
          </Button>

          <Typography
            variant="h5"
            fontWeight={700}
          >
            Teacher Marks Entry
          </Typography>

          {assessment && (
            <Typography
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              {assessment.name}
              {" • "}
              Week{" "}
              {assessment.weekNumber}
              {" • "}
              {assessment.batch?.name}
            </Typography>
          )}
        </Box>

        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={handleRefresh}
          disabled={saving}
        >
          Refresh
        </Button>
      </Stack>

      {/* ALERTS */}

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() =>
            setError("")
          }
        >
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          onClose={() =>
            setSuccess("")
          }
        >
          {success}
        </Alert>
      )}

      {/* STUDENT SELECTOR */}

      <Card
        sx={{
          mb: 3,
          borderRadius: 3,
        }}
      >
        <CardContent>
          <Stack
            direction={{
              xs: "column",
              md: "row",
            }}
            spacing={2}
            alignItems={{
              xs: "stretch",
              md: "center",
            }}
          >
            <FormControl fullWidth>
              <InputLabel>
                Select Student
              </InputLabel>

              <Select
                value={
                  selectedStudentId
                }
                label="Select Student"
                onChange={
                  handleStudentChange
                }
                disabled={saving}
              >
                <MenuItem value="">
                  Select Student
                </MenuItem>

                {students.map(
                  (item) => (
                    <MenuItem
                      key={item._id}
                      value={item._id}
                    >
                      {item.rollNumber}
                      {" - "}
                      {item.name}
                    </MenuItem>
                  )
                )}
              </Select>
            </FormControl>

            {marksData && (
              <Chip
                label={
                  allQuestionsAnswered
                    ? "All Marks Entered"
                    : "Marks Pending"
                }
                color={
                  allQuestionsAnswered
                    ? "success"
                    : "warning"
                }
              />
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* NO STUDENT */}

      {!selectedStudentId && (
        <Card
          sx={{
            borderRadius: 3,
            textAlign: "center",
            py: 8,
          }}
        >
          <CardContent>
            <Typography
              variant="h6"
              fontWeight={600}
              mb={1}
            >
              Select a Student
            </Typography>

            <Typography color="text.secondary">
              Select a student from the
              assessment batch to enter
              question-wise marks.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* MARKS */}

      {marksData && (
        <>
          {/* STUDENT INFO */}

          <Card
            sx={{
              mb: 3,
              borderRadius: 3,
            }}
          >
            <CardContent>
              <Stack
                direction={{
                  xs: "column",
                  sm: "row",
                }}
                spacing={3}
              >
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    Student
                  </Typography>

                  <Typography fontWeight={700}>
                    {marksData.student?.name}
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    Roll Number
                  </Typography>

                  <Typography fontWeight={700}>
                    {
                      marksData.student
                        ?.rollNumber
                    }
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    Current Total
                  </Typography>

                  <Typography fontWeight={700}>
                    {
                      currentTotals.obtained
                    }
                    {" / "}
                    {
                      currentTotals.max
                    }
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    Percentage
                  </Typography>

                  <Typography fontWeight={700}>
                    {currentTotals.percentage.toFixed(
                      2
                    )}
                    %
                  </Typography>
                </Box>

                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    Student
                  </Typography>

                  <Typography fontWeight={700}>
                    {currentStudentIndex +
                      1}
                    {" / "}
                    {students.length}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* ==================================================
              PART MODE
          ================================================== */}

          {hasParts && (
            <Stack spacing={3}>
              {getParts().map(
                (part) => {
                  const attempted =
                    isPartAttempted(
                      part
                    );

                  const totals =
                    calculatePartTotals(
                      part
                    );

                  return (
                    <Card
                      key={
                        part._id ||
                        part.partId
                      }
                      sx={{
                        borderRadius: 3,
                        borderLeft: 5,
                        borderColor:
                          part.isOptional
                            ? "warning.main"
                            : "primary.main",
                      }}
                    >
                      <CardContent>
                        {/* PART HEADER */}

                        <Stack
                          direction={{
                            xs: "column",
                            md: "row",
                          }}
                          justifyContent="space-between"
                          spacing={2}
                          mb={2}
                        >
                          <Box>
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                              flexWrap="wrap"
                            >
                              <Typography
                                variant="h5"
                                fontWeight={700}
                              >
                                {part.name}
                              </Typography>

                              {part.code && (
                                <Chip
                                  size="small"
                                  label={
                                    part.code
                                  }
                                  variant="outlined"
                                />
                              )}

                              <Chip
                                size="small"
                                label={
                                  part.isOptional
                                    ? "Optional"
                                    : "Required"
                                }
                                color={
                                  part.isOptional
                                    ? "warning"
                                    : "primary"
                                }
                              />
                            </Stack>

                            {part.description && (
                              <Typography
                                color="text.secondary"
                                variant="body2"
                                sx={{
                                  mt: 0.5,
                                }}
                              >
                                {
                                  part.description
                                }
                              </Typography>
                            )}
                          </Box>

                          <Box>
                            {part.isOptional ? (
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={
                                      attempted
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      handlePartSelectionChange(
                                        part._id ||
                                          part.partId,
                                        e.target
                                          .checked
                                      )
                                    }
                                    disabled={
                                      saving
                                    }
                                  />
                                }
                                label={
                                  attempted
                                    ? "Attempt Part"
                                    : "Skip Part"
                                }
                              />
                            ) : (
                              <Chip
                                label="Required Part"
                                color="primary"
                                variant="outlined"
                              />
                            )}
                          </Box>
                        </Stack>

                        <Divider
                          sx={{
                            mb: 2,
                          }}
                        />

                        {/* SKIPPED */}

                        {!attempted &&
                        part.isOptional ? (
                          <Alert severity="info">
                            This optional
                            part is skipped.
                            Its marks are
                            completely
                            excluded from
                            the final
                            numerator and
                            denominator.
                          </Alert>
                        ) : (
                          <Stack spacing={3}>
                            {(
                              part.sections ||
                              []
                            ).map(
                              (section) => {
                                const totals =
                                  calculateSectionTotals(
                                    section
                                  );

                                return (
                                  <SectionMarks
                                    key={
                                      section._id
                                    }
                                    section={
                                      section
                                    }
                                    totals={
                                      totals
                                    }
                                    answers={
                                      answers
                                    }
                                    awardedMarks={
                                      awardedMarks
                                    }
                                    handleAnswerChange={
                                      handleAnswerChange
                                    }
                                    getQuestionTypeLabel={
                                      getQuestionTypeLabel
                                    }
                                    calculateQuestionMark={
                                      calculateQuestionMark
                                    }
                                  />
                                );
                              }
                            )}
                          </Stack>
                        )}

                        {/* PART TOTAL */}

                        <Box
                          sx={{
                            mt: 2,
                            p: 2,
                            borderRadius: 2,
                            bgcolor:
                              "grey.50",
                          }}
                        >
                          <Stack
                            direction={{
                              xs: "column",
                              sm: "row",
                            }}
                            spacing={2}
                            justifyContent="space-between"
                          >
                            <Typography fontWeight={700}>
                              Part Total
                            </Typography>

                            <Typography fontWeight={700}>
                              {totals.obtained}
                              {" / "}
                              {totals.max}
                              {" • "}
                              {totals.percentage.toFixed(
                                2
                              )}
                              %
                            </Typography>
                          </Stack>
                        </Box>
                      </CardContent>
                    </Card>
                  );
                }
              )}
            </Stack>
          )}

          {/* ==================================================
              DIRECT SECTION MODE
          ================================================== */}

          {!hasParts && (
            <Stack spacing={3}>
              {getSections().map(
                (section) => {
                  const totals =
                    calculateSectionTotals(
                      section
                    );

                  return (
                    <SectionMarks
                      key={
                        section._id
                      }
                      section={
                        section
                      }
                      totals={
                        totals
                      }
                      answers={
                        answers
                      }
                      awardedMarks={
                        awardedMarks
                      }
                      handleAnswerChange={
                        handleAnswerChange
                      }
                      getQuestionTypeLabel={
                        getQuestionTypeLabel
                      }
                      calculateQuestionMark={
                        calculateQuestionMark
                      }
                    />
                  );
                }
              )}
            </Stack>
          )}

          {/* FOOTER */}

          <Card
            sx={{
              mt: 3,
              borderRadius: 3,
              position: "sticky",
              bottom: 16,
              zIndex: 10,
            }}
          >
            <CardContent>
              <Stack
                direction={{
                  xs: "column",
                  sm: "row",
                }}
                spacing={2}
                alignItems={{
                  xs: "stretch",
                  sm: "center",
                }}
                justifyContent="space-between"
              >
                <Box>
                  <Typography
                    variant="h6"
                    fontWeight={700}
                  >
                    Total:
                    {" "}
                    {
                      currentTotals.obtained
                    }
                    {" / "}
                    {
                      currentTotals.max
                    }
                  </Typography>

                  <Typography color="text.secondary">
                    Percentage:
                    {" "}
                    {currentTotals.percentage.toFixed(
                      2
                    )}
                    %
                  </Typography>

                  <Typography
                    variant="caption"
                    color="text.secondary"
                  >
                    Student{" "}
                    {currentStudentIndex +
                      1}
                    {" of "}
                    {students.length}
                  </Typography>
                </Box>

                <Stack
                  direction={{
                    xs: "column",
                    sm: "row",
                  }}
                  spacing={1}
                >
                  <Button
                    variant="outlined"
                    disabled={
                      saving ||
                      isFirstStudent
                    }
                    onClick={
                      handlePreviousStudent
                    }
                  >
                    Previous
                  </Button>

                  {!isLastStudent && (
                    <Button
                      variant="contained"
                      startIcon={
                        saving ? (
                          <CircularProgress
                            size={18}
                            color="inherit"
                          />
                        ) : (
                          <Save />
                        )
                      }
                      disabled={
                        saving ||
                        !allQuestionsAnswered
                      }
                      onClick={
                        handleNextStudent
                      }
                    >
                      {saving
                        ? "Saving..."
                        : "Save & Next"}
                    </Button>
                  )}

                  {isLastStudent && (
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={
                        saving ? (
                          <CircularProgress
                            size={18}
                            color="inherit"
                          />
                        ) : (
                          <CheckCircle />
                        )
                      }
                      disabled={
                        saving ||
                        !allQuestionsAnswered
                      }
                      onClick={
                        handleNextStudent
                      }
                    >
                      {saving
                        ? "Saving..."
                        : "Save & Submit"}
                    </Button>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}

// ============================================================
// SECTION MARKS COMPONENT
// ============================================================

function SectionMarks({
  section,
  totals,
  answers,
  awardedMarks,
  handleAnswerChange,
  getQuestionTypeLabel,
  calculateQuestionMark,
}) {
  return (
    <Card
      sx={{
        borderRadius: 3,
      }}
    >
      <CardContent>
        <Stack
          direction={{
            xs: "column",
            sm: "row",
          }}
          justifyContent="space-between"
          spacing={1}
          mb={2}
        >
          <Box>
            <Typography
              variant="h6"
              fontWeight={700}
            >
              {section.name}
            </Typography>

            {section.description && (
              <Typography
                color="text.secondary"
                variant="body2"
              >
                {section.description}
              </Typography>
            )}
          </Box>

          <Chip
            label={`Section: ${totals.obtained} / ${totals.max}`}
            color="primary"
            variant="outlined"
          />
        </Stack>

        <Divider sx={{ mb: 2 }} />

        <Stack spacing={2}>
          {(section.questions || []).map(
            (question, index) => {
              const selectedAnswer =
                answers[
                  question._id
                ];

              const maxPoints =
                Number(
                  question.maxPoints ||
                    0
                );

              const marks =
                calculateQuestionMark(
                  question
                );

              return (
                <Card
                  key={
                    question._id
                  }
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                  }}
                >
                  <CardContent>
                    <Stack
                      direction={{
                        xs: "column",
                        sm: "row",
                      }}
                      justifyContent="space-between"
                      spacing={1}
                      mb={2}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Typography fontWeight={600}>
                          Q{index + 1}.{" "}
                          {
                            question.questionText
                          }
                        </Typography>

                        <Stack
                          direction="row"
                          spacing={1}
                          mt={1}
                          flexWrap="wrap"
                        >
                          <Chip
                            size="small"
                            label={getQuestionTypeLabel(
                              question.questionType
                            )}
                            color="primary"
                            variant="outlined"
                          />

                          <Chip
                            size="small"
                            label={`Max ${maxPoints}`}
                            color="success"
                            variant="outlined"
                          />

                          {question.isRequired && (
                            <Chip
                              size="small"
                              label="Required"
                              color="error"
                              variant="outlined"
                            />
                          )}
                        </Stack>
                      </Box>

                      {marks !== "" && (
                        <Chip
                          size="small"
                          label={`Marks: ${marks}/${maxPoints}`}
                          color="success"
                        />
                      )}
                    </Stack>

                    {/* YES / NO */}

                    {question.questionType ===
                      "YES_NO" && (
                      <FormControl>
                        <RadioGroup
                          row
                          value={
                            selectedAnswer ||
                            ""
                          }
                          onChange={(event) =>
                            handleAnswerChange(
                              question._id,
                              event.target
                                .value,
                              maxPoints
                            )
                          }
                        >
                          <FormControlLabel
                            value="YES"
                            control={<Radio />}
                            label={`YES (${maxPoints} pts)`}
                          />

                          <FormControlLabel
                            value="NO"
                            control={<Radio />}
                            label="NO (0 pts)"
                          />
                        </RadioGroup>
                      </FormControl>
                    )}

                    {/* TEXT */}

                    {question.questionType ===
                      "TEXT" && (
                      <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        label="Student Answer"
                        value={
                          selectedAnswer ||
                          ""
                        }
                        onChange={(event) =>
                          handleAnswerChange(
                            question._id,
                            event.target
                              .value
                          )
                        }
                      />
                    )}

                    {/* NUMBER */}

                    {question.questionType ===
                      "NUMBER" && (
                      <TextField
                        fullWidth
                        type="number"
                        label="Student Answer"
                        value={
                          selectedAnswer ??
                          ""
                        }
                        onChange={(event) =>
                          handleAnswerChange(
                            question._id,
                            event.target
                              .value
                          )
                        }
                      />
                    )}

                    {/* SINGLE CHOICE */}

                    {question.questionType ===
                      "SINGLE_CHOICE" && (
                      <FormControl fullWidth>
                        <InputLabel>
                          Student Answer
                        </InputLabel>

                        <Select
                          value={
                            selectedAnswer ||
                            ""
                          }
                          label="Student Answer"
                          onChange={(event) =>
                            handleAnswerChange(
                              question._id,
                              event.target
                                .value
                            )
                          }
                        >
                          <MenuItem value="">
                            Select Answer
                          </MenuItem>

                          {(
                            question.options ||
                            []
                          ).map(
                            (
                              option,
                              optionIndex
                            ) => (
                              <MenuItem
                                key={
                                  optionIndex
                                }
                                value={
                                  option
                                }
                              >
                                {option}
                              </MenuItem>
                            )
                          )}
                        </Select>
                      </FormControl>
                    )}

                    {/* MULTIPLE CHOICE */}

                    {question.questionType ===
                      "MULTIPLE_CHOICE" && (
                      <FormControl fullWidth>
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          sx={{
                            mb: 1,
                          }}
                        >
                          Student Answer
                        </Typography>

                        <Stack>
                          {(
                            question.options ||
                            []
                          ).map(
                            (
                              option,
                              optionIndex
                            ) => {
                              const current =
                                Array.isArray(
                                  selectedAnswer
                                )
                                  ? selectedAnswer
                                  : [];

                              const checked =
                                current.includes(
                                  option
                                );

                              return (
                                <FormControlLabel
                                  key={
                                    optionIndex
                                  }
                                  control={
                                    <Checkbox
                                      checked={
                                        checked
                                      }
                                      onChange={(
                                        event
                                      ) => {
                                        const updated =
                                          event
                                            .target
                                            .checked
                                            ? [
                                                ...current,
                                                option,
                                              ]
                                            : current.filter(
                                                (
                                                  item
                                                ) =>
                                                  item !==
                                                  option
                                              );

                                        handleAnswerChange(
                                          question._id,
                                          updated
                                        );
                                      }}
                                    />
                                  }
                                  label={
                                    option
                                  }
                                />
                              );
                            }
                          )}
                        </Stack>
                      </FormControl>
                    )}
                  </CardContent>
                </Card>
              );
            }
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}