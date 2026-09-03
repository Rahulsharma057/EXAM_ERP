"use client";

import React, {
  useEffect,
  useState,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from "@mui/material";

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import Layout from "../../../../components/common/Layout";
import AssessmentForm from "../../../../components/assessment/AssessmentForm";
import { api } from "../../../../services/api";

export default function SubmitAssessmentPage() {
  const { id } = useParams();
  const router = useRouter();

  const [assessment, setAssessment] =
    useState(null);

  const [students, setStudents] =
    useState([]);

  const [selectedStudent, setSelectedStudent] =
    useState("");

  const [submitted, setSubmitted] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const load = async () => {
      if (!id) return;

      try {
        setLoading(true);
        setError("");

        const res =
          await api.getAssessment(id);

        const assessmentData =
          res?.data;

        if (!assessmentData) {
          throw new Error(
            "Assessment not found"
          );
        }

        setAssessment(
          assessmentData
        );

        if (
          assessmentData.batch?._id
        ) {
          const studentsRes =
            await api.getBatchStudents(
              assessmentData.batch._id
            );

          setStudents(
            studentsRes?.data ||
              []
          );
        }
      } catch (err) {
        console.error(
          "LOAD SUBMIT ASSESSMENT ERROR:",
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

    load();
  }, [id]);

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <Layout>
        <Box
          sx={{
            minHeight:
              "60vh",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
          }}
        >
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  // ==========================================================
  // ERROR
  // ==========================================================

  if (error || !assessment) {
    return (
      <Layout>
        <Box
          sx={{
            maxWidth: 900,
            mx: "auto",
            mt: 4,
          }}
        >
          <Alert
            severity="error"
            sx={{
              mb: 3,
            }}
          >
            {error ||
              "Assessment not found"}
          </Alert>

          <Button
            startIcon={
              <ArrowBackIcon />
            }
            variant="outlined"
            onClick={() =>
              router.push(
                "/assessments"
              )
            }
          >
            Back to Assessments
          </Button>
        </Box>
      </Layout>
    );
  }

  // ==========================================================
  // SUBMITTED
  // ==========================================================

  if (submitted) {
    return (
      <Layout>
        <Box
          sx={{
            minHeight:
              "70vh",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            p: 3,
          }}
        >
          <Card
            sx={{
              maxWidth: 650,
              width: "100%",
              borderRadius: 4,
              textAlign:
                "center",
            }}
          >
            <CardContent
              sx={{
                p: 5,
              }}
            >
              <CheckCircleIcon
                color="success"
                sx={{
                  fontSize: 80,
                  mb: 2,
                }}
              />

              <Typography
                variant="h4"
                fontWeight={700}
                gutterBottom
              >
                Assessment Submitted!
              </Typography>

              <Typography
                color="text.secondary"
                sx={{
                  mb: 3,
                }}
              >
                {assessment.name}
                {" • "}
                Week{" "}
                {
                  assessment.weekNumber
                }
              </Typography>

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
                  onClick={() =>
                    router.push(
                      "/assessments"
                    )
                  }
                >
                  Back to Assessments
                </Button>

                <Button
                  variant="contained"
                  onClick={() =>
                    router.push(
                      `/assessments/${id}/results`
                    )
                  }
                >
                  View Results
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Layout>
    );
  }

  // ==========================================================
  // ASSESSMENT FORM
  // ==========================================================

  if (selectedStudent) {
    return (
      <Layout>
        <AssessmentForm
          assessmentId={id}
          studentId={
            selectedStudent
          }
          onSubmit={() =>
            setSubmitted(
              true
            )
          }
        />
      </Layout>
    );
  }

  // ==========================================================
  // STUDENT SELECT
  // ==========================================================

  return (
    <Layout>
      <Box
        sx={{
          maxWidth: 1000,
          mx: "auto",
        }}
      >
        <Button
          startIcon={
            <ArrowBackIcon />
          }
          onClick={() =>
            router.back()
          }
          sx={{
            mb: 2,
          }}
        >
          Back
        </Button>

        <Paper
          sx={{
            p: {
              xs: 2,
              sm: 4,
            },
            borderRadius: 3,
          }}
        >
          <Typography
            variant="h4"
            fontWeight={700}
            gutterBottom
          >
            Submit Assessment
          </Typography>

          <Typography
            variant="h6"
            color="text.secondary"
            sx={{
              mb: 1,
            }}
          >
            {assessment.name}
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 3,
            }}
          >
            Week{" "}
            {assessment.weekNumber}
            {" • "}
            Batch:{" "}
            {assessment.batch?.name ||
              "-"}
          </Typography>

          <Alert
            severity="info"
            sx={{
              mb: 3,
            }}
          >
            Select the student for whom
            you want to start this
            assessment.
          </Alert>

          <Card
            variant="outlined"
            sx={{
              maxWidth: 600,
            }}
          >
            <CardContent>
              <FormControl
                fullWidth
              >
                <InputLabel>
                  Select Student
                </InputLabel>

                <Select
                  value={
                    selectedStudent
                  }
                  label="Select Student"
                  onChange={(e) =>
                    setSelectedStudent(
                      e.target.value
                    )
                  }
                >
                  <MenuItem value="">
                    Select Student
                  </MenuItem>

                  {students.map(
                    (student) => (
                      <MenuItem
                        key={
                          student._id
                        }
                        value={
                          student._id
                        }
                      >
                        {
                          student.rollNumber
                        }
                        {" - "}
                        {
                          student.name
                        }
                      </MenuItem>
                    )
                  )}
                </Select>
              </FormControl>

              <Button
                fullWidth
                variant="contained"
                sx={{
                  mt: 2,
                }}
                disabled={
                  !selectedStudent
                }
                onClick={() => {
                  /*
                   * State already contains
                   * selected student, so
                   * AssessmentForm will
                   * render automatically.
                   */
                }}
              >
                Start Assessment
              </Button>
            </CardContent>
          </Card>

          {students.length ===
            0 && (
            <Alert
              severity="warning"
              sx={{
                mt: 2,
              }}
            >
              No students found in
              this assessment batch.
            </Alert>
          )}
        </Paper>
      </Box>
    </Layout>
  );
}