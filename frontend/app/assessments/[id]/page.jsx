"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";

import {
  ArrowBack,
  Assessment as AssessmentIcon,
  CalendarMonth,
  CheckCircle,
  Close,
  Code,
  Edit,
  EventAvailable,
  HelpOutline,
  InfoOutlined,
  MenuBook,
  Numbers,
  Publish,
  Refresh,
  School,
  Quiz,
  Schedule,
  Topic,
} from "@mui/icons-material";

import Layout from "../../../components/common/Layout";
import { api } from "../../../services/api";

// ============================================================
// HELPERS
// ============================================================

const getStatusColor = (status) => {
  switch (String(status || "").toUpperCase()) {
    case "PUBLISHED":
      return "success";

    case "SCHEDULED":
      return "info";

    case "CLOSED":
      return "warning";

    case "ARCHIVED":
      return "default";

    case "DRAFT":
    default:
      return "default";
  }
};

const getQuestionTypeLabel = (type) => {
  const normalized = String(type || "").toLowerCase();

  const map = {
    mcq: "Multiple Choice",
    multiple_choice: "Multiple Choice",
    multiplechoice: "Multiple Choice",

    single_choice: "Single Choice",
    singlechoice: "Single Choice",

    true_false: "True / False",
    truefalse: "True / False",

    short_answer: "Short Answer",
    shortanswer: "Short Answer",

    long_answer: "Long Answer",
    longanswer: "Long Answer",

    text: "Text",

    number: "Number",

    fill_blank: "Fill in the Blank",
    fillblank: "Fill in the Blank",
  };

  return map[normalized] || type || "Question";
};

const formatDate = (value) => {
  if (!value) return "—";

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
};

/**
 * IMPORTANT:
 * Backend may return either:
 *
 * organisation: {
 *   _id: "...",
 *   name: "Sleepwell Foundation"
 * }
 *
 * OR
 *
 * organisation: "68xxxxxxxx"
 *
 * This helper intentionally avoids displaying raw ObjectId
 * when no readable name is available.
 */
const getEntityName = (entity, fallback = "—") => {
  if (!entity) return fallback;

  if (typeof entity === "string") {
    // Raw ObjectId / ID should not be displayed as the name.
    return fallback;
  }

  if (typeof entity === "object") {
    return (
      entity.name ||
      entity.title ||
      entity.label ||
      entity.displayName ||
      entity.organisationName ||
      entity.organizationName ||
      entity.centreName ||
      entity.courseName ||
      entity.batchName ||
      fallback
    );
  }

  return fallback;
};

const getPartTotalMarks = (part) => {
  if (
    part?.totalMarks !== undefined &&
    part?.totalMarks !== null
  ) {
    return Number(part.totalMarks || 0);
  }

  return (part?.sections || []).reduce(
    (total, section) =>
      total + Number(section?.totalMarks || 0),
    0
  );
};

const getPartTotalQuestions = (part) => {
  if (
    part?.totalQuestions !== undefined &&
    part?.totalQuestions !== null
  ) {
    return Number(part.totalQuestions || 0);
  }

  return (part?.sections || []).reduce(
    (total, section) =>
      total +
      Number(
        section?.questions?.length ||
          section?.totalQuestions ||
          0
      ),
    0
  );
};

const getSectionTotalMarks = (section) => {
  if (
    section?.totalMarks !== undefined &&
    section?.totalMarks !== null
  ) {
    return Number(section.totalMarks || 0);
  }

  return (section?.questions || []).reduce(
    (total, question) =>
      total + Number(question?.maxPoints || 0),
    0
  );
};

const getSectionQuestionCount = (section) => {
  if (Array.isArray(section?.questions)) {
    return section.questions.length;
  }

  return Number(section?.totalQuestions || 0);
};

// ============================================================
// INFO ITEM
// ============================================================

function InfoItem({ icon, label, value }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1,
        minWidth: 0,
      }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          minWidth: 32,
          borderRadius: 1.2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#E3F2FD",
          color: "#1565C0",
        }}
      >
        {React.cloneElement(icon, {
          sx: { fontSize: 17 },
        })}
      </Box>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          sx={{
            fontSize: "0.66rem",
            color: "#667085",
            lineHeight: 1.2,
            mb: 0.25,
          }}
        >
          {label}
        </Typography>

        <Typography
          component="div"
          sx={{
            fontSize: "0.78rem",
            fontWeight: 700,
            color: "#101828",
            lineHeight: 1.3,
            wordBreak: "break-word",
          }}
        >
          {value || "—"}
        </Typography>
      </Box>
    </Box>
  );
}

// ============================================================
// STAT BOX
// ============================================================

