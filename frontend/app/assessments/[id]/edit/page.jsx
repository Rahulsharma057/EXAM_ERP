
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Breadcrumbs,
  Link,
  Chip,
  Divider,
  Stack,
} from "@mui/material";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AssessmentIcon from "@mui/icons-material/Assessment";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ViewListIcon from "@mui/icons-material/ViewList";

import Layout from "../../../../components/common/Layout";
import AssessmentBuilder from "../../../../components/assessment/AssessmentBuilder";
import { api } from "../../../../services/api";

export default function EditAssessmentPage() {
  const params = useParams();
  const router = useRouter();

  const id = params?.id;

  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // =========================================================
  // LOAD ASSESSMENT
  // =========================================================

  const loadAssessment = useCallback(
    async (showLoader = true) => {
      if (!id) {
        return;
      }

      try {
        if (showLoader) {
          setLoading(true);
        } else {
          setRefreshing(true);
        }

        setError("");

        const res = await api.getAssessment(id);

        if (!res?.data) {
          throw new Error(
            "Assessment data not found",
          );
        }

        setAssessment(res.data);
      } catch (err) {
        console.error(
          "GET ASSESSMENT ERROR:",
          err,
        );

        setError(
          err?.message ||
            "Failed to load assessment",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id],
  );

  // =========================================================
  // INITIAL LOAD
  // =========================================================

  useEffect(() => {
    loadAssessment(true);
  }, [loadAssessment]);

  // =========================================================
  // BUILDER UPDATE CALLBACK
  // =========================================================

  const handleUpdate = async () => {
    await loadAssessment(false);
  };

  // =========================================================
  // STATUS COLOR
  // =========================================================

  const getStatusColor = (status) => {
    switch (status) {
      case "PUBLISHED":
        return "success";

      case "CLOSED":
        return "error";

      case "SCHEDULED":
        return "info";

      case "ARCHIVED":
        return "default";

      case "DRAFT":
      default:
        return "warning";
    }
  };

  // =========================================================
  // MODE LABEL
  // =========================================================

  const isPartsMode =
    Boolean(assessment?.hasParts);

  const structureLabel = isPartsMode
    ? "Parts → Sections → Questions"
    : "Sections → Questions";

  // =========================================================
  // COUNT PARTS / SECTIONS
  // =========================================================

  const getPartsCount = () => {
    if (!assessment?.parts) {
      return 0;
    }

    return assessment.parts.filter(
      (part) => part?.isActive !== false,
    ).length;
  };

  const getSectionsCount = () => {
    if (!assessment?.sections) {
      return 0;
    }

    return assessment.sections.filter(
      (section) =>
        section?.isActive !== false,
    ).length;
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <Layout>
        <Box
          sx={{
            minHeight: "60vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <CircularProgress />

          <Typography color="text.secondary">
            Loading assessment...
          </Typography>
        </Box>
      </Layout>
    );
  }

  // =========================================================
  // ERROR
  // =========================================================

  if (error || !assessment) {
    return (
      <Layout>
        <Box
          sx={{
            maxWidth: 900,
            mx: "auto",
            mt: 4,
            px: 2,
          }}
        >
          <Alert
            severity="error"
            sx={{ mb: 3 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() =>
                  loadAssessment(true)
                }
              >
                Retry
              </Button>
            }
          >
            {error ||
              "Assessment not found"}
          </Alert>

          <Button
            startIcon={<ArrowBackIcon />}
            variant="outlined"
            onClick={() =>
              router.push("/assessments")
            }
          >
            Back to Assessments
          </Button>
        </Box>
      </Layout>
    );
  }

  // =========================================================
  // EDIT PAGE
  // =========================================================

  return (
    <Layout>
      <Box
        sx={{
          width: "100%",
          maxWidth: 1400,
          mx: "auto",
        }}
      >
        {/* ================================================= */}
        {/* BREADCRUMBS */}
        {/* ================================================= */}

        <Breadcrumbs
          sx={{
            mb: 2,
            px: {
              xs: 1,
              sm: 0,
            },
          }}
        >
          <Link
            component="button"
            underline="hover"
            color="inherit"
            onClick={() =>
              router.push("/assessments")
            }
          >
            Assessments
          </Link>

          <Typography color="text.primary">
            Edit Assessment
          </Typography>
        </Breadcrumbs>

        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <Paper
          elevation={0}
          sx={{
            p: {
              xs: 2,
              sm: 3,
            },
            mb: 3,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: {
                xs: "flex-start",
                md: "center",
              },
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            {/* LEFT */}
            <Box>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  mb: 1,
                  flexWrap: "wrap",
                }}
              >
                <Typography
                  variant="h4"
                  fontWeight={700}
                >
                  Edit Assessment
                </Typography>

                <Chip
                  size="small"
                  label={
                    assessment.status ||
                    "DRAFT"
                  }
                  color={getStatusColor(
                    assessment.status,
                  )}
                />
              </Box>

              <Typography
                variant="h6"
                color="text.secondary"
              >
                {assessment.name}
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.75 }}
              >
                {assessment.code ||
                  "No assessment code"}
              </Typography>
            </Box>

            {/* ACTIONS */}
            <Stack
              direction={{
                xs: "column",
                sm: "row",
              }}
              spacing={1}
              sx={{
                width: {
                  xs: "100%",
                  sm: "auto",
                },
              }}
            >
              <Button
                variant="outlined"
                startIcon={
                  <ArrowBackIcon />
                }
                onClick={() =>
                  router.push(
                    "/assessments",
                  )
                }
              >
                Back
              </Button>

              <Button
                variant="outlined"
                startIcon={
                  <AssessmentIcon />
                }
                onClick={() =>
                  router.push(
                    `/assessments/${assessment._id}`,
                  )
                }
              >
                View
              </Button>
            </Stack>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* ================================================= */}
          {/* ASSESSMENT INFO */}
          {/* ================================================= */}

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                md: "repeat(4, 1fr)",
              },
              gap: 2,
            }}
          >
            <InfoItem
              label="Week"
              value={`Week ${
                assessment.weekNumber ||
                "-"
              }`}
            />

            <InfoItem
              label="Batch"
              value={
                assessment.batch?.name ||
                "-"
              }
            />

            <InfoItem
              label="Total Questions"
              value={
                assessment.totalQuestions ??
                0
              }
            />

            <InfoItem
              label="Total Marks"
              value={
                assessment.totalMarks ??
                0
              }
            />
          </Box>

          {/* ================================================= */}
          {/* STRUCTURE INFO */}
          {/* ================================================= */}

          <Box
            sx={{
              mt: 2,
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, 1fr)",
                md: "repeat(3, 1fr)",
              },
              gap: 2,
            }}
          >
            <InfoItem
              label="Assessment Structure"
              value={structureLabel}
            />

            {isPartsMode ? (
              <InfoItem
                label="Active Parts"
                value={getPartsCount()}
              />
            ) : (
              <InfoItem
                label="Active Sections"
                value={getSectionsCount()}
              />
            )}

            <InfoItem
              label="Academic Year"
              value={
                assessment.academicYear ||
                "-"
              }
            />
          </Box>
        </Paper>

        {/* ================================================= */}
        {/* MODE INFORMATION */}
        {/* ================================================= */}

        <Alert
          severity={
            isPartsMode
              ? "info"
              : "success"
          }
          icon={
            isPartsMode ? (
              <AccountTreeIcon />
            ) : (
              <ViewListIcon />
            )
          }
          sx={{
            mb: 3,
            borderRadius: 2,
          }}
        >
          {isPartsMode ? (
            <>
              <strong>
                Parts Mode is enabled.
              </strong>{" "}
              This assessment uses
              <strong>
                {" "}
                Part → Section → Question
              </strong>{" "}
              hierarchy. Optional Parts can
              be configured from the Assessment
              Builder.
            </>
          ) : (
            <>
              <strong>
                Direct Sections Mode is enabled.
              </strong>{" "}
              This assessment uses
              <strong>
                {" "}
                Section → Question
              </strong>{" "}
              hierarchy.
            </>
          )}
        </Alert>

        {/* ================================================= */}
        {/* PUBLISHED / LOCK WARNING */}
        {/* ================================================= */}

        {assessment.status !==
          "DRAFT" && (
          <Alert
            severity="warning"
            sx={{
              mb: 3,
              borderRadius: 2,
            }}
          >
            This assessment is{" "}
            <strong>
              {assessment.status}
            </strong>
            . Assessment structure should
            normally be modified only while it
            is in <strong>DRAFT</strong> status.
            If submissions already exist, the
            backend should prevent structural
            changes to preserve historical
            results.
          </Alert>
        )}

        {/* ================================================= */}
        {/* REFRESHING */}
        {/* ================================================= */}

        {refreshing && (
          <Alert
            severity="info"
            sx={{ mb: 2 }}
            icon={
              <CircularProgress
                size={18}
              />
            }
          >
            Refreshing assessment structure...
          </Alert>
        )}

        {/* ================================================= */}
        {/* BUILDER */}
        {/* ================================================= */}

        <Paper
          elevation={0}
          sx={{
            p: {
              xs: 1.5,
              sm: 2,
              md: 3,
            },
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box
            sx={{
              mb: 3,
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: {
                xs: "flex-start",
                sm: "center",
              },
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            <Box>
              <Typography
                variant="h5"
                fontWeight={700}
              >
                Assessment Builder
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                Manage{" "}
                {isPartsMode
                  ? "parts, sections and questions"
                  : "sections and questions"}{" "}
                for this assessment.
              </Typography>
            </Box>

            <Chip
              icon={
                isPartsMode ? (
                  <AccountTreeIcon />
                ) : (
                  <ViewListIcon />
                )
              }
              label={
                isPartsMode
                  ? "Parts Enabled"
                  : "Parts Disabled"
              }
              color={
                isPartsMode
                  ? "secondary"
                  : "primary"
              }
              variant="outlined"
            />
          </Box>

          <AssessmentBuilder
            assessment={assessment}
            onUpdate={handleUpdate}
          />
        </Paper>
      </Box>
    </Layout>
  );
}

// ===========================================================
// INFO ITEM
// ===========================================================

function InfoItem({
  label,
  value,
}) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: "grey.50",
        border: "1px solid",
        borderColor: "divider",
        minWidth: 0,
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        sx={{
          mb: 0.5,
        }}
      >
        {label}
      </Typography>

      <Typography
        variant="body1"
        fontWeight={600}
        sx={{
          wordBreak: "break-word",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
