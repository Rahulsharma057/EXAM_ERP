"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TextField,
  Pagination,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Tooltip,
  CircularProgress,
  Divider,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import FileCopyIcon from "@mui/icons-material/FileCopy";
import PublishIcon from "@mui/icons-material/Publish";
import AssessmentIcon from "@mui/icons-material/Assessment";
import DeleteIcon from "@mui/icons-material/Delete";
import GradingIcon from "@mui/icons-material/Grading";

import Layout from "../../components/common/Layout";
import HierarchyFilter from "../../components/assessment/HierarchyFilter";
import { api } from "../../services/api";

const STATUS_COLORS = {
  DRAFT: "default",
  SCHEDULED: "info",
  PUBLISHED: "success",
  CLOSED: "error",
  ARCHIVED: "warning",
};

export default function AssessmentsPage() {
  const router = useRouter();

  // =========================================================
  // ASSESSMENTS
  // =========================================================

  const [assessments, setAssessments] = useState([]);
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const limit = 20;

  const [loading, setLoading] = useState(false);

  // =========================================================
  // DUPLICATE DIALOG
  // =========================================================

  const [duplicateDialog, setDuplicateDialog] = useState(false);

  const [selectedAssessment, setSelectedAssessment] =
    useState(null);

  const [batches, setBatches] = useState([]);

  const [targetBatch, setTargetBatch] = useState("");
  const [targetWeek, setTargetWeek] = useState("");

  const [duplicateName, setDuplicateName] = useState("");
  const [duplicateCode, setDuplicateCode] = useState("");

  const [duplicating, setDuplicating] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(false);

  const [duplicateError, setDuplicateError] = useState("");

  // =========================================================
  // LOAD ASSESSMENTS
  // =========================================================

  const load = async () => {
    try {
      setLoading(true);

      const params = {
        ...filters,
        search: search.trim(),
        page,
        limit,
      };

      const res = await api.getAssessments(params);

      setAssessments(res?.data || []);
      setTotal(res?.pagination?.total || 0);
    } catch (error) {
      console.error("GET ASSESSMENTS ERROR:", error);

      setAssessments([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filters, search, page]);

  // =========================================================
  // LOAD ASSIGNED / AVAILABLE BATCHES
  // =========================================================

  const loadBatches = async () => {
    try {
      setLoadingBatches(true);
      setDuplicateError("");

      /*
       * IMPORTANT:
       *
       * Backend getBatchesList MUST return only the batches
       * the logged-in teacher is assigned to.
       *
       * For super_admin/admin it can return all allowed batches.
       */

      const res = await api.getBatchesList({
        page: 1,
        limit: 500,
      });

      console.log("AVAILABLE BATCHES RESPONSE:", res);

      const availableBatches = Array.isArray(res?.data)
        ? res.data
        : [];

      setBatches(availableBatches);
    } catch (error) {
      console.error("GET BATCHES ERROR:", error);

      setBatches([]);

      setDuplicateError(
        error?.message ||
          "Failed to load available batches"
      );
    } finally {
      setLoadingBatches(false);
    }
  };

  // =========================================================
  // AVAILABLE TARGET BATCHES
  // =========================================================

  const targetBatches = useMemo(() => {
    if (!selectedAssessment) {
      return batches;
    }

    const currentBatchId =
      selectedAssessment?.batch?._id ||
      selectedAssessment?.batch ||
      "";

    return batches.filter(
      (batch) =>
        String(batch?._id) !== String(currentBatchId)
    );
  }, [batches, selectedAssessment]);

  // =========================================================
  // PUBLISH
  // =========================================================

  const handlePublish = async (id) => {
    try {
      await api.publishAssessment(id);
      await load();
    } catch (error) {
      alert(
        error?.message ||
          "Failed to publish assessment"
      );
    }
  };

  // =========================================================
  // OPEN DUPLICATE DIALOG
  // =========================================================

  const openDuplicateDialog = async (assessment) => {
    setSelectedAssessment(assessment);

    setDuplicateError("");

    setDuplicateName(
      `${assessment?.name || "Assessment"} (Copy)`
    );

    const originalCode =
      assessment?.code ||
      String(
        assessment?.name || "ASSESSMENT"
      )
        .replace(/\s+/g, "_")
        .toUpperCase();

    setDuplicateCode(`${originalCode}_COPY`);

    // Current week + 1
    setTargetWeek(
      String(
        Number(assessment?.weekNumber || 0) + 1
      )
    );

    setTargetBatch("");

    setBatches([]);

    setDuplicateDialog(true);

    // Load only allowed batches from backend
    await loadBatches();
  };

  // =========================================================
  // DUPLICATE ASSESSMENT
  // =========================================================

  const handleDuplicate = async () => {
    if (!selectedAssessment) {
      setDuplicateError(
        "Assessment not selected"
      );
      return;
    }

    if (!targetBatch) {
      setDuplicateError(
        "Please select the target batch"
      );
      return;
    }

    const weekNumber = parseInt(targetWeek, 10);

    if (
      !Number.isInteger(weekNumber) ||
      weekNumber <= 0
    ) {
      setDuplicateError(
        "Please enter a valid target week number"
      );
      return;
    }

    if (!duplicateName.trim()) {
      setDuplicateError(
        "Assessment name is required"
      );
      return;
    }

    if (!duplicateCode.trim()) {
      setDuplicateError(
        "Assessment code is required"
      );
      return;
    }

    // =====================================================
    // EXTRA FRONTEND SECURITY
    // Make sure selected batch actually exists in the
    // backend-returned allowed batch list.
    // =====================================================

    const selectedBatch = batches.find(
      (batch) =>
        String(batch?._id) === String(targetBatch)
    );

    if (!selectedBatch) {
      setDuplicateError(
        "Selected batch is not available for your account"
      );
      return;
    }

    // Current batch cannot be selected
    const currentBatchId =
      selectedAssessment?.batch?._id ||
      selectedAssessment?.batch ||
      "";

    if (
      String(selectedBatch._id) ===
      String(currentBatchId)
    ) {
      setDuplicateError(
        "Target batch must be different from the current batch"
      );
      return;
    }

    try {
      setDuplicating(true);
      setDuplicateError("");

      /*
       * DO NOT send organisation / centre / course.
       *
       * Backend derives hierarchy from targetBatch.
       */

      await api.duplicateAssessment(
        selectedAssessment._id,
        {
          newName: duplicateName.trim(),

          newCode: duplicateCode.trim(),

          newWeekNumber: weekNumber,

          targetBatch: selectedBatch._id,
        }
      );

      closeDuplicateDialog();

      await load();

      alert(
        "Assessment duplicated successfully"
      );
    } catch (error) {
      console.error(
        "DUPLICATE ASSESSMENT ERROR:",
        error
      );

      setDuplicateError(
        error?.message ||
          "Failed to duplicate assessment"
      );
    } finally {
      setDuplicating(false);
    }
  };

  // =========================================================
  // CLOSE DUPLICATE DIALOG
  // =========================================================

  const closeDuplicateDialog = () => {
    if (duplicating) return;

    setDuplicateDialog(false);

    setSelectedAssessment(null);

    setBatches([]);

    setTargetBatch("");
    setTargetWeek("");

    setDuplicateName("");
    setDuplicateCode("");

    setDuplicateError("");
  };

  // =========================================================
  // DELETE
  // =========================================================

  const handleDelete = async (id) => {
    if (
      !confirm(
        "Are you sure you want to delete this draft assessment?"
      )
    ) {
      return;
    }

    try {
      await api.deleteAssessment(id);
      await load();
    } catch (error) {
      alert(
        error?.message ||
          "Failed to delete assessment"
      );
    }
  };

  // =========================================================
  // CREATE ASSESSMENT
  // =========================================================

  const handleCreateAssessment = () => {
    router.push("/assessments/new");
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <Layout>
      {/* =====================================================
          HEADER
      ===================================================== */}

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
          gap: 2,
          flexWrap: "wrap",
        }}
      >
        <Box>
          <Typography
            variant="h4"
            fontWeight={700}
          >
            Assessment Management
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5 }}
          >
            Create, manage, publish and duplicate
            weekly assessments
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateAssessment}
        >
          Create Assessment
        </Button>
      </Box>

      {/* =====================================================
          FILTERS
      ===================================================== */}

      <Paper
        sx={{
          p: 2,
          mb: 3,
        }}
      >
        <Grid
          container
          spacing={2}
        >
          <Grid item xs={12}>
            <HierarchyFilter
              onChange={(value) => {
                setFilters(value);
                setPage(1);
              }}
              values={filters}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              placeholder="Search assessments..."
              fullWidth
              size="small"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* =====================================================
          TABLE
      ===================================================== */}

      <TableContainer
        component={Paper}
        sx={{
          overflowX: "auto",
        }}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>

              <TableCell>
                Week
              </TableCell>

              <TableCell>
                Batch
              </TableCell>

              <TableCell>
                Status
              </TableCell>

              <TableCell>
                Total Marks
              </TableCell>

              <TableCell align="right">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  align="center"
                  sx={{ py: 6 }}
                >
                  <CircularProgress
                    size={28}
                  />

                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 1 }}
                  >
                    Loading assessments...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : assessments.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  align="center"
                  sx={{ py: 6 }}
                >
                  <Typography
                    color="text.secondary"
                  >
                    No assessments found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              assessments.map((a) => (
                <TableRow
                  key={a._id}
                  hover
                >
                  {/* NAME */}

                  <TableCell>
                    <Typography fontWeight={600}>
                      {a.name}
                    </Typography>

                    {a.code && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                      >
                        {a.code}
                      </Typography>
                    )}
                  </TableCell>

                  {/* WEEK */}

                  <TableCell>
                    <Chip
                      size="small"
                      label={`Week ${a.weekNumber}`}
                      variant="outlined"
                    />
                  </TableCell>

                  {/* BATCH */}

                  <TableCell>
                    {a.batch?.name || "-"}
                  </TableCell>

                  {/* STATUS */}

                  <TableCell>
                    <Chip
                      size="small"
                      label={a.status}
                      color={
                        STATUS_COLORS[
                          a.status
                        ] || "default"
                      }
                    />
                  </TableCell>

                  {/* MARKS */}

                  <TableCell>
                    {a.totalMarks || 0}
                  </TableCell>

                  {/* ACTIONS */}

                  <TableCell align="right">
                    {/* VIEW */}

                    <Tooltip title="View Assessment">
                      <IconButton
                        size="small"
                        onClick={() =>
                          router.push(
                            `/assessments/${a._id}`
                          )
                        }
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    {/* EDIT */}

                    {a.status === "DRAFT" && (
                      <Tooltip title="Edit Assessment">
                        <IconButton
                          size="small"
                          onClick={() =>
                            router.push(
                              `/assessments/${a._id}/edit`
                            )
                          }
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}

                    {/* DUPLICATE */}

                    <Tooltip title="Duplicate Assessment">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() =>
                          openDuplicateDialog(a)
                        }
                      >
                        <FileCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    {/* PUBLISH */}

                    {a.status === "DRAFT" && (
                      <Tooltip title="Publish Assessment">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() =>
                            handlePublish(a._id)
                          }
                        >
                          <PublishIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}

                    {/* ENTER MARKS */}

                    {(
                      a.status === "PUBLISHED" ||
                      a.status === "CLOSED"
                    ) && (
                      <Tooltip title="Enter Marks">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() =>
                            router.push(
                              `/assessments/${a._id}/marks`
                            )
                          }
                        >
                          <GradingIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}

                    {/* RESULTS */}

                    <Tooltip title="View Results">
                      <IconButton
                        size="small"
                        onClick={() =>
                          router.push(
                            `/assessments/${a._id}/results`
                          )
                        }
                      >
                        <AssessmentIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    {/* DELETE */}

                    {a.status === "DRAFT" && (
                      <Tooltip title="Delete Assessment">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() =>
                            handleDelete(a._id)
                          }
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* =====================================================
          PAGINATION
      ===================================================== */}

      <Box
        sx={{
          mt: 2,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Pagination
          count={Math.max(
            1,
            Math.ceil(total / limit)
          )}
          page={page}
          onChange={(e, value) =>
            setPage(value)
          }
        />
      </Box>

      {/* =====================================================
          DUPLICATE ASSESSMENT DIALOG
      ===================================================== */}

      <Dialog
        open={duplicateDialog}
        onClose={closeDuplicateDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Duplicate Assessment
        </DialogTitle>

        <DialogContent>
          {/* =================================================
              SOURCE INFO
          ================================================= */}

          {selectedAssessment && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                mt: 1,
                mb: 2,
              }}
            >
              <Typography
                variant="subtitle1"
                fontWeight={700}
              >
                {selectedAssessment.name}
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
              >
                Current Batch:{" "}
                {selectedAssessment.batch?.name ||
                  "-"}
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
              >
                Current Week:{" "}
                {selectedAssessment.weekNumber}
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
              >
                Questions:{" "}
                {selectedAssessment.totalQuestions ||
                  0}
              </Typography>

              <Typography
                variant="body2"
                color="text.secondary"
              >
                Total Marks:{" "}
                {selectedAssessment.totalMarks ||
                  0}
              </Typography>
            </Paper>
          )}

          {/* =================================================
              ERROR
          ================================================= */}

          {duplicateError && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
            >
              {duplicateError}
            </Alert>
          )}

          {/* =================================================
              TARGET BATCH
          ================================================= */}

          <FormControl
            fullWidth
            margin="normal"
            disabled={
              loadingBatches ||
              duplicating
            }
          >
            <InputLabel>
              Target Batch
            </InputLabel>

            <Select
              value={targetBatch}
              label="Target Batch"
              onChange={(e) =>
                setTargetBatch(
                  e.target.value
                )
              }
            >
              <MenuItem value="">
                Select Target Batch
              </MenuItem>

              {targetBatches.map(
                (batch) => (
                  <MenuItem
                    key={batch._id}
                    value={batch._id}
                  >
                    {batch.name}

                    {batch.code
                      ? ` (${batch.code})`
                      : ""}
                  </MenuItem>
                )
              )}
            </Select>
          </FormControl>

          {/* =================================================
              LOADING
          ================================================= */}

          {loadingBatches && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                mt: 1,
              }}
            >
              <CircularProgress
                size={18}
              />

              <Typography
                variant="caption"
                color="text.secondary"
              >
                Loading your assigned batches...
              </Typography>
            </Box>
          )}

          {/* =================================================
              NO OTHER ASSIGNED BATCHES
          ================================================= */}

          {!loadingBatches &&
            targetBatches.length === 0 && (
              <Alert
                severity="warning"
                sx={{ mt: 2 }}
              >
                No other assigned batches are
                available for duplication.
              </Alert>
            )}

          {/* =================================================
              ASSIGNED BATCH INFO
          ================================================= */}

          {!loadingBatches &&
            targetBatches.length > 0 && (
              <Alert
                severity="info"
                sx={{ mt: 2 }}
              >
                Only batches assigned to your account
                are available here.
              </Alert>
            )}

          <Divider sx={{ my: 2 }} />

          {/* =================================================
              ASSESSMENT NAME
          ================================================= */}

          <TextField
            fullWidth
            margin="normal"
            label="New Assessment Name"
            value={duplicateName}
            onChange={(e) =>
              setDuplicateName(
                e.target.value
              )
            }
            disabled={duplicating}
          />

          {/* =================================================
              ASSESSMENT CODE
          ================================================= */}

          <TextField
            fullWidth
            margin="normal"
            label="Assessment Code"
            value={duplicateCode}
            onChange={(e) =>
              setDuplicateCode(
                e.target.value
              )
            }
            disabled={duplicating}
            helperText="Assessment code target batch ke liye unique hona chahiye."
          />

          {/* =================================================
              TARGET WEEK
          ================================================= */}

          <TextField
            fullWidth
            margin="normal"
            label="Target Week Number"
            type="number"
            value={targetWeek}
            onChange={(e) =>
              setTargetWeek(
                e.target.value
              )
            }
            disabled={duplicating}
            inputProps={{
              min: 1,
            }}
            helperText="Target batch me assessment kis week ke liye create karna hai."
          />

          {/* =================================================
              COPY INFO
          ================================================= */}

          <Alert
            severity="info"
            sx={{ mt: 2 }}
          >
            <Typography variant="body2">
              <strong>
                What will be copied?
              </strong>
            </Typography>

            <Typography
              variant="body2"
              sx={{ mt: 0.5 }}
            >
              • Assessment details
              <br />
              • Sections
              <br />
              • Questions
              <br />
              • Question marks
              <br />
              • Question order
              <br />
              • Scoring configuration
            </Typography>

            <Typography
              variant="body2"
              sx={{ mt: 1 }}
            >
              Target batch ka organisation,
              centre, course aur batch backend
              automatically selected target batch
              se set karega.
            </Typography>

            <Typography
              variant="body2"
              sx={{ mt: 1 }}
            >
              Students, submissions, marks aur
              results copy nahi honge. Target batch
              ka assessment completely independent
              rahega.
            </Typography>
          </Alert>
        </DialogContent>

        {/* =================================================
            ACTIONS
        ================================================= */}

        <DialogActions
          sx={{
            px: 3,
            pb: 2,
          }}
        >
          <Button
            onClick={closeDuplicateDialog}
            disabled={duplicating}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            startIcon={
              duplicating ? (
                <CircularProgress
                  size={18}
                  color="inherit"
                />
              ) : (
                <FileCopyIcon />
              )
            }
            onClick={handleDuplicate}
            disabled={
              duplicating ||
              loadingBatches ||
              !targetBatch ||
              !targetWeek ||
              !duplicateName.trim() ||
              !duplicateCode.trim()
            }
          >
            {duplicating
              ? "Duplicating..."
              : "Duplicate Assessment"}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}