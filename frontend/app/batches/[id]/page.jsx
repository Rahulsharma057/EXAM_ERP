
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Button,
  Divider,
  CircularProgress,
  Alert,
  Stack,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import PeopleIcon from '@mui/icons-material/People';
import SchoolIcon from '@mui/icons-material/School';
import BusinessIcon from '@mui/icons-material/Business';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AssignmentIcon from '@mui/icons-material/Assignment';

import Layout from '../../../components/common/Layout';
import { api } from '../../../services/api';

export default function BatchDetailPage() {
  const params = useParams();
  const router = useRouter();

  const batchId = params?.id;

  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadBatch = async () => {
    if (!batchId) return;

    try {
      setLoading(true);
      setError('');

      const res = await api.getBatch(batchId);

      setBatch(res?.data || res);
    } catch (err) {
      console.error('Failed to load batch:', err);
      setError(
        err?.message || 'Failed to load batch details.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatch();
  }, [batchId]);

  const formatDate = (date) => {
    if (!date) return '—';

    try {
      return new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  if (loading) {
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

  if (error) {
    return (
      <Layout>
        <Box sx={{ p: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push('/batches')}
            sx={{ mb: 2 }}
          >
            Back to Batches
          </Button>

          <Alert severity="error">
            {error}
          </Alert>
        </Box>
      </Layout>
    );
  }

  if (!batch) {
    return (
      <Layout>
        <Alert severity="warning">
          Batch not found.
        </Alert>
      </Layout>
    );
  }

  const course =
    typeof batch.course === 'object'
      ? batch.course
      : null;

  const centre =
    typeof batch.centre === 'object'
      ? batch.centre
      : null;

  const organisation =
    typeof batch.organisation === 'object'
      ? batch.organisation
      : null;

  const students = batch.students || [];
  const assessments = batch.assessments || [];

  return (
    <Layout>
      {/* HEADER */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: {
            xs: 'flex-start',
            md: 'center',
          },
          flexDirection: {
            xs: 'column',
            md: 'row',
          },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => router.push('/batches')}
            sx={{ mb: 1 }}
          >
            Back to Batches
          </Button>

          <Typography
            variant="h4"
            fontWeight={700}
          >
            {batch.name}
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5 }}
          >
            Batch Code: {batch.code || '—'}
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<EditIcon />}
          onClick={() =>
            router.push(`/batches/${batch._id}/edit`)
          }
        >
          Edit Batch
        </Button>
      </Box>

      {/* SUMMARY CARDS */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
              >
                <PeopleIcon
                  color="primary"
                  fontSize="large"
                />

                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    Students
                  </Typography>

                  <Typography
                    variant="h5"
                    fontWeight={700}
                  >
                    {batch.studentCount ??
                      students.length ??
                      0}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
              >
                <AssignmentIcon
                  color="secondary"
                  fontSize="large"
                />

                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    Assessments
                  </Typography>

                  <Typography
                    variant="h5"
                    fontWeight={700}
                  >
                    {batch.assessmentCount ??
                      assessments.length ??
                      0}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
              >
                <CalendarMonthIcon
                  color="success"
                  fontSize="large"
                />

                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    Academic Year
                  </Typography>

                  <Typography
                    variant="h6"
                    fontWeight={700}
                  >
                    {batch.academicYear || '—'}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Stack
                direction="row"
                spacing={2}
                alignItems="center"
              >
                <SchoolIcon
                  color="warning"
                  fontSize="large"
                />

                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    Status
                  </Typography>

                  <Chip
                    size="small"
                    label={
                      batch.isActive
                        ? 'ACTIVE'
                        : 'INACTIVE'
                    }
                    color={
                      batch.isActive
                        ? 'success'
                        : 'default'
                    }
                  />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* BATCH INFORMATION */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Typography
          variant="h6"
          fontWeight={700}
          sx={{ mb: 2 }}
        >
          Batch Information
        </Typography>

        <Divider sx={{ mb: 3 }} />

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <InfoRow
              label="Batch Name"
              value={batch.name}
            />

            <InfoRow
              label="Batch Code"
              value={batch.code}
            />

            <InfoRow
              label="Academic Year"
              value={batch.academicYear}
            />

            <InfoRow
              label="Start Date"
              value={formatDate(batch.startDate)}
            />

            <InfoRow
              label="End Date"
              value={formatDate(batch.endDate)}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <InfoRow
              icon={<BusinessIcon fontSize="small" />}
              label="Organisation"
              value={
                organisation?.name ||
                batch.organisation?.name ||
                batch.organisation ||
                '—'
              }
            />

            <InfoRow
              label="Centre"
              value={
                centre?.name ||
                batch.centre?.name ||
                batch.centre ||
                '—'
              }
            />

            <InfoRow
              label="Course"
              value={
                course?.name ||
                batch.course?.name ||
                batch.course ||
                '—'
              }
            />

            <InfoRow
              label="Course Code"
              value={
                course?.code ||
                batch.course?.code ||
                '—'
              }
            />
          </Grid>
        </Grid>
      </Paper>

      {/* QUICK ACTIONS */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Typography
          variant="h6"
          fontWeight={700}
          sx={{ mb: 2 }}
        >
          Quick Actions
        </Typography>

        <Divider sx={{ mb: 2 }} />

        <Stack
          direction={{
            xs: 'column',
            sm: 'row',
          }}
          spacing={2}
        >
          <Button
            variant="outlined"
            startIcon={<PeopleIcon />}
            onClick={() =>
              router.push(
                `/students?batch=${batch._id}`
              )
            }
          >
            View Students
          </Button>

          <Button
            variant="outlined"
            startIcon={<AssignmentIcon />}
            onClick={() =>
              router.push(
                `/assessments?batch=${batch._id}`
              )
            }
          >
            View Assessments
          </Button>
        </Stack>
      </Paper>

      {/* STUDENTS */}
      {students.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Typography
              variant="h6"
              fontWeight={700}
            >
              Students
            </Typography>

            <Button
              size="small"
              onClick={() =>
                router.push(
                  `/students?batch=${batch._id}`
                )
              }
            >
              View All
            </Button>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    Roll Number
                  </TableCell>

                  <TableCell>
                    Student Name
                  </TableCell>

                  <TableCell>
                    Father Name
                  </TableCell>

                  <TableCell>
                    Mobile
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {students
                  .slice(0, 10)
                  .map((student) => (
                    <TableRow
                      key={student._id}
                      hover
                    >
                      <TableCell>
                        {student.rollNumber || '—'}
                      </TableCell>

                      <TableCell>
                        {student.name || '—'}
                      </TableCell>

                      <TableCell>
                        {student.fatherName || '—'}
                      </TableCell>

                      <TableCell>
                        {student.mobile || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* ASSESSMENTS */}
      {assessments.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            p: 3,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Typography
            variant="h6"
            fontWeight={700}
            sx={{ mb: 2 }}
          >
            Assessments
          </Typography>

          <Divider sx={{ mb: 2 }} />

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    Assessment
                  </TableCell>

                  <TableCell>
                    Week
                  </TableCell>

                  <TableCell>
                    Total Marks
                  </TableCell>

                  <TableCell>
                    Status
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {assessments.map((assessment) => (
                  <TableRow
                    key={assessment._id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() =>
                      router.push(
                        `/assessments/${assessment._id}`
                      )
                    }
                  >
                    <TableCell>
                      {assessment.name || '—'}
                    </TableCell>

                    <TableCell>
                      Week {assessment.weekNumber}
                    </TableCell>

                    <TableCell>
                      {assessment.totalMarks ?? 0}
                    </TableCell>

                    <TableCell>
                      <Chip
                        size="small"
                        label={
                          assessment.status || 'DRAFT'
                        }
                        color={
                          assessment.status ===
                          'PUBLISHED'
                            ? 'success'
                            : assessment.status ===
                              'CLOSED'
                            ? 'error'
                            : 'default'
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Layout>
  );
}

function InfoRow({
  label,
  value,
  icon,
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 1.2,
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      {icon && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {icon}
        </Box>
      )}

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          minWidth: {
            xs: 120,
            sm: 150,
          },
        }}
      >
        {label}
      </Typography>

      <Typography
        variant="body2"
        fontWeight={600}
        sx={{
          wordBreak: 'break-word',
        }}
      >
        {value || '—'}
      </Typography>
    </Box>
  );
}