function StatBox({
  icon,
  label,
  value,
  accent = "#1565C0",
}) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: {
          xs: "calc(50% - 5px)",
          sm: 130,
        },
        border: "1px solid #E6EAF0",
        borderRadius: 1.5,
        backgroundColor: "#FFFFFF",
        p: 1.25,
        display: "flex",
        alignItems: "center",
        gap: 1,
      }}
    >
      <Box
        sx={{
          width: 34,
          height: 34,
          minWidth: 34,
          borderRadius: 1.2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: `${accent}12`,
          color: accent,
        }}
      >
        {React.cloneElement(icon, {
          sx: { fontSize: 18 },
        })}
      </Box>

      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: "0.64rem",
            color: "#667085",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </Typography>

        <Typography
          sx={{
            fontSize: "1rem",
            fontWeight: 800,
            color: "#101828",
            lineHeight: 1.2,
          }}
        >
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

// ============================================================
// QUESTION CARD
// ============================================================

function QuestionCard({ question, index }) {
  const options = Array.isArray(question?.options)
    ? question.options
    : [];

  return (
    <Box
      sx={{
        border: "1px solid #E6EAF0",
        borderRadius: 1.5,
        backgroundColor: "#FFFFFF",
        p: { xs: 1.1, sm: 1.35 },
        mb: 1,
        transition: "all 0.15s ease",
        "&:hover": {
          borderColor: "#B9D4F2",
          boxShadow:
            "0 2px 8px rgba(21,101,192,0.06)",
        },
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="flex-start"
      >
        <Box
          sx={{
            width: 28,
            height: 28,
            minWidth: 28,
            borderRadius: 1,
            backgroundColor: "#E3F2FD",
            color: "#1565C0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.7rem",
            fontWeight: 800,
          }}
        >
          {index + 1}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction={{
              xs: "column",
              sm: "row",
            }}
            spacing={0.75}
            alignItems={{
              xs: "flex-start",
              sm: "center",
            }}
            sx={{ mb: 0.5 }}
          >
            <Typography
              sx={{
                fontSize: "0.8rem",
                fontWeight: 700,
                color: "#101828",
                lineHeight: 1.45,
                wordBreak: "break-word",
              }}
            >
              {question?.questionText ||
                "Untitled question"}
            </Typography>

            <Stack
              direction="row"
              spacing={0.5}
              flexWrap="wrap"
              useFlexGap
            >
              <Chip
                size="small"
                label={getQuestionTypeLabel(
                  question?.questionType
                )}
                sx={{
                  height: 21,
                  fontSize: "0.61rem",
                  fontWeight: 600,
                  backgroundColor: "#F2F4F7",
                }}
              />

              <Chip
                size="small"
                label={`${Number(
                  question?.maxPoints || 0
                )} pts`}
                sx={{
                  height: 21,
                  fontSize: "0.61rem",
                  fontWeight: 700,
                  color: "#1565C0",
                  backgroundColor: "#E3F2FD",
                }}
              />

              {question?.isRequired && (
                <Chip
                  size="small"
                  label="Required"
                  color="error"
                  variant="outlined"
                  sx={{
                    height: 21,
                    fontSize: "0.61rem",
                    fontWeight: 600,
                  }}
                />
              )}
            </Stack>
          </Stack>

          {options.length > 0 && (
            <Box
              sx={{
                mt: 0.9,
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
              }}
            >
              {options.map(
                (option, optionIndex) => {
                  const optionText =
                    typeof option === "string"
                      ? option
                      : option?.text ||
                        option?.label ||
                        option?.value ||
                        `Option ${
                          optionIndex + 1
                        }`;

                  return (
                    <Box
                      key={optionIndex}
                      sx={{
                        display: "flex",
                        alignItems:
                          "flex-start",
                        gap: 0.7,
                        px: 0.9,
                        py: 0.55,
                        borderRadius: 0.8,
                        backgroundColor:
                          "#F8FAFC",
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: "0.66rem",
                          fontWeight: 700,
                          color: "#667085",
                        }}
                      >
                        {String.fromCharCode(
                          65 + optionIndex
                        )}
                        .
                      </Typography>

                      <Typography
                        sx={{
                          fontSize: "0.68rem",
                          color: "#344054",
                          lineHeight: 1.35,
                        }}
                      >
                        {optionText}
                      </Typography>
                    </Box>
                  );
                }
              )}
            </Box>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

// ============================================================
// SECTION CARD
// ============================================================

function SectionCard({
  section,
  sectionIndex,
}) {
  const questions = Array.isArray(
    section?.questions
  )
    ? section.questions
    : [];

  const totalMarks =
    getSectionTotalMarks(section);

  const totalQuestions =
    getSectionQuestionCount(section);

  return (
    <Card
      elevation={0}
      sx={{
        mb: 1.5,
        border: "1px solid #E1E7EF",
        borderRadius: 1.8,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          px: {
            xs: 1.25,
            sm: 1.75,
          },
          py: 1.15,
          backgroundColor: "#F8FAFC",
          borderBottom:
            "1px solid #E6EAF0",
        }}
      >
        <Stack
          direction={{
            xs: "column",
            sm: "row",
          }}
          justifyContent="space-between"
          alignItems={{
            xs: "flex-start",
            sm: "center",
          }}
          spacing={0.8}
        >
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            minWidth={0}
          >
            <Box
              sx={{
                width: 34,
                height: 34,
                minWidth: 34,
                borderRadius: 1.2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  "#1565C0",
                color: "#FFFFFF",
                fontWeight: 800,
                fontSize: "0.75rem",
              }}
            >
              {sectionIndex + 1}
            </Box>

            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: "0.88rem",
                  fontWeight: 800,
                  color: "#101828",
                  wordBreak: "break-word",
                }}
              >
                {section?.name ||
                  "Untitled Section"}
              </Typography>

              {section?.description && (
                <Typography
                  sx={{
                    mt: 0.2,
                    fontSize: "0.68rem",
                    color: "#667085",
                  }}
                >
                  {section.description}
                </Typography>
              )}
            </Box>
          </Stack>

          <Stack
            direction="row"
            spacing={0.6}
            flexWrap="wrap"
            useFlexGap
          >
            <Chip
              size="small"
              icon={
                <Quiz
                  sx={{
                    fontSize: 14,
                  }}
                />
              }
              label={`${totalQuestions} Questions`}
              sx={{
                height: 23,
                fontSize: "0.62rem",
                fontWeight: 600,
              }}
            />

            <Chip
              size="small"
              icon={
                <Numbers
                  sx={{
                    fontSize: 14,
                  }}
                />
              }
              label={`${totalMarks} Marks`}
              color="primary"
              variant="outlined"
              sx={{
                height: 23,
                fontSize: "0.62rem",
                fontWeight: 700,
              }}
            />
          </Stack>
        </Stack>
      </Box>

      <CardContent
        sx={{
          p: {
            xs: 1,
            sm: 1.5,
          },
          "&:last-child": {
            pb: {
              xs: 1,
              sm: 1.5,
            },
          },
        }}
      >
        {questions.length > 0 ? (
          questions.map(
            (question, index) => (
              <QuestionCard
                key={
                  question?._id ||
                  `${section?._id}-${index}`
                }
                question={question}
                index={index}
              />
            )
          )
        ) : (
          <Box
            sx={{
              py: 3,
              textAlign: "center",
              color: "#98A2B3",
            }}
          >
            <HelpOutline
              sx={{
                fontSize: 30,
                mb: 0.5,
              }}
            />

            <Typography
              sx={{
                fontSize: "0.75rem",
                fontWeight: 600,
              }}
            >
              No questions in this section
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// PART CARD
// ============================================================

function PartCard({
  part,
  partIndex,
}) {
  const sections = Array.isArray(
    part?.sections
  )
    ? part.sections
    : [];

  const totalMarks =
    getPartTotalMarks(part);

  const totalQuestions =
    getPartTotalQuestions(part);

  return (
    <Box sx={{ mb: 2 }}>
      <Box
        sx={{
          p: {
            xs: 1.25,
            sm: 1.5,
          },
          mb: 1,
          borderRadius: 1.8,
          background:
            "linear-gradient(135deg, #0D47A1 0%, #1565C0 55%, #1976D2 100%)",
          color: "#FFFFFF",
        }}
      >
        <Stack
          direction={{
            xs: "column",
            sm: "row",
          }}
          justifyContent="space-between"
          alignItems={{
            xs: "flex-start",
            sm: "center",
          }}
          spacing={1}
        >
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
          >
            <Box
              sx={{
                width: 38,
                height: 38,
                minWidth: 38,
                borderRadius: 1.2,
                backgroundColor:
                  "rgba(255,255,255,0.16)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "0.8rem",
              }}
            >
              P{partIndex + 1}
            </Box>

            <Box>
              <Typography
                sx={{
                  fontSize: "0.95rem",
                  fontWeight: 800,
                }}
              >
                {part?.name ||
                  `Part ${
                    partIndex + 1
                  }`}
              </Typography>

              {part?.description && (
                <Typography
                  sx={{
                    mt: 0.15,
                    fontSize: "0.67rem",
                    opacity: 0.85,
                  }}
                >
                  {part.description}
                </Typography>
              )}
            </Box>
          </Stack>

          <Stack
            direction="row"
            spacing={0.6}
            flexWrap="wrap"
            useFlexGap
          >
            <Chip
              size="small"
              label={`${sections.length} Sections`}
              sx={{
                height: 23,
                color: "#FFFFFF",
                backgroundColor:
                  "rgba(255,255,255,0.14)",
                fontSize: "0.62rem",
              }}
            />

            <Chip
              size="small"
              label={`${totalQuestions} Questions`}
              sx={{
                height: 23,
                color: "#FFFFFF",
                backgroundColor:
                  "rgba(255,255,255,0.14)",
                fontSize: "0.62rem",
              }}
            />

            <Chip
              size="small"
              label={`${totalMarks} Marks`}
              sx={{
                height: 23,
                color: "#FFFFFF",
                backgroundColor:
                  "rgba(255,255,255,0.18)",
                fontSize: "0.62rem",
                fontWeight: 700,
              }}
            />
          </Stack>
        </Stack>
      </Box>

      {sections.length > 0 ? (
        sections.map(
          (section, sectionIndex) => (
            <SectionCard
              key={
                section?._id ||
                `${part?._id}-${sectionIndex}`
              }
              section={section}
              sectionIndex={
                sectionIndex
              }
            />
          )
        )
      ) : (
        <Card
          elevation={0}
          sx={{
            border:
              "1px solid #E6EAF0",
            borderRadius: 1.5,
          }}
        >
          <CardContent>
            <Typography
              sx={{
                textAlign: "center",
                fontSize: "0.75rem",
                color: "#98A2B3",
                py: 2,
              }}
            >
              No sections found in
              this part.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function AssessmentDetailPage() {
  const router = useRouter();
  const params = useParams();

  const id = params?.id;

  const [assessment, setAssessment] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [publishing, setPublishing] =
    useState(false);

  // ==========================================================
  // LOAD
  // ==========================================================

  const loadAssessment =
    useCallback(async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError("");

        const response =
          await api.getAssessment(id);

        const assessmentData =
          response?.data || null;

        console.log(
          "Assessment detail response:",
          assessmentData
        );

        setAssessment(
          assessmentData
        );

        if (!assessmentData) {
          setError(
            "Assessment data not found."
          );
        }
      } catch (err) {
        console.error(
          "Failed to load assessment:",
          err
        );

        setAssessment(null);

        setError(
          err?.message ||
            "Failed to load assessment."
        );
      } finally {
        setLoading(false);
      }
    }, [id]);

  useEffect(() => {
    loadAssessment();
  }, [loadAssessment]);

  // ==========================================================
  // PUBLISH
  // ==========================================================

  const handlePublish = async () => {
    if (!id) return;

    try {
      setPublishing(true);
      setError("");

      const response =
        await api.publishAssessment(id);

      if (response?.data) {
        setAssessment(
          response.data
        );
      } else {
        await loadAssessment();
      }
    } catch (err) {
      console.error(
        "Publish assessment error:",
        err
      );

      setError(
        err?.message ||
          "Failed to publish assessment."
      );
    } finally {
      setPublishing(false);
    }
  };

  // ==========================================================
  // DERIVED DATA
  // ==========================================================

  const parts = useMemo(
    () =>
      Array.isArray(
        assessment?.parts
      )
        ? assessment.parts
        : [],
    [assessment]
  );

  const unassignedSections =
    useMemo(
      () =>
        Array.isArray(
          assessment?.sections
        )
          ? assessment.sections
          : [],
      [assessment]
    );

  const isPartsMode =
    Boolean(assessment?.hasParts) ||
    parts.length > 0;

  const allSections = useMemo(() => {
    const result = [
      ...unassignedSections,
    ];

    parts.forEach((part) => {
      if (
        Array.isArray(
          part?.sections
        )
      ) {
        result.push(
          ...part.sections
        );
      }
    });

    return result;
  }, [
    parts,
    unassignedSections,
  ]);

  const calculatedQuestionCount =
    useMemo(
      () =>
        allSections.reduce(
          (total, section) =>
            total +
            Number(
              section?.questions
                ?.length ||
                section?.totalQuestions ||
                0
            ),
          0
        ),
      [allSections]
    );

  const calculatedMarks = useMemo(
    () =>
      allSections.reduce(
        (total, section) =>
          total +
          getSectionTotalMarks(
            section
          ),
        0
      ),
    [allSections]
  );

  // ==========================================================
  // SAFE DISPLAY VALUES
  // ==========================================================

  const organisationName =
    getEntityName(
      assessment?.organisation
    );

  const centreName =
    getEntityName(
      assessment?.centre
    );

  const courseName =
    getEntityName(
      assessment?.course
    );

  const batchName =
    getEntityName(
      assessment?.batch
    );

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <Layout>
        <Box
          sx={{
            minHeight: 400,
            display: "flex",
            alignItems: "center",
            justifyContent:
              "center",
            flexDirection:
              "column",
            gap: 1.5,
          }}
        >
          <CircularProgress
            size={30}
          />

          <Typography
            sx={{
              fontSize: "0.78rem",
              color: "#667085",
            }}
          >
            Loading assessment...
          </Typography>
        </Box>
      </Layout>
    );
  }

  // ==========================================================
  // ERROR / NOT FOUND
  // ==========================================================

  if (!assessment) {
    return (
      <Layout>
        <Box
          sx={{
            p: {
              xs: 1,
              sm: 2,
            },
          }}
        >
          <Button
            size="small"
            startIcon={<ArrowBack />}
            onClick={() =>
              router.push(
                "/assessments"
              )
            }
            sx={{
              textTransform:
                "none",
              mb: 2,
            }}
          >
            Back to Assessments
          </Button>

          <Alert severity="error">
            {error ||
              "Assessment not found."}
          </Alert>
        </Box>
      </Layout>
    );
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <Layout>
      <Box
        sx={{
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing:
            "border-box",
          overflowX: "hidden",
          px: {
            xs: 1,
            sm: 1.5,
            md: 2,
          },
          py: {
            xs: 1,
            sm: 1.5,
          },
        }}
      >
        {/* ================================================== */}
        {/* TOP HEADER */}
        {/* ================================================== */}

        <Box
          sx={{
            mb: 1.5,
            p: {
              xs: 1.25,
              sm: 1.5,
              md: 1.75,
            },
            borderRadius: 1.8,
            background:
              "linear-gradient(135deg, #0D47A1 0%, #3437b9 55%, #1f3f98 100%)",
            color: "#FFFFFF",
            boxShadow:
              "0 4px 14px rgba(21,101,192,0.16)",
          }}
        >
          <Stack
            direction={{
              xs: "column",
              lg: "row",
            }}
            justifyContent="space-between"
            alignItems={{
              xs: "stretch",
              lg: "center",
            }}
            spacing={1.5}
          >
            {/* TITLE */}

            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              minWidth={0}
            >
              <IconButton
                onClick={() =>
                  router.push(
                    "/assessments"
                  )
                }
                sx={{
                  width: 36,
                  height: 36,
                  color: "#FFFFFF",
                  backgroundColor:
                    "rgba(255,255,255,0.12)",
                  borderRadius: 1.2,
                  "&:hover": {
                    backgroundColor:
                      "rgba(255,255,255,0.2)",
                  },
                }}
              >
                <ArrowBack fontSize="small" />
              </IconButton>

              <Box sx={{ minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: {
                      xs: "1.05rem",
                      sm: "1.25rem",
                      md: "1.4rem",
                    },
                    fontWeight: 800,
                    lineHeight: 1.2,
                    wordBreak:
                      "break-word",
                  }}
                >
                  {assessment.name}
                </Typography>

                <Stack
                  direction="row"
                  spacing={0.6}
                  flexWrap="wrap"
                  useFlexGap
                  sx={{ mt: 0.6 }}
                >
                  {assessment.code && (
                    <Chip
                      size="small"
                      icon={
                        <Code
                          sx={{
                            fontSize: 13,
                            color:
                              "inherit !important",
                          }}
                        />
                      }
                      label={
                        assessment.code
                      }
                      sx={{
                        height: 22,
                        color:
                          "#FFFFFF",
                        backgroundColor:
                          "rgba(255,255,255,0.12)",
                        fontSize:
                          "0.62rem",
                      }}
                    />
                  )}

                  <Chip
                    size="small"
                    label={
                      assessment.status ||
                      "DRAFT"
                    }
                    color={getStatusColor(
                      assessment.status
                    )}
                    sx={{
                      height: 22,
                      fontSize:
                        "0.62rem",
                      fontWeight: 700,
                    }}
                  />

                  {isPartsMode && (
                    <Chip
                      size="small"
                      label="Parts Mode"
                      sx={{
                        height: 22,
                        color:
                          "#FFFFFF",
                        backgroundColor:
                          "rgba(255,255,255,0.12)",
                        fontSize:
                          "0.62rem",
                      }}
                    />
                  )}
                </Stack>
              </Box>
            </Stack>

            {/* ACTIONS */}

            <Stack
              direction="row"
              spacing={0.7}
              flexWrap="wrap"
              useFlexGap
            >
              {assessment.status ===
                "DRAFT" && (
                <>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={
                      <Edit fontSize="small" />
                    }
                    onClick={() =>
                      router.push(
                        `/assessments/${id}/edit`
                      )
                    }
                    sx={{
                      minHeight: 34,
                      textTransform:
                        "none",
                      fontWeight: 700,
                      backgroundColor:
                        "#FFFFFF",
                      color:
                        "#1565C0",
                      "&:hover": {
                        backgroundColor:
                          "#F5F9FF",
                      },
                    }}
                  >
                    Edit
                  </Button>

                  <Button
                    size="small"
                    variant="contained"
                    disabled={
                      publishing
                    }
                    startIcon={
                      publishing ? (
                        <CircularProgress
                          size={15}
                          color="inherit"
                        />
                      ) : (
                        <Publish fontSize="small" />
                      )
                    }
                    onClick={
                      handlePublish
                    }
                    sx={{
                      minHeight: 34,
                      textTransform:
                        "none",
                      fontWeight: 700,
                      backgroundColor:
                        "#D32F2F",
                      "&:hover": {
                        backgroundColor:
                          "#B71C1C",
                      },
                    }}
                  >
                    {publishing
                      ? "Publishing..."
                      : "Publish"}
                  </Button>
                </>
              )}

              <Button
                size="small"
                variant="outlined"
                startIcon={
                  <AssessmentIcon fontSize="small" />
                }
                onClick={() =>
                  router.push(
                    `/assessments/${id}/results`
                  )
                }
                sx={{
                  minHeight: 34,
                  textTransform:
                    "none",
                  fontWeight: 700,
                  color: "#FFFFFF",
                  borderColor:
                    "rgba(255,255,255,0.45)",
                  "&:hover": {
                    borderColor:
                      "#FFFFFF",
                    backgroundColor:
                      "rgba(255,255,255,0.08)",
                  },
                }}
              >
                Results
              </Button>

              <Tooltip title="Refresh">
                <IconButton
                  onClick={
                    loadAssessment
                  }
                  disabled={loading}
                  sx={{
                    width: 34,
                    height: 34,
                    color: "#FFFFFF",
                    border:
                      "1px solid rgba(255,255,255,0.35)",
                    borderRadius: 1,
                    "&:hover": {
                      backgroundColor:
                        "rgba(255,255,255,0.08)",
                    },
                  }}
                >
                  <Refresh fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Box>

        {/* ERROR */}

        {error && (
          <Alert
            severity="error"
            onClose={() =>
              setError("")
            }
            sx={{
              mb: 1.5,
              fontSize: "0.75rem",
            }}
          >
            {error}
          </Alert>
        )}

        {/* ================================================== */}
        {/* SUMMARY STATS */}
        {/* ================================================== */}

        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: 1,
            mb: 1.5,
          }}
        >
          <StatBox
            icon={<Numbers />}
            label="Total Marks"
            value={
              assessment.totalMarks ??
              calculatedMarks ??
              0
            }
            accent="#1565C0"
          />

          <StatBox
            icon={<Quiz />}
            label="Questions"
            value={
              assessment.totalQuestions ??
              calculatedQuestionCount ??
              0
            }
            accent="#2E7D32"
          />

          <StatBox
            icon={<Topic />}
            label="Sections"
            value={
              allSections.length
            }
            accent="#7B1FA2"
          />

          {isPartsMode && (
            <StatBox
              icon={<MenuBook />}
              label="Parts"
              value={parts.length}
              accent="#ED6C02"
            />
          )}

          <StatBox
            icon={<CalendarMonth />}
            label="Week"
            value={
              assessment.weekNumber
                ? `Week ${assessment.weekNumber}`
                : "—"
            }
            accent="#0288D1"
          />
        </Box>

        {/* ================================================== */}
        {/* ASSESSMENT INFORMATION */}
        {/* ================================================== */}

        <Paper
          elevation={0}
          sx={{
            mb: 1.5,
            border:
              "1px solid #E6EAF0",
            borderRadius: 1.8,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              px: {
                xs: 1.25,
                sm: 1.75,
              },
              py: 1.1,
              backgroundColor:
                "#F8FAFC",
              borderBottom:
                "1px solid #E6EAF0",
            }}
          >
            <Stack
              direction="row"
              spacing={0.8}
              alignItems="center"
            >
              <InfoOutlined
                sx={{
                  fontSize: 19,
                  color: "#1565C0",
                }}
              />

              <Typography
                sx={{
                  fontSize:
                    "0.88rem",
                  fontWeight: 800,
                  color:
                    "#101828",
                }}
              >
                Assessment Information
              </Typography>
            </Stack>
          </Box>

          <Box
            sx={{
              p: {
                xs: 1.25,
                sm: 1.75,
              },
            }}
          >
            <Grid
              container
              spacing={2}
            >
              <Grid
                item
                xs={12}
                sm={6}
                md={4}
              >
                <InfoItem
                  icon={<Code />}
                  label="Assessment Code"
                  value={
                    assessment.code
                  }
                />
              </Grid>

              <Grid
                item
                xs={12}
                sm={6}
                md={4}
              >
                <InfoItem
                  icon={
                    <CalendarMonth />
                  }
                  label="Week Number"
                  value={
                    assessment.weekNumber
                      ? `Week ${assessment.weekNumber}`
                      : "—"
                  }
                />
              </Grid>

              <Grid
                item
                xs={12}
                sm={6}
                md={4}
              >
                <InfoItem
                  icon={<School />}
                  label="Academic Year"
                  value={
                    assessment.academicYear
                  }
                />
              </Grid>

              <Grid
                item
                xs={12}
                sm={6}
                md={4}
              >
                <InfoItem
                  icon={<MenuBook />}
                  label="Organisation"
                  value={
                    organisationName
                  }
                />
              </Grid>

              <Grid
                item
                xs={12}
                sm={6}
                md={4}
              >
                <InfoItem
                  icon={<School />}
                  label="Centre"
                  value={
                    centreName
                  }
                />
              </Grid>

              <Grid
                item
                xs={12}
                sm={6}
                md={4}
              >
                <InfoItem
                  icon={<Topic />}
                  label="Course"
                  value={
                    courseName
                  }
                />
              </Grid>

              <Grid
                item
                xs={12}
                sm={6}
                md={4}
              >
                <InfoItem
                  icon={<School />}
                  label="Batch"
                  value={
                    batchName
                  }
                />
              </Grid>

              <Grid
                item
                xs={12}
                sm={6}
                md={4}
              >
                <InfoItem
                  icon={
                    <CheckCircle />
                  }
                  label="Status"
                  value={
                    <Chip
                      size="small"
                      label={
                        assessment.status ||
                        "DRAFT"
                      }
                      color={getStatusColor(
                        assessment.status
                      )}
                      sx={{
                        height: 22,
                        fontSize:
                          "0.62rem",
                        fontWeight: 700,
                      }}
                    />
                  }
                />
              </Grid>

              <Grid
                item
                xs={12}
                sm={6}
                md={4}
              >
                <InfoItem
                  icon={<MenuBook />}
                  label="Structure"
                  value={
                    isPartsMode
                      ? "Parts + Sections + Questions"
                      : "Sections + Questions"
                  }
                />
              </Grid>
            </Grid>

            {/* DESCRIPTION */}

            {assessment.description && (
              <>
                <Divider
                  sx={{ my: 1.75 }}
                />

                <Box>
                  <Typography
                    sx={{
                      fontSize:
                        "0.7rem",
                      fontWeight: 800,
                      color:
                        "#344054",
                      mb: 0.45,
                    }}
                  >
                    Description
                  </Typography>

                  <Typography
                    sx={{
                      fontSize:
                        "0.75rem",
                      color:
                        "#667085",
                      lineHeight: 1.55,
                      whiteSpace:
                        "pre-wrap",
                    }}
                  >
                    {
                      assessment.description
                    }
                  </Typography>
                </Box>
              </>
            )}

            {/* INSTRUCTIONS */}

            {assessment.instructions && (
              <>
                <Divider
                  sx={{ my: 1.75 }}
                />

                <Box>
                  <Typography
                    sx={{
                      fontSize:
                        "0.7rem",
                      fontWeight: 800,
                      color:
                        "#344054",
                      mb: 0.45,
                    }}
                  >
                    Instructions
                  </Typography>

                  <Box
                    sx={{
                      p: 1.1,
                      borderRadius: 1,
                      backgroundColor:
                        "#FFF8E1",
                      border:
                        "1px solid #FFE082",
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize:
                          "0.72rem",
                        color:
                          "#664D03",
                        lineHeight: 1.55,
                        whiteSpace:
                          "pre-wrap",
                      }}
                    >
                      {
                        assessment.instructions
                      }
                    </Typography>
                  </Box>
                </Box>
              </>
            )}

            {/* SCHEDULE */}

            {(assessment.publishDate ||
              assessment.publishTime ||
              assessment.closeDate ||
              assessment.closeTime) && (
              <>
                <Divider
                  sx={{ my: 1.75 }}
                />

                <Typography
                  sx={{
                    fontSize:
                      "0.7rem",
                    fontWeight: 800,
                    color:
                      "#344054",
                    mb: 1,
                  }}
                >
                  Schedule
                </Typography>

                <Grid
                  container
                  spacing={1.5}
                >
                  <Grid
                    item
                    xs={12}
                    sm={6}
                    md={3}
                  >
                    <InfoItem
                      icon={
                        <EventAvailable />
                      }
                      label="Publish Date"
                      value={formatDate(
                        assessment.publishDate
                      )}
                    />
                  </Grid>

                  <Grid
                    item
                    xs={12}
                    sm={6}
                    md={3}
                  >
                    <InfoItem
                      icon={<Schedule />}
                      label="Publish Time"
                      value={
                        assessment.publishTime ||
                        "—"
                      }
                    />
                  </Grid>

                  <Grid
                    item
                    xs={12}
                    sm={6}
                    md={3}
                  >
                    <InfoItem
                      icon={<Close />}
                      label="Close Date"
                      value={formatDate(
                        assessment.closeDate
                      )}
                    />
                  </Grid>

                  <Grid
                    item
                    xs={12}
                    sm={6}
                    md={3}
                  >
                    <InfoItem
                      icon={<Schedule />}
                      label="Close Time"
                      value={
                        assessment.closeTime ||
                        "—"
                      }
                    />
                  </Grid>
                </Grid>
              </>
            )}
          </Box>
        </Paper>

        {/* ================================================== */}
        {/* STRUCTURE */}
        {/* ================================================== */}

        <Box sx={{ mb: 1 }}>
          <Stack
            direction={{
              xs: "column",
              sm: "row",
            }}
            justifyContent="space-between"
            alignItems={{
              xs: "flex-start",
              sm: "center",
            }}
            spacing={0.75}
          >
            <Box>
              <Typography
                sx={{
                  fontSize: {
                    xs: "1rem",
                    sm: "1.1rem",
                  },
                  fontWeight: 800,
                  color:
                    "#101828",
                }}
              >
                Assessment Structure
              </Typography>

              <Typography
                sx={{
                  mt: 0.2,
                  fontSize:
                    "0.7rem",
                  color:
                    "#667085",
                }}
              >
                {isPartsMode
                  ? "Parts → Sections → Questions"
                  : "Sections → Questions"}
              </Typography>
            </Box>

            <Stack
              direction="row"
              spacing={0.6}
            >
              <Chip
                size="small"
                label={`${allSections.length} Sections`}
                sx={{
                  height: 23,
                  fontSize:
                    "0.62rem",
                }}
              />

              <Chip
                size="small"
                label={`${calculatedQuestionCount} Questions`}
                color="primary"
                variant="outlined"
                sx={{
                  height: 23,
                  fontSize:
                    "0.62rem",
                }}
              />
            </Stack>
          </Stack>
        </Box>

        {/* ================================================== */}
        {/* PART MODE */}
        {/* ================================================== */}

        {isPartsMode && (
          <>
            {parts.length > 0 ? (
              parts.map(
                (part, index) => (
                  <PartCard
                    key={
                      part?._id ||
                      index
                    }
                    part={part}
                    partIndex={index}
                  />
                )
              )
            ) : (
              <Alert
                severity="info"
                sx={{
                  mb: 1.5,
                  fontSize:
                    "0.72rem",
                }}
              >
                This assessment is
                configured for Parts,
                but no Parts were
                found.
              </Alert>
            )}

            {unassignedSections.length >
              0 && (
              <Box sx={{ mt: 1.5 }}>
                <Typography
                  sx={{
                    fontSize:
                      "0.8rem",
                    fontWeight: 800,
                    color:
                      "#344054",
                    mb: 0.8,
                  }}
                >
                  Unassigned Sections
                </Typography>

                {unassignedSections.map(
                  (
                    section,
                    index
                  ) => (
                    <SectionCard
                      key={
                        section?._id ||
                        `unassigned-${index}`
                      }
                      section={
                        section
                      }
                      sectionIndex={
                        index
                      }
                    />
                  )
                )}
              </Box>
            )}
          </>
        )}

        {/* ================================================== */}
        {/* NORMAL MODE */}
        {/* ================================================== */}

        {!isPartsMode && (
          <>
            {unassignedSections.length >
            0 ? (
              unassignedSections.map(
                (
                  section,
                  index
                ) => (
                  <SectionCard
                    key={
                      section?._id ||
                      `section-${index}`
                    }
                    section={
                      section
                    }
                    sectionIndex={
                      index
                    }
                  />
                )
              )
            ) : (
              <Card
                elevation={0}
                sx={{
                  border:
                    "1px solid #E6EAF0",
                  borderRadius: 1.8,
                }}
              >
                <CardContent
                  sx={{
                    py: 5,
                    textAlign:
                      "center",
                  }}
                >
                  <Topic
                    sx={{
                      fontSize: 42,
                      color:
                        "#98A2B3",
                      mb: 1,
                    }}
                  />

                  <Typography
                    sx={{
                      fontSize:
                        "0.9rem",
                      fontWeight: 700,
                      color:
                        "#475467",
                    }}
                  >
                    No sections found
                  </Typography>

                  <Typography
                    sx={{
                      mt: 0.35,
                      fontSize:
                        "0.7rem",
                      color:
                        "#98A2B3",
                    }}
                  >
                    Add sections and
                    questions to build
                    this assessment.
                  </Typography>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ================================================== */}
        {/* BOTTOM ACTIONS */}
        {/* ================================================== */}

        <Paper
          elevation={0}
          sx={{
            mt: 2,
            p: 1.25,
            borderRadius: 1.5,
            border:
              "1px solid #E6EAF0",
            backgroundColor:
              "#F8FAFC",
          }}
        >
          <Stack
            direction={{
              xs: "column",
              sm: "row",
            }}
            justifyContent="space-between"
            alignItems={{
              xs: "stretch",
              sm: "center",
            }}
            spacing={1}
          >
            <Typography
              sx={{
                fontSize:
                  "0.68rem",
                color:
                  "#667085",
              }}
            >
              {calculatedQuestionCount}{" "}
              questions •{" "}
              {calculatedMarks} marks •{" "}
              {allSections.length}{" "}
              sections
              {isPartsMode
                ? ` • ${parts.length} parts`
                : ""}
            </Typography>

            <Stack
              direction="row"
              spacing={0.7}
            >
              <Button
                size="small"
                variant="outlined"
                startIcon={
                  <ArrowBack />
                }
                onClick={() =>
                  router.push(
                    "/assessments"
                  )
                }
                sx={{
                  minHeight: 34,
                  textTransform:
                    "none",
                }}
              >
                Back
              </Button>

              {assessment.status ===
                "DRAFT" && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={
                    <Edit />
                  }
                  onClick={() =>
                    router.push(
                      `/assessments/${id}/edit`
                    )
                  }
                  sx={{
                    minHeight: 34,
                    textTransform:
                      "none",
                    fontWeight: 700,
                  }}
                >
                  Edit Assessment
                </Button>
              )}

              <Button
                size="small"
                variant="outlined"
                startIcon={
                  <AssessmentIcon />
                }
                onClick={() =>
                  router.push(
                    `/assessments/${id}/results`
                  )
                }
                sx={{
                  minHeight: 34,
                  textTransform:
                    "none",
                  fontWeight: 700,
                }}
              >
                View Results
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Box>
    </Layout>
  );
}