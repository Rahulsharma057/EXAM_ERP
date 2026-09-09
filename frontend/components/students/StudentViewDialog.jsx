'use client';

import React, { useEffect, useState } from 'react';

import {
  Alert,
  Avatar,
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
  Typography,
} from '@mui/material';

import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';

import { api } from '../../services/api';
import {
  COLORS,
  outlinedButtonSx,
  containedButtonSx,
  iconButtonSx,
  dialogTitleSx,
  dialogPaperSx,
} from './theme';

function DetailRow({ label, value }) {
  return (
    <Grid item xs={12} sm={6}>
      <Typography
        sx={{
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.02em',
          color: COLORS.mutedText,
          mb: 0.25,
        }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontSize: '13.5px', color: COLORS.text, fontWeight: 500 }}>
        {value || '-'}
      </Typography>
    </Grid>
  );
}

export default function StudentViewDialog({ open, studentId, onClose, onEdit }) {
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchStudent = () => {
    if (!studentId) return;

    setLoading(true);
    setError('');

    api
      .getStudent(studentId)
      .then((response) => {
        if (!response?.success) {
          throw new Error(response?.message || 'Failed to load student');
        }
        setStudent(response.data);
      })
      .catch((err) => setError(err?.message || 'Failed to load student'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open || !studentId) return;
    setStudent(null);
    fetchStudent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, studentId]);

  const initials = (student?.name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: dialogPaperSx }}
      aria-labelledby="student-view-title"
    >
      <DialogTitle
        id="student-view-title"
        sx={{ ...dialogTitleSx, display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <VisibilityIcon sx={{ fontSize: 19, color: COLORS.blue }} />
        <Typography sx={{ fontSize: '16px', fontWeight: 700, flexGrow: 1 }}>
          Student Details
        </Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close dialog" sx={iconButtonSx}>
          <CloseIcon sx={{ fontSize: 19 }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 2.5 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} sx={{ color: COLORS.blue }} />
          </Box>
        )}

        {!loading && error && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Alert severity="error" sx={{ borderRadius: '9px', fontSize: '13px', mb: 2, textAlign: 'left' }}>
              {error}
            </Alert>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
              onClick={fetchStudent}
              sx={outlinedButtonSx}
            >
              Try again
            </Button>
          </Box>
        )}

        {!loading && !error && student && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
              <Avatar
                sx={{
                  width: 48,
                  height: 48,
                  fontSize: '15px',
                  fontWeight: 700,
                  backgroundColor: COLORS.blueLight,
                  color: COLORS.blueDark,
                  border: `1px solid ${COLORS.blueBorder}`,
                }}
              >
                {initials}
              </Avatar>

              <Box sx={{ minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: COLORS.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {student.name}
                </Typography>
                <Typography sx={{ fontSize: '12.5px', color: COLORS.secondaryText }}>
                  Roll No. {student.rollNumber}
                </Typography>
              </Box>
            </Box>

            <Typography
              sx={{ fontSize: '12px', fontWeight: 700, color: COLORS.secondaryText, mb: 1 }}
            >
              Organisation Hierarchy
            </Typography>

            <Grid container spacing={2} sx={{ mb: 2.5 }}>
              <DetailRow label="Organisation" value={student.organisation?.name} />
              <DetailRow label="Centre" value={student.centre?.name} />
              <DetailRow label="Course" value={student.course?.name} />
              <DetailRow label="Batch" value={student.batch?.name} />
            </Grid>

            <Divider sx={{ mb: 2.5, borderColor: COLORS.border }} />

            <Typography
              sx={{ fontSize: '12px', fontWeight: 700, color: COLORS.secondaryText, mb: 1 }}
            >
              Personal Details
            </Typography>

            <Grid container spacing={2}>
              <DetailRow label="Father's Name" value={student.fatherName} />
              <DetailRow label="Mother's Name" value={student.motherName} />
              <DetailRow label="Mobile" value={student.mobile} />
              <DetailRow label="Email" value={student.email} />
              <DetailRow label="Gender" value={student.gender} />
              <DetailRow
                label="Date of Birth"
                value={
                  student.dateOfBirth
                    ? new Date(student.dateOfBirth).toLocaleDateString()
                    : ''
                }
              />
            </Grid>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 2, borderTop: `1px solid ${COLORS.border}` }}>
        <Button variant="outlined" onClick={onClose} sx={outlinedButtonSx}>
          Close
        </Button>

        {student && !loading && !error && (
          <Button
            variant="contained"
            startIcon={<EditIcon sx={{ fontSize: 17 }} />}
            onClick={() => onEdit?.(student._id)}
            sx={containedButtonSx}
          >
            Edit
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}