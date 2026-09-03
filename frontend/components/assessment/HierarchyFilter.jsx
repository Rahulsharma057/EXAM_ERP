'use client';
import React, { useState, useEffect } from 'react';
import { Box, FormControl, InputLabel, Select, MenuItem, Grid } from '@mui/material';
import { api } from '../../services/api';

export default function HierarchyFilter({ onChange, values = {} }) {
  const [organisations, setOrganisations] = useState([]);
  const [centres, setCentres] = useState([]);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selected, setSelected] = useState(values);

  useEffect(() => {
    api.getOrganisations().then(res => setOrganisations(res.data));
  }, []);

  useEffect(() => {
    if (selected.organisation) {
      api.getCentres(selected.organisation).then(res => setCentres(res.data));
    } else {
      setCentres([]);
    }
    setSelected(s => ({ ...s, centre: '', course: '', batch: '' }));
  }, [selected.organisation]);

  useEffect(() => {
    if (selected.centre) {
      api.getCourses(selected.centre).then(res => setCourses(res.data));
    } else {
      setCourses([]);
    }
    setSelected(s => ({ ...s, course: '', batch: '' }));
  }, [selected.centre]);

  useEffect(() => {
    if (selected.course) {
      api.getBatches(selected.course).then(res => setBatches(res.data));
    } else {
      setBatches([]);
    }
    setSelected(s => ({ ...s, batch: '' }));
  }, [selected.course]);

  const handleChange = (field, value) => {
    const updated = { ...selected, [field]: value };
    setSelected(updated);
    onChange(updated);
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6} md={3}>
        <FormControl fullWidth size="small">
          <InputLabel>Organisation</InputLabel>
          <Select value={selected.organisation || ''} onChange={e => handleChange('organisation', e.target.value)} label="Organisation">
            <MenuItem value=""><em>Select</em></MenuItem>
            {organisations.map(o => <MenuItem key={o._id} value={o._id}>{o.name}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <FormControl fullWidth size="small" disabled={!selected.organisation}>
          <InputLabel>Centre</InputLabel>
          <Select value={selected.centre || ''} onChange={e => handleChange('centre', e.target.value)} label="Centre">
            <MenuItem value=""><em>Select</em></MenuItem>
            {centres.map(c => <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <FormControl fullWidth size="small" disabled={!selected.centre}>
          <InputLabel>Course</InputLabel>
          <Select value={selected.course || ''} onChange={e => handleChange('course', e.target.value)} label="Course">
            <MenuItem value=""><em>Select</em></MenuItem>
            {courses.map(c => <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <FormControl fullWidth size="small" disabled={!selected.course}>
          <InputLabel>Batch</InputLabel>
          <Select value={selected.batch || ''} onChange={e => handleChange('batch', e.target.value)} label="Batch">
            <MenuItem value=""><em>Select</em></MenuItem>
            {batches.map(b => <MenuItem key={b._id} value={b._id}>{b.name}</MenuItem>)}
          </Select>
        </FormControl>
      </Grid>
    </Grid>
  );
}
