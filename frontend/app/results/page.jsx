'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Typography, Paper, Button, Grid, TextField, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Pagination
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import Layout from '../../components/common/Layout';
import HierarchyFilter from '../../components/assessment/HierarchyFilter';
import { api } from '../../services/api';

export default function ResultsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState({});
  const [assessments, setAssessments] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const load = async () => {
    const params = { ...filters, page, limit, status: 'PUBLISHED' };
    const res = await api.getAssessments(params);
    setAssessments(res.data);
    setTotal(res.pagination.total);
  };

  useEffect(() => { load(); }, [filters, page]);

  return (
    <Layout>
      <Typography variant="h4" gutterBottom>Results Dashboard</Typography>
      <HierarchyFilter onChange={setFilters} values={filters} />

      <TableContainer component={Paper} sx={{ mt: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Assessment</TableCell>
              <TableCell>Week</TableCell>
              <TableCell>Batch</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {assessments.map(a => (
              <TableRow key={a._id}>
                <TableCell>{a.name}</TableCell>
                <TableCell>Week {a.weekNumber}</TableCell>
                <TableCell>{a.batch?.name}</TableCell>
                <TableCell><Chip size="small" label={a.status} color="success" /></TableCell>
                <TableCell>
                  <Button size="small" variant="outlined" onClick={() => router.push(`/assessments/${a._id}/results`)}>
                    View Results
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
        <Pagination count={Math.ceil(total / limit)} page={page} onChange={(e, v) => setPage(v)} />
      </Box>
    </Layout>
  );
}
