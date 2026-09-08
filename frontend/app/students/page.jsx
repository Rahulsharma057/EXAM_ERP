'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  Menu,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';

import SearchIcon from '@mui/icons-material/Search';
import UploadIcon from '@mui/icons-material/Upload';
import RefreshIcon from '@mui/icons-material/Refresh';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import CloseIcon from '@mui/icons-material/Close';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

import Pagination from '@mui/material/Pagination';

import Layout from '../../components/common/Layout';
import HierarchyFilter from '../../components/assessment/HierarchyFilter';
import StudentFormDialog from '../../components/students/StudentFormDialog';
import StudentViewDialog from '../../components/students/StudentViewDialog';
import DeleteStudentDialog from '../../components/students/DeleteStudentDialog';
import { api } from '../../services/api';

import {
  COLORS,
  PAGE_SIZE_OPTIONS,
  cardSx,
  inputFieldSx,
  outlinedButtonSx,
  containedButtonSx,
  iconButtonSx,
  snackbarAlertSx,
} from '../../components/students/theme';

const TABLE_COLUMN_COUNT = 6;

/* Simple initials avatar — one color, consistent, easy on the eye */
function StudentAvatar({ name }) {
  const initials = (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <Avatar
      sx={{
        width: 32,
        height: 32,
        fontSize: '12px',
        fontWeight: 700,
        backgroundColor: COLORS.blueLight,
        color: COLORS.blueDark,
        border: `1px solid ${COLORS.blueBorder}`,
      }}
    >
      {initials || <PeopleAltIcon sx={{ fontSize: 16 }} />}
    </Avatar>
  );
}

/* Skeleton placeholder rows shown only on the very first load */
function SkeletonRows({ rows = 6 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <TableRow key={index} sx={{ '&:last-child td': { borderBottom: 'none' } }}>
          <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${COLORS.border}` }}>
            <Skeleton variant="text" width={64} height={18} />
          </TableCell>
          <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${COLORS.border}` }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Skeleton variant="circular" width={32} height={32} />
              <Skeleton variant="text" width={120} height={18} />
            </Stack>
          </TableCell>
          <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${COLORS.border}` }}>
            <Skeleton variant="text" width={90} height={18} />
          </TableCell>
          <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${COLORS.border}` }}>
            <Skeleton variant="text" width={140} height={18} />
          </TableCell>
          <TableCell sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${COLORS.border}` }}>
            <Skeleton variant="text" width={110} height={18} />
          </TableCell>
          <TableCell align="right" sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${COLORS.border}` }}>
            <Skeleton variant="text" width={70} height={18} sx={{ ml: 'auto' }} />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

/* ============================================================
   PAGE
============================================================ */

