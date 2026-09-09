"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import {
  Alert,
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  Grid,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  CircularProgress,
  Stack,
  IconButton,
  Tooltip,
  Divider,
} from "@mui/material";

import DownloadIcon from "@mui/icons-material/Download";
import UploadIcon from "@mui/icons-material/Upload";
import RefreshIcon from "@mui/icons-material/Refresh";
import AssessmentIcon from "@mui/icons-material/Assessment";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import SchoolIcon from "@mui/icons-material/School";
import QuizIcon from "@mui/icons-material/Quiz";
import LayersIcon from "@mui/icons-material/Layers";
import PercentIcon from "@mui/icons-material/Percent";
import CloseIcon from "@mui/icons-material/Close";

import Layout from "../../../../components/common/Layout";
import ResultsTable from "../../../../components/results/ResultsTable";
import StudentResultDetail from "../../../../components/results/StudentResultDetail";

import { api } from "../../../../services/api";

// ============================================================
// HELPERS
// ============================================================

const getDisplayValue = (value, fallback = "—") => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (typeof value === "object") {
    return (
      value.name ||
      value.title ||
      value.label ||
      value.code ||
      value.displayName ||
      value.fullName ||
      value.value ||
      fallback
    );
  }

  return fallback;
};

const getEntityValue = (...values) => {
  for (const value of values) {
    const result = getDisplayValue(value, "");

    if (result) {
      return result;
    }
  }

  return "—";
};

// ============================================================
// COMPACT STAT CARD
// ============================================================

