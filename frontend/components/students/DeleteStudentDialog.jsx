'use client';

import React, { useState } from 'react';

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  Typography,
} from '@mui/material';

import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import { api } from '../../services/api';
import { COLORS, outlinedButtonSx, dialogPaperSx } from './theme';

export default function DeleteStudentDialog({ open, student, onClose, onSuccess }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    if (submitting) return;
    setError('');
    onClose?.();
  };

  const handleDelete = async () => {
    if (!student?._id) return;

    setSubmitting(true);
    setError('');

    try {
      const response = await api.deleteStudent(student._id);

      if (!response?.success) {
        throw new Error(response?.message || 'Failed to remove student');
      }

      onSuccess?.('Student removed successfully.');
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Failed to remove student');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{ sx: dialogPaperSx }}
      aria-labelledby="delete-student-title"
    >
      <DialogContent sx={{ p: 3, textAlign: 'center' }}>
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            backgroundColor: COLORS.redLight,
            border: `1px solid ${COLORS.redBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 2,
          }}
        >
          <WarningAmberIcon sx={{ fontSize: 26, color: COLORS.red }} />
        </Box>

        <Typography
          id="delete-student-title"
          sx={{ fontSize: '16px', fontWeight: 700, color: COLORS.text, mb: 0.75 }}
        >
          Remove this student?
        </Typography>

        <Typography sx={{ fontSize: '13px', color: COLORS.secondaryText, lineHeight: 1.6 }}>
          {student?.name ? (
            <>
              <Box component="span" sx={{ fontWeight: 700, color: COLORS.text }}>
                {student.name}
              </Box>{' '}
              (Roll No. {student.rollNumber}) will be removed from this batch and won't appear
              in student lists. This can be reversed later by a system admin.
            </>
          ) : (
            'This student will be removed.'
          )}
        </Typography>

        {error && (
          <Alert
            severity="error"
            sx={{ mt: 2, borderRadius: '9px', fontSize: '13px', textAlign: 'left' }}
          >
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'center', gap: 1.5 }}>
        <Button
          variant="outlined"
          onClick={handleClose}
          disabled={submitting}
          sx={{ ...outlinedButtonSx, minWidth: 100 }}
        >
          Cancel
        </Button>

        <Button
          variant="contained"
          onClick={handleDelete}
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
          sx={{
            minHeight: 40,
            px: 2,
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '13px',
            minWidth: 100,
            backgroundColor: COLORS.red,
            boxShadow: 'none',
            '&:hover': { backgroundColor: '#B71C1C', boxShadow: 'none' },
            '&:focus-visible': { outline: `2px solid ${COLORS.red}`, outlineOffset: '2px' },
          }}
        >
          {submitting ? 'Removing...' : 'Remove'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}