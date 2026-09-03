'use client';

import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { useParams } from 'next/navigation';

import {
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
  Alert,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';

import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import RefreshIcon from '@mui/icons-material/Refresh';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingActionsIcon from '@mui/icons-material/PendingActions';

import Layout from '../../../../components/common/Layout';
import ResultsTable from '../../../../components/results/ResultsTable';
import StudentResultDetail from '../../../../components/results/StudentResultDetail';

import { api } from '../../../../services/api';

export default function AssessmentResultsPage() {
  const params = useParams();
  const id = params?.id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] =
    useState(null);

  const [importFile, setImportFile] = useState(null);

  // =========================================================
  // LOAD RESULTS
  // =========================================================

  const load = useCallback(async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError('');

      const res = await api.getAssessmentResults(id, {
        search: search.trim(),
      });

      setData(res?.data || null);
    } catch (err) {
      console.error(
        'GET ASSESSMENT RESULTS ERROR:',
        err
      );

      setError(
        err?.message ||
          'Failed to load assessment results'
      );
    } finally {
      setLoading(false);
    }
  }, [id, search]);

  useEffect(() => {
    load();
  }, [load]);

  // =========================================================
  // IMPORT MARKS
  // =========================================================

  const handleImport = async () => {
    if (!importFile) {
      alert('Please select an Excel file');
      return;
    }

    try {
      setImporting(true);

      await api.importMarks(
        id,
        importFile
      );

      alert(
        'Marks imported successfully'
      );

      setImportFile(null);

      const fileInput =
        document.getElementById(
          'assessment-marks-import-input'
        );

      if (fileInput) {
        fileInput.value = '';
      }

      await load();
    } catch (err) {
      console.error(
        'IMPORT MARKS ERROR:',
        err
      );

      alert(
        err?.message ||
          'Failed to import marks'
      );
    } finally {
      setImporting(false);
    }
  };

  // =========================================================
  // EXPORT TEMPLATE
  // =========================================================

  const handleExportTemplate =
    async () => {
      try {
        await api.exportTemplate(id);
      } catch (err) {
        console.error(
          'EXPORT TEMPLATE ERROR:',
          err
        );

        alert(
          err?.message ||
            'Failed to download template'
        );
      }
    };

  // =========================================================
  // EXPORT RESULTS
  // =========================================================
  //
  // IMPORTANT:
  // ResultsTable se selected dynamic options
  // yahan receive honge.
  //
  // options structure:
  //
  // {
  //   student: {
  //     rollNumber: true,
  //     name: true
  //   },
  //
  //   parts: {
  //     partId: {
  //       attempted: true,
  //       obtained: true,
  //       max: true,
  //       percentage: true
  //     }
  //   },
  //
  //   sections: {
  //     sectionId: {
  //       obtained: true,
  //       max: true,
  //       percentage: true
  //     }
  //   },
  //
  //   overall: {
  //     totalObtained: true,
  //     totalMax: true,
  //     percentage: true,
  //     status: true
  //   }
  // }
  //
  // =========================================================

  const handleExportResults =
    async (options) => {
      try {
        if (!id) {
          throw new Error(
            'Assessment ID is missing'
          );
        }

        await api.exportResults(
          id,
          options
        );
      } catch (err) {
        console.error(
          'EXPORT RESULTS ERROR:',
          err
        );

        alert(
          err?.message ||
            'Failed to export results'
        );

        // Re-throw so ResultsTable knows
        // download failed.
        throw err;
      }
    };

  // =========================================================
  // LOADING
  // =========================================================

  if (loading && !data) {
    return (
      <Layout>
        <Box
          sx={{
            minHeight: '60vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CircularProgress />
        </Box>
      </Layout>
    );
  }

  // =========================================================
  // ERROR
  // =========================================================

  if (error && !data) {
    return (
      <Layout>
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={load}
            >
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <Alert severity="info">
          No assessment result data available.
        </Alert>
      </Layout>
    );
  }

  // =========================================================
  // SAFE DATA
  // =========================================================

  const assessment =
    data.assessment || {};

  const stats = {
    totalStudents:
      Number(
        data.stats?.totalStudents
      ) || 0,

    completed:
      Number(
        data.stats?.completed
      ) || 0,

    pending:
      Number(
        data.stats?.pending
      ) || 0,

    averageScore:
      Number(
        data.stats?.averageScore
      ) || 0,
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
  Boolean(data.hasParts) ||
  Boolean(assessment.hasParts) ||
  parts.length > 0;
  // =========================================================
  // TOTAL STRUCTURE
  // =========================================================

  const configuredTotalMarks =
    hasParts
      ? parts.reduce(
          (sum, part) =>
            sum +
            (part?.isOptional
              ? 0
              : Number(
                  part?.totalMarks
                ) || 0),
          0
        )
      : sections.reduce(
          (sum, section) =>
            sum +
            (Number(
              section?.totalMarks
            ) || 0),
          0
        );

  const totalQuestions =
    hasParts
      ? parts.reduce(
          (sum, part) =>
            sum +
            (Number(
              part?.totalQuestions
            ) || 0),
          0
        )
      : sections.reduce(
          (sum, section) =>
            sum +
            (Number(
              section?.totalQuestions
            ) || 0),
          0
        );

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <Layout>
      {/* =====================================================
          HEADER
      ====================================================== */}

      <Box
        sx={{
          mb: 3,
          display: 'flex',
          flexDirection: {
            xs: 'column',
            md: 'row',
          },
          justifyContent:
            'space-between',
          alignItems: {
            xs: 'flex-start',
            md: 'center',
          },
          gap: 2,
        }}
      >
        <Box>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            flexWrap="wrap"
          >
            <AssessmentIcon color="primary" />

            <Typography
              variant="h4"
              fontWeight={700}
            >
              Results: {assessment.name}
            </Typography>

            <Chip
              size="small"
              label={
                hasParts
                  ? 'Parts Assessment'
                  : 'Sections Assessment'
              }
              color="primary"
              variant="outlined"
            />
          </Stack>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5 }}
          >
            {assessment.code
              ? `Code: ${assessment.code}`
              : 'Assessment Results'}

            {assessment.weekNumber
              ? ` • Week ${assessment.weekNumber}`
              : ''}
          </Typography>
        </Box>

        <Tooltip title="Refresh results">
          <IconButton
            onClick={load}
            disabled={loading}
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* =====================================================
          ERROR WHILE REFRESHING
      ====================================================== */}

      {error && data && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setError('')}
        >
          {error}
        </Alert>
      )}

      {/* =====================================================
          SUMMARY CARDS
      ====================================================== */}

      <Grid
        container
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Grid
          size={{
            xs: 12,
            sm: 6,
            md: 3,
          }}
        >
          <Paper
            sx={{
              p: 2.5,
              height: '100%',
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
            >
              Total Students
            </Typography>

            <Typography
              variant="h4"
              fontWeight={800}
              sx={{ mt: 0.5 }}
            >
              {stats.totalStudents}
            </Typography>
          </Paper>
        </Grid>

        <Grid
          size={{
            xs: 12,
            sm: 6,
            md: 3,
          }}
        >
          <Paper
            sx={{
              p: 2.5,
              height: '100%',
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
            >
              Completed
            </Typography>

            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mt: 0.5 }}
            >
              <CheckCircleIcon color="success" />

              <Typography
                variant="h4"
                fontWeight={800}
              >
                {stats.completed}
              </Typography>
            </Stack>
          </Paper>
        </Grid>

        <Grid
          size={{
            xs: 12,
            sm: 6,
            md: 3,
          }}
        >
          <Paper
            sx={{
              p: 2.5,
              height: '100%',
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
            >
              Pending
            </Typography>

            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ mt: 0.5 }}
            >
              <PendingActionsIcon color="warning" />

              <Typography
                variant="h4"
                fontWeight={800}
              >
                {stats.pending}
              </Typography>
            </Stack>
          </Paper>
        </Grid>

        <Grid
          size={{
            xs: 12,
            sm: 6,
            md: 3,
          }}
        >
          <Paper
            sx={{
              p: 2.5,
              height: '100%',
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
            >
              Average Score
            </Typography>

            <Typography
              variant="h4"
              fontWeight={800}
              sx={{ mt: 0.5 }}
            >
              {stats.averageScore}%
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* =====================================================
          ASSESSMENT STRUCTURE INFO
      ====================================================== */}

      <Paper
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Stack
          direction={{
            xs: 'column',
            sm: 'row',
          }}
          spacing={2}
          flexWrap="wrap"
          alignItems={{
            xs: 'flex-start',
            sm: 'center',
          }}
        >
          <Chip
            label={
              hasParts
                ? `${parts.length} Part(s)`
                : `${sections.length} Section(s)`
            }
            variant="outlined"
          />

          <Chip
            label={`${totalQuestions} Question(s)`}
            variant="outlined"
          />

          <Chip
            label={`Configured Marks: ${configuredTotalMarks}`}
            variant="outlined"
          />

          {assessment.weekNumber && (
            <Chip
              label={`Week ${assessment.weekNumber}`}
              variant="outlined"
            />
          )}

          {assessment.status && (
            <Chip
              label={assessment.status}
              color={
                assessment.status ===
                'PUBLISHED'
                  ? 'success'
                  : assessment.status ===
                      'CLOSED'
                    ? 'default'
                    : 'warning'
              }
            />
          )}
        </Stack>
      </Paper>

      {/* =====================================================
          SEARCH + IMPORT / EXPORT
      ====================================================== */}

      <Paper
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 3,
        }}
      >
        <Stack
          direction={{
            xs: 'column',
            md: 'row',
          }}
          spacing={2}
          justifyContent="space-between"
        >
          <TextField
            fullWidth
            sx={{
              maxWidth: {
                xs: '100%',
                md: 360,
              },
            }}
            placeholder="Search student..."
            size="small"
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
          />

          <Stack
            direction={{
              xs: 'column',
              sm: 'row',
            }}
            spacing={1}
            width={{
              xs: '100%',
              md: 'auto',
            }}
          >
            {/* Template */}

            <Button
              variant="outlined"
              startIcon={
                <DownloadIcon />
              }
              onClick={
                handleExportTemplate
              }
              fullWidth
            >
              Template
            </Button>

            {/* 
              IMPORTANT:
              Result export button ab ResultsTable
              ke andar hai.

              Wahan user pehle fields select karega.
            */}

            {/* Select File */}

            <Button
              variant="contained"
              component="label"
              startIcon={
                <UploadIcon />
              }
              disabled={importing}
              fullWidth
            >
              Select Marks File

              <input
                id="assessment-marks-import-input"
                type="file"
                hidden
                accept=".xlsx,.xls,.csv"
                onChange={(e) => {
                  const file =
                    e.target.files?.[0];

                  if (file) {
                    setImportFile(file);
                  }
                }}
              />
            </Button>

            {/* Upload */}

            {importFile && (
              <Button
                variant="contained"
                color="success"
                disabled={importing}
                onClick={handleImport}
                fullWidth
                startIcon={
                  importing ? (
                    <CircularProgress
                      size={18}
                      color="inherit"
                    />
                  ) : (
                    <UploadIcon />
                  )
                }
              >
                {importing
                  ? 'Uploading...'
                  : 'Upload Marks'}
              </Button>
            )}
          </Stack>
        </Stack>

        {/* Selected file */}

        {importFile && (
          <Box sx={{ mt: 2 }}>
            <Chip
              label={`Selected: ${importFile.name}`}
              onDelete={() => {
                setImportFile(null);

                const input =
                  document.getElementById(
                    'assessment-marks-import-input'
                  );

                if (input) {
                  input.value = '';
                }
              }}
            />
          </Box>
        )}
      </Paper>

      {/* =====================================================
          RESULTS TABLE
      ====================================================== */}

      <ResultsTable
        results={
          data.results || []
        }
        sections={sections}
        parts={parts}
        hasParts={hasParts}
        assessment={assessment}
        onViewStudent={(studentId) =>
          setSelectedStudent(
            studentId
          )
        }
        onExportResults={
          handleExportResults
        }
      />

      {/* =====================================================
          STUDENT RESULT DETAIL DIALOG
      ====================================================== */}

      <Dialog
        open={Boolean(
          selectedStudent
        )}
        onClose={() =>
          setSelectedStudent(null)
        }
        maxWidth="lg"
        fullWidth
        fullScreen={false}
        PaperProps={{
          sx: {
            borderRadius: {
              xs: 0,
              sm: 3,
            },
            minHeight: {
              xs: '100vh',
              sm: 'auto',
            },
          },
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            borderBottom:
              '1px solid',
            borderColor:
              'divider',
          }}
        >
          Student Result Detail
        </DialogTitle>

        <DialogContent
          sx={{
            p: {
              xs: 1.5,
              sm: 3,
            },
          }}
        >
          {selectedStudent && (
            <StudentResultDetail
              assessmentId={id}
              studentId={
                selectedStudent
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}