function StatCard({
  title,
  value,
  icon,
  color = "#1565C0",
  bg = "#E3F2FD",
  subtitle,
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        height: "100%",
        px: 1.25,
        py: 1,
        borderRadius: 1.5,
        border: "1px solid #E6EAF0",
        backgroundColor: "#FFFFFF",
        transition: "0.2s ease",

        "&:hover": {
          boxShadow: "0 3px 10px rgba(16,24,40,0.06)",
          borderColor: "#D0D5DD",
        },
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Box
          sx={{
            width: 36,
            height: 36,
            minWidth: 36,
            borderRadius: 1.1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: bg,
            color,
          }}
        >
          {icon}
        </Box>

        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: "0.66rem",
              color: "#667085",
              fontWeight: 500,
              lineHeight: 1.2,
            }}
          >
            {title}
          </Typography>

          <Typography
            sx={{
              mt: 0.2,
              fontSize: "1.1rem",
              lineHeight: 1.1,
              fontWeight: 800,
              color: "#101828",
            }}
          >
            {value}
          </Typography>

          {subtitle && (
            <Typography
              sx={{
                mt: 0.2,
                fontSize: "0.56rem",
                color: "#98A2B3",
                lineHeight: 1.2,
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}

// ============================================================
// INFO ITEM
// ============================================================

function InfoItem({ label, value }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        sx={{
          fontSize: "0.6rem",
          color: "#667085",
          fontWeight: 500,
          mb: 0.25,
        }}
      >
        {label}
      </Typography>

      <Typography
        sx={{
          fontSize: "0.74rem",
          color: "#101828",
          fontWeight: 700,
          lineHeight: 1.25,
          wordBreak: "break-word",
        }}
      >
        {getDisplayValue(value)}
      </Typography>
    </Box>
  );
}

// ============================================================
// MAIN
// ============================================================

export default function AssessmentResultsPage() {
  const params = useParams();

  const id = params?.id;

  const [data, setData] = useState(null);
  const [assessmentDetail, setAssessmentDetail] = useState(null);

  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [importFile, setImportFile] = useState(null);

  // ==========================================================
  // LOAD RESULTS + FULL ASSESSMENT DETAILS
  // ==========================================================

  const load = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError("");

      /*
       * IMPORTANT:
       *
       * Results API may return only IDs for:
       * organisation / centre / course / batch.
       *
       * So we also load the complete assessment.
       */
      const [resultsResponse, assessmentResponse] = await Promise.allSettled([
        api.getAssessmentResults(id, {
          search: search.trim(),
        }),

        api.getAssessment(id),
      ]);

      // --------------------------------------------------------
      // RESULTS
      // --------------------------------------------------------

      if (resultsResponse.status === "rejected") {
        throw resultsResponse.reason;
      }

      const resultsData = resultsResponse.value?.data || null;

      // --------------------------------------------------------
      // ASSESSMENT DETAIL
      // --------------------------------------------------------

      let fullAssessment = null;

      if (assessmentResponse.status === "fulfilled") {
        fullAssessment = assessmentResponse.value?.data || null;
      } else {
        console.warn("GET ASSESSMENT DETAIL ERROR:", assessmentResponse.reason);
      }

      setAssessmentDetail(fullAssessment);

      // --------------------------------------------------------
      // MERGE ASSESSMENT DATA
      // --------------------------------------------------------

      if (resultsData) {
        const resultAssessment = resultsData.assessment || {};

        const mergedAssessment = {
          ...fullAssessment,
          ...resultAssessment,

          // Keep nested populated values from full assessment
          organisation:
            resultAssessment.organisation ||
            fullAssessment?.organisation ||
            null,

          centre: resultAssessment.centre || fullAssessment?.centre || null,

          course: resultAssessment.course || fullAssessment?.course || null,

          batch: resultAssessment.batch || fullAssessment?.batch || null,

          parts:
            resultAssessment.parts?.length > 0
              ? resultAssessment.parts
              : fullAssessment?.parts || [],

          sections:
            resultAssessment.sections?.length > 0
              ? resultAssessment.sections
              : fullAssessment?.sections || [],
        };

        setData({
          ...resultsData,
          assessment: mergedAssessment,
        });
      } else {
        setData(null);
      }
    } catch (err) {
      console.error("GET ASSESSMENT RESULTS ERROR:", err);

      setError(err?.message || "Failed to load assessment results");
    } finally {
      setLoading(false);
    }
  }, [id, search]);

  useEffect(() => {
    load();
  }, [load]);

  // ==========================================================
  // IMPORT MARKS
  // ==========================================================

  const handleImport = async () => {
    if (!importFile) {
      alert("Please select an Excel file");
      return;
    }

    try {
      setImporting(true);
      setError("");

      await api.importMarks(id, importFile);

      alert("Marks imported successfully");

      setImportFile(null);

      const fileInput = document.getElementById(
        "assessment-marks-import-input",
      );

      if (fileInput) {
        fileInput.value = "";
      }

      await load();
    } catch (err) {
      console.error("IMPORT MARKS ERROR:", err);

      alert(err?.message || "Failed to import marks");
    } finally {
      setImporting(false);
    }
  };

  // ==========================================================
  // EXPORT TEMPLATE
  // ==========================================================

  const handleExportTemplate = async () => {
    try {
      await api.exportTemplate(id);
    } catch (err) {
      console.error("EXPORT TEMPLATE ERROR:", err);

      alert(err?.message || "Failed to download template");
    }
  };

  // ==========================================================
  // EXPORT RESULTS
  // ==========================================================

  const handleExportResults = async (options) => {
    try {
      if (!id) {
        throw new Error("Assessment ID is missing");
      }

      await api.exportResults(id, options);
    } catch (err) {
      console.error("EXPORT RESULTS ERROR:", err);

      alert(err?.message || "Failed to export results");

      throw err;
    }
  };

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading && !data) {
    return (
      <Layout>
        <Box
          sx={{
            minHeight: "55vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Stack alignItems="center" spacing={1}>
            <CircularProgress size={28} />

            <Typography
              sx={{
                fontSize: "0.7rem",
                color: "#667085",
              }}
            >
              Loading assessment results...
            </Typography>
          </Stack>
        </Box>
      </Layout>
    );
  }

  // ==========================================================
  // ERROR
  // ==========================================================

  if (error && !data) {
    return (
      <Layout>
        <Box
          sx={{
            p: {
              xs: 1.5,
              sm: 2,
            },
          }}
        >
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={load}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        </Box>
      </Layout>
    );
  }

  // ==========================================================
  // NO DATA
  // ==========================================================

  if (!data) {
    return (
      <Layout>
        <Box
          sx={{
            p: {
              xs: 1.5,
              sm: 2,
            },
          }}
        >
          <Alert severity="info">No assessment result data available.</Alert>
        </Box>
      </Layout>
    );
  }

  // ==========================================================
  // SAFE DATA
  // ==========================================================

  /*
   * Results API assessment has priority,
   * full assessment remains fallback.
   */
  const assessment = {
    ...(assessmentDetail || {}),
    ...(data.assessment || {}),
  };

  const stats = {
    totalStudents: Number(data.stats?.totalStudents) || 0,
    completed: Number(data.stats?.completed) || 0,
    pending: Number(data.stats?.pending) || 0,
    averageScore: Number(data.stats?.averageScore) || 0,
  };

  const parts = Array.isArray(data.parts)
    ? data.parts
    : Array.isArray(assessment.parts)
      ? assessment.parts
      : [];

  const sections = Array.isArray(data.sections)
    ? data.sections
    : Array.isArray(assessment.sections)
      ? assessment.sections
      : [];

  const hasParts =
    Boolean(data.hasParts) || Boolean(assessment.hasParts) || parts.length > 0;

  // ==========================================================
  // TOTAL MARKS
  // ==========================================================

  const configuredTotalMarks = hasParts
    ? parts.reduce(
        (sum, part) =>
          sum + (part?.isOptional ? 0 : Number(part?.totalMarks) || 0),
        0,
      )
    : sections.reduce(
        (sum, section) => sum + (Number(section?.totalMarks) || 0),
        0,
      );

  // ==========================================================
  // TOTAL QUESTIONS
  // ==========================================================

  const totalQuestions = hasParts
    ? parts.reduce(
        (sum, part) =>
          sum +
          (Number(part?.totalQuestions) ||
            part?.sections?.reduce(
              (sectionSum, section) =>
                sectionSum +
                (Number(section?.totalQuestions) ||
                  section?.questions?.length ||
                  0),
              0,
            ) ||
            0),
        0,
      )
    : sections.reduce(
        (sum, section) =>
          sum +
          (Number(section?.totalQuestions) || section?.questions?.length || 0),
        0,
      );

  // ==========================================================
  // RESOLVED HIERARCHY VALUES
  // ==========================================================

  const organisationName = getEntityValue(
    assessment.organisation,
    assessment.organization,
    assessment.organisationName,
    assessment.organizationName,
  );

  const centreName = getEntityValue(
    assessment.centre,
    assessment.center,
    assessment.centreName,
    assessment.centerName,
  );

  const courseName = getEntityValue(assessment.course, assessment.courseName);

  const batchName = getEntityValue(assessment.batch, assessment.batchName);

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <Layout>
      <Box
        sx={{
          width: "100%",
          minWidth: 0,
          overflowX: "hidden",

          px: {
            xs: 1,
            sm: 1.5,
            md: 2,
            lg: 2.5,
          },

          py: {
            xs: 1,
            sm: 1.5,
            md: 1.75,
          },
        }}
      >
        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <Paper
          elevation={0}
          sx={{
            mb: 1.25,
            px: {
              xs: 1.25,
              sm: 1.5,
            },
            py: 1.1,

            borderRadius: 1.5,
            border: "1px solid #E6EAF0",

            background: "linear-gradient(135deg, #F8FBFF 0%, #FFFFFF 70%)",
          }}
        >
          <Stack
            direction={{
              xs: "column",
              sm: "row",
            }}
            spacing={1}
            alignItems={{
              xs: "flex-start",
              sm: "center",
            }}
            justifyContent="space-between"
          >
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{
                minWidth: 0,
                flex: 1,
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  minWidth: 36,
                  borderRadius: 1,

                  backgroundColor: "#E3F2FD",
                  color: "#1565C0",

                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AssessmentIcon fontSize="small" />
              </Box>

              <Box sx={{ minWidth: 0 }}>
                <Stack
                  direction="row"
                  spacing={0.6}
                  alignItems="center"
                  flexWrap="wrap"
                  useFlexGap
                >
                  <Typography
                    sx={{
                      fontSize: {
                        xs: "0.98rem",
                        sm: "1.1rem",
                      },

                      fontWeight: 800,
                      color: "#101828",
                      lineHeight: 1.2,
                      wordBreak: "break-word",
                    }}
                  >
                    {getDisplayValue(assessment.name, "Assessment Results")}
                  </Typography>

                  <Chip
                    size="small"
                    label={hasParts ? "Parts" : "Sections"}
                    color="primary"
                    variant="outlined"
                    sx={{
                      height: 21,
                      fontSize: "0.58rem",
                      fontWeight: 600,
                    }}
                  />
                </Stack>

                <Typography
                  sx={{
                    mt: 0.25,
                    fontSize: "0.63rem",
                    color: "#667085",
                  }}
                >
                  {assessment.code
                    ? `Code: ${assessment.code}`
                    : "Assessment Results"}

                  {assessment.weekNumber
                    ? ` • Week ${assessment.weekNumber}`
                    : ""}
                </Typography>
              </Box>
            </Stack>

            <Tooltip title="Refresh results">
              <span>
                <IconButton
                  size="small"
                  onClick={load}
                  disabled={loading}
                  sx={{
                    width: 34,
                    height: 34,
                    border: "1px solid #D0D5DD",
                    borderRadius: 1,
                  }}
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Paper>

        {/* ================================================== */}
        {/* ERROR */}
        {/* ================================================== */}

        {error && data && (
          <Alert
            severity="error"
            sx={{
              mb: 1.25,
              py: 0.15,
              fontSize: "0.7rem",
            }}
            onClose={() => setError("")}
          >
            {error}
          </Alert>
        )}

        {/* ================================================== */}
        {/* SUMMARY */}
        {/* ================================================== */}

        <Grid
          container
          spacing={1}
          sx={{
            mb: 1.25,
          }}
        >
          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              title="Total Students"
              value={stats.totalStudents}
              subtitle="Students"
              icon={<SchoolIcon fontSize="small" />}
            />
          </Grid>

          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              title="Completed"
              value={stats.completed}
              subtitle="Completed"
              icon={<CheckCircleIcon fontSize="small" />}
              color="#2E7D32"
              bg="#E8F5E9"
            />
          </Grid>

          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              title="Pending"
              value={stats.pending}
              subtitle="Pending"
              icon={<PendingActionsIcon fontSize="small" />}
              color="#ED6C02"
              bg="#FFF4E5"
            />
          </Grid>

          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              title="Average"
              value={`${stats.averageScore}%`}
              subtitle="Performance"
              icon={<PercentIcon fontSize="small" />}
              color="#7B1FA2"
              bg="#F3E5F5"
            />
          </Grid>
        </Grid>

        {/* ================================================== */}
        {/* ASSESSMENT OVERVIEW */}
        {/* ================================================== */}

        <Paper
          elevation={0}
          sx={{
            mb: 1.25,
            borderRadius: 1.5,
            border: "1px solid #E6EAF0",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              px: 1.5,
              py: 0.8,
              backgroundColor: "#F8FAFC",
              borderBottom: "1px solid #E6EAF0",
            }}
          >
            <Stack direction="row" spacing={0.7} alignItems="center">
              <LayersIcon
                sx={{
                  fontSize: 18,
                  color: "#1565C0",
                }}
              />

              <Typography
                sx={{
                  fontSize: "0.77rem",
                  fontWeight: 800,
                  color: "#101828",
                }}
              >
                Assessment Overview
              </Typography>
            </Stack>
          </Box>

          <Box sx={{ p: 1.4 }}>
            <Grid
              container
              spacing={{
                xs: 1.1,
                sm: 1.5,
              }}
            >
              <Grid item xs={6} sm={4} md={3}>
                <InfoItem label="Assessment" value={assessment.name} />
              </Grid>

              <Grid item xs={6} sm={4} md={3}>
                <InfoItem label="Code" value={assessment.code} />
              </Grid>

              <Grid item xs={6} sm={4} md={3}>
                <InfoItem
                  label="Week"
                  value={
                    assessment.weekNumber
                      ? `Week ${assessment.weekNumber}`
                      : null
                  }
                />
              </Grid>

              <Grid item xs={6} sm={4} md={3}>
                <InfoItem label="Status" value={assessment.status} />
              </Grid>

              <Grid item xs={6} sm={4} md={3}>
                <InfoItem label="Organisation" value={organisationName} />
              </Grid>

              <Grid item xs={6} sm={4} md={3}>
                <InfoItem label="Centre" value={centreName} />
              </Grid>

              <Grid item xs={6} sm={4} md={3}>
                <InfoItem label="Course" value={courseName} />
              </Grid>

              <Grid item xs={6} sm={4} md={3}>
                <InfoItem label="Batch" value={batchName} />
              </Grid>
            </Grid>

          </Box>
        </Paper>

        {/* ================================================== */}
        {/* SEARCH + IMPORT */}
        {/* ================================================== */}

       <Paper
  elevation={0}
  sx={{
    mb: 1.25,
    p: 1,
    borderRadius: 1.5,
    border: "1px solid #E6EAF0",
    backgroundColor: "#FFFFFF",
    width: "100%",
  }}
>
  <Grid
    container
    spacing={1}
    alignItems="center"
    sx={{
      width: "100%",
      m: 0,
    }}
  >
    {/* ================= SEARCH ================= */}
    <Grid item xs={12} sm={6} md={3}>
      <TextField
        fullWidth
        size="small"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search student..."
        sx={{
          "& .MuiOutlinedInput-root": {
            height: 36,
            borderRadius: 1,
            backgroundColor: "#F8FAFC",

            "& fieldset": {
              borderColor: "#E2E8F0",
            },

            "&:hover fieldset": {
              borderColor: "#1565C0",
            },

            "&.Mui-focused fieldset": {
              borderColor: "#1565C0",
              borderWidth: 1,
            },
          },

          "& .MuiInputBase-input": {
            fontSize: "0.72rem",
          },
        }}
      />
    </Grid>

    {/* ================= FILE ================= */}
    <Grid item xs={12} sm={6} md={3}>
      {importFile ? (
        <Chip
          label={importFile.name}
          onDelete={() => {
            setImportFile(null);

            const input = document.getElementById(
              "assessment-marks-import-input"
            );

            if (input) {
              input.value = "";
            }
          }}
          sx={{
            width: "100%",
            height: 36,
            borderRadius: 1,
            justifyContent: "flex-start",
            backgroundColor: "#F8FAFC",
            border: "1px solid #E2E8F0",

            "& .MuiChip-label": {
              display: "block",
              width: "100%",
              fontSize: "0.66rem",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              pr: 1,
            },

            "& .MuiChip-deleteIcon": {
              fontSize: 17,
            },
          }}
        />
      ) : (
        <Box
          sx={{
            height: 36,
            px: 1.25,
            display: "flex",
            alignItems: "center",
            borderRadius: 1,
            backgroundColor: "#F8FAFC",
            border: "1px dashed #D9E0E8",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <Typography
            sx={{
              fontSize: "0.65rem",
              color: "#98A2B3",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            No marks file selected
          </Typography>
        </Box>
      )}
    </Grid>

    {/* ================= STATS + ACTIONS ================= */}
    <Grid item xs={12} md={6}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 0.75,
          width: "100%",
          flexWrap: "wrap",
        }}
      >
        {/* ---------- STATS ---------- */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            flexWrap: "wrap",
          }}
        >
          <Chip
            size="small"
            icon={hasParts ? <LayersIcon /> : <QuizIcon />}
            label={
              hasParts
                ? `${parts.length} Part(s)`
                : `${sections.length} Section(s)`
            }
            variant="outlined"
            sx={{
              height: 25,
              borderRadius: 0.8,
              fontSize: "0.58rem",
              fontWeight: 600,

              "& .MuiChip-icon": {
                fontSize: 14,
              },
            }}
          />

          <Chip
            size="small"
            icon={<QuizIcon />}
            label={`${totalQuestions} Question(s)`}
            variant="outlined"
            sx={{
              height: 25,
              borderRadius: 0.8,
              fontSize: "0.58rem",
              fontWeight: 600,

              "& .MuiChip-icon": {
                fontSize: 14,
              },
            }}
          />

          <Chip
            size="small"
            label={`Marks: ${configuredTotalMarks}`}
            variant="outlined"
            sx={{
              height: 25,
              borderRadius: 0.8,
              fontSize: "0.58rem",
              fontWeight: 600,
            }}
          />
        </Box>

        {/* ---------- ACTION BUTTONS ---------- */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            flexShrink: 0,
          }}
        >
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={handleExportTemplate}
            sx={{
              height: 36,
              minWidth: 82,
              px: 1.2,
              textTransform: "none",
              fontSize: "0.68rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
              borderRadius: 1,
            }}
          >
            Template
          </Button>

          <Button
            variant="outlined"
            component="label"
            size="small"
            startIcon={<UploadIcon />}
            disabled={importing}
            sx={{
              height: 36,
              minWidth: 92,
              px: 1.2,
              textTransform: "none",
              fontSize: "0.68rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
              borderRadius: 1,
            }}
          >
            Select File

            <input
              id="assessment-marks-import-input"
              type="file"
              hidden
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0];

                if (file) {
                  setImportFile(file);
                }
              }}
            />
          </Button>

          {importFile && (
            <Button
              variant="contained"
              color="success"
              size="small"
              disabled={importing}
              startIcon={
                importing ? (
                  <CircularProgress
                    size={15}
                    color="inherit"
                  />
                ) : (
                  <UploadIcon />
                )
              }
              onClick={handleImport}
              sx={{
                height: 36,
                minWidth: 105,
                px: 1.3,
                textTransform: "none",
                fontSize: "0.68rem",
                fontWeight: 700,
                whiteSpace: "nowrap",
                borderRadius: 1,
              }}
            >
              {importing ? "Uploading..." : "Upload Marks"}
            </Button>
          )}
        </Box>
      </Box>
    </Grid>
  </Grid>
