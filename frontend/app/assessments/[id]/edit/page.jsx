
"use client";

import React, { useEffect, useState } from "react";
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
} from "@mui/material";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import AssessmentIcon from "@mui/icons-material/Assessment";

import Layout from "../../../../components/common/Layout";
import AssessmentBuilder from "../../../../components/assessment/AssessmentBuilder";
import { api } from "../../../../services/api";

export default function EditAssessmentPage() {
  const params = useParams();
  const router = useRouter();

  const id = params?.id;

  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ---------------------------------------------------------
  // LOAD ASSESSMENT
  // ---------------------------------------------------------

  const loadAssessment = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError("");

      const res = await api.getAssessment(id);

      if (!res?.data) {
        throw new Error("Assessment data not found");
      }

      setAssessment(res.data);
    } catch (err) {
      console.error("GET ASSESSMENT ERROR:", err);

      setError(
        err?.message || "Failed to load assessment"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssessment();
  }, [id]);

  // ---------------------------------------------------------
  // UPDATE CALLBACK
  // ---------------------------------------------------------

  const handleUpdate = async () => {
    await loadAssessment();
  };

  // ---------------------------------------------------------
  // LOADING
  // ---------------------------------------------------------

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

  // ---------------------------------------------------------
  // ERROR
  // ---------------------------------------------------------

  if (error || !assessment) {
    return (
      <Layout>
        <Box sx={{ maxWidth: 900, mx: "auto", mt: 4 }}>
          <Alert
            severity="error"
            sx={{ mb: 3 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={loadAssessment}
              >
                Retry
              </Button>
            }
          >
            {error || "Assessment not found"}
          </Alert>

          <Button
            startIcon={<ArrowBackIcon />}
            variant="outlined"
            onClick={() => router.push("/assessments")}
          >
            Back to Assessments
          </Button>
        </Box>
      </Layout>
    );
  }

  // ---------------------------------------------------------
  // EDIT PAGE
  // ---------------------------------------------------------

  return (
    <Layout>
      <Box sx={{ maxWidth: 1400, mx: "auto" }}>
        {/* ------------------------------------------------ */}
        {/* BREADCRUMBS */}
        {/* ------------------------------------------------ */}

        <Breadcrumbs sx={{ mb: 2 }}>
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

        {/* ------------------------------------------------ */}
        {/* HEADER */}
        {/* ------------------------------------------------ */}

        <Paper
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 2,
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
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
                  label={assessment.status}
                  color={
                    assessment.status === "PUBLISHED"
                      ? "success"
                      : assessment.status === "CLOSED"
                      ? "error"
                      : assessment.status === "SCHEDULED"
                      ? "info"
                      : "default"
                  }
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
                sx={{ mt: 1 }}
              >
                {assessment.code || "No assessment code"}
              </Typography>
            </Box>

            <Box
              sx={{
                display: "flex",
                gap: 1,
                flexWrap: "wrap",
              }}
            >
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={() =>
                  router.push("/assessments")
                }
              >
                Back
              </Button>

              <Button
                variant="outlined"
                startIcon={<AssessmentIcon />}
                onClick={() =>
                  router.push(
                    `/assessments/${assessment._id}`
                  )
                }
              >
                View
              </Button>
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* ------------------------------------------------ */}
          {/* ASSESSMENT INFO */}
          {/* ------------------------------------------------ */}

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
              value={`Week ${assessment.weekNumber}`}
            />

            <InfoItem
              label="Batch"
              value={assessment.batch?.name || "-"}
            />

            <InfoItem
              label="Total Questions"
              value={
                assessment.totalQuestions || 0
              }
            />

            <InfoItem
              label="Total Marks"
              value={assessment.totalMarks || 0}
            />
          </Box>
        </Paper>

        {/* ------------------------------------------------ */}
        {/* PUBLISHED WARNING */}
        {/* ------------------------------------------------ */}

        {assessment.status !== "DRAFT" && (
          <Alert severity="warning" sx={{ mb: 3 }}>
            This assessment is{" "}
            <strong>{assessment.status}</strong>.
            Assessment structure should normally be
            modified only while it is in DRAFT status.
          </Alert>
        )}

        {/* ------------------------------------------------ */}
        {/* BUILDER */}
        {/* ------------------------------------------------ */}

        <Paper
          sx={{
            p: {
              xs: 1.5,
              sm: 2,
              md: 3,
            },
            borderRadius: 2,
          }}
        >
          <Box sx={{ mb: 3 }}>
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
              Manage sections and questions for this
              assessment.
            </Typography>
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

// ---------------------------------------------------------
// INFO ITEM
// ---------------------------------------------------------

function InfoItem({ label, value }) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: "grey.50",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        display="block"
        sx={{ mb: 0.5 }}
      >
        {label}
      </Typography>

      <Typography
        variant="body1"
        fontWeight={600}
      >
        {value}
      </Typography>
    </Box>
  );
}

