
'use client';

import React, { useState, useEffect } from 'react';

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
  Stack
} from '@mui/material';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import { api } from '../../services/api';

export default function StudentResultDetail({
  assessmentId,
  studentId
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadResult = async () => {
      try {
        setLoading(true);
        setError('');

        const res = await api.getStudentSectionResults(
          assessmentId,
          studentId
        );

        if (!mounted) return;

        setData(res.data);
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

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          py: 6
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // =====================================================
  // ERROR
  // =====================================================

  if (error) {
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        {error}
      </Alert>
    );
  }

  // =====================================================
  // NO DATA
  // =====================================================

  if (!data) {
    return (
      <Alert severity="info" sx={{ my: 2 }}>
        No result data available.
      </Alert>
    );
  }

  const isPending =
    data.status === 'PENDING' ||
    data.status === 'NOT_ATTEMPTED';

  // =====================================================
  // STUDENT INFO
  // =====================================================

  const studentName =
    data.student?.name || 'Unknown Student';

  const rollNumber =
    data.student?.rollNumber || 'N/A';

  // =====================================================
  // PENDING / NOT COMPLETED
  // =====================================================

  if (isPending) {
    return (
      <Box sx={{ py: 1 }}>

        {/* Student Information */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
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
              icon={<PendingActionsIcon />}
              label="Assessment Pending"
              color="warning"
              sx={{ fontWeight: 600 }}
            />
          </Stack>
        </Paper>

        {/* Pending Message */}
        <Paper
          sx={{
            p: { xs: 3, sm: 5 },
            mb: 2,
            textAlign: 'center',
            borderRadius: 3,
            border: '1px dashed',
            borderColor: 'warning.main',
            bgcolor: 'warning.50'
          }}
        >
          <PendingActionsIcon
            sx={{
              fontSize: 64,
              color: 'warning.main',
              mb: 1
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
              maxWidth: 550,
              mx: 'auto'
            }}
          >
            This student has not completed this
            assessment yet. Marks and question-wise
            results are not available.
          </Typography>

          <Chip
            label="PENDING"
            color="warning"
            sx={{
              mt: 2,
              fontWeight: 700
            }}
          />
        </Paper>

        {/* Assessment Information */}
        {data.assessment && (
          <Paper
            sx={{
              p: 2,
              mb: 2,
              borderRadius: 2
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
                  sm: 'repeat(2, 1fr)'
                },
                gap: 2
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
                  {data.assessment.name || 'N/A'}
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
                  {data.assessment.code || 'N/A'}
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
                  {data.totalMax || 0}
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
        )}

        {/* Pending Overall */}
        <Paper
          sx={{
            p: 2.5,
            borderRadius: 2,
            bgcolor: 'grey.100'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
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
                Result will be available after the
                assessment is completed.
              </Typography>
            </Box>

            <Box sx={{ textAlign: 'right' }}>
              <Typography
                variant="h6"
                fontWeight={700}
              >
                0/{data.totalMax || 0}
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

  // =====================================================
  // COMPLETED RESULT
  // =====================================================

  return (
    <Box>

      {/* Student Header */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2
        }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'center' }}
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
            icon={<CheckCircleIcon />}
            label="Assessment Completed"
            color="success"
            sx={{ fontWeight: 600 }}
          />
        </Stack>
      </Paper>

      {/* Sections */}
      {data.sections?.map((section) => (
        <Paper
          key={section.sectionName}
          sx={{
            p: 2,
            mb: 2,
            borderRadius: 2
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 1
            }}
          >
            <Typography
              variant="subtitle1"
              fontWeight="bold"
            >
              {section.sectionName}
            </Typography>

            <Chip
              label={`${section.obtained}/${section.max} (${section.percentage}%)`}
              color="primary"
            />
          </Box>

          <Divider sx={{ mb: 1 }} />

          <TableContainer>
            <Table size="small">
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
                {section.questions?.map(
                  (q, idx) => (
                    <TableRow key={idx}>

                      <TableCell>
                        {q.questionText}
                      </TableCell>

                      <TableCell align="center">
                        {q.maxPoints}
                      </TableCell>

                      <TableCell align="center">
                        {q.answerValue || '-'}
                      </TableCell>

                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={`${q.awardedScore}/${q.maxPoints}`}
                          color={
                            Number(q.awardedScore) > 0
                              ? 'success'
                              : 'error'
                          }
                        />
                      </TableCell>

                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ))}

      {/* Overall Result */}
      <Paper
        sx={{
          p: 2,
          bgcolor: 'primary.main',
          color: 'white',
          borderRadius: 2
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <Typography variant="h6">
            Overall
          </Typography>

          <Typography variant="h6">
            {data.totalObtained || 0}/
            {data.totalMax || 0}
            {' '}
            ({data.overallPercentage || 0}%)
          </Typography>
        </Box>
      </Paper>

    </Box>
  );
}

