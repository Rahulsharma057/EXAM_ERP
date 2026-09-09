'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Box, Typography, Paper, Grid, Chip, Button, IconButton,
  Breadcrumbs, Link as MuiLink, Skeleton, Alert, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BusinessIcon from '@mui/icons-material/Business';
import Layout from '../../../components/common/Layout';
import { api } from '../../../services/api';

export default function OrganisationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orgId = params?.id;

  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', description: '', address: '', contactEmail: '', contactPhone: '' });

  const canEdit = ['super_admin'].includes(userRole);
  const canDelete = ['super_admin'].includes(userRole);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getOrganisation(orgId);
      setOrg(res.data);
      setForm({
        name: res.data.name || '',
        code: res.data.code || '',
        description: res.data.description || '',
        address: res.data.address || '',
        contactEmail: res.data.contactEmail || '',
        contactPhone: res.data.contactPhone || '',
      });
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not load this organisation.');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    api.getMe().then((res) => setUserRole(res.user?.role || '')).catch(() => {});
  }, []);

  useEffect(() => {
    if (orgId) load();
  }, [orgId, load]);

  async function handleSave() {
    setSaving(true);
    try {
      await api.updateOrganisation(orgId, form);
      setEditOpen(false);
      await load();
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await api.deleteOrganisation(orgId);
      router.push('/organisations');
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not delete this organisation.');
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
          <Typography color="text.primary">{loading ? '…' : org?.name || 'Not found'}</Typography>
        </Breadcrumbs>

        <Button startIcon={<ArrowBackIcon />} onClick={() => router.push('/organisations')} sx={{ mb: 2 }}>
          Back to organisations
        </Button>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {loading ? (
          <Paper sx={{ p: 3 }}>
            <Skeleton variant="text" width={240} height={40} />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="rectangular" height={100} sx={{ mt: 2, borderRadius: 1 }} />
          </Paper>
        ) : !org ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">This organisation couldn't be found.</Typography>
          </Paper>
        ) : (
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <BusinessIcon color="primary" fontSize="large" />
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>{org.name}</Typography>
                  <Chip label={org.code} size="small" sx={{ mt: 0.5 }} />
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
                <Typography sx={{ mb: 2 }}>{org.description || '—'}</Typography>

                <Typography variant="overline" color="text.secondary">Address</Typography>
                <Typography sx={{ mb: 2 }}>{org.address || '—'}</Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="overline" color="text.secondary">Contact email</Typography>
                <Typography sx={{ mb: 2 }}>{org.contactEmail || '—'}</Typography>

                <Typography variant="overline" color="text.secondary">Contact phone</Typography>
                <Typography sx={{ mb: 2 }}>{org.contactPhone || '—'}</Typography>
              </Grid>
            </Grid>

            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 4 }}>
              <Box>
                <Typography variant="h6">{org.centreCount ?? 0}</Typography>
                <Typography variant="caption" color="text.secondary">Active centres</Typography>
              </Box>
            </Box>
          </Paper>
        )}
      </Box>

      {/* Edit dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit organisation</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField label="Organisation Name" fullWidth required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Code" fullWidth required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Description" fullWidth multiline rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Address" fullWidth multiline rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Contact Email" fullWidth value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Contact Phone" fullWidth value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name.trim() || !form.code.trim()}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Deactivate this organisation?</DialogTitle>
        <DialogContent>
          <Typography>
            This will deactivate <strong>{org?.name}</strong>. It won't appear in lists anymore, but its data isn't permanently erased.
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