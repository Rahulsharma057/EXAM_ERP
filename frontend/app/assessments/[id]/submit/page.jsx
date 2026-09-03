'use client';
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Typography, Paper, FormControl, InputLabel, Select, MenuItem,
  Button, Stepper, Step, StepLabel, CircularProgress
} from '@mui/material';
import Layout from '../../../../components/common/Layout';
import AssessmentForm from '../../../../components/assessment/AssessmentForm';
import { api } from '../../../../services/api';

export default function SubmitAssessmentPage() {
  const { id } = useParams();
  const router = useRouter();
  const [assessment, setAssessment] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    api.getAssessment(id).then(res => {
      setAssessment(res.data);
      api.getBatchStudents(res.data.batch._id).then(s => setStudents(s.data));
    });
  }, [id]);

  if (!assessment) return <Layout><CircularProgress /></Layout>;

  if (submitted) {
    return (
      <Layout>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h4" gutterBottom color="success.main">Assessment Submitted!</Typography>
          <Button variant="contained" onClick={() => router.push('/assessments')}>Back to Assessments</Button>
        </Paper>
      </Layout>
    );
  }

  if (!selectedStudent) {
    return (
      <Layout>
        <Typography variant="h4" gutterBottom>Submit Assessment: {assessment.name}</Typography>
        <Paper sx={{ p: 3, maxWidth: 400 }}>
          <FormControl fullWidth>
            <InputLabel>Select Student</InputLabel>
            <Select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} label="Select Student">
              {students.map(s => <MenuItem key={s._id} value={s._id}>{s.rollNumber} - {s.name}</MenuItem>)}
            </Select>
          </FormControl>
          <Button variant="contained" fullWidth sx={{ mt: 2 }} disabled={!selectedStudent} onClick={() => {}}>
            Start Assessment
          </Button>
        </Paper>
      </Layout>
    );
  }

  return (
    <Layout>
      <AssessmentForm assessmentId={id} studentId={selectedStudent} onSubmit={() => setSubmitted(true)} />
    </Layout>
  );
}
