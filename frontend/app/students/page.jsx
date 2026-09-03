
'use client';

import React, { useCallback, useEffect, useState } from 'react';

import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

import SearchIcon from '@mui/icons-material/Search';
import UploadIcon from '@mui/icons-material/Upload';
import RefreshIcon from '@mui/icons-material/Refresh';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';

import Pagination from '@mui/material/Pagination';

import Layout from '../../components/common/Layout';
import HierarchyFilter from '../../components/assessment/HierarchyFilter';
import { api } from '../../services/api';

const LIMIT = 50;

export default function StudentsPage() {
  // ============================================================
  // STATE
  // ============================================================

  const [students, setStudents] = useState([]);
  const [filters, setFilters] = useState({});

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ============================================================
  // LOAD STUDENTS
  // ============================================================

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = {
        page,
        limit: LIMIT,
      };

      // Only send valid filter values
      if (filters?.organisation) {
        params.organisation = filters.organisation;
      }

      if (filters?.centre) {
        params.centre = filters.centre;
      }

      if (filters?.course) {
        params.course = filters.course;
      }

      if (filters?.batch) {
        params.batch = filters.batch;
      }

      if (search.trim()) {
        params.search = search.trim();
      }

      const response = await api.getStudents(params);

      if (!response?.success) {
        throw new Error(
          response?.message || 'Failed to load students'
        );
      }

      setStudents(Array.isArray(response.data) ? response.data : []);

      setTotal(
        Number(response?.pagination?.total || 0)
      );
    } catch (err) {
      console.error('LOAD STUDENTS ERROR:', err);

      setStudents([]);
      setTotal(0);

      setError(
        err?.message || 'Unable to load students'
      );
    } finally {
      setLoading(false);
    }
  }, [filters, page, search]);

  // ============================================================
  // LOAD WHEN FILTER / PAGE / SEARCH CHANGES
  // ============================================================

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  // ============================================================
  // FILTER CHANGE
  // ============================================================

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters || {});
    setPage(1);
    setError('');
    setSuccess('');
  };

  // ============================================================
  // SEARCH
  // ============================================================

  const handleSearchChange = (event) => {
    setSearch(event.target.value);
    setPage(1);
  };

  // ============================================================
  // PAGE CHANGE
  // ============================================================

  const handlePageChange = (_, value) => {
    setPage(value);
  };

  // ============================================================
  // REFRESH
  // ============================================================

  const handleRefresh = () => {
    setSuccess('');
    setError('');
    loadStudents();
  };

  // ============================================================
  // IMPORT STUDENTS
  // ============================================================

  const handleImport = async (event) => {
    const file = event.target.files?.[0];

    // Reset input so same file can be selected again
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!filters?.batch) {
      setError('Please select a Batch before importing students.');
      return;
    }

    const allowedExtensions = [
      '.xlsx',
      '.xls',
      '.csv',
    ];

    const fileName = file.name.toLowerCase();

    const validFile = allowedExtensions.some(
      (extension) => fileName.endsWith(extension)
    );

    if (!validFile) {
      setError(
        'Invalid file format. Please upload XLSX, XLS or CSV file.'
      );
      return;
    }

    setImporting(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.importStudents(
        filters.batch,
        file
      );

      if (!response?.success) {
        throw new Error(
          response?.message || 'Student import failed'
        );
      }

      const imported = response?.data?.imported ?? 0;
      const failed = response?.data?.failed ?? 0;

      setSuccess(
        `Import completed successfully. Imported: ${imported}, Failed: ${failed}`
      );

      // Reload student list
      setPage(1);

      await loadStudents();
    } catch (err) {
      console.error('IMPORT STUDENTS ERROR:', err);

      setError(
        err?.message || 'Failed to import students'
      );
    } finally {
      setImporting(false);
    }
  };

  // ============================================================
  // PAGINATION
  // ============================================================

  const totalPages = Math.max(
    1,
    Math.ceil(total / LIMIT)
  );

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <Layout>
      <Box sx={{ width: '100%' }}>

        {/* ======================================================
            HEADER
        ====================================================== */}

        <Box
          sx={{
            mb: 3,
            display: 'flex',
            flexDirection: {
              xs: 'column',
              sm: 'row',
            },
            justifyContent: 'space-between',
            alignItems: {
              xs: 'flex-start',
              sm: 'center',
            },
            gap: 2,
          }}
        >
          <Box>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
            >
              <PeopleAltIcon />

              <Typography
                variant="h4"
                fontWeight={700}
              >
                Students
              </Typography>
            </Stack>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              Manage and view students across your organisation
              hierarchy.
            </Typography>
          </Box>

          <Button
            variant="outlined"
            startIcon={
              loading ? (
                <CircularProgress size={18} />
              ) : (
                <RefreshIcon />
              )
            }
            onClick={handleRefresh}
            disabled={loading || importing}
          >
            Refresh
          </Button>
        </Box>

        {/* ======================================================
            ALERTS
        ====================================================== */}

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            onClose={() => setError('')}
          >
            {error}
          </Alert>
        )}

        {success && (
          <Alert
            severity="success"
            sx={{ mb: 2 }}
            onClose={() => setSuccess('')}
          >
            {success}
          </Alert>
        )}

        {/* ======================================================
            FILTERS
        ====================================================== */}

        <Paper
          elevation={0}
          sx={{
            p: 2,
            mb: 3,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Typography
            variant="subtitle1"
            fontWeight={600}
            sx={{ mb: 2 }}
          >
            Student Filters
          </Typography>

          <Grid container spacing={2}>

            <Grid size={{ xs: 12 }}>
              <HierarchyFilter
                onChange={handleFilterChange}
                values={filters}
              />
            </Grid>

            {/* SEARCH */}

            <Grid size={{ xs: 12, md: 8 }}>
              <TextField
                fullWidth
                size="small"
                value={search}
                onChange={handleSearchChange}
                placeholder="Search by student name or roll number..."
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* IMPORT */}

            <Grid
              size={{ xs: 12, md: 4 }}
              sx={{
                display: 'flex',
                justifyContent: {
                  xs: 'stretch',
                  md: 'flex-end',
                },
              }}
            >
   <Stack
  direction={{ xs: 'column', sm: 'row' }}
  spacing={1}
  sx={{
    width: '100%',
    justifyContent: 'flex-end',
  }}
>
  <Button
    variant="outlined"
  onClick={() => api.downloadStudentTemplate(filters.batch)}
    disabled={!filters?.batch || importing}
  >
    Download Template
  </Button>

  <Button
    variant="contained"
    component="label"
    startIcon={
      importing ? (
        <CircularProgress size={18} color="inherit" />
      ) : (
        <UploadIcon />
      )
    }
    disabled={!filters?.batch || importing || loading}
  >
    {importing ? 'Importing...' : 'Import Students'}

    <input
      type="file"
      hidden
      accept=".xlsx,.xls,.csv"
      onChange={handleImport}
    />
  </Button>
</Stack>
            </Grid>

          </Grid>

          {/* Selected batch information */}

          {filters?.batch && (
            <Box sx={{ mt: 2 }}>
              <Chip
                label="Batch selected"
                size="small"
                color="primary"
                variant="outlined"
              />
            </Box>
          )}

        </Paper>

        {/* ======================================================
            STUDENT COUNT
        ====================================================== */}

        <Box
          sx={{
            mb: 1.5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Typography
            variant="body2"
            color="text.secondary"
          >
            {loading
              ? 'Loading students...'
              : `${total} student${total === 1 ? '' : 's'} found`}
          </Typography>

          {filters?.batch && (
            <Typography
              variant="body2"
              color="text.secondary"
            >
              Showing page {page} of {totalPages}
            </Typography>
          )}
        </Box>

        {/* ======================================================
            STUDENT TABLE
        ====================================================== */}

        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
            overflowX: 'auto',
          }}
        >
          <Table
            sx={{
              minWidth: 850,
            }}
          >

            <TableHead>
              <TableRow>

                <TableCell
                  sx={{ fontWeight: 700 }}
                >
                  Roll Number
                </TableCell>

                <TableCell
                  sx={{ fontWeight: 700 }}
                >
                  Student Name
                </TableCell>

                <TableCell
                  sx={{ fontWeight: 700 }}
                >
                  Father Name
                </TableCell>

                <TableCell
                  sx={{ fontWeight: 700 }}
                >
                  Mobile
                </TableCell>

                <TableCell
                  sx={{ fontWeight: 700 }}
                >
                  Gender
                </TableCell>

                <TableCell
                  sx={{ fontWeight: 700 }}
                >
                  Course
                </TableCell>

                <TableCell
                  sx={{ fontWeight: 700 }}
                >
                  Batch
                </TableCell>

              </TableRow>
            </TableHead>

            <TableBody>

              {/* LOADING */}

              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    align="center"
                    sx={{ py: 7 }}
                  >
                    <CircularProgress />

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 2 }}
                    >
                      Loading students...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : students.length === 0 ? (

                /* EMPTY */

                <TableRow>
                  <TableCell
                    colSpan={7}
                    align="center"
                    sx={{ py: 7 }}
                  >
                    <PeopleAltIcon
                      sx={{
                        fontSize: 48,
                        color: 'text.disabled',
                        mb: 1,
                      }}
                    />

                    <Typography
                      variant="h6"
                      color="text.secondary"
                    >
                      No students found
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 0.5 }}
                    >
                      Try changing the hierarchy filter
                      or search term.
                    </Typography>
                  </TableCell>
                </TableRow>

              ) : (

                /* STUDENTS */

                students.map((student) => (
                  <TableRow
                    key={student._id}
                    hover
                  >

                    <TableCell>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                      >
                        {student.rollNumber || '-'}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                      >
                        {student.name || '-'}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      {student.fatherName || '-'}
                    </TableCell>

                    <TableCell>
                      {student.mobile || '-'}
                    </TableCell>

                    <TableCell>
                      {student.gender || '-'}
                    </TableCell>

                    <TableCell>
                      {student.course?.name || '-'}
                    </TableCell>

                    <TableCell>
                      {student.batch?.name || '-'}
                    </TableCell>

                  </TableRow>
                ))

              )}

            </TableBody>

          </Table>
        </TableContainer>

        {/* ======================================================
            PAGINATION
        ====================================================== */}

        {!loading && total > 0 && totalPages > 1 && (
          <Box
            sx={{
              mt: 3,
              display: 'flex',
              justifyContent: 'center',
              pb: 3,
            }}
          >
            <Pagination
              count={totalPages}
              page={page}
              onChange={handlePageChange}
              color="primary"
              showFirstButton
              showLastButton
            />
          </Box>
        )}

      </Box>
    </Layout>
  );
}

