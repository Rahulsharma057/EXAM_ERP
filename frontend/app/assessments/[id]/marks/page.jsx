
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
  Divider,
  CircularProgress,
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

  const assessmentId = params.id;

  // ==========================================================
  // STATE
  // ==========================================================

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
   * answers:
   *
   * {
   *   questionId: "YES",
   *   questionId2: "Option A",
   *   questionId3: ["Option A", "Option B"]
   * }
   */
  const [answers, setAnswers] = useState({});

  /*
   * awardedMarks:
   *
   * {
   *   questionId: 1,
   *   questionId2: 0
   * }
   */
  const [awardedMarks, setAwardedMarks] =
    useState({});

  const [assessmentSubmitted, setAssessmentSubmitted] =
    useState(false);

  // ==========================================================
  // LOAD STUDENTS
  // ==========================================================

  const loadStudents = async () => {
    try {
      setLoading(true);
      setError("");

      const response =
        await api.getAssessmentStudentsForMarks(
          assessmentId
        );

      const data = response?.data || {};

      setAssessment(data.assessment || null);
      setStudents(data.students || []);
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

  const loadStudentMarks = async (studentId) => {
    if (!studentId) {
      setMarksData(null);
      setAnswers({});
      setAwardedMarks({});
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

      const data = response?.data || {};

      setMarksData(data);

      const initialAnswers = {};
      const initialMarks = {};

      /*
       * Load previously saved answers and marks
       */

      (data.sections || []).forEach(
        (section) => {
          (section.questions || []).forEach(
            (question) => {
              /*
               * Existing awarded marks
               */

              if (
                question.awardedScore !== null &&
                question.awardedScore !== undefined
              ) {
                initialMarks[question._id] =
                  Number(
                    question.awardedScore
                  );
              }

              /*
               * Existing answer
               */

              if (
                question.answerValue !== null &&
                question.answerValue !== undefined
              ) {
                initialAnswers[question._id] =
                  question.answerValue;
              }

              /*
               * Backward compatibility:
               *
               * If YES_NO question does not have
               * answerValue but has marks:
               */

              if (
                question.questionType ===
                  "YES_NO" &&
                initialAnswers[question._id] ===
                  undefined &&
                question.awardedScore !==
                  null &&
                question.awardedScore !==
                  undefined
              ) {
                const maxPoints = Number(
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
            }
          );
        }
      );

      setAnswers(initialAnswers);
      setAwardedMarks(initialMarks);
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

  const handleStudentChange = async (event) => {
    const studentId = event.target.value;

    setSelectedStudentId(studentId);

    await loadStudentMarks(studentId);
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

    // YES = full marks, NO = zero marks.
    // Teacher does not need to enter awarded marks manually.
    if (maxPoints !== null) {
      setAwardedMarks((prev) => ({
        ...prev,
        [questionId]:
          String(value).toUpperCase() === "YES"
            ? Number(maxPoints)
            : String(value).toUpperCase() === "NO"
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

  const getQuestionTypeLabel = (type) => {
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

    (marksData.sections || []).forEach(
      (section) => {
        (section.questions || []).forEach(
          (question) => {
            const maxPoints = Number(
              question.maxPoints || 0
            );

            max += maxPoints;

            const marks =
              awardedMarks[question._id];

            if (
              marks !== undefined &&
              marks !== null &&
              marks !== ""
            ) {
              obtained += Number(marks);
            }
          }
        );
      }
    );

    return {
      obtained,
      max,
      percentage:
        max > 0
          ? (obtained / max) * 100
          : 0,
    };
  }, [marksData, awardedMarks]);

  // ==========================================================
  // CHECK ALL QUESTIONS MARKED
  // ==========================================================

  const allQuestionsAnswered = useMemo(() => {
    if (!marksData) return false;

    const questions = [];

    (marksData.sections || []).forEach(
      (section) => {
        (section.questions || []).forEach(
          (question) => {
            questions.push(question);
          }
        );
      }
    );

    if (questions.length === 0) {
      return false;
    }

    return questions.every((question) => {
      const marks =
        awardedMarks[question._id];

      return (
        marks !== undefined &&
        marks !== null &&
        marks !== "" &&
        Number(marks) >= 0 &&
        Number(marks) <=
          Number(question.maxPoints || 0)
      );
    });
  }, [marksData, awardedMarks]);

  // ==========================================================
  // CURRENT STUDENT INDEX
  // ==========================================================

  const currentStudentIndex =
    students.findIndex(
      (student) =>
        student._id === selectedStudentId
    );

  const isLastStudent =
    currentStudentIndex ===
    students.length - 1;

  const isFirstStudent =
    currentStudentIndex <= 0;

  // ==========================================================
  // SAVE CURRENT STUDENT
  // ==========================================================

  const saveCurrentStudentMarks = async () => {
    if (!selectedStudentId) {
      setError("Please select a student");
      return false;
    }

    if (!marksData) {
      setError(
        "Student marks data not loaded"
      );
      return false;
    }

    const markPayload = [];

    for (
      const section of
        marksData.sections || []
    ) {
      for (
        const question of
          section.questions || []
      ) {
        const marks =
          awardedMarks[question._id];

        if (
          marks === undefined ||
          marks === null ||
          marks === ""
        ) {
          setError(
            `Please enter marks for: ${question.questionText}`
          );

          return false;
        }

        const numericMarks =
          Number(marks);

        const maxPoints = Number(
          question.maxPoints || 0
        );

        if (
          Number.isNaN(numericMarks) ||
          numericMarks < 0 ||
          numericMarks > maxPoints
        ) {
          setError(
            `Invalid marks for: ${question.questionText}. Maximum marks are ${maxPoints}.`
          );

          return false;
        }

        markPayload.push({
          questionId: question._id,
          awardedScore: numericMarks,
        });
      }
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response =
        await api.saveStudentMarks(
          assessmentId,
          selectedStudentId,
          markPayload
        );

      setSuccess(
        response?.message ||
          "Marks saved successfully"
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

  const handleNextStudent = async () => {
    if (!selectedStudentId) {
      setError("Please select a student");
      return;
    }

    const saved =
      await saveCurrentStudentMarks();

    if (!saved) {
      return;
    }

    if (isLastStudent) {
      setAssessmentSubmitted(true);
      setSuccess("");
      return;
    }

    const nextStudent =
      students[currentStudentIndex + 1];

    if (!nextStudent) {
      return;
    }

    setSelectedStudentId(
      nextStudent._id
    );

    await loadStudentMarks(
      nextStudent._id
    );
  };

  // ==========================================================
  // PREVIOUS STUDENT
  // ==========================================================

  const handlePreviousStudent = async () => {
    if (currentStudentIndex <= 0) {
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

  const handleRefresh = async () => {
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
  // COMPLETED SCREEN
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
                Week {assessment.weekNumber}
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

      {/* ======================================================
          HEADER
      ====================================================== */}

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
              Week {assessment.weekNumber}
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

      {/* ======================================================
          ALERTS
      ====================================================== */}

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

      {/* ======================================================
          STUDENT SELECTOR
      ====================================================== */}

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

      {/* ======================================================
          NO STUDENT
      ====================================================== */}

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
              Select a student from the assessment
              batch to enter question-wise marks.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* ======================================================
          MARKS FORM
      ====================================================== */}

      {marksData && (
        <>
          {/* ==================================================
              STUDENT INFO
          ================================================== */}

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
                    {currentTotals.obtained}
                    {" / "}
                    {currentTotals.max}
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
                    {currentStudentIndex + 1}
                    {" / "}
                    {students.length}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>

          {/* ==================================================
              SECTIONS
          ================================================== */}

          <Stack spacing={3}>
            {marksData.sections?.map(
              (section) => {

                const sectionObtained =
                  section.questions.reduce(
                    (
                      total,
                      question
                    ) => {
                      const marks =
                        awardedMarks[
                          question._id
                        ];

                      if (
                        marks !== undefined &&
                        marks !== null &&
                        marks !== ""
                      ) {
                        return (
                          total +
                          Number(marks)
                        );
                      }

                      return total;
                    },
                    0
                  );

                const sectionMax =
                  section.questions.reduce(
                    (
                      total,
                      question
                    ) =>
                      total +
                      Number(
                        question.maxPoints ||
                          0
                      ),
                    0
                  );

                return (
                  <Card
                    key={
                      section._id
                    }
                    sx={{
                      borderRadius: 3,
                    }}
                  >
                    <CardContent>

                      {/* SECTION HEADER */}

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
                              {
                                section.description
                              }
                            </Typography>
                          )}
                        </Box>

                        <Chip
                          label={`Section: ${sectionObtained} / ${sectionMax}`}
                          color="primary"
                          variant="outlined"
                        />
                      </Stack>

                      <Divider
                        sx={{ mb: 2 }}
                      />

                      {/* QUESTIONS */}

                      <Stack spacing={2}>
                        {section.questions.map(
                          (
                            question,
                            index
                          ) => {

                            const selectedAnswer =
                              answers[
                                question._id
                              ];

                            const marks =
                              awardedMarks[
                                question._id
                              ];

                            const maxPoints =
                              Number(
                                question.maxPoints ||
                                  0
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

                                  {/* QUESTION HEADER */}

                                  <Stack
                                    direction={{
                                      xs: "column",
                                      sm: "row",
                                    }}
                                    justifyContent="space-between"
                                    spacing={1}
                                    mb={2}
                                  >
                                    <Box
                                      sx={{
                                        flex: 1,
                                      }}
                                    >
                                      <Typography
                                        fontWeight={600}
                                      >
                                        Q
                                        {index +
                                          1}
                                        .{" "}
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
                                  </Stack>

                                  {/* =================================
                                      ANSWER INPUT
                                  ================================= */}

                                  <Box
                                    sx={{
                                      mb: 2,
                                    }}
                                  >

                                    {/* YES / NO */}

                                    {question.questionType ===
                                      "YES_NO" && (
                                      <FormControl>
                                       {/*  <Typography
                                          variant="body2"
                                          fontWeight={600}
                                          sx={{
                                            mb: 1,
                                          }}
                                        >
                                          Student Answer
                                        </Typography> */}

                                        <RadioGroup
                                          row
                                          value={
                                            selectedAnswer ||
                                            ""
                                          }
                                          onChange={(
                                            event
                                          ) =>
                                            handleAnswerChange(
                                              question._id,
                                              event.target.value,
                                              maxPoints
                                            )
                                          }
                                        >
                                          <FormControlLabel
                                            value="YES"
                                            control={
                                              <Radio />
                                            }
                                            label="YES"
                                          />

                                          <FormControlLabel
                                            value="NO"
                                            control={
                                              <Radio />
                                            }
                                            label="NO"
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
                                        onChange={(
                                          event
                                        ) =>
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
                                        onChange={(
                                          event
                                        ) =>
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
                                          onChange={(
                                            event
                                          ) =>
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

                                  </Box>

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
            )}
          </Stack>

          {/* ==================================================
              FOOTER
          ================================================== */}

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

                {/* TOTAL */}

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

                {/* ACTIONS */}

                <Stack
                  direction={{
                    xs: "column",
                    sm: "row",
                  }}
                  spacing={1}
                >

                  {/* PREVIOUS */}

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

                  {/* SAVE & NEXT */}

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

                  {/* LAST */}

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

