'use client';
import React, { useState, useEffect } from 'react';
import {
  Box, Paper, Typography, FormControl, FormLabel, RadioGroup,
  FormControlLabel, Radio, Button, Stepper, Step, StepLabel,
  Card, CardContent, Divider, Alert, CircularProgress, TextField
} from '@mui/material';
import { api } from '../../services/api';

export default function AssessmentForm({ assessmentId, studentId, onSubmit }) {
  const [assessment, setAssessment] = useState(null);
  const [student, setStudent] = useState(null);
  const [answers, setAnswers] = useState({});
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await api.getAssessment(assessmentId);
      setAssessment(res.data);
      if (studentId) {
        const studentsRes = await api.getBatchStudents(res.data.batch._id);
        const found = studentsRes.data.find(s => s._id === studentId);
        setStudent(found);
      }
      setLoading(false);
    };
    load();
  }, [assessmentId, studentId]);

  const handleAnswer = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        studentId,
        answers: Object.entries(answers).map(([questionId, answerValue]) => ({ questionId, answerValue }))
      };
      await api.createSubmission(assessmentId, payload);
      onSubmit?.();
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <CircularProgress />;
  if (!assessment) return <Alert severity="error">Assessment not found</Alert>;

  const sections = assessment.sections || [];
  const currentSection = sections[activeStep];

  const isComplete = () => {
    for (const section of sections) {
      for (const q of section.questions || []) {
        if (q.isRequired && !answers[q._id]) return false;
      }
    }
    return true;
  };

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>{assessment.name}</Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Week {assessment.weekNumber} | {student?.name} ({student?.rollNumber})
        </Typography>
      </Paper>

      <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
        {sections.map((s, i) => (
          <Step key={s._id} completed={i < activeStep}>
            <StepLabel>{s.name}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {currentSection && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>{currentSection.name}</Typography>
            {currentSection.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{currentSection.description}</Typography>
            )}
            <Divider sx={{ mb: 2 }} />

            {(currentSection.questions || []).map((q, idx) => (
              <Box key={q._id} sx={{ mb: 3 }}>
                <Typography variant="subtitle1">
                  {idx + 1}. {q.questionText}
                  <Typography component="span" color="primary" sx={{ ml: 1 }}>({q.maxPoints} pts)</Typography>
                </Typography>

                {q.questionType === 'YES_NO' && (
                  <FormControl component="fieldset" sx={{ mt: 1 }}>
                    <RadioGroup row value={answers[q._id] || ''} onChange={e => handleAnswer(q._id, e.target.value)}>
                      <FormControlLabel value="YES" control={<Radio />} label={`Yes (${q.maxPoints} pts)`} />
                      <FormControlLabel value="NO" control={<Radio />} label="No (0 pts)" />
                    </RadioGroup>
                  </FormControl>
                )}

                {q.questionType === 'TEXT' && (
                  <TextField fullWidth multiline rows={2} placeholder="Enter answer..." value={answers[q._id] || ''} onChange={e => handleAnswer(q._id, e.target.value)} sx={{ mt: 1 }} />
                )}
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button disabled={activeStep === 0} onClick={() => setActiveStep(s => s - 1)}>Back</Button>
        <Box>
          {activeStep === sections.length - 1 ? (
            <Button variant="contained" disabled={!isComplete() || submitting} onClick={handleSubmit}>
              {submitting ? <CircularProgress size={24} /> : 'Submit Assessment'}
            </Button>
          ) : (
            <Button variant="contained" onClick={() => setActiveStep(s => s + 1)}>Next</Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}
