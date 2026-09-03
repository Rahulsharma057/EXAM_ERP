'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton, TextField,
  Pagination, Grid, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, Breadcrumbs, Link,
  Card, CardContent, Avatar, Tooltip, Fade
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchIcon from '@mui/icons-material/Search';
import BusinessIcon from '@mui/icons-material/Business';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SchoolIcon from '@mui/icons-material/School';
import GroupsIcon from '@mui/icons-material/Groups';

const ICONS = {
  organisation: <BusinessIcon />,
  centre: <LocationOnIcon />,
  course: <SchoolIcon />,
  batch: <GroupsIcon />
};

const COLORS = {
  organisation: '#1565c0',
  centre: '#2e7d32',
  course: '#ed6c02',
  batch: '#9c27b0'
};

export default function EntityManager({
  title,
  entityType,
  api,
  fields,
  parentField,
  parentOptions = [],
  parentLabel = '',
  breadcrumbs = [],
  onView,
  extraColumns = [],
  canCreate = true,
  canEdit = true,
  canDelete = true
}) {
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [parentFilter, setParentFilter] = useState('');
  const limit = 20;

  const load = async () => {
    const params = { search, page, limit };
    if (parentField && parentFilter) params[parentField] = parentFilter;
    const res = await api.getList(params);
    setItems(res.data);
    setTotal(res.pagination?.total || 0);
  };

  useEffect(() => { load(); }, [search, page, parentFilter]);

  const handleSave = async () => {
    const payload = { ...form };
    if (parentField && parentFilter) payload[parentField] = parentFilter;

    if (editing) {
      await api.update(editing._id, payload);
    } else {
      await api.create(payload);
    }
    setDialog(false);
    setEditing(null);
    setForm({});
    load();
  };

  const handleDelete = async (id) => {
    if (confirm(`Delete this ${entityType}?`)) {
      await api.delete(id);
      load();
    }
  };

  const openDialog = (item = null) => {
    if (item) {
      setEditing(item);
      const initial = {};
      fields.forEach(f => initial[f.name] = item[f.name] || '');
      setForm(initial);
    } else {
      setEditing(null);
      const initial = {};
      fields.forEach(f => initial[f.name] = f.default || '');
      setForm(initial);
    }
    setDialog(true);
  };

  const icon = ICONS[entityType] || <BusinessIcon />;
  const color = COLORS[entityType] || '#1565c0';

  return (
    <Box>
      <Breadcrumbs sx={{ mb: 2 }}>
        {breadcrumbs.map((crumb, i) => (
          <Link key={i} color="inherit" href={crumb.path} onClick={(e) => { e.preventDefault(); router.push(crumb.path); }}>
            {crumb.label}
          </Link>
        ))}
        <Typography color="text.primary">{title}</Typography>
      </Breadcrumbs>

      <Card sx={{ mb: 3, bgcolor: color, color: 'white' }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 56, height: 56 }}>
            {icon}
          </Avatar>
          <Box>
            <Typography variant="h4">{title}</Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Total: {total} {entityType}s
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 3 }} alignItems="center">
        <Grid item xs={12} md={4}>
          <TextField
            placeholder={`Search ${entityType}...`}
            fullWidth
            size="small"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
          />
        </Grid>
        {parentField && parentOptions.length > 0 && (
          <Grid item xs={12} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>{parentLabel}</InputLabel>
              <Select value={parentFilter} onChange={e => { setParentFilter(e.target.value); setPage(1); }} label={parentLabel}>
                <MenuItem value="">All</MenuItem>
                {parentOptions.map(o => <MenuItem key={o._id} value={o._id}>{o.name}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
        )}
        <Grid item xs={12} md={parentField ? 4 : 8} sx={{ textAlign: 'right' }}>
          {canCreate && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => openDialog()}>
              Add {entityType.charAt(0).toUpperCase() + entityType.slice(1)}
            </Button>
          )}
        </Grid>
      </Grid>

      <TableContainer component={Paper} elevation={2}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell width={50}>#</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Code</TableCell>
              {parentField && <TableCell>{parentLabel}</TableCell>}
              {extraColumns.map(col => <TableCell key={col.key}>{col.label}</TableCell>)}
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item, idx) => (
              <TableRow key={item._id} hover>
                <TableCell>{(page - 1) * limit + idx + 1}</TableCell>
                <TableCell>
                  <Typography fontWeight="medium">{item.name}</Typography>
                </TableCell>
                <TableCell><Chip size="small" label={item.code} variant="outlined" /></TableCell>
                {parentField && (
                  <TableCell>
                    {item[parentField]?.name || item[parentField] || '-'}
                  </TableCell>
                )}
                {extraColumns.map(col => (
                  <TableCell key={col.key}>{item[col.key] || '-'}</TableCell>
                ))}
                <TableCell>
                  <Chip
                    size="small"
                    label={item.isActive ? 'Active' : 'Inactive'}
                    color={item.isActive ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="View" arrow>
                    <IconButton size="small" onClick={() => onView ? onView(item) : router.push(`/${entityType}s/${item._id}`)}>
                      <VisibilityIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {canEdit && (
                    <Tooltip title="Edit" arrow>
                      <IconButton size="small" onClick={() => openDialog(item)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canDelete && (
                    <Tooltip title="Delete" arrow>
                      <IconButton size="small" color="error" onClick={() => handleDelete(item._id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
        <Pagination count={Math.ceil(total / limit)} page={page} onChange={(e, v) => setPage(v)} color="primary" />
      </Box>

      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: color, color: 'white' }}>
          {editing ? `Edit ${title}` : `Add New ${title}`}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            {fields.map(field => (
              <Grid item xs={12} md={field.fullWidth ? 12 : 6} key={field.name}>
                <TextField
                  label={field.label}
                  fullWidth
                  type={field.type || 'text'}
                  multiline={field.multiline}
                  rows={field.rows}
                  value={form[field.name] || ''}
                  onChange={e => setForm({ ...form, [field.name]: e.target.value })}
                  required={field.required !== false}
                />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialog(false)}>Cancel</Button>
          <Button variant="contained" sx={{ bgcolor: color }} onClick={handleSave}>
            {editing ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
