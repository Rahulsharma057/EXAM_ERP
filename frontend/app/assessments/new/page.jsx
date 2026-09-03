'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Typography, Stepper, Step, StepLabel, Button, Paper,
  TextField, Grid
} from '@mui/material';
import Layout from '../../../components/common/Layout';
import HierarchyFilter from '../../../components/assessment/HierarchyFilter';
import AssessmentBuilder from '../../../components/assessment/AssessmentBuilder';
import { api } from '../../../services/api';

const steps = ['Basic Details', 'Hierarchy', 'Build Assessment', 'Preview & Publish'];

export default function NewAssessmentPage() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [assessment, setAssessment] = useState(null);
  const [form, setForm] = useState({
    name: '', code: '', description: '', instructions: '',
    weekNumber: 1, academicYear: '', publishDate: '', closeDate: ''
  });
  const [hierarchy, setHierarchy] = useState({});

  const handleCreate = async () => {
    const data = { ...form, ...hierarchy, weekNumber: parseInt(form.weekNumber) };
    const res = await api.createAssessment(data);
    setAssessment(res.data);
    setActiveStep(2);
  };

  const handlePublish = async () => {
    await api.publishAssessment(assessment._id);
    router.push('/assessments');
  };

  return (
    <Layout>
      <Typography variant="h4" gutterBottom>Create Assessment</Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map(label => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
      </Stepper>

      {activeStep === 0 && (
        <Paper sx={{ p: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}><TextField label="Assessment Name" fullWidth value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></Grid>
            <Grid item xs={12} md={6}><TextField label="Assessment Code" fullWidth value={form.code} onChange={e => setForm({...form, code: e.target.value})} /></Grid>
            <Grid item xs={12} md={4}><TextField label="Week Number" type="number" fullWidth value={form.weekNumber} onChange={e => setForm({...form, weekNumber: e.target.value})} /></Grid>
            <Grid item xs={12} md={4}><TextField label="Academic Year" fullWidth value={form.academicYear} onChange={e => setForm({...form, academicYear: e.target.value})} /></Grid>
            <Grid item xs={12}><TextField label="Description" fullWidth multiline rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></Grid>
            <Grid item xs={12}><TextField label="Instructions" fullWidth multiline rows={2} value={form.instructions} onChange={e => setForm({...form, instructions: e.target.value})} /></Grid>
          </Grid>
          <Box sx={{ mt: 2, textAlign: 'right' }}>
            <Button variant="contained" onClick={() => setActiveStep(1)}>Next</Button>
          </Box>
        </Paper>
      )}

      {activeStep === 1 && (
        <Paper sx={{ p: 3 }}>
          <HierarchyFilter onChange={setHierarchy} values={hierarchy} />
          <Box sx={{ mt: 2, textAlign: 'right' }}>
            <Button onClick={() => setActiveStep(0)} sx={{ mr: 1 }}>Back</Button>
            <Button variant="contained" onClick={handleCreate}>Create & Continue</Button>
          </Box>
        </Paper>
      )}

      {activeStep === 2 && assessment && (
        <Paper sx={{ p: 3 }}>
          <AssessmentBuilder assessment={assessment} onUpdate={() => {}} />
          <Box sx={{ mt: 2, textAlign: 'right' }}>
            <Button onClick={() => setActiveStep(1)} sx={{ mr: 1 }}>Back</Button>
            <Button variant="contained" onClick={() => setActiveStep(3)}>Preview</Button>
          </Box>
        </Paper>
      )}

      {activeStep === 3 && assessment && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6">{assessment.name}</Typography>
          <Typography>Week {assessment.weekNumber}</Typography>
          <Box sx={{ mt: 3, textAlign: 'right' }}>
            <Button onClick={() => setActiveStep(2)} sx={{ mr: 1 }}>Back</Button>
            <Button variant="contained" color="success" onClick={handlePublish}>Publish Assessment</Button>
          </Box>
        </Paper>
      )}
    </Layout>
  );
}
