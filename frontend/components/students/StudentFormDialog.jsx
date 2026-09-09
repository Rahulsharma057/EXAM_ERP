'use client';

import React, { useEffect, useState } from 'react';

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';

import CloseIcon from '@mui/icons-material/Close';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import EditIcon from '@mui/icons-material/Edit';

import HierarchyFilter from '../assessment/HierarchyFilter';
import { api } from '../../services/api';

import {
  COLORS,
  inputFieldSx,
  outlinedButtonSx,
  containedButtonSx,
  iconButtonSx,
  dialogTitleSx,
  dialogPaperSx,
} from './theme';

const EMPTY_FORM = {
  rollNumber: '',
  name: '',
  fatherName: '',
  motherName: '',
  mobile: '',
  email: '',
  gender: '',
  dateOfBirth: '',
};

/**
 * Reusable dialog for both "Add Student" and "Edit Student".
 *
 * mode: 'create' | 'edit'
 * studentId: required for 'edit' — full record is fetched fresh
 *            so hierarchy IDs (org/centre/course/batch) are available,
 *            since the list endpoint only returns populated names.
 * defaultHierarchy: used to prefill org/centre/course/batch in 'create'
 *            mode from the page's currently active filters.
 */
export default function StudentFormDialog({
  open,
  mode = 'create',
  studentId = null,
  defaultHierarchy = {},
  onClose,
  onSuccess,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [hierarchy, setHierarchy] = useState({});

  const [fetching, setFetching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Field-level errors (shown right under the field that needs fixing)
  const [fieldErrors, setFieldErrors] = useState({});
  // Reserved for errors the form can't attribute to one field — e.g. a
  // network/server failure on submit.
  const [formError, setFormError] = useState('');

  const isEdit = mode === 'edit';

  useEffect(() => {
    if (!open) return;

    setFormError('');
    setFieldErrors({});

    if (isEdit && studentId) {
      setFetching(true);

      api
        .getStudent(studentId)
        .then((response) => {
          const student = response?.data || {};

          setForm({
            rollNumber: student.rollNumber || '',
            name: student.name || '',
            fatherName: student.fatherName || '',
            motherName: student.motherName || '',
            mobile: student.mobile || '',
            email: student.email || '',
            gender: student.gender || '',
            dateOfBirth: student.dateOfBirth
              ? String(student.dateOfBirth).slice(0, 10)
              : '',
          });

          setHierarchy({
            organisation: student.organisation?._id || student.organisation,
            centre: student.centre?._id || student.centre,
            course: student.course?._id || student.course,
            batch: student.batch?._id || student.batch,
          });
        })
        .catch((err) => {
          setFormError(err?.message || 'Failed to load student details');
        })
        .finally(() => setFetching(false));
    } else {
      setForm(EMPTY_FORM);
      setHierarchy(defaultHierarchy || {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, studentId]);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

    // Clear that field's error the moment the user starts fixing it
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleHierarchyChange = (value) => {
    setHierarchy(value);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.organisation;
      delete next.centre;
      delete next.course;
      delete next.batch;
      return next;
    });
  };

  const handleClose = () => {
    if (submitting) return;
    onClose?.();
  };

  const validate = () => {
    const errors = {};

    if (!form.rollNumber.trim()) errors.rollNumber = 'Roll number is required.';
    if (!form.name.trim()) errors.name = 'Student name is required.';

    if (!hierarchy?.organisation) errors.organisation = 'Select an organisation.';
    else if (!hierarchy?.centre) errors.centre = 'Select a centre.';
    else if (!hierarchy?.course) errors.course = 'Select a course.';
    else if (!hierarchy?.batch) errors.batch = 'Select a batch.';

    return errors;
  };

  const handleSubmit = async () => {
    const errors = validate();

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    setFormError('');

    const payload = {
      ...form,
      rollNumber: form.rollNumber.trim(),
      name: form.name.trim(),
      organisation: hierarchy.organisation,
      centre: hierarchy.centre,
      course: hierarchy.course,
      batch: hierarchy.batch,
    };

    try {
      const response = isEdit
        ? await api.updateStudent(studentId, payload)
        : await api.createStudent(payload);

      if (!response?.success) {
        throw new Error(
          response?.message ||
            (isEdit ? 'Failed to update student' : 'Failed to create student')
        );
      }

      onSuccess?.(isEdit ? 'Student updated successfully.' : 'Student added successfully.');
      onClose?.();
    } catch (err) {
      setFormError(
        err?.message ||
          (isEdit ? 'Failed to update student' : 'Failed to create student')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const hierarchyErrorText =
    fieldErrors.organisation || fieldErrors.centre || fieldErrors.course || fieldErrors.batch;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: dialogPaperSx }}
      aria-labelledby="student-form-title"
    >
      <DialogTitle
        id="student-form-title"
        sx={{ ...dialogTitleSx, display: 'flex', alignItems: 'center', gap: 1 }}
      >
        {isEdit ? (
          <EditIcon sx={{ fontSize: 19, color: COLORS.blue }} />
        ) : (
          <PersonAddAlt1Icon sx={{ fontSize: 19, color: COLORS.blue }} />
        )}

        <Typography sx={{ fontSize: '16px', fontWeight: 700, flexGrow: 1 }}>
          {isEdit ? 'Edit Student' : 'Add Student'}
        </Typography>

        <IconButton
          size="small"
          onClick={handleClose}
          disabled={submitting}
          aria-label="Close dialog"
          sx={iconButtonSx}
        >
          <CloseIcon sx={{ fontSize: 19 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5 }}>
        {fetching ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} sx={{ color: COLORS.blue }} />
          </Box>
        ) : (
          <Box sx={{ mt: 0.5 }}>
            {formError && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: '9px', fontSize: '13px' }}>
                {formError}
              </Alert>
            )}

            <Typography
              sx={{ fontSize: '12px', fontWeight: 700, color: COLORS.secondaryText, mb: 1 }}
            >
              Organisation Hierarchy
            </Typography>

            <HierarchyFilter onChange={handleHierarchyChange} values={hierarchy} />

            {hierarchyErrorText && (
              <Typography sx={{ fontSize: '11.5px', color: COLORS.red, mt: 0.75 }}>
                {hierarchyErrorText}
              </Typography>
            )}

            <Divider sx={{ my: 2.5, borderColor: COLORS.border }} />

            <Typography
              sx={{ fontSize: '12px', fontWeight: 700, color: COLORS.secondaryText, mb: 1 }}
            >
              Student Details
            </Typography>

            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Roll Number"
                  fullWidth
                  size="small"
                  required
                  value={form.rollNumber}
                  onChange={handleChange('rollNumber')}
                  error={Boolean(fieldErrors.rollNumber)}
                  helperText={fieldErrors.rollNumber || ' '}
                  sx={inputFieldSx}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Student Name"
                  fullWidth
                  size="small"
                  required
                  value={form.name}
                  onChange={handleChange('name')}
                  error={Boolean(fieldErrors.name)}
                  helperText={fieldErrors.name || ' '}
                  sx={inputFieldSx}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Father's Name"
                  fullWidth
                  size="small"
                  value={form.fatherName}
                  onChange={handleChange('fatherName')}
                  sx={inputFieldSx}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Mother's Name"
                  fullWidth
                  size="small"
                  value={form.motherName}
                  onChange={handleChange('motherName')}
                  sx={inputFieldSx}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Mobile"
                  fullWidth
                  size="small"
                  value={form.mobile}
                  onChange={handleChange('mobile')}
                  sx={inputFieldSx}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Email"
                  type="email"
                  fullWidth
                  size="small"
                  value={form.email}
                  onChange={handleChange('email')}
                  sx={inputFieldSx}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Gender"
                  fullWidth
                  size="small"
                  value={form.gender}
                  onChange={handleChange('gender')}
                  sx={inputFieldSx}
                >
                  <MenuItem value="">—</MenuItem>
                  <MenuItem value="Male">Male</MenuItem>
                  <MenuItem value="Female">Female</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  label="Date of Birth"
                  type="date"
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={form.dateOfBirth}
                  onChange={handleChange('dateOfBirth')}
                  sx={inputFieldSx}
                />
              </Grid>
            </Grid>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 2, borderTop: `1px solid ${COLORS.border}` }}>
        <Button
          variant="outlined"
          onClick={handleClose}
          disabled={submitting}
          sx={outlinedButtonSx}
        >
          Cancel
        </Button>

        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || fetching}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
          sx={containedButtonSx}
        >
          {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Student'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}