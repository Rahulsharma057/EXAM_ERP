'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  Box, Typography, Paper, Button, Chip, Grid, Divider, Card, CardContent
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import PublishIcon from '@mui/icons-material/Publish';
import AssessmentIcon from '@mui/icons-material/Assessment';
import Layout from '../../../components/common/Layout';
import { api } from '../../../services/api';

export default function AssessmentDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const [assessment, setAssessment] = useState(null);

  useEffect(() => {
    api.getAssessment(id).then(res => setAssessment(res.data));
  }, [id]);

  if (!assessment) return <Layout><Typography>Loading...</Typography></Layout>;

  return (
    <Layout>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{assessment.name}</Typography>
        <Box>
          {assessment.status === 'DRAFT' && (
            <Button variant="outlined" startIcon={<EditIcon />} onClick={() => router.push(`/assessments/${id}/edit`)} sx={{ mr: 1 }}>
              Edit
            </Button>
          )}
          {assessment.status === 'DRAFT' && (
            <Button variant="contained" startIcon={<PublishIcon />} onClick={() => api.publishAssessment(id).then(() => window.location.reload())} sx={{ mr: 1 }}>
              Publish
            </Button>
          )}
          <Button variant="outlined" startIcon={<AssessmentIcon />} onClick={() => router.push(`/assessments/${id}/results`)}>
            Results
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}><Typography><strong>Code:</strong> {assessment.code}</Typography></Grid>
          <Grid item xs={12} md={6}><Typography><strong>Week:</strong> {assessment.weekNumber}</Typography></Grid>
          <Grid item xs={12} md={6}><Typography><strong>Batch:</strong> {assessment.batch?.name}</Typography></Grid>
          <Grid item xs={12} md={6}><Typography><strong>Status:</strong> <Chip size="small" label={assessment.status} /></Typography></Grid>
          <Grid item xs={12} md={6}><Typography><strong>Total Marks:</strong> {assessment.totalMarks}</Typography></Grid>
          <Grid item xs={12} md={6}><Typography><strong>Total Questions:</strong> {assessment.totalQuestions}</Typography></Grid>
        </Grid>
        {assessment.description && <Typography sx={{ mt: 2 }}>{assessment.description}</Typography>}
      </Paper>

      <Typography variant="h5" gutterBottom>Sections & Questions</Typography>
      {assessment.sections?.map(section => (
        <Card key={section._id} sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6">{section.name}</Typography>
            <Typography variant="body2" color="text.secondary">{section.questions?.length || 0} questions | {section.totalMarks} marks</Typography>
            <Divider sx={{ my: 1 }} />
            {section.questions?.map((q, i) => (
              <Box key={q._id} sx={{ py: 0.5 }}>
                <Typography variant="body2">{i + 1}. {q.questionText} ({q.maxPoints} pts)</Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      ))}
    </Layout>
  );
}