export default function StudentsPage() {
  const isMobile = useMediaQuery('(max-width:640px)');

  /* ============================================================
     STATE
  ============================================================ */

  const [students, setStudents] = useState([]);
  const [filters, setFilters] = useState({});

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalStudents, setTotalStudents] = useState(0);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [importing, setImporting] = useState(false);

  // Persistent — describes why the LIST couldn't load. Shown inline
  // in the table with a retry action, not as a page-level banner.
  const [listError, setListError] = useState('');

  // Transient — feedback for an ACTION the user just took (create,
  // update, delete, import). Auto-dismisses, doesn't shift layout.
  const [toast, setToast] = useState({ open: false, severity: 'success', message: '' });

  const hasLoadedOnce = useRef(false);

  const [formDialog, setFormDialog] = useState({ open: false, mode: 'create', studentId: null });
  const [viewDialog, setViewDialog] = useState({ open: false, studentId: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, student: null });
  const [rowMenu, setRowMenu] = useState({ anchorEl: null, student: null });

  const showToast = (message, severity = 'success') => {
    setToast({ open: true, severity, message });
  };

  const closeToast = () => setToast((prev) => ({ ...prev, open: false }));

  /* ============================================================
     DEBOUNCE SEARCH
  ============================================================ */

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 450);

    return () => clearTimeout(timer);
  }, [searchInput]);

  /* ============================================================
     LOAD STUDENTS (backend-driven pagination)
  ============================================================ */

  const loadStudents = useCallback(async () => {
    const isBackground = hasLoadedOnce.current;

    if (isBackground) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setListError('');

    try {
      const params = { page, limit: rowsPerPage };

      if (filters?.organisation) params.organisation = filters.organisation;
      if (filters?.centre) params.centre = filters.centre;
      if (filters?.course) params.course = filters.course;
      if (filters?.batch) params.batch = filters.batch;
      if (search) params.search = search;

      const response = await api.getStudents(params);

      if (!response?.success) {
        throw new Error(response?.message || 'Failed to load students');
      }

      const studentList = Array.isArray(response?.data) ? response.data : [];
      const total = response?.pagination?.total ?? studentList.length;

      setStudents(studentList);
      setTotalStudents(total);
      hasLoadedOnce.current = true;

      const maxPage = Math.max(1, Math.ceil(total / rowsPerPage));
      if (page > maxPage) {
        setPage(maxPage);
      }
    } catch (err) {
      console.error('LOAD STUDENTS ERROR:', err);
      setStudents([]);
      setTotalStudents(0);
      setListError(err?.message || 'Unable to load students');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, search, page, rowsPerPage]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  /* ============================================================
     FILTER / SEARCH HANDLERS
  ============================================================ */

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters || {});
    setPage(1);
  };

  const handleSearchChange = (event) => setSearchInput(event.target.value);

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  const handlePageChange = (_event, value) => setPage(value);

  const handleRowsPerPageChange = (event) => {
    setRowsPerPage(Number(event.target.value));
    setPage(1);
  };

  const handleRefresh = () => loadStudents();

  /* ============================================================
     IMPORT STUDENTS
  ============================================================ */

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    if (!filters?.batch) {
      showToast('Please select a Batch before importing students.', 'error');
      return;
    }

    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const fileName = file.name.toLowerCase();
    const validFile = allowedExtensions.some((ext) => fileName.endsWith(ext));

    if (!validFile) {
      showToast('Invalid file format. Please upload XLSX, XLS or CSV file.', 'error');
      return;
    }

    setImporting(true);

    try {
      const response = await api.importStudents(filters.batch, file);

      if (!response?.success) {
        throw new Error(response?.message || 'Student import failed');
      }

      const imported = response?.data?.imported ?? 0;
      const failed = response?.data?.failed ?? 0;

      showToast(`Import completed. Imported: ${imported}, Failed: ${failed}`, failed > 0 ? 'warning' : 'success');
      setPage(1);
      await loadStudents();
    } catch (err) {
      console.error('IMPORT STUDENTS ERROR:', err);
      showToast(err?.message || 'Failed to import students', 'error');
    } finally {
      setImporting(false);
    }
  };

  /* ============================================================
     CRUD DIALOG HANDLERS
  ============================================================ */

  const openAddDialog = () => setFormDialog({ open: true, mode: 'create', studentId: null });

  const openEditDialog = (studentId) => {
    setRowMenu({ anchorEl: null, student: null });
    setViewDialog({ open: false, studentId: null });
    setFormDialog({ open: true, mode: 'edit', studentId });
  };

  const openViewDialog = (studentId) => {
    setRowMenu({ anchorEl: null, student: null });
    setViewDialog({ open: true, studentId });
  };

  const openDeleteDialog = (student) => {
    setRowMenu({ anchorEl: null, student: null });
    setDeleteDialog({ open: true, student });
  };

  const handleRowMenuOpen = (event, student) => {
    setRowMenu({ anchorEl: event.currentTarget, student });
  };

  const handleRowMenuClose = () => setRowMenu({ anchorEl: null, student: null });

  const handleFormSuccess = (message) => {
    showToast(message, 'success');
    loadStudents();
  };

  const handleDeleteSuccess = (message) => {
    showToast(message, 'success');
    loadStudents();
  };

  /* ============================================================
     DISPLAY RANGE
  ============================================================ */

  const firstStudent = totalStudents === 0 ? 0 : (page - 1) * rowsPerPage + 1;
  const lastStudent = totalStudents === 0 ? 0 : firstStudent + students.length - 1;
  const totalPages = Math.max(1, Math.ceil(totalStudents / rowsPerPage));

  const showInitialLoading = loading && !hasLoadedOnce.current;
  const showListError = !showInitialLoading && listError;
  const showEmptyState = !showInitialLoading && !listError && students.length === 0;

  /* ============================================================
     RENDER
  ============================================================ */

  return (
    <Layout>
      <Box
        sx={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          backgroundColor: COLORS.background,
          overflowX: 'hidden',
          boxSizing: 'border-box',
          px: { xs: 1.25, sm: 2, md: 2.5, lg: 3 },
          py: { xs: 1.5, sm: 2, md: 2.5 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 1600, minWidth: 0, mx: 'auto' }}>
          {/* ====================================================
              HEADER
          ==================================================== */}

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'center' },
              justifyContent: 'space-between',
              gap: 2,
              mb: 2.5,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography
                sx={{ fontSize: { xs: 22, sm: 25 }, lineHeight: 1.2, fontWeight: 700, color: COLORS.text }}
              >
                Students
              </Typography>

              <Typography sx={{ mt: 0.5, color: COLORS.secondaryText, fontSize: '13.5px', lineHeight: 1.5 }}>
                Manage and view students across your organisation hierarchy.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center">
              {hasLoadedOnce.current && !listError && (
                <Chip
                  icon={<PeopleAltIcon sx={{ fontSize: '16px !important' }} />}
                  label={`${totalStudents} student${totalStudents === 1 ? '' : 's'}`}
                  size="small"
                  sx={{
                    height: 32,
                    borderRadius: '8px',
                    backgroundColor: COLORS.blueLight,
                    border: `1px solid ${COLORS.blueBorder}`,
                    color: COLORS.blueDark,
                    fontSize: '12.5px',
                    fontWeight: 600,
                    '& .MuiChip-icon': { color: COLORS.blue },
                  }}
                />
              )}

              <Tooltip title="Reload the list">
                <span>
                  <Button
                    variant="outlined"
                    startIcon={
                      loading || refreshing ? (
                        <CircularProgress size={16} sx={{ color: COLORS.blue }} />
                      ) : (
                        <RefreshIcon sx={{ fontSize: 19 }} />
                      )
                    }
                    onClick={handleRefresh}
                    disabled={loading || refreshing || importing}
                    aria-label="Refresh student list"
                    sx={{ ...outlinedButtonSx, width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 105 } }}
                  >
                    Refresh
                  </Button>
                </span>
              </Tooltip>

              <Button
                variant="contained"
                startIcon={<PersonAddAlt1Icon sx={{ fontSize: 19 }} />}
                onClick={openAddDialog}
                sx={{ ...containedButtonSx, width: { xs: '100%', sm: 'auto' }, whiteSpace: 'nowrap' }}
              >
                Add Student
              </Button>
            </Stack>
          </Box>

          {/* ====================================================
              FILTER CARD
          ==================================================== */}

          <Paper elevation={0} sx={{ ...cardSx, p: { xs: 1.5, sm: 2, md: 2.5 }, mb: 2, minWidth: 0 }}>
            <Box
              sx={{
                width: '100%',
                minWidth: 0,
                '& .MuiFormControl-root': { width: '100%', minWidth: 0 },
                '& .MuiTextField-root': { width: '100%', minWidth: 0 },
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  backgroundColor: COLORS.white,
                  '& fieldset': { borderColor: COLORS.border },
                  '&:hover fieldset': { borderColor: COLORS.blueBorder },
                  '&.Mui-focused fieldset': { borderColor: COLORS.blue, borderWidth: '1.5px' },
                },
                '& .MuiInputLabel-root.Mui-focused': { color: COLORS.blue },
                '& .MuiSelect-select': {
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                },
              }}
            >
              <HierarchyFilter onChange={handleFilterChange} values={filters} />
            </Box>

            <Divider sx={{ my: 2, borderColor: COLORS.border }} />

            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, md: 6, lg: 7 }}>
                <TextField
                  fullWidth
                  size="small"
                  value={searchInput}
                  onChange={handleSearchChange}
                  placeholder="Search by student name or roll number..."
                  inputProps={{ 'aria-label': 'Search students by name or roll number' }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: COLORS.mutedText, fontSize: 20 }} />
                      </InputAdornment>
                    ),
                    endAdornment: searchInput ? (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          onClick={handleClearSearch}
                          aria-label="Clear search"
                          sx={{ p: 0.25, ...iconButtonSx }}
                        >
                          <CloseIcon sx={{ fontSize: 17, color: COLORS.mutedText }} />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  }}
                  sx={inputFieldSx}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6, lg: 5 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: '100%', height: '100%' }}>
                  <Tooltip title={!filters?.batch ? 'Select a batch first' : ''}>
                    <span style={{ flex: 1, display: 'flex' }}>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<FileDownloadOutlinedIcon sx={{ fontSize: 19 }} />}
                        onClick={() => api.downloadStudentTemplate(filters.batch)}
                        disabled={!filters?.batch || importing}
                        sx={{ ...outlinedButtonSx, whiteSpace: 'nowrap' }}
                      >
                        Download Template
                      </Button>
                    </span>
                  </Tooltip>

                  <Tooltip title={!filters?.batch ? 'Select a batch first' : ''}>
                    <span style={{ flex: 1, display: 'flex' }}>
                      <Button
                        fullWidth
                        variant="contained"
                        component="label"
                        startIcon={
                          importing ? <CircularProgress size={17} color="inherit" /> : <UploadIcon sx={{ fontSize: 19 }} />
                        }
                        disabled={!filters?.batch || importing || loading}
                        sx={{ ...containedButtonSx, whiteSpace: 'nowrap' }}
                      >
                        {importing ? 'Importing...' : 'Import Students'}
                        <input
                          type="file"
                          hidden
                          accept=".xlsx,.xls,.csv"
                          onChange={handleImport}
                          aria-label="Import students from file"
                        />
                      </Button>
                    </span>
                  </Tooltip>
                </Stack>
              </Grid>
            </Grid>
          </Paper>

          {/* ====================================================
              STUDENT TABLE
          ==================================================== */}

          <TableContainer
            component={Paper}
            elevation={0}
            sx={{ ...cardSx, width: '100%', maxWidth: '100%', minWidth: 0, position: 'relative' }}
          >
            {refreshing && (
              <LinearProgress
                aria-hidden="true"
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  zIndex: 2,
                  backgroundColor: 'transparent',
                  '& .MuiLinearProgress-bar': { backgroundColor: COLORS.blue },
                }}
              />
            )}

            <Box
              aria-busy={refreshing}
              sx={{
                width: '100%',
                overflowX: 'auto',
                overflowY: 'hidden',
                WebkitOverflowScrolling: 'touch',
                '&::-webkit-scrollbar': { height: 7 },
                '&::-webkit-scrollbar-track': { backgroundColor: '#F1F5F9' },
                '&::-webkit-scrollbar-thumb': { backgroundColor: '#CBD5E1', borderRadius: 10 },
              }}
            >
              <Table sx={{ minWidth: 780 }}>
                <TableHead>
                  <TableRow>
                    {['Roll Number', 'Student Name', 'Mobile', 'Course', 'Batch'].map((heading) => (
                      <TableCell
                        key={heading}
                        scope="col"
                        sx={{
                          backgroundColor: COLORS.blueLight,
                          color: COLORS.blueDark,
                          fontWeight: 700,
                          fontSize: '12px',
                          whiteSpace: 'nowrap',
                          py: 1.5,
                          px: 2,
                          borderBottom: `1px solid ${COLORS.blueBorder}`,
                        }}
                      >
                        {heading}
                      </TableCell>
                    ))}

                    <TableCell
                      scope="col"
                      align="right"
                      sx={{
                        backgroundColor: COLORS.blueLight,
                        color: COLORS.blueDark,
                        fontWeight: 700,
                        fontSize: '12px',
                        whiteSpace: 'nowrap',
                        py: 1.5,
                        px: 2,
                        borderBottom: `1px solid ${COLORS.blueBorder}`,
                      }}
                    >
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {showInitialLoading && <SkeletonRows />}

                  {showListError && (
                    <TableRow>
                      <TableCell colSpan={TABLE_COLUMN_COUNT} align="center" sx={{ py: 7, borderBottom: 'none' }}>
                        <Stack alignItems="center" spacing={1.25}>
                          <Box
                            sx={{
                              width: 52,
                              height: 52,
                              borderRadius: '14px',
                              backgroundColor: COLORS.redLight,
                              border: `1px solid ${COLORS.redBorder}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <ErrorOutlineIcon sx={{ fontSize: 26, color: COLORS.red }} />
                          </Box>

                          <Typography sx={{ fontSize: '14px', fontWeight: 700, color: COLORS.text }}>
                            Couldn't load students
                          </Typography>

                          <Typography sx={{ fontSize: '13px', color: COLORS.secondaryText, maxWidth: 380 }}>
                            {listError}
                          </Typography>

                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                            onClick={handleRefresh}
                            sx={{ ...outlinedButtonSx, mt: 0.5 }}
                          >
                            Try again
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )}

                  {showEmptyState && (
                    <TableRow>
                      <TableCell colSpan={TABLE_COLUMN_COUNT} align="center" sx={{ py: 8, borderBottom: 'none' }}>
                        <Stack alignItems="center" spacing={1}>
                          <Box
                            sx={{
                              width: 60,
                              height: 60,
                              borderRadius: '14px',
                              backgroundColor: COLORS.blueLight,
                              border: `1px solid ${COLORS.blueBorder}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              mb: 0.5,
                            }}
                          >
                            <PeopleAltIcon sx={{ fontSize: 28, color: COLORS.blue }} />
                          </Box>

                          <Typography sx={{ fontSize: '15px', fontWeight: 700, color: COLORS.text }}>
                            No students found
                          </Typography>

                          <Typography
                            sx={{ fontSize: '13px', color: COLORS.secondaryText, maxWidth: 420, lineHeight: 1.6 }}
                          >
                            Try changing the hierarchy filter or search term, or add a student manually.
                          </Typography>

                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<PersonAddAlt1Icon sx={{ fontSize: 16 }} />}
                            onClick={openAddDialog}
                            sx={{ ...containedButtonSx, mt: 0.5 }}
                          >
                            Add Student
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )}

                  {!showInitialLoading && !showListError && !showEmptyState &&
                    students.map((student) => (
                      <TableRow
                        key={student._id}
                        hover
                        sx={{
                          transition: 'background-color 0.15s ease',
                          '&:hover': { backgroundColor: COLORS.blueLight },
                          '&:last-child td': { borderBottom: 'none' },
                        }}
                      >
                        <TableCell
                          sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${COLORS.border}`, whiteSpace: 'nowrap' }}
                        >
                          <Typography sx={{ fontSize: '13px', fontWeight: 700, color: COLORS.blueDark }}>
                            {student.rollNumber || '-'}
                          </Typography>
                        </TableCell>

                        <TableCell
                          sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${COLORS.border}`, whiteSpace: 'nowrap' }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center">
                            <StudentAvatar name={student.name} />
                            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: COLORS.text }}>
                              {student.name || '-'}
                            </Typography>
                          </Stack>
                        </TableCell>

                        <TableCell
                          sx={{
                            py: 1.5,
                            px: 2,
                            borderBottom: `1px solid ${COLORS.border}`,
                            whiteSpace: 'nowrap',
                            fontSize: '13px',
                            color: COLORS.text,
                          }}
                        >
                          {student.mobile || '-'}
                        </TableCell>

                        <TableCell
                          sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${COLORS.border}`, maxWidth: 220, whiteSpace: 'nowrap' }}
                        >
                          <Typography
                            title={student.course?.name || '-'}
                            sx={{
                              maxWidth: 220,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontSize: '13px',
                              color: COLORS.text,
                            }}
                          >
                            {student.course?.name || '-'}
                          </Typography>
                        </TableCell>

                        <TableCell
                          sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${COLORS.border}`, maxWidth: 200, whiteSpace: 'nowrap' }}
                        >
                          <Typography
                            title={student.batch?.name || '-'}
                            sx={{
                              maxWidth: 200,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontSize: '13px',
                              color: COLORS.text,
                            }}
                          >
                            {student.batch?.name || '-'}
                          </Typography>
                        </TableCell>

                        <TableCell
                          align="right"
                          sx={{ py: 1, px: 2, borderBottom: `1px solid ${COLORS.border}`, whiteSpace: 'nowrap' }}
                        >
                          {isMobile ? (
                            <IconButton
                              size="small"
                              onClick={(e) => handleRowMenuOpen(e, student)}
                              aria-label={`Actions for ${student.name}`}
                              sx={iconButtonSx}
                            >
                              <MoreVertIcon sx={{ fontSize: 19, color: COLORS.secondaryText }} />
                            </IconButton>
                          ) : (
                            <>
                              <Tooltip title="View details">
                                <IconButton
                                  size="small"
                                  onClick={() => openViewDialog(student._id)}
                                  aria-label={`View ${student.name}`}
                                  sx={iconButtonSx}
                                >
                                  <VisibilityOutlinedIcon sx={{ fontSize: 18, color: COLORS.secondaryText }} />
                                </IconButton>
                              </Tooltip>

                              <Tooltip title="Edit student">
                                <IconButton
                                  size="small"
                                  onClick={() => openEditDialog(student._id)}
                                  aria-label={`Edit ${student.name}`}
                                  sx={iconButtonSx}
                                >
                                  <EditOutlinedIcon sx={{ fontSize: 18, color: COLORS.blue }} />
                                </IconButton>
                              </Tooltip>

                              <Tooltip title="Remove student">
                                <IconButton
                                  size="small"
                                  onClick={() => openDeleteDialog(student)}
                                  aria-label={`Remove ${student.name}`}
                                  sx={iconButtonSx}
                                >
                                  <DeleteOutlineIcon sx={{ fontSize: 18, color: COLORS.red }} />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Box>

            {/* ==================================================
                TABLE FOOTER
            ================================================== */}

            {!showInitialLoading && !showListError && totalStudents > 0 && (
              <Box
                sx={{
                  borderTop: `1px solid ${COLORS.border}`,
                  backgroundColor: COLORS.white,
                  px: { xs: 1.25, sm: 2, md: 2.5 },
                  py: 1.25,
                  minHeight: 58,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1.5,
                  flexWrap: 'wrap',
                }}
              >
                <Typography sx={{ fontSize: '12px', color: COLORS.secondaryText, whiteSpace: 'nowrap' }}>
                  Showing{' '}
                  <Box component="span" sx={{ fontWeight: 700, color: COLORS.text }}>
                    {firstStudent}-{lastStudent}
                  </Box>{' '}
                  of{' '}
                  <Box component="span" sx={{ fontWeight: 700, color: COLORS.text }}>
                    {totalStudents}
                  </Box>{' '}
                  students
                </Typography>

                <Stack
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                  sx={{
                    ml: { xs: 0, sm: 'auto' },
                    width: { xs: '100%', sm: 'auto' },
                    justifyContent: { xs: 'space-between', sm: 'flex-end' },
                  }}
                >
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Typography sx={{ fontSize: '12px', color: COLORS.secondaryText, whiteSpace: 'nowrap' }}>
                      Rows:
                    </Typography>

                    <FormControl size="small" sx={{ minWidth: 68 }}>
                      <Select
                        value={rowsPerPage}
                        onChange={handleRowsPerPageChange}
                        inputProps={{ 'aria-label': 'Rows per page' }}
                        sx={{
                          height: 32,
                          borderRadius: '7px',
                          fontSize: '12px',
                          fontWeight: 600,
                          backgroundColor: COLORS.white,
                          '& .MuiOutlinedInput-notchedOutline': { borderColor: COLORS.border },
                          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: COLORS.blueBorder },
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: COLORS.blue },
                        }}
                      >
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <MenuItem key={size} value={size} sx={{ fontSize: '12px' }}>
                            {size}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Stack>

                  {totalPages > 1 && (
                    <Pagination
                      count={totalPages}
                      page={page}
                      onChange={handlePageChange}
                      showFirstButton
                      showLastButton
                      siblingCount={1}
                      boundaryCount={1}
                      size="small"
                      sx={{
                        '& .MuiPagination-ul': { flexWrap: 'nowrap' },
                        '& .MuiPaginationItem-root': {
                          minWidth: { xs: 29, sm: 32 },
                          height: { xs: 29, sm: 32 },
                          borderRadius: '7px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: COLORS.secondaryText,
                          margin: '0 2px',
                        },
                        '& .MuiPaginationItem-root:hover': { backgroundColor: COLORS.blueLight, color: COLORS.blue },
                        '& .MuiPaginationItem-root.Mui-selected': { backgroundColor: COLORS.blue, color: COLORS.white },
                        '& .MuiPaginationItem-root.Mui-selected:hover': { backgroundColor: COLORS.blueDark },
                      }}
                    />
                  )}
                </Stack>
              </Box>
            )}
          </TableContainer>

          <Box sx={{ height: { xs: 10, md: 18 } }} />
        </Box>
      </Box>

      {/* ====================================================
          MOBILE ROW ACTION MENU
      ==================================================== */}

      <Menu
        anchorEl={rowMenu.anchorEl}
        open={Boolean(rowMenu.anchorEl)}
        onClose={handleRowMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { borderRadius: '10px', minWidth: 160 } }}
      >
        <MenuItem onClick={() => openViewDialog(rowMenu.student?._id)} sx={{ fontSize: '13px', gap: 1.25 }}>
          <VisibilityOutlinedIcon sx={{ fontSize: 18, color: COLORS.secondaryText }} />
          View details
        </MenuItem>
        <MenuItem onClick={() => openEditDialog(rowMenu.student?._id)} sx={{ fontSize: '13px', gap: 1.25 }}>
          <EditOutlinedIcon sx={{ fontSize: 18, color: COLORS.blue }} />
          Edit student
        </MenuItem>
        <MenuItem onClick={() => openDeleteDialog(rowMenu.student)} sx={{ fontSize: '13px', gap: 1.25, color: COLORS.red }}>
          <DeleteOutlineIcon sx={{ fontSize: 18, color: COLORS.red }} />
          Remove student
        </MenuItem>
      </Menu>

      {/* ====================================================
          DIALOGS
      ==================================================== */}

      <StudentFormDialog
        open={formDialog.open}
        mode={formDialog.mode}
        studentId={formDialog.studentId}
        defaultHierarchy={filters}
        onClose={() => setFormDialog({ open: false, mode: 'create', studentId: null })}
        onSuccess={handleFormSuccess}
      />

      <StudentViewDialog
        open={viewDialog.open}
        studentId={viewDialog.studentId}
        onClose={() => setViewDialog({ open: false, studentId: null })}
        onEdit={openEditDialog}
      />

      <DeleteStudentDialog
        open={deleteDialog.open}
        student={deleteDialog.student}
        onClose={() => setDeleteDialog({ open: false, student: null })}
        onSuccess={handleDeleteSuccess}
      />

      {/* ====================================================
          TOAST — transient feedback for actions
      ==================================================== */}

      <Snackbar
        open={toast.open}
        autoHideDuration={4500}
        onClose={closeToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={closeToast}
          severity={toast.severity}
          variant="filled"
          sx={snackbarAlertSx}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Layout>
  );
}