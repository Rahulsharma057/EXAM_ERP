"use client";

import React, {
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
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";

import { api } from "../../services/api";

export default function AssessmentForm({
  assessmentId,
  studentId,
  onSubmit,
}) {
  const [assessment, setAssessment] =
    useState(null);

  const [student, setStudent] =
    useState(null);

  const [answers, setAnswers] =
    useState({});

  const [partSelections, setPartSelections] =
    useState({});

  const [activeStep, setActiveStep] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const res =
          await api.getAssessment(
            assessmentId
          );

        const data =
          res?.data || null;

        setAssessment(data);

        if (studentId && data?.batch?._id) {
          const studentsRes =
            await api.getBatchStudents(
              data.batch._id
            );

          const found =
            (studentsRes?.data || []).find(
              (s) =>
                s._id === studentId
            );

          setStudent(found || null);
        }
      } catch (err) {
        console.error(
          "LOAD ASSESSMENT FORM ERROR:",
          err
        );

        setError(
          err?.message ||
            "Failed to load assessment"
        );
      } finally {
        setLoading(false);
      }
    };

    if (assessmentId) {
      load();
    }
  }, [assessmentId, studentId]);

  // ==========================================================
  // HELPERS
  // ==========================================================

  const hasParts = Boolean(
    assessment?.hasParts
  );

  const parts =
    assessment?.parts || [];

  const sections =
    assessment?.sections || [];

  const currentSteps = useMemo(() => {
    if (hasParts) {
      return parts.map(
        (part) => part.name
      );
    }

    return sections.map(
      (section) => section.name
    );
  }, [
    hasParts,
    parts,
    sections,
  ]);

  const currentPart =
    hasParts
      ? parts[activeStep]
      : null;

  const currentSection =
    !hasParts
      ? sections[activeStep]
      : null;

  const currentSections =
    currentPart?.sections || [];

  const isPartAttempted = (
    part
  ) => {
    if (!part?.isOptional) {
      return true;
    }

    const partId =
      part._id;

    if (
      partSelections[partId] !==
      undefined
    ) {
      return Boolean(
        partSelections[partId]
      );
    }

    return true;
  };

  const handlePartSelection = (
    partId,
    attempted
  ) => {
    setPartSelections(
      (prev) => ({
        ...prev,
        [partId]:
          Boolean(attempted),
      })
    );
  };

  const handleAnswer = (
    questionId,
    value
  ) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const isQuestionAnswered = (
    question
  ) => {
    const answer =
      answers[question._id];

    if (
      question.questionType ===
      "YES_NO"
    ) {
      return (
        answer === "YES" ||
        answer === "NO"
      );
    }

    if (
      question.questionType ===
      "MULTIPLE_CHOICE"
    ) {
      return (
        Array.isArray(answer) &&
        answer.length > 0
      );
    }

    return (
      answer !== undefined &&
      answer !== null &&
      String(answer).trim() !== ""
    );
  };

  const getCurrentQuestions = () => {
    if (hasParts) {
      if (!currentPart) return [];

      if (
        currentPart.isOptional &&
        !isPartAttempted(
          currentPart
        )
      ) {
        return [];
      }

      return currentSections.flatMap(
        (section) =>
          section.questions || []
      );
    }

    return currentSection
      ? currentSection.questions ||
          []
      : [];
  };

  const isCurrentStepComplete =
    () => {
      const questions =
        getCurrentQuestions();

      return questions.every(
        (question) => {
          if (
            question.isRequired ===
            false
          ) {
            return true;
          }

          return isQuestionAnswered(
            question
          );
        }
      );
    };

  const isComplete = () => {
    /*
     * PART MODE
     */
    if (hasParts) {
      for (const part of parts) {
        const attempted =
          isPartAttempted(part);

        if (
          part.isOptional &&
          !attempted
        ) {
          continue;
        }

        for (const section of
          part.sections || []) {
          for (const question of
            section.questions || []) {
            if (
              question.isRequired &&
              !isQuestionAnswered(
                question
              )
            ) {
              return false;
            }
          }
        }
      }

      return true;
    }

    /*
     * DIRECT MODE
     */
    for (const section of sections) {
      for (const question of
        section.questions || []) {
        if (
          question.isRequired &&
          !isQuestionAnswered(
            question
          )
        ) {
          return false;
        }
      }
    }

    return true;
  };

  const buildPayload = () => {
    return {
      studentId,
      answers: Object.entries(
        answers
      ).map(
        ([
          questionId,
          answerValue,
        ]) => ({
          questionId,
          answerValue,
        })
      ),
      partSelections:
        Object.entries(
          partSelections
        ).map(
          ([
            partId,
            attempted,
          ]) => ({
            partId,
            attempted:
              Boolean(attempted),
          })
        ),
    };
  };

  // ==========================================================
  // SUBMIT
  // ==========================================================

  const handleSubmit = async () => {
    if (!isComplete()) {
      setError(
        "Please complete all required questions and selected parts."
      );
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const payload =
        buildPayload();

      await api.createSubmission(
        assessmentId,
        payload
      );

      onSubmit?.();
    } catch (err) {
      console.error(
        "SUBMIT ASSESSMENT ERROR:",
        err
      );

      setError(
        err?.message ||
          "Failed to submit assessment"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================================
  // RENDER QUESTION
  // ==========================================================

  const renderQuestion = (
    question,
    index
  ) => {
    const value =
      answers[question._id];

    return (
      <Box
        key={question._id}
        sx={{
          mb: 4,
        }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={600}
        >
          {index + 1}.{" "}
          {question.questionText}

          <Typography
            component="span"
            color="primary"
            sx={{
              ml: 1,
            }}
          >
            ({question.maxPoints} pts)
          </Typography>

          {question.isRequired && (
            <Typography
              component="span"
              color="error"
              sx={{
                ml: 1,
              }}
            >
              *
            </Typography>
          )}
        </Typography>

        {/* YES NO */}

        {question.questionType ===
          "YES_NO" && (
          <FormControl
            sx={{
              mt: 1,
            }}
          >
            <RadioGroup
              row
              value={
                value || ""
              }
              onChange={(e) =>
                handleAnswer(
                  question._id,
                  e.target.value
                )
              }
            >
              <FormControlLabel
                value="YES"
                control={<Radio />}
                label={`Yes (${question.maxPoints} pts)`}
              />

              <FormControlLabel
                value="NO"
                control={<Radio />}
                label="No (0 pts)"
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
            placeholder="Enter answer..."
            value={
              value || ""
            }
            onChange={(e) =>
              handleAnswer(
                question._id,
                e.target.value
              )
            }
            sx={{
              mt: 1,
            }}
          />
        )}

        {/* NUMBER */}

        {question.questionType ===
          "NUMBER" && (
          <TextField
            fullWidth
            type="number"
            placeholder="Enter number..."
            value={
              value ?? ""
            }
            onChange={(e) =>
              handleAnswer(
                question._id,
                e.target.value
              )
            }
            sx={{
              mt: 1,
            }}
          />
        )}

        {/* SINGLE CHOICE */}

        {question.questionType ===
          "SINGLE_CHOICE" && (
          <FormControl
            fullWidth
            sx={{
              mt: 1,
            }}
          >
            <InputLabel>
              Select Answer
            </InputLabel>

            <Select
              value={
                value || ""
              }
              label="Select Answer"
              onChange={(e) =>
                handleAnswer(
                  question._id,
                  e.target.value
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
          <FormControl
            sx={{
              mt: 1,
            }}
          >
            <Stack>
              {(
                question.options ||
                []
              ).map(
                (
                  option,
                  optionIndex
                ) => {
                  const selected =
                    Array.isArray(
                      value
                    )
                      ? value
                      : [];

                  const checked =
                    selected.includes(
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
                            e
                          ) => {
                            const updated =
                              e.target
                                .checked
                                ? [
                                    ...selected,
                                    option,
                                  ]
                                : selected.filter(
                                    (
                                      item
                                    ) =>
                                      item !==
                                      option
                                  );

                            handleAnswer(
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
    );
  };

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent:
            "center",
          p: 5,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!assessment) {
    return (
      <Alert severity="error">
        {error ||
          "Assessment not found"}
      </Alert>
    );
  }

  // ==========================================================
  // MAIN
  // ==========================================================

  return (
    <Box>
      {error && (
        <Alert
          severity="error"
          sx={{
            mb: 2,
          }}
          onClose={() =>
            setError("")
          }
        >
          {error}
        </Alert>
      )}

      {/* HEADER */}

      <Paper
        sx={{
          p: 3,
          mb: 3,
        }}
      >
        <Typography
          variant="h5"
          gutterBottom
        >
          {assessment.name}
        </Typography>

        <Typography
          variant="subtitle1"
          color="text.secondary"
        >
          Week{" "}
          {assessment.weekNumber}
          {" | "}
          {student?.name}
          {" "}
          (
          {student?.rollNumber}
          )
        </Typography>

        <Stack
          direction="row"
          spacing={1}
          sx={{
            mt: 2,
          }}
          flexWrap="wrap"
        >
          <Chip
            size="small"
            label={
              hasParts
                ? "Parts Based Assessment"
                : "Section Based Assessment"
            }
            color="primary"
            variant="outlined"
          />

          {assessment.status && (
            <Chip
              size="small"
              label={
                assessment.status
              }
            />
          )}
        </Stack>
      </Paper>

      {/* STEPPER */}

      {currentSteps.length >
        0 && (
        <Stepper
          activeStep={
            activeStep
          }
          alternativeLabel
          sx={{
            mb: 3,
            overflowX:
              "auto",
          }}
        >
          {currentSteps.map(
            (
              step,
              index
            ) => (
              <Step
                key={`${step}-${index}`}
                completed={
                  index <
                  activeStep
                }
              >
                <StepLabel>
                  {step}
                </StepLabel>
              </Step>
            )
          )}
        </Stepper>
      )}

      {/* PART MODE */}

      {hasParts &&
        currentPart && (
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
                justifyContent="space-between"
                spacing={2}
                mb={2}
              >
                <Box>
                  <Typography
                    variant="h6"
                    fontWeight={700}
                  >
                    {currentPart.name}
                  </Typography>

                  {currentPart.description && (
                    <Typography
                      color="text.secondary"
                      variant="body2"
                    >
                      {
                        currentPart.description
                      }
                    </Typography>
                  )}
                </Box>

                {currentPart.isOptional && (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isPartAttempted(
                          currentPart
                        )}
                        onChange={(e) =>
                          handlePartSelection(
                            currentPart._id,
                            e.target
                              .checked
                          )
                        }
                        disabled={
                          submitting
                        }
                      />
                    }
                    label={
                      isPartAttempted(
                        currentPart
                      )
                        ? "Attempt Part"
                        : "Skip Part"
                    }
                  />
                )}
              </Stack>

              <Divider
                sx={{
                  mb: 3,
                }}
              />

              {!isPartAttempted(
                currentPart
              ) ? (
                <Alert severity="info">
                  You have chosen to
                  skip this optional
                  part. Its marks will
                  not be included in
                  your final percentage.
                </Alert>
              ) : (
                <Stack spacing={3}>
                  {currentSections.map(
                    (section) => (
                      <Card
                        key={
                          section._id
                        }
                        variant="outlined"
                      >
                        <CardContent>
                          <Typography
                            variant="h6"
                            gutterBottom
                          >
                            {
                              section.name
                            }
                          </Typography>

                          {section.description && (
                            <Typography
                              color="text.secondary"
                              variant="body2"
                              sx={{
                                mb: 2,
                              }}
                            >
                              {
                                section.description
                              }
                            </Typography>
                          )}

                          <Divider
                            sx={{
                              mb: 3,
                            }}
                          />

                          {(
                            section.questions ||
                            []
                          ).map(
                            (
                              question,
                              index
                            ) =>
                              renderQuestion(
                                question,
                                index
                              )
                          )}
                        </CardContent>
                      </Card>
                    )
                  )}
                </Stack>
              )}
            </CardContent>
          </Card>
        )}

      {/* DIRECT SECTION MODE */}

      {!hasParts &&
        currentSection && (
          <Card
            sx={{
              mb: 3,
            }}
          >
            <CardContent>
              <Typography
                variant="h6"
                gutterBottom
              >
                {
                  currentSection.name
                }
              </Typography>

              {currentSection.description && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mb: 2,
                  }}
                >
                  {
                    currentSection.description
                  }
                </Typography>
              )}

              <Divider
                sx={{
                  mb: 3,
                }}
              />

              {(
                currentSection.questions ||
                []
              ).map(
                (
                  question,
                  index
                ) =>
                  renderQuestion(
                    question,
                    index
                  )
              )}
            </CardContent>
          </Card>
        )}

      {/* NAVIGATION */}

      <Box
        sx={{
          display: "flex",
          justifyContent:
            "space-between",
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Button
          disabled={
            activeStep === 0 ||
            submitting
          }
          onClick={() =>
            setActiveStep(
              (s) => s - 1
            )
          }
        >
          Back
        </Button>

        <Box>
          {activeStep ===
          currentSteps.length -
            1 ? (
            <Button
              variant="contained"
              color="success"
              disabled={
                submitting ||
                !isCurrentStepComplete() ||
                !isComplete()
              }
              onClick={
                handleSubmit
              }
            >
              {submitting ? (
                <CircularProgress
                  size={24}
                  color="inherit"
                />
              ) : (
                "Submit Assessment"
              )}
            </Button>
          ) : (
            <Button
              variant="contained"
              disabled={
                submitting ||
                !isCurrentStepComplete()
              }
              onClick={() =>
                setActiveStep(
                  (s) => s + 1
                )
              }
            >
              Next
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}