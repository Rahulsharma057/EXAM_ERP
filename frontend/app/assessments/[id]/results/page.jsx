'use client';
import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Box, Typography, Paper, Button, Chip, Grid, TextField,
  Dialog, DialogTitle, DialogContent, Tabs, Tab, CircularProgress
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import Layout from '../../../../components/common/Layout';
import ResultsTable from '../../../../components/results/ResultsTable';
import StudentResultDetail from '../../../../components/results/StudentResultDetail';
import { api } from '../../../../services/api';

export default function AssessmentResultsPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [importFile, setImportFile] = useState(null);

  const load = async () => {
    const res = await api.getAssessmentResults(id, { search });
    setData(res.data);
  };

  useEffect(() => { load(); }, [id, search]);

const handleImport = async () => {
  if (!importFile) {
    alert('Please select an Excel file');
    return;
  }

  try {
    await api.importMarks(id, importFile);

    alert('Marks imported successfully');

    setImportFile(null);

    await load();
  } catch (error) {
    console.error(
      'IMPORT MARKS ERROR:',
      error
    );

    alert(
      error.message ||
      'Failed to import marks'
    );
  }
};

  if (!data) return <Layout><CircularProgress /></Layout>;

  return (
    <Layout>
      <Typography variant="h4" gutterBottom>Results: {data.assessment.name}</Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}><Typography><strong>Total Students:</strong> {data.stats.totalStudents}</Typography></Grid>
          <Grid item xs={12} md={3}><Typography><strong>Completed:</strong> <Chip size="small" label={data.stats.completed} color="success" /></Typography></Grid>
          <Grid item xs={12} md={3}><Typography><strong>Pending:</strong> <Chip size="small" label={data.stats.pending} /></Typography></Grid>
          <Grid item xs={12} md={3}><Typography><strong>Average:</strong> {data.stats.averageScore}%</Typography></Grid>
        </Grid>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <TextField placeholder="Search student..." size="small" value={search} onChange={e => setSearch(e.target.value)} />
        <Box>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => api.exportTemplate(id)} sx={{ mr: 1 }}>
            Template
          </Button>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => api.exportResults(id)} sx={{ mr: 1 }}>
            Export
          </Button>
  <Button
  variant="contained"
  component="label"
  startIcon={<UploadIcon />}
>
  Select Marks File

  <input
    type="file"
    hidden
    accept=".xlsx,.xls,.csv"
    onChange={(e) => {
      const file =
        e.target.files?.[0];

      if (file) {
        setImportFile(file);
      }
    }}
  />
</Button>

{importFile && (
  <Button
    variant="contained"
    sx={{ ml: 1 }}
    onClick={async () => {
      try {
        await handleImport();
      } catch (error) {
        console.error(error);
      }
    }}
  >
    Upload Marks
  </Button>
)}
        </Box>
      </Box>

      <ResultsTable
        results={data.results}
        sections={data.assessment.sections || []}
        onViewStudent={(studentId) => setSelectedStudent(studentId)}
      />

      <Dialog open={!!selectedStudent} onClose={() => setSelectedStudent(null)} maxWidth="md" fullWidth>
        <DialogTitle>Student Result Detail</DialogTitle>
        <DialogContent>
          {selectedStudent && <StudentResultDetail assessmentId={id} studentId={selectedStudent} />}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
