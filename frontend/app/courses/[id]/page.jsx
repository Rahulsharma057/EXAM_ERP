'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Box, Typography, Paper, Grid, Chip, Button, IconButton,
  Breadcrumbs, Link as MuiLink, Skeleton, Alert, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import Layout from '../../../components/common/Layout';
import { api } from '../../../services/api';

export default function CourseDetailPage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params?.id;

  const [course, setCourse] = useState(null);
  const [centres, setCentres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', description: '', duration: '', centre: '' });

  const canEdit = ['super_admin', 'org_admin', 'centre_admin'].includes(userRole);
  const canDelete = ['super_admin', 'org_admin', 'centre_admin'].includes(userRole);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getCourse(courseId);
      setCourse(res.data);
      setForm({
        name: res.data.name || '',
        code: res.data.code || '',
        description: res.data.description || '',
        duration: res.data.duration || '',
        centre: res.data.centre?._id || res.data.centre || '',
      });
    } catch (e) {
      setError(e.message || 'Could not load this course.');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    api.getMe().then((res) => setUserRole(res.user?.role || '')).catch(() => {});
    // Same call CoursesPage itself uses for its centre dropdown -- note it
    // returns at most the backend's default page size (20) since no params
    // are passed, so on a large org this list may be incomplete. That's an
    // existing characteristic of getCentresList, not something new here.
    api.getCentresList().then((res) => setCentres(res.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (courseId) load();
  }, [courseId, load]);

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      // organisation is intentionally not sent -- updateCourse derives it
      // server-side from whichever centre is selected.
      await api.updateCourse(courseId, {
        name: form.name,
        code: form.code,
        description: form.description,
        duration: form.duration,
        centre: form.centre,
      });
      setEditOpen(false);
      await load();
    } catch (e) {
      setError(e.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    setError('');
    try {
      await api.deleteCourse(courseId);
      router.push('/courses');
    } catch (e) {
      setError(e.message || 'Could not delete this course.');
      setSaving(false);
      setDeleteOpen(false);
    }
  }

  return (
    <Layout>
      <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Breadcrumbs sx={{ mb: 2 }}>
          <MuiLink component="button" underline="hover" onClick={() => router.push('/')}>Dashboard</MuiLink>
          <MuiLink component="button" underline="hover" onClick={() => router.push('/organisations')}>Organisations</MuiLink>
          <MuiLink component="button" underline="hover" onClick={() => router.push('/centres')}>Centres</MuiLink>
          <MuiLink component="button" underline="hover" onClick={() => router.push('/courses')}>Courses</MuiLink>
          <Typography color="text.primary">{loading ? '…' : course?.name || 'Not found'}</Typography>
        </Breadcrumbs>

        <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/courses')} sx={{ mb: 2 }}>
          Back to courses
        </Button>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {loading ? (
          <Paper sx={{ p: 3 }}>
            <Skeleton variant="text" width={240} height={40} />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="rectangular" height={100} sx={{ mt: 2, borderRadius: 1 }} />
          </Paper>
        ) : !course ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">This course couldn't be found.</Typography>
          </Paper>
        ) : (
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <MenuBookIcon color="primary" fontSize="large" />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>{course.name}</Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                    <Chip label={course.code} size="small" />
                    {course.centre?.name && (
                      <Chip label={course.centre.name} size="small" variant="outlined" onClick={() => router.push('/centres')} />
                    )}
                    {course.organisation?.name && (
                      <Chip label={course.organisation.name} size="small" variant="outlined" onClick={() => router.push('/organisations')} />
                    )}
                  </Box>
                </Box>
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {canEdit && (
                  <IconButton onClick={() => setEditOpen(true)} title="Edit">
                    <EditIcon />
                  </IconButton>
                )}
                {canDelete && (
                  <IconButton onClick={() => setDeleteOpen(true)} title="Deactivate" color="error">
                    <DeleteIcon />
                  </IconButton>
                )}
              </Box>
            </Box>

            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <Typography variant="overline" color="text.secondary">Description</Typography>
                <Typography sx={{ mb: 2 }}>{course.description || '—'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="overline" color="text.secondary">Duration</Typography>
                <Typography sx={{ mb: 2 }}>{course.duration || '—'}</Typography>
              </Grid>
            </Grid>

            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 4 }}>
              <Box>
                <Typography variant="h6">{course.batchCount ?? 0}</Typography>
                <Typography variant="caption" color="text.secondary">Active batches</Typography>
              </Box>
            </Box>
          </Paper>
        )}
      </Box>

      {/* Edit dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit course</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField label="Course Name" fullWidth required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Code" fullWidth required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                label="Centre"
                fullWidth
                required
                value={form.centre}
                onChange={(e) => setForm({ ...form, centre: e.target.value })}
                helperText="Changing the centre also updates which organisation this course belongs to."
              >
                {centres.map((c) => (
                  <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField label="Description" fullWidth multiline rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Duration" fullWidth value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name.trim() || !form.code.trim() || !form.centre}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Deactivate this course?</DialogTitle>
        <DialogContent>
          <Typography>
            This will deactivate <strong>{course?.name}</strong>. It won't appear in lists anymore, but its data isn't permanently erased.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)} disabled={saving}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={saving}>
            {saving ? 'Deactivating…' : 'Deactivate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}