
'use client';

import React, { useMemo } from 'react';

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Typography,
  Box,
  Stack,
  Tooltip,
  Alert,
} from '@mui/material';

import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import BlockIcon from '@mui/icons-material/Block';

// ============================================================
// HELPERS
// ============================================================

const getId = (value) => {
  if (!value) return null;

  if (typeof value === 'object') {
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

const round2 = (value) =>
  Math.round((Number(value) || 0) * 100) / 100;

// ============================================================
// COMPONENT
// ============================================================

export default function ResultsTable({
  results = [],
  sections = [],
  parts = [],
  hasParts = false,
  assessment = {},
  onViewStudent,
}) {
  // ==========================================================
  // NORMALIZE
  // ==========================================================

  const safeResults = Array.isArray(results)
    ? results
    : [];

  const safeSections = Array.isArray(sections)
    ? sections
    : [];

  const safeParts = Array.isArray(parts)
    ? parts
    : [];

  /*
   * Backend may return hasParts or
   * parts array.
   */
  const partsMode =
    Boolean(hasParts) ||
    Boolean(assessment?.hasParts) ||
    safeParts.length > 0;

  // ==========================================================
  // SECTION COLUMNS
  // ==========================================================

  /*
   * For Direct Sections mode:
   *
   * Assessment
   *    └── Section
   *
   * For Parts mode:
   *
   * Assessment
   *    └── Part
   *          └── Section
   *
   * We create section columns from
   * the parts structure.
   */

  const sectionColumns = useMemo(() => {
    if (!partsMode) {
      return safeSections.map(
        (section, index) => ({
          id:
            section?._id ||
            section?.sectionId ||
            `section-${index}`,

          name:
            section?.name ||
            section?.sectionName ||
            `Section ${index + 1}`,

          partId: null,

          partName: null,

          isOptionalPart: false,
        })
      );
    }

    const columns = [];

    safeParts.forEach(
      (part, partIndex) => {
        const partId =
          part?._id ||
          part?.partId ||
          `part-${partIndex}`;

        /*
         * Some API responses contain:
         *
         * part.sections
         *
         * while others may return
         * sections at root level with partId.
         */

        let partSections = Array.isArray(
          part?.sections
        )
          ? part.sections
          : [];

        if (
          partSections.length === 0 &&
          safeSections.length > 0
        ) {
          partSections =
            safeSections.filter(
              (section) =>
                sameId(
                  section?.partId ||
                    section?.part,
                  partId
                )
            );
        }

        partSections.forEach(
          (section, sectionIndex) => {
            columns.push({
              id:
                section?._id ||
                section?.sectionId ||
                `section-${partIndex}-${sectionIndex}`,

              name:
                section?.name ||
                section?.sectionName ||
                `Section ${sectionIndex + 1}`,

              partId,

              partName:
                part?.name ||
                part?.partName ||
                `Part ${partIndex + 1}`,

              isOptionalPart:
                Boolean(part?.isOptional),

              partIndex,
            });
          }
        );
      }
    );

    /*
     * Safety fallback:
     *
     * If backend sent hasParts=true
     * but parts don't contain sections,
     * render root sections.
     */
    if (
      columns.length === 0 &&
      safeSections.length > 0
    ) {
      return safeSections.map(
        (section, index) => ({
          id:
            section?._id ||
            section?.sectionId ||
            `section-${index}`,

          name:
            section?.name ||
            section?.sectionName ||
            `Section ${index + 1}`,

          partId:
            section?.partId ||
            section?.part?._id ||
            section?.part ||
            null,

          partName:
            section?.partName ||
            section?.part?.name ||
            null,

          isOptionalPart:
            Boolean(
              section?.partIsOptional ||
                section?.part?.isOptional
            ),
        })
      );
    }

    return columns;
  }, [
    partsMode,
    safeParts,
    safeSections,
  ]);

  // ==========================================================
  // PART GROUPS FOR HEADER
  // ==========================================================

  const partGroups = useMemo(() => {
    if (!partsMode) return [];

    return safeParts.map(
      (part, index) => {
        const partId =
          part?._id ||
          part?.partId ||
          `part-${index}`;

        const sectionCount =
          sectionColumns.filter(
            (section) =>
              sameId(
                section.partId,
                partId
              )
          ).length;

        return {
          id: partId,

          name:
            part?.name ||
            part?.partName ||
            `Part ${index + 1}`,

          isOptional:
            Boolean(part?.isOptional),

          sectionCount,
        };
      }
    );
  }, [
    partsMode,
    safeParts,
    sectionColumns,
  ]);

  // ==========================================================
  // FIND SECTION SCORE
  // ==========================================================

  const getSectionScore = (
    row,
    sectionId
  ) => {
    const scores = Array.isArray(
      row?.sectionScores
    )
      ? row.sectionScores
      : [];

    return (
      scores.find((score) =>
        sameId(
          score?.sectionId ||
            score?._id,
          sectionId
        )
      ) || null
    );
  };

  // ==========================================================
  // FIND PART SCORE
  // ==========================================================

  const getPartScore = (
    row,
    partId
  ) => {
    const scores = Array.isArray(
      row?.partScores
    )
      ? row.partScores
      : [];

    return (
      scores.find((score) =>
        sameId(
          score?.partId ||
            score?._id,
          partId
        )
      ) || null
    );
  };

  // ==========================================================
  // EMPTY STATE
  // ==========================================================

  if (safeResults.length === 0) {
    return (
      <Alert
        severity="info"
        sx={{
          borderRadius: 2,
        }}
      >
        No students found for this
        assessment.
      </Alert>
    );
  }

  // ==========================================================
  // HEADER
  // ==========================================================

  return (
    <TableContainer
      component={Paper}
      sx={{
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        overflowX: 'auto',
      }}
    >
      <Table
        size="small"
        stickyHeader
        sx={{
          minWidth:
            partsMode
              ? Math.max(
                  1100,
                  300 +
                    sectionColumns.length *
                      150
                )
              : Math.max(
                  900,
                  300 +
                    sectionColumns.length *
                      150
                ),
        }}
      >
        {/* ====================================================
            TABLE HEADER
        ===================================================== */}

        <TableHead>
          {/* -----------------------------------------------
              PART GROUP HEADER
          ------------------------------------------------ */}

          {partsMode &&
            partGroups.length > 0 && (
              <TableRow>
                <TableCell
                  colSpan={2}
                  sx={{
                    bgcolor:
                      'primary.main',
                    color: 'white',
                    fontWeight: 700,
                  }}
                >
                  Student
                </TableCell>

                {partGroups.map(
                  (part) => (
                    <TableCell
                      key={
                        `group-${part.id}`
                      }
                      align="center"
                      colSpan={Math.max(
                        part.sectionCount,
                        1
                      )}
                      sx={{
                        bgcolor:
                          'primary.main',
                        color: 'white',
                        fontWeight: 700,
                        minWidth: 150,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={0.5}
                        justifyContent="center"
                        alignItems="center"
                      >
                        <Typography
                          variant="body2"
                          fontWeight={800}
                        >
                          {part.name}
                        </Typography>

                        {part.isOptional && (
                          <Chip
                            size="small"
                            label="Optional"
                            sx={{
                              color:
                                'white',
                              borderColor:
                                'rgba(255,255,255,.6)',
                            }}
                            variant="outlined"
                          />
                        )}
                      </Stack>
                    </TableCell>
                  )
                )}

                <TableCell
                  align="center"
                  rowSpan={2}
                  sx={{
                    bgcolor:
                      'primary.main',
                    color: 'white',
                    fontWeight: 700,
                  }}
                >
                  Total
                </TableCell>

                <TableCell
                  align="center"
                  rowSpan={2}
                  sx={{
                    bgcolor:
                      'primary.main',
                    color: 'white',
                    fontWeight: 700,
                  }}
                >
                  %
                </TableCell>

                <TableCell
                  align="center"
                  rowSpan={2}
                  sx={{
                    bgcolor:
                      'primary.main',
                    color: 'white',
                    fontWeight: 700,
                  }}
                >
                  Status
                </TableCell>

                <TableCell
                  rowSpan={2}
                  align="center"
                  sx={{
                    bgcolor:
                      'primary.main',
                    color: 'white',
                    fontWeight: 700,
                  }}
                >
                  Actions
                </TableCell>
              </TableRow>
            )}

          {/* -----------------------------------------------
              SECTION HEADER
          ------------------------------------------------ */}

          <TableRow>
            <TableCell
              sx={{
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              Roll No
            </TableCell>

            <TableCell
              sx={{
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
            >
              Student
            </TableCell>

            {sectionColumns.map(
              (section) => (
                <TableCell
                  key={
                    `header-${section.id}`
                  }
                  align="center"
                  sx={{
                    fontWeight: 700,
                    minWidth: 140,
                  }}
                >
                  <Tooltip
                    title={
                      section.partName
                        ? `${section.partName} → ${section.name}`
                        : section.name
                    }
                  >
                    <Box>
                      {section.name}
                    </Box>
                  </Tooltip>
                </TableCell>
              )
            )}

            {!partsMode && (
              <>
                <TableCell
                  align="center"
                  sx={{
                    fontWeight: 700,
                  }}
                >
                  Total
                </TableCell>

                <TableCell
                  align="center"
                  sx={{
                    fontWeight: 700,
                  }}
                >
                  %
                </TableCell>

                <TableCell
                  align="center"
                  sx={{
                    fontWeight: 700,
                  }}
                >
                  Status
                </TableCell>

                <TableCell
                  align="center"
                  sx={{
                    fontWeight: 700,
                  }}
                >
                  Actions
                </TableCell>
              </>
            )}
          </TableRow>
        </TableHead>

        {/* ====================================================
            BODY
        ===================================================== */}

        <TableBody>
          {safeResults.map(
            (row, rowIndex) => {
              const student =
                row?.student || {};

              const studentId =
                student?._id ||
                row?.studentId ||
                `student-${rowIndex}`;

              const totalObtained =
                Number(
                  row?.totalObtained
                ) || 0;

              const totalMax =
                Number(
                  row?.totalMax
                ) || 0;

              const percentage =
                row?.overallPercentage !==
                  undefined &&
                row?.overallPercentage !==
                  null
                  ? round2(
                      row.overallPercentage
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
                  row?.status ||
                    'PENDING'
                ).toUpperCase();

              const completed =
                status === 'COMPLETED';

              return (
                <TableRow
                  key={studentId}
                  hover
                >
                  {/* ----------------------------------------
                      ROLL NUMBER
                  ----------------------------------------- */}

                  <TableCell
                    sx={{
                      whiteSpace:
                        'nowrap',
                    }}
                  >
                    {student?.rollNumber ||
                      student?.rollNo ||
                      '-'}
                  </TableCell>

                  {/* ----------------------------------------
                      STUDENT
                  ----------------------------------------- */}

                  <TableCell>
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{
                        whiteSpace:
                          'nowrap',
                      }}
                    >
                      {student?.name ||
                        student?.fullName ||
                        'Unknown Student'}
                    </Typography>
                  </TableCell>

                  {/* ----------------------------------------
                      SECTION SCORES
                  ----------------------------------------- */}

                  {sectionColumns.map(
                    (section) => {
                      const sectionScore =
                        getSectionScore(
                          row,
                          section.id
                        );

                      /*
                       * Optional part score
                       */
                      const partScore =
                        section.partId
                          ? getPartScore(
                              row,
                              section.partId
                            )
                          : null;

                      const partSkipped =
                        Boolean(
                          section.isOptionalPart
                        ) &&
                        partScore &&
                        partScore.attempted ===
                          false;

                      if (partSkipped) {
                        return (
                          <TableCell
                            key={
                              section.id
                            }
                            align="center"
                          >
                            <Tooltip
                              title="Optional part skipped — excluded from total"
                            >
                              <Chip
                                size="small"
                                icon={
                                  <BlockIcon />
                                }
                                label="Skipped"
                                color="warning"
                                variant="outlined"
                              />
                            </Tooltip>
                          </TableCell>
                        );
                      }

                      if (!sectionScore) {
                        return (
                          <TableCell
                            key={
                              section.id
                            }
                            align="center"
                          >
                            <Typography
                              variant="body2"
                              color="text.secondary"
                            >
                              -
                            </Typography>
                          </TableCell>
                        );
                      }

                      const obtained =
                        Number(
                          sectionScore.obtainedMarks ??
                            sectionScore.obtained
                        ) || 0;

                      const max =
                        Number(
                          sectionScore.maxMarks ??
                            sectionScore.max
                        ) || 0;

                      const secPercentage =
                        sectionScore.percentage !==
                          undefined
                          ? Number(
                              sectionScore.percentage
                            ) || 0
                          : max > 0
                            ? round2(
                                (obtained /
                                  max) *
                                  100
                              )
                            : 0;

                      return (
                        <TableCell
                          key={
                            section.id
                          }
                          align="center"
                        >
                          <Tooltip
                            title={`${secPercentage}%`}
                          >
                            <Typography
                              variant="body2"
                              fontWeight={600}
                            >
                              {obtained}/
                              {max}
                            </Typography>
                          </Tooltip>
                        </TableCell>
                      );
                    }
                  )}

                  {/* ----------------------------------------
                      TOTAL
                  ----------------------------------------- */}

                  <TableCell align="center">
                    <Typography
                      fontWeight={700}
                    >
                      {totalObtained}/
                      {totalMax}
                    </Typography>
                  </TableCell>

                  {/* ----------------------------------------
                      PERCENTAGE
                  ----------------------------------------- */}

                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={`${percentage}%`}
                      color={
                        completed
                          ? percentage >=
                            60
                            ? 'success'
                            : 'warning'
                          : 'default'
                      }
                      variant={
                        completed
                          ? 'filled'
                          : 'outlined'
                      }
                    />
                  </TableCell>

                  {/* ----------------------------------------
                      STATUS
                  ----------------------------------------- */}

                  <TableCell align="center">
                    {completed ? (
                      <Chip
                        size="small"
                        icon={
                          <CheckCircleIcon />
                        }
                        label="Completed"
                        color="success"
                      />
                    ) : (
                      <Chip
                        size="small"
                        icon={
                          <PendingActionsIcon />
                        }
                        label="Pending"
                        color="warning"
                        variant="outlined"
                      />
                    )}
                  </TableCell>

                  {/* ----------------------------------------
                      ACTION
                  ----------------------------------------- */}

                  <TableCell align="center">
                    <Tooltip title="View student result">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() =>
                          onViewStudent?.(
                            studentId
                          )
                        }
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            }
          )}
        </TableBody>
      </Table>

      {/* ====================================================
          OPTIONAL PART NOTE
      ===================================================== */}

      {partsMode &&
        safeParts.some(
          (part) =>
            Boolean(part?.isOptional)
        ) && (
          <Box
            sx={{
              p: 1.5,
              borderTop: '1px solid',
              borderColor:
                'divider',
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
            >
              <BlockIcon
                fontSize="small"
                color="warning"
              />

              <Typography
                variant="caption"
                color="text.secondary"
              >
                Optional parts marked as
                “Skipped” are excluded from
                the student's total marks and
                percentage denominator.
              </Typography>
            </Stack>
          </Box>
        )}
    </TableContainer>
  );
}

