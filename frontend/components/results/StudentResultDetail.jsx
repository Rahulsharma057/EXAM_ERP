'use client';

import React, { useEffect, useMemo, useState } from 'react';

import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Stack,
  LinearProgress,
} from '@mui/material';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import BlockIcon from '@mui/icons-material/Block';
import { api } from '../../services/api';

// ============================================================
// HELPERS
// ============================================================

const round2 = (value) =>
  Math.round((Number(value) || 0) * 100) / 100;

const getPercentage = (obtained, max) => {
  const obtainedValue = Number(obtained) || 0;
  const maxValue = Number(max) || 0;

  if (maxValue <= 0) return 0;

  return round2(
    (obtainedValue / maxValue) * 100
  );
};

/*
 * FIX:
 *
 * The backend never stores a real answerValue for
 * YES_NO questions (it always saves answerValue: "" —
 * see saveStudentMarks in the controller). The true
 * source of truth for a YES_NO answer is awardedScore
 * vs maxPoints, exactly like the marks-entry page derives
 * it for editing.
 *
 * Previously this function only looked at answerValue,
 * so YES_NO rows always displayed "-" in the Answer
 * column even though the Score column showed a correct
 * awardedScore. Now it accepts the full question object
 * and derives YES/NO from the score for that type, and
 * falls back to the raw answerValue for every other type.
 */
const getAnswerDisplay = (question) => {
  const {
    questionType,
    answerValue,
    awardedScore,
    maxPoints,
  } = question || {};

  if (questionType === 'YES_NO') {
    if (
      awardedScore === null ||
      awardedScore === undefined ||
      awardedScore === ''
    ) {
      return '-';
    }

    const max = Number(maxPoints) || 0;

    return Number(awardedScore) === max &&
      max > 0
      ? 'YES'
      : 'NO';
  }

  if (
    answerValue === null ||
    answerValue === undefined ||
    answerValue === ''
  ) {
    return '-';
  }

  if (typeof answerValue === 'object') {
    try {
      return JSON.stringify(answerValue);
    } catch {
      return '-';
    }
  }

  return String(answerValue);
};

const getScoreColor = (
  awardedScore,
  maxPoints
) => {
  const score = Number(awardedScore) || 0;
  const max = Number(maxPoints) || 0;

  if (score <= 0) return 'error';

  if (max > 0 && score >= max) {
    return 'success';
  }

  return 'warning';
};

// ============================================================
// COMPONENT
// ============================================================

export default function StudentResultDetail({
  assessmentId,
  studentId,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ==========================================================
  // LOAD
  // ==========================================================

  useEffect(() => {
    let mounted = true;

    const loadResult = async () => {
      try {
        setLoading(true);
        setError('');

        const res =
          await api.getStudentSectionResults(
            assessmentId,
            studentId
          );

        if (!mounted) return;

        setData(res?.data || null);
      } catch (err) {
        console.error(
          'GET STUDENT RESULT ERROR:',
          err
        );

        if (!mounted) return;

        setError(
          err?.message ||
            'Failed to load student result'
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    if (assessmentId && studentId) {
      loadResult();
    }

    return () => {
      mounted = false;
    };
  }, [assessmentId, studentId]);

  // ==========================================================
  // NORMALIZE STRUCTURE
  // ==========================================================

  const hasParts = useMemo(() => {
    if (!data) return false;

    if (data.assessment?.hasParts) {
      return true;
    }

    if (
      Array.isArray(data.parts) &&
      data.parts.length > 0
    ) {
      return true;
    }

    return false;
  }, [data]);

  /*
   * Backend may return:
   *
   * 1. New structure:
   *    parts -> sections -> questions
   *
   * 2. Direct structure:
   *    sections -> questions
   *
   * We normalize it here only for rendering.
   * Scores still come from backend.
   */

  const parts = useMemo(() => {
    if (!data) return [];

    if (
      Array.isArray(data.parts) &&
      data.parts.length > 0
    ) {
      return data.parts;
    }

    return [];
  }, [data]);

  const sections = useMemo(() => {
    if (!data) return [];

    if (
      Array.isArray(data.sections)
    ) {
      return data.sections;
    }

    return [];
  }, [data]);

  /*
   * FIX: Rules of Hooks — these two useMemo calls used to
   * live below the loading/error/no-data early returns, so
   * they were skipped entirely on those renders and only
   * called once data existed. React detected a different
   * number of hooks between renders ("Rendered more hooks
   * than during the previous render"). Moved above every
   * early return and guarded with `data?.` so they run on
   * every render, in the same order, no matter what.
   */

  // ==========================================================
  // PART SCORE MAP
  // ==========================================================

  const partScoreMap = useMemo(() => {
    const map = new Map();

    const scoreList =
      Array.isArray(data?.partScores)
        ? data.partScores
        : [];

    scoreList.forEach((score) => {
      const id =
        score?.partId ||
        score?._id;

      if (id) {
        map.set(
          String(id),
          score
        );
      }
    });

    return map;
  }, [data]);

  // ==========================================================
  // SECTION SCORE MAP
  // ==========================================================

  const sectionScoreMap = useMemo(() => {
    const map = new Map();

    const scoreList =
      Array.isArray(
        data?.sectionScores
      )
        ? data.sectionScores
        : [];

    scoreList.forEach((score) => {
      const id =
        score?.sectionId ||
        score?._id;

      if (id) {
        map.set(
          String(id),
          score
        );
      }
    });

    return map;
  }, [data]);

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          py: 6,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // ==========================================================
  // ERROR
  // ==========================================================

  if (error) {
    return (
      <Alert
        severity="error"
        sx={{ my: 2 }}
      >
        {error}
      </Alert>
    );
  }

  // ==========================================================
  // NO DATA
  // ==========================================================

  if (!data) {
    return (
      <Alert
        severity="info"
        sx={{ my: 2 }}
      >
        No result data available.
      </Alert>
    );
  }

  // ==========================================================
  // STATUS
  // ==========================================================

  const status =
    String(data.status || '')
      .toUpperCase();

  const isPending =
    status === 'PENDING' ||
    status === 'NOT_ATTEMPTED';

  const isCompleted =
    status === 'COMPLETED';

  // ==========================================================
  // STUDENT INFO
  // ==========================================================

  const studentName =
    data.student?.name ||
    data.student?.fullName ||
    'Unknown Student';

  const rollNumber =
    data.student?.rollNumber ||
    data.student?.rollNo ||
    'N/A';

  const assessment =
    data.assessment || {};

  // ==========================================================
  // BACKEND TOTALS
  // ==========================================================

  const totalObtained =
    Number(data.totalObtained) || 0;

  const totalMax =
    Number(data.totalMax) || 0;

  const overallPercentage =
    data.overallPercentage !==
      undefined &&
    data.overallPercentage !== null
      ? round2(
          data.overallPercentage
        )
      : getPercentage(
          totalObtained,
          totalMax
        );

  // ==========================================================
  // RENDER STUDENT HEADER
  // ==========================================================

  const StudentHeader = () => (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <Stack
        direction={{
          xs: 'column',
          sm: 'row',
        }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{
          xs: 'flex-start',
          sm: 'center',
        }}
      >
        <Box>
          <Typography
            variant="h6"
            fontWeight={700}
          >
            {studentName}
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
          >
            Roll Number: {rollNumber}
          </Typography>
        </Box>

        <Chip
          icon={
            isCompleted ? (
              <CheckCircleIcon />
            ) : (
              <PendingActionsIcon />
            )
          }
          label={
            isCompleted
              ? 'Assessment Completed'
              : 'Assessment Pending'
          }
          color={
            isCompleted
              ? 'success'
              : 'warning'
          }
          sx={{
            fontWeight: 600,
          }}
        />
      </Stack>
    </Paper>
  );

  // ==========================================================
  // PENDING RESULT
  // ==========================================================

  if (isPending) {
    return (
      <Box sx={{ py: 1 }}>
        <StudentHeader />

        <Paper
          sx={{
            p: {
              xs: 3,
              sm: 5,
            },
            mb: 2,
            textAlign: 'center',
            borderRadius: 3,
            border: '1px dashed',
            borderColor:
              'warning.main',
            bgcolor:
              'warning.50',
          }}
        >
          <PendingActionsIcon
            sx={{
              fontSize: 64,
              color: 'warning.main',
              mb: 1,
            }}
          />

          <Typography
            variant="h5"
            fontWeight={700}
            gutterBottom
          >
            Assessment Not Completed
          </Typography>

          <Typography
            variant="body1"
            color="text.secondary"
            sx={{
              maxWidth: 600,
              mx: 'auto',
            }}
          >
            This student has not completed
            this assessment yet. Marks and
            question-wise results are not
            available.
          </Typography>

          <Chip
            label="PENDING"
            color="warning"
            sx={{
              mt: 2,
              fontWeight: 700,
            }}
          />
        </Paper>

        {/* ====================================================
            ASSESSMENT INFORMATION
        ===================================================== */}

        <Paper
          sx={{
            p: 2,
            mb: 2,
            borderRadius: 2,
          }}
        >
          <Typography
            variant="subtitle1"
            fontWeight={700}
            gutterBottom
          >
            Assessment Information
          </Typography>

          <Divider sx={{ mb: 2 }} />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
              },
              gap: 2,
            }}
          >
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
              >
                Assessment
              </Typography>

              <Typography fontWeight={600}>
                {assessment.name ||
                  'N/A'}
              </Typography>
            </Box>

            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
              >
                Assessment Code
              </Typography>

              <Typography fontWeight={600}>
                {assessment.code ||
                  'N/A'}
              </Typography>
            </Box>

            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
              >
                Structure
              </Typography>

              <Typography fontWeight={600}>
                {hasParts
                  ? 'Parts → Sections → Questions'
                  : 'Sections → Questions'}
              </Typography>
            </Box>

            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
              >
                Total Questions
              </Typography>

              <Typography fontWeight={600}>
                {assessment.totalQuestions ||
                  data.totalQuestions ||
                  0}
              </Typography>
            </Box>

            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
              >
                Total Marks
              </Typography>

              <Typography fontWeight={600}>
                {totalMax}
              </Typography>
            </Box>

            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
              >
                Status
              </Typography>

              <Box sx={{ mt: 0.5 }}>
                <Chip
                  size="small"
                  label="Not Attempted"
                  color="warning"
                />
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* ====================================================
            PENDING PART STRUCTURE
        ===================================================== */}

        {hasParts &&
          parts.length > 0 && (
            <Paper
              sx={{
                p: 2,
                mb: 2,
                borderRadius: 2,
              }}
            >
              <Typography
                variant="subtitle1"
                fontWeight={700}
                gutterBottom
              >
                Assessment Parts
              </Typography>

              <Divider sx={{ mb: 1 }} />

              {parts.map(
                (part, index) => (
                  <Box
                    key={
                      part._id ||
                      part.partId ||
                      `part-${index}`
                    }
                    sx={{
                      py: 1.5,
                      display: 'flex',
                      justifyContent:
                        'space-between',
                      alignItems: {
                        xs: 'flex-start',
                        sm: 'center',
                      },
                      flexDirection: {
                        xs: 'column',
                        sm: 'row',
                      },
                      gap: 1,
                    }}
                  >
                    <Box>
                      <Typography
                        fontWeight={600}
                      >
                        {part.name ||
                          part.partName ||
                          `Part ${index + 1}`}
                      </Typography>

                      <Typography
                        variant="body2"
                        color="text.secondary"
                      >
                        {part.isOptional
                          ? 'Optional Part'
                          : 'Required Part'}
                      </Typography>
                    </Box>

                    <Chip
                      size="small"
                      label={`${Number(part.totalMarks) || 0} Marks`}
                      variant="outlined"
                    />
                  </Box>
                )
              )}
            </Paper>
          )}

        {/* ====================================================
            PENDING OVERALL
        ===================================================== */}

        <Paper
          sx={{
            p: 2.5,
            borderRadius: 2,
            bgcolor: 'grey.100',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent:
                'space-between',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Box>
              <Typography
                variant="subtitle1"
                fontWeight={700}
              >
                Overall Result
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
              >
                Result will be available
                after the assessment is
                completed.
              </Typography>
            </Box>

            <Box
              sx={{
                textAlign: 'right',
              }}
            >
              <Typography
                variant="h6"
                fontWeight={700}
              >
                0/{totalMax}
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
              >
                0%
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    );
  }

  // ==========================================================
  // SECTION RENDERER
  // ==========================================================

  const renderSection = (
    section,
    index,
    inheritedPart = null
  ) => {
    const sectionId =
      section?.sectionId ||
      section?._id ||
      `section-${index}`;

    const scoreFromBackend =
      sectionScoreMap.get(
        String(sectionId)
      );

    const obtained =
      scoreFromBackend?.obtainedMarks ??
      scoreFromBackend?.obtained ??
      section?.obtained ??
      0;

    const max =
      scoreFromBackend?.maxMarks ??
      scoreFromBackend?.max ??
      section?.max ??
      section?.totalMarks ??
      0;

    const percentage =
      scoreFromBackend?.percentage ??
      section?.percentage ??
      getPercentage(
        obtained,
        max
      );

    return (
      <Paper
        key={sectionId}
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        {/* Section Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent:
              'space-between',
            alignItems: {
              xs: 'flex-start',
              sm: 'center',
            },
            flexDirection: {
              xs: 'column',
              sm: 'row',
            },
            gap: 1,
            mb: 1,
          }}
        >
          <Box>
            <Typography
              variant="subtitle1"
              fontWeight="bold"
            >
              {section.sectionName ||
                section.name ||
                `Section ${index + 1}`}
            </Typography>

            {section.description && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.25 }}
              >
                {section.description}
              </Typography>
            )}
          </Box>

          <Chip
            label={`${obtained}/${max} (${percentage}%)`}
            color="primary"
          />
        </Box>

        <Divider sx={{ mb: 1 }} />

        {/* Section Progress */}
        <Box sx={{ mb: 2 }}>
          <LinearProgress
            variant="determinate"
            value={Math.min(
              100,
              Number(percentage) || 0
            )}
            sx={{
              height: 7,
              borderRadius: 10,
            }}
          />
        </Box>

        {/* Questions */}
        {Array.isArray(
          section.questions
        ) &&
        section.questions.length > 0 ? (
          <TableContainer>
            <Table
              size="small"
              sx={{
                minWidth: 650,
              }}
            >
              <TableHead>
                <TableRow>
                  <TableCell>
                    Question
                  </TableCell>

                  <TableCell align="center">
                    Max
                  </TableCell>

                  <TableCell align="center">
                    Answer
                  </TableCell>

                  <TableCell align="center">
                    Score
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {section.questions.map(
                  (q, qIndex) => {
                    const qScore =
                      Number(
                        q.awardedScore
                      ) || 0;

                    const qMax =
                      Number(
                        q.maxPoints
                      ) || 0;

                    return (
                      <TableRow
                        key={
                          q.questionId ||
                          q._id ||
                          `q-${qIndex}`
                        }
                        hover
                      >
                        <TableCell>
                          <Typography
                            variant="body2"
                            fontWeight={500}
                          >
                            {q.questionText ||
                              `Question ${qIndex + 1}`}
                          </Typography>

                          {q.questionType && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {q.questionType}
                            </Typography>
                          )}
                        </TableCell>

                        <TableCell align="center">
                          {qMax}
                        </TableCell>

                        <TableCell
                          align="center"
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              wordBreak:
                                'break-word',
                            }}
                          >
                            {getAnswerDisplay(
                              q
                            )}
                          </Typography>
                        </TableCell>

                        <TableCell
                          align="center"
                        >
                          <Chip
                            size="small"
                            label={`${qScore}/${qMax}`}
                            color={getScoreColor(
                              qScore,
                              qMax
                            )}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  }
                )}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Alert severity="info">
            No question-wise result
            available for this section.
          </Alert>
        )}
      </Paper>
    );
  };

  // ==========================================================
  // COMPLETED RESULT
  // ==========================================================

  return (
    <Box>
      <StudentHeader />

      {/* ====================================================
          PART-WISE RESULT
      ===================================================== */}

      {hasParts &&
        parts.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="h6"
              fontWeight={700}
              sx={{ mb: 1.5 }}
            >
              Part-wise Result
            </Typography>

            {parts.map(
              (part, partIndex) => {
                const partId =
                  part?.partId ||
                  part?._id ||
                  `part-${partIndex}`;

                const backendPartScore =
                  partScoreMap.get(
                    String(partId)
                  );

                const attempted =
                  backendPartScore?.attempted ??
                  part?.attempted ??
                  true;

                const skipped =
                  part?.isOptional &&
                  attempted === false;

                const obtained =
                  backendPartScore?.obtainedMarks ??
                  backendPartScore?.obtained ??
                  part?.obtained ??
                  0;

                const max =
                  backendPartScore?.maxMarks ??
                  backendPartScore?.max ??
                  part?.max ??
                  part?.totalMarks ??
                  0;

                const percentage =
                  backendPartScore?.percentage ??
                  part?.percentage ??
                  getPercentage(
                    obtained,
                    max
                  );

                /*
                 * Important:
                 *
                 * Optional skipped part has:
                 * obtained = 0
                 * max = 0
                 *
                 * It is therefore excluded from
                 * the denominator.
                 */

                return (
                  <Paper
                    key={partId}
                    sx={{
                      p: 2,
                      mb: 2,
                      borderRadius: 3,
                      border: '1px solid',
                      borderColor:
                        skipped
                          ? 'warning.light'
                          : 'divider',
                    }}
                  >
                    <Stack
                      direction={{
                        xs: 'column',
                        sm: 'row',
                      }}
                      spacing={2}
                      justifyContent="space-between"
                      alignItems={{
                        xs: 'flex-start',
                        sm: 'center',
                      }}
                    >
                      <Box>
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          flexWrap="wrap"
                        >
                          <Typography
                            variant="subtitle1"
                            fontWeight={700}
                          >
                            {part.name ||
                              part.partName ||
                              `Part ${partIndex + 1}`}
                          </Typography>

                          {part.isOptional && (
                            <Chip
                              size="small"
                              label="Optional"
                              color="warning"
                              variant="outlined"
                            />
                          )}

                          {skipped && (
                            <Chip
                              size="small"
                              icon={
                                <BlockIcon />
                              }
                              label="Skipped"
                              color="warning"
                            />
                          )}
                        </Stack>

                        {part.description && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 0.5 }}
                          >
                            {part.description}
                          </Typography>
                        )}
                      </Box>

                      <Box
                        sx={{
                          textAlign: {
                            xs: 'left',
                            sm: 'right',
                          },
                        }}
                      >
                        <Typography
                          variant="h6"
                          fontWeight={800}
                        >
                          {obtained}/{max}
                        </Typography>

                        <Typography
                          variant="body2"
                          color="text.secondary"
                        >
                          {percentage}%
                        </Typography>
                      </Box>
                    </Stack>

                    <Box sx={{ mt: 1.5 }}>
                      {skipped ? (
                        <Alert
                          severity="warning"
                          icon={
                            <BlockIcon />
                          }
                        >
                          This optional part
                          was skipped. Its
                          marks are excluded
                          from the overall
                          denominator.
                        </Alert>
                      ) : (
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(
                            100,
                            Number(
                              percentage
                            ) || 0
                          )}
                          sx={{
                            height: 7,
                            borderRadius: 10,
                          }}
                        />
                      )}
                    </Box>
                  </Paper>
                );
              }
            )}
          </Box>
        )}

      {/* ====================================================
          SECTION-WISE RESULT
      ===================================================== */}

      <Typography
        variant="h6"
        fontWeight={700}
        sx={{ mb: 1.5 }}
      >
        Section-wise Result
      </Typography>

      {/* ====================================================
          PART MODE
      ===================================================== */}

      {hasParts ? (
        parts.map(
          (part, partIndex) => {
            const partId =
              part?.partId ||
              part?._id ||
              `part-${partIndex}`;

            const backendPartScore =
              partScoreMap.get(
                String(partId)
              );

            const attempted =
              backendPartScore?.attempted ??
              part?.attempted ??
              true;

            const skipped =
              part?.isOptional &&
              attempted === false;

            const partSections =
              Array.isArray(
                part.sections
              )
                ? part.sections
                : [];

            /*
             * Some backend responses may
             * return all sections at root
             * with partId instead of nesting.
             */
            const fallbackSections =
              sections.filter(
                (section) =>
                  String(
                    section?.partId ||
                      section?.part?._id ||
                      section?.part
                  ) ===
                  String(partId)
              );

            const sectionsToRender =
              partSections.length > 0
                ? partSections
                : fallbackSections;

            return (
              <Box
                key={partId}
                sx={{ mb: 3 }}
              >
                <Paper
                  sx={{
                    p: 2,
                    mb: 1.5,
                    borderRadius: 3,
                    bgcolor: skipped
                      ? 'warning.50'
                      : 'grey.50',
                    border: '1px solid',
                    borderColor:
                      skipped
                        ? 'warning.light'
                        : 'divider',
                  }}
                >
                  <Stack
                    direction={{
                      xs: 'column',
                      sm: 'row',
                    }}
                    justifyContent="space-between"
                    alignItems={{
                      xs: 'flex-start',
                      sm: 'center',
                    }}
                    gap={1}
                  >
                    <Box>
                      <Typography
                        variant="h6"
                        fontWeight={800}
                      >
                        {part.name ||
                          part.partName ||
                          `Part ${partIndex + 1}`}
                      </Typography>

                      {part.isOptional && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                        >
                          Optional Part
                          {skipped
                            ? ' • Skipped'
                            : ' • Attempted'}
                        </Typography>
                      )}
                    </Box>

                    {skipped && (
                      <Chip
                        icon={
                          <BlockIcon />
                        }
                        label="Skipped"
                        color="warning"
                      />
                    )}
                  </Stack>
                </Paper>

                {skipped ? (
                  <Alert
                    severity="warning"
                    sx={{ mb: 2 }}
                  >
                    This optional part was
                    skipped by the student.
                    Questions and marks from
                    this part are excluded from
                    the final score.
                  </Alert>
                ) : sectionsToRender.length >
                  0 ? (
                  sectionsToRender.map(
                    (section, sectionIndex) =>
                      renderSection(
                        section,
                        sectionIndex,
                        part
                      )
                  )
                ) : (
                  <Alert severity="info">
                    No sections found in this
                    part.
                  </Alert>
                )}
              </Box>
            );
          }
        )
      ) : (
        /* ====================================================
           DIRECT SECTION MODE
        ===================================================== */

        <>
          {sections.length > 0 ? (
            sections.map(
              (section, index) =>
                renderSection(
                  section,
                  index
                )
            )
          ) : (
            <Alert severity="info">
              No sections found in this
              assessment.
            </Alert>
          )}
        </>
      )}

      {/* ====================================================
          OVERALL RESULT
      ===================================================== */}

      <Paper
        sx={{
          p: {
            xs: 2,
            sm: 2.5,
          },
          mt: 2,
          bgcolor: 'primary.main',
          color: 'white',
          borderRadius: 3,
        }}
      >
        <Stack
          direction={{
            xs: 'column',
            sm: 'row',
          }}
          justifyContent="space-between"
          alignItems={{
            xs: 'flex-start',
            sm: 'center',
          }}
          gap={2}
        >
          <Box>
            <Typography
              variant="h6"
              fontWeight={800}
            >
              Overall Result
            </Typography>

            <Typography
              variant="body2"
              sx={{
                opacity: 0.9,
              }}
            >
              Backend calculated final
              score
            </Typography>
          </Box>

          <Box
            sx={{
              textAlign: {
                xs: 'left',
                sm: 'right',
              },
            }}
          >
            <Typography
              variant="h5"
              fontWeight={800}
            >
              {totalObtained}/{totalMax}
            </Typography>

            <Typography
              variant="body1"
              fontWeight={600}
            >
              {overallPercentage}%
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}