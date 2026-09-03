
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

import {
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  Button,
  Paper,
  TextField,
  Grid,
  FormControl,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  Divider,
  Chip,
} from "@mui/material";

import Layout from "../../../components/common/Layout";
import HierarchyFilter from "../../../components/assessment/HierarchyFilter";
import AssessmentBuilder from "../../../components/assessment/AssessmentBuilder";
import { api } from "../../../services/api";

const steps = [
  "Basic Details",
  "Hierarchy",
  "Build Assessment",
  "Preview & Publish",
];

export default function NewAssessmentPage() {
  const router = useRouter();

  // ==========================================================
  // STATE
  // ==========================================================

  const [activeStep, setActiveStep] = useState(0);

  const [assessment, setAssessment] = useState(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    instructions: "",

    weekNumber: 1,
    academicYear: "",

    publishDate: "",
    publishTime: "",

    closeDate: "",
    closeTime: "",

    // ========================================================
    // IMPORTANT
    // false = Assessment → Sections → Questions
    // true  = Assessment → Parts → Sections → Questions
    // ========================================================

    hasParts: false,
  });

  const [hierarchy, setHierarchy] = useState({});

  // ==========================================================
  // FORM CHANGE
  // ==========================================================

  const handleFormChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));

    setError("");
  };

  // ==========================================================
  // BASIC DETAILS VALIDATION
  // ==========================================================

  const validateBasicDetails = () => {
    if (!form.name.trim()) {
      setError("Please enter assessment name.");
      return false;
    }

    if (!form.code.trim()) {
      setError("Please enter assessment code.");
      return false;
    }

    const weekNumber = Number(form.weekNumber);

    if (
      !Number.isInteger(weekNumber) ||
      weekNumber <= 0
    ) {
      setError("Please enter a valid week number.");
      return false;
    }

    if (!form.academicYear.trim()) {
      setError("Please enter academic/training year.");
      return false;
    }

    return true;
  };

  // ==========================================================
  // HIERARCHY VALIDATION
  // ==========================================================

  const validateHierarchy = () => {
    if (!hierarchy.organisation) {
      setError("Please select Organisation.");
      return false;
    }

    if (!hierarchy.centre) {
      setError("Please select Centre.");
      return false;
    }

    if (!hierarchy.course) {
      setError("Please select Course.");
      return false;
    }

    if (!hierarchy.batch) {
      setError("Please select Batch.");
      return false;
    }

    return true;
  };

  // ==========================================================
  // STEP 1 → STEP 2
  // ==========================================================

  const handleBasicNext = () => {
    setError("");

    if (!validateBasicDetails()) {
      return;
    }

    setActiveStep(1);
  };

  // ==========================================================
  // CREATE ASSESSMENT
  // ==========================================================

  const handleCreate = async () => {
    setError("");

    if (!validateHierarchy()) {
      return;
    }

    try {
      setLoading(true);

      const data = {
        // ====================================================
        // BASIC
        // ====================================================

        name: form.name.trim(),

        code: form.code.trim(),

        description:
          form.description?.trim() || "",

        instructions:
          form.instructions?.trim() || "",

        weekNumber: Number(form.weekNumber),

        academicYear:
          form.academicYear.trim(),

        // ====================================================
        // SCHEDULE
        // ====================================================

        publishDate:
          form.publishDate || null,

        publishTime:
          form.publishTime || null,

        closeDate:
          form.closeDate || null,

        closeTime:
          form.closeTime || null,

        // ====================================================
        // PART MODE
        // ====================================================

        hasParts: Boolean(form.hasParts),

        // ====================================================
        // HIERARCHY
        // ====================================================

        organisation:
          hierarchy.organisation,

        centre:
          hierarchy.centre,

        course:
          hierarchy.course,

        batch:
          hierarchy.batch,
      };

      const res =
        await api.createAssessment(data);

      if (!res?.success || !res?.data) {
        throw new Error(
          res?.message ||
            "Assessment creation failed.",
        );
      }

      setAssessment(res.data);

      // Builder step
      setActiveStep(2);
    } catch (err) {
      console.error(
        "CREATE ASSESSMENT ERROR:",
        err,
      );

      setError(
        err?.message ||
          "Failed to create assessment.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // PUBLISH
  // ==========================================================

  const handlePublish = async () => {
    if (!assessment?._id) {
      setError(
        "Assessment information is missing.",
      );
      return;
    }

    try {
      setLoading(true);
      setError("");

      await api.publishAssessment(
        assessment._id,
      );

      router.push("/assessments");
    } catch (err) {
      console.error(
        "PUBLISH ASSESSMENT ERROR:",
        err,
      );

      setError(
        err?.message ||
          "Failed to publish assessment.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // BACK TO HIERARCHY
  // ==========================================================

  const handleBackToHierarchy = () => {
    setActiveStep(1);
  };

  // ==========================================================
  // BUILDER UPDATE
  // ==========================================================

  const handleBuilderUpdate = async () => {
    if (!assessment?._id) {
      return;
    }

    try {
      const res =
        await api.getAssessment(
          assessment._id,
        );

      if (res?.data) {
        setAssessment(res.data);
      }
    } catch (err) {
      console.error(
        "REFRESH ASSESSMENT ERROR:",
        err,
      );
    }
  };

  // ==========================================================
  // PREVIEW STEP
  // ==========================================================

  const handlePreview = async () => {
    try {
      setLoading(true);
      setError("");

      const res =
        await api.getPreview(
          assessment._id,
        );

      if (res?.data?.assessment) {
        setAssessment(
          res.data.assessment,
        );
      }

      setActiveStep(3);
    } catch (err) {
      console.error(
        "PREVIEW ERROR:",
        err,
      );

      setError(
        err?.message ||
          "Unable to load assessment preview.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <Layout>
      <Box
        sx={{
          width: "100%",
          maxWidth: 1400,
          mx: "auto",
        }}
      >
        {/* ================================================== */}
        {/* HEADER */}
        {/* ================================================== */}

        <Box
          sx={{
            mb: 3,
            display: "flex",
            justifyContent: "space-between",
            alignItems: {
              xs: "flex-start",
              sm: "center",
            },
            gap: 2,
            flexDirection: {
              xs: "column",
              sm: "row",
            },
          }}
        >
          <Box>
            <Typography
              variant="h4"
              fontWeight={700}
            >
              Create Assessment
            </Typography>

            <Typography
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              Create a weekly assessment,
              configure sections/questions and
              publish it for students.
            </Typography>
          </Box>

          {assessment && (
            <Chip
              label={
                assessment.hasParts
                  ? "Parts Mode"
                  : "Direct Sections Mode"
              }
              color={
                assessment.hasParts
                  ? "secondary"
                  : "primary"
              }
              variant="outlined"
            />
          )}
        </Box>

        {/* ================================================== */}
        {/* STEPPER */}
        {/* ================================================== */}

        <Stepper
          activeStep={activeStep}
          alternativeLabel
          sx={{
            mb: 4,
          }}
        >
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* ================================================== */}
        {/* ERROR */}
        {/* ================================================== */}

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 3 }}
            onClose={() =>
              setError("")
            }
          >
            {error}
          </Alert>
        )}

        {/* ================================================== */}
        {/* STEP 1 - BASIC DETAILS */}
        {/* ================================================== */}

        {activeStep === 0 && (
          <Paper
            elevation={0}
            sx={{
              p: {
                xs: 2,
                sm: 3,
              },
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography
              variant="h6"
              fontWeight={700}
              mb={3}
            >
              Basic Details
            </Typography>

            <Grid
              container
              spacing={2}
            >
              {/* Assessment Name */}
              <Grid
                item
                xs={12}
                md={6}
              >
                <TextField
                  label="Assessment Name"
                  fullWidth
                  required
                  value={form.name}
                  onChange={(e) =>
                    handleFormChange(
                      "name",
                      e.target.value,
                    )
                  }
                />
              </Grid>

              {/* Assessment Code */}
              <Grid
                item
                xs={12}
                md={6}
              >
                <TextField
                  label="Assessment Code"
                  fullWidth
                  required
                  value={form.code}
                  onChange={(e) =>
                    handleFormChange(
                      "code",
                      e.target.value,
                    )
                  }
                />
              </Grid>

              {/* Week */}
              <Grid
                item
                xs={12}
                sm={6}
                md={4}
              >
                <TextField
                  label="Week Number"
                  type="number"
                  fullWidth
                  required
                  inputProps={{
                    min: 1,
                  }}
                  value={
                    form.weekNumber
                  }
                  onChange={(e) =>
                    handleFormChange(
                      "weekNumber",
                      e.target.value,
                    )
                  }
                />
              </Grid>

              {/* Academic Year */}
              <Grid
                item
                xs={12}
                sm={6}
                md={4}
              >
                <TextField
                  label="Academic / Training Year"
                  fullWidth
                  required
                  placeholder="2026-27"
                  value={
                    form.academicYear
                  }
                  onChange={(e) =>
                    handleFormChange(
                      "academicYear",
                      e.target.value,
                    )
                  }
                />
              </Grid>

              {/* Has Parts */}
              <Grid
                item
                xs={12}
                md={4}
              >
                <Paper
                  variant="outlined"
                  sx={{
                    height: "100%",
                    minHeight: 56,
                    px: 2,
                    display: "flex",
                    alignItems: "center",
                    borderRadius: 2,
                  }}
                >
                  <FormControlLabel
                    control={
                      <Switch
                        checked={
                          form.hasParts
                        }
                        onChange={(e) =>
                          handleFormChange(
                            "hasParts",
                            e.target.checked,
                          )
                        }
                        color="secondary"
                      />
                    }
                    label={
                      <Box>
                        <Typography
                          fontWeight={600}
                        >
                          Enable Parts
                        </Typography>

                        <Typography
                          variant="caption"
                          color="text.secondary"
                        >
                          Use Part → Section → Question
                        </Typography>
                      </Box>
                    }
                  />
                </Paper>
              </Grid>

              {/* Description */}
              <Grid
                item
                xs={12}
              >
                <TextField
                  label="Description"
                  fullWidth
                  multiline
                  rows={3}
                  value={
                    form.description
                  }
                  onChange={(e) =>
                    handleFormChange(
                      "description",
                      e.target.value,
                    )
                  }
                />
              </Grid>

              {/* Instructions */}
              <Grid
                item
                xs={12}
              >
                <TextField
                  label="Instructions"
                  fullWidth
                  multiline
                  rows={3}
                  value={
                    form.instructions
                  }
                  onChange={(e) =>
                    handleFormChange(
                      "instructions",
                      e.target.value,
                    )
                  }
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            {/* ================================================= */}
            {/* SCHEDULE */}
            {/* ================================================= */}

            <Typography
              variant="subtitle1"
              fontWeight={700}
              mb={2}
            >
              Assessment Schedule
            </Typography>

            <Grid
              container
              spacing={2}
            >
              <Grid
                item
                xs={12}
                sm={6}
                md={3}
              >
                <TextField
                  label="Publish Date"
                  type="date"
                  fullWidth
                  InputLabelProps={{
                    shrink: true,
                  }}
                  value={
                    form.publishDate
                  }
                  onChange={(e) =>
                    handleFormChange(
                      "publishDate",
                      e.target.value,
                    )
                  }
                />
              </Grid>

              <Grid
                item
                xs={12}
                sm={6}
                md={3}
              >
                <TextField
                  label="Publish Time"
                  type="time"
                  fullWidth
                  InputLabelProps={{
                    shrink: true,
                  }}
                  value={
                    form.publishTime
                  }
                  onChange={(e) =>
                    handleFormChange(
                      "publishTime",
                      e.target.value,
                    )
                  }
                />
              </Grid>

              <Grid
                item
                xs={12}
                sm={6}
                md={3}
              >
                <TextField
                  label="Close Date"
                  type="date"
                  fullWidth
                  InputLabelProps={{
                    shrink: true,
                  }}
                  value={
                    form.closeDate
                  }
                  onChange={(e) =>
                    handleFormChange(
                      "closeDate",
                      e.target.value,
                    )
                  }
                />
              </Grid>

              <Grid
                item
                xs={12}
                sm={6}
                md={3}
              >
                <TextField
                  label="Close Time"
                  type="time"
                  fullWidth
                  InputLabelProps={{
                    shrink: true,
                  }}
                  value={
                    form.closeTime
                  }
                  onChange={(e) =>
                    handleFormChange(
                      "closeTime",
                      e.target.value,
                    )
                  }
                />
              </Grid>
            </Grid>

            {/* ================================================= */}
            {/* ACTIONS */}
            {/* ================================================= */}

            <Box
              sx={{
                mt: 3,
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <Button
                variant="contained"
                onClick={
                  handleBasicNext
                }
              >
                Next
              </Button>
            </Box>
          </Paper>
        )}

        {/* ================================================== */}
        {/* STEP 2 - HIERARCHY */}
        {/* ================================================== */}

        {activeStep === 1 && (
          <Paper
            elevation={0}
            sx={{
              p: {
                xs: 2,
                sm: 3,
              },
              borderRadius: 3,
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography
              variant="h6"
              fontWeight={700}
              mb={1}
            >
              Select Assessment Hierarchy
            </Typography>

            <Typography
              color="text.secondary"
              mb={3}
            >
              Select Organisation → Centre →
              Course → Batch. Only students from
              the selected batch will be eligible
              for this assessment.
            </Typography>

            <HierarchyFilter
              onChange={setHierarchy}
              values={hierarchy}
            />

            {/* Selected hierarchy */}
            {hierarchy?.batch && (
              <Alert
                severity="info"
                sx={{ mt: 3 }}
              >
                Assessment will be assigned to
                the selected Batch.
              </Alert>
            )}

            <Box
              sx={{
                mt: 3,
                display: "flex",
                justifyContent:
                  "space-between",
                gap: 2,
              }}
            >
              <Button
                onClick={() =>
                  setActiveStep(0)
                }
              >
                Back
              </Button>

              <Button
                variant="contained"
                onClick={handleCreate}
                disabled={loading}
                startIcon={
                  loading ? (
                    <CircularProgress
                      size={18}
                      color="inherit"
                    />
                  ) : null
                }
              >
                {loading
                  ? "Creating..."
                  : "Create & Continue"}
              </Button>
            </Box>
          </Paper>
        )}

        {/* ================================================== */}
        {/* STEP 3 - BUILD */}
        {/* ================================================== */}

        {activeStep === 2 &&
          assessment && (
            <Paper
              elevation={0}
              sx={{
                p: {
                  xs: 1.5,
                  sm: 3,
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
                  alignItems: "center",
                  gap: 2,
                  flexWrap: "wrap",
                }}
              >
                <Box>
                  <Typography
                    variant="h6"
                    fontWeight={700}
                  >
                    Build Assessment
                  </Typography>

                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    {assessment.name}
                  </Typography>
                </Box>

                <Chip
                  label={
                    assessment.hasParts
                      ? "Parts Enabled"
                      : "Parts Disabled"
                  }
                  color={
                    assessment.hasParts
                      ? "secondary"
                      : "default"
                  }
                />
              </Box>

              <AssessmentBuilder
                assessment={
                  assessment
                }
                onUpdate={
                  handleBuilderUpdate
                }
              />

              <Box
                sx={{
                  mt: 3,
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: 2,
                }}
              >
                <Button
                  onClick={
                    handleBackToHierarchy
                  }
                >
                  Back
                </Button>

                <Button
                  variant="contained"
                  onClick={
                    handlePreview
                  }
                  disabled={loading}
                  startIcon={
                    loading ? (
                      <CircularProgress
                        size={18}
                        color="inherit"
                      />
                    ) : null
                  }
                >
                  {loading
                    ? "Loading..."
                    : "Preview"}
                </Button>
              </Box>
            </Paper>
          )}

        {/* ================================================== */}
        {/* STEP 4 - PREVIEW */}
        {/* ================================================== */}

        {activeStep === 3 &&
          assessment && (
            <Paper
              elevation={0}
              sx={{
                p: {
                  xs: 2,
                  sm: 3,
                },
                borderRadius: 3,
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              {/* Header */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems: "flex-start",
                  gap: 2,
                  flexWrap: "wrap",
                }}
              >
                <Box>
                  <Typography
                    variant="h5"
                    fontWeight={700}
                  >
                    {assessment.name}
                  </Typography>

                  <Typography
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    Code:{" "}
                    {assessment.code}
                  </Typography>

                  <Typography
                    color="text.secondary"
                  >
                    Week{" "}
                    {
                      assessment.weekNumber
                    }{" "}
                    •{" "}
                    {
                      assessment.academicYear
                    }
                  </Typography>
                </Box>

                <Chip
                  label={
                    assessment.hasParts
                      ? "Part Based Assessment"
                      : "Section Based Assessment"
                  }
                  color={
                    assessment.hasParts
                      ? "secondary"
                      : "primary"
                  }
                />
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Description */}
              {assessment.description && (
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="subtitle1"
                    fontWeight={700}
                  >
                    Description
                  </Typography>

                  <Typography
                    color="text.secondary"
                  >
                    {
                      assessment.description
                    }
                  </Typography>
                </Box>
              )}

              {/* Instructions */}
              {assessment.instructions && (
                <Box sx={{ mb: 3 }}>
                  <Typography
                    variant="subtitle1"
                    fontWeight={700}
                  >
                    Instructions
                  </Typography>

                  <Typography
                    color="text.secondary"
                  >
                    {
                      assessment.instructions
                    }
                  </Typography>
                </Box>
              )}

              {/* Hierarchy */}
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  mb: 3,
                  borderRadius: 2,
                }}
              >
                <Typography
                  variant="subtitle1"
                  fontWeight={700}
                  mb={1}
                >
                  Assigned Batch
                </Typography>

                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  Assessment is assigned to the
                  selected batch and its students.
                </Typography>
              </Paper>

              {/* Stats */}
              <Grid
                container
                spacing={2}
                sx={{ mb: 3 }}
              >
                <Grid
                  item
                  xs={12}
                  sm={4}
                >
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      Total Questions
                    </Typography>

                    <Typography
                      variant="h5"
                      fontWeight={700}
                    >
                      {
                        assessment.totalQuestions ??
                        0
                      }
                    </Typography>
                  </Paper>
                </Grid>

                <Grid
                  item
                  xs={12}
                  sm={4}
                >
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      Total Marks
                    </Typography>

                    <Typography
                      variant="h5"
                      fontWeight={700}
                    >
                      {
                        assessment.totalMarks ??
                        0
                      }
                    </Typography>
                  </Paper>
                </Grid>

                <Grid
                  item
                  xs={12}
                  sm={4}
                >
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      Structure
                    </Typography>

                    <Typography
                      variant="h6"
                      fontWeight={700}
                    >
                      {assessment.hasParts
                        ? "Parts → Sections"
                        : "Sections"}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>

              {/* ================================================= */}
              {/* ACTIONS */}
              {/* ================================================= */}

              <Box
                sx={{
                  mt: 3,
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: 2,
                  flexWrap: "wrap",
                }}
              >
                <Button
                  onClick={() =>
                    setActiveStep(2)
                  }
                >
                  Back to Builder
                </Button>

                <Button
                  variant="contained"
                  color="success"
                  onClick={
                    handlePublish
                  }
                  disabled={loading}
                  startIcon={
                    loading ? (
                      <CircularProgress
                        size={18}
                        color="inherit"
                      />
                    ) : null
                  }
                >
                  {loading
                    ? "Publishing..."
                    : "Publish Assessment"}
                </Button>
              </Box>
            </Paper>
          )}
      </Box>
    </Layout>
  );
}

