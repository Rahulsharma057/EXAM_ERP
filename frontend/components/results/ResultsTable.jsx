'use client';
import React from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, IconButton, Typography, Box
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';

export default function ResultsTable({ results, sections, onViewStudent }) {
  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Roll No</TableCell>
            <TableCell>Student</TableCell>
            {sections.map(s => (
              <TableCell key={s._id} align="center">{s.name}</TableCell>
            ))}
            <TableCell align="center">Total</TableCell>
            <TableCell align="center">%</TableCell>
            <TableCell align="center">Status</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {results.map(row => (
            <TableRow key={row.student._id}>
              <TableCell>{row.student.rollNumber}</TableCell>
              <TableCell>{row.student.name}</TableCell>
              {sections.map(s => {
                const sec = row.sectionScores?.find(sc => sc.sectionId.toString() === s._id.toString());
                return (
                  <TableCell key={s._id} align="center">
                    {sec ? `${sec.obtainedMarks}/${sec.maxMarks}` : '-'}
                  </TableCell>
                );
              })}
              <TableCell align="center">
                <Typography fontWeight="bold">{row.totalObtained}/{row.totalMax}</Typography>
              </TableCell>
              <TableCell align="center">
                <Chip size="small" label={`${row.overallPercentage}%`} color={row.overallPercentage >= 60 ? 'success' : 'warning'} />
              </TableCell>
              <TableCell align="center">
                <Chip size="small" label={row.status} color={row.status === 'COMPLETED' ? 'success' : 'default'} />
              </TableCell>
              <TableCell>
                <IconButton size="small" onClick={() => onViewStudent(row.student._id)}><VisibilityIcon /></IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