</Paper>

        {/* ================================================== */}
        {/* RESULTS */}
        {/* ================================================== */}

        <Paper
          elevation={0}
          sx={{
            borderRadius: 1.5,
            border: "1px solid #E6EAF0",
            overflow: "hidden",
          }}
        >
          {/* RESULTS HEADER */}

      {/*     <Box
            sx={{
              px: 1.5,
              py: 0.8,
              backgroundColor: "#F8FAFC",
              borderBottom: "1px solid #E6EAF0",
            }}
          >
            <Stack
              direction={{
                xs: "column",
                sm: "row",
              }}
              spacing={0.7}
              alignItems={{
                xs: "flex-start",
                sm: "center",
              }}
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={0.7} alignItems="center">
                <AssessmentIcon
                  sx={{
                    fontSize: 18,
                    color: "#1565C0",
                  }}
                />

                <Typography
                  sx={{
                    fontSize: "0.78rem",
                    fontWeight: 800,
                    color: "#101828",
                  }}
                >
                  Student Results
                </Typography>
              </Stack>

              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  label={`${stats.totalStudents} Students`}
                  sx={{
                    height: 21,
                    fontSize: "0.56rem",
                  }}
                />

                <Chip
                  size="small"
                  label={`${stats.completed} Completed`}
                  color="success"
                  variant="outlined"
                  sx={{
                    height: 21,
                    fontSize: "0.56rem",
                  }}
                />

                <Chip
                  size="small"
                  label={`${stats.pending} Pending`}
                  color="warning"
                  variant="outlined"
                  sx={{
                    height: 21,
                    fontSize: "0.56rem",
                  }}
                />
              </Stack>
            </Stack>
          </Box> */}

          {/* TABLE */}

          <Box
            sx={{
              width: "100%",
              minWidth: 0,
              overflowX: "auto",

              "& .MuiDataGrid-root": {
                border: 0,
              },
            }}
          >
            <ResultsTable
              results={data.results || []}
              sections={sections}
              parts={parts}
              hasParts={hasParts}
              assessment={assessment}
              onViewStudent={(studentId) => setSelectedStudent(studentId)}
              onExportResults={handleExportResults}
            />
          </Box>
        </Paper>

        {/* ================================================== */}
        {/* STUDENT DETAIL */}
        {/* ================================================== */}

        <Dialog
          open={Boolean(selectedStudent)}
          onClose={() => setSelectedStudent(null)}
          maxWidth="lg"
          fullWidth
          fullScreen
          PaperProps={{
            sx: {
              borderRadius: {
                xs: 0,
                sm: 2,
              },
            },
          }}
        >
          <DialogTitle
            sx={{
              px: {
                xs: 1.5,
                sm: 2,
              },

              py: 1.1,

              borderBottom: "1px solid #E6EAF0",
            }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={1}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1,

                    backgroundColor: "#E3F2FD",
                    color: "#1565C0",

                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <AssessmentIcon fontSize="small" />
                </Box>

                <Box>
                  <Typography
                    sx={{
                      fontSize: "0.86rem",
                      fontWeight: 800,
                      color: "#101828",
                    }}
                  >
                    Student Result
                  </Typography>

                  <Typography
                    sx={{
                      fontSize: "0.6rem",
                      color: "#667085",
                    }}
                  >
                    Detailed assessment performance
                  </Typography>
                </Box>
              </Stack>

              <IconButton
                size="small"
                onClick={() => setSelectedStudent(null)}
                sx={{
                  width: 32,
                  height: 32,
                  border: "1px solid #D0D5DD",
                  borderRadius: 1,
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          </DialogTitle>

          <DialogContent
            sx={{
              p: {
                xs: 1,
                sm: 2,
              },

              backgroundColor: "#F8FAFC",
            }}
          >
            {selectedStudent && (
              <StudentResultDetail
                assessmentId={id}
                studentId={selectedStudent}
              />
            )}
          </DialogContent>
        </Dialog>
      </Box>
    </Layout>
  );
}
