'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Typography, Button, Grid, Card, CardContent, CardActionArea,
  LinearProgress, Chip, Avatar, Paper, Divider, Fade
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SchoolIcon from '@mui/icons-material/School';
import BarChartIcon from '@mui/icons-material/BarChart';
import BusinessIcon from '@mui/icons-material/Business';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import GroupsIcon from '@mui/icons-material/Groups';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import Layout from '../components/common/Layout';
import { api } from '../services/api';

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({ assessments: 0, students: 0, organisations: 0, centres: 0, courses: 0, batches: 0 });
  const [userRole, setUserRole] = useState('');
  const [recentAssessments, setRecentAssessments] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const me = await api.getMe();
        setUserRole(me.user?.role || '');

        const [assRes, stuRes, orgRes, cenRes, couRes, batRes] = await Promise.all([
          api.getAssessments({ page: 1, limit: 1 }),
          api.getStudents({ page: 1, limit: 1 }),
          api.getOrganisationsList({ page: 1, limit: 1 }),
          api.getCentresList({ page: 1, limit: 1 }),
          api.getCoursesList({ page: 1, limit: 1 }),
          api.getBatchesList({ page: 1, limit: 1 })
        ]);

        setStats({
          assessments: assRes.pagination?.total || 0,
          students: stuRes.pagination?.total || 0,
          organisations: orgRes.pagination?.total || 0,
          centres: cenRes.pagination?.total || 0,
          courses: couRes.pagination?.total || 0,
          batches: batRes.pagination?.total || 0
        });

        const recent = await api.getAssessments({ page: 1, limit: 5, status: 'PUBLISHED' });
        setRecentAssessments(recent.data || []);
      } catch (e) {}
    };
    load();
  }, []);

  const statCards = [
    { title: 'Assessments', count: stats.assessments, icon: <AssessmentIcon />, color: '#1565c0', path: '/assessments' },
    { title: 'Students', count: stats.students, icon: <SchoolIcon />, color: '#2e7d32', path: '/students' },
    { title: 'Batches', count: stats.batches, icon: <GroupsIcon />, color: '#9c27b0', path: '/batches' },
    { title: 'Courses', count: stats.courses, icon: <BarChartIcon />, color: '#ed6c02', path: '/courses' },
  ];

  const configCards = [
    { title: 'Organisations', count: stats.organisations, icon: <BusinessIcon />, color: '#d32f2f', path: '/organisations', roles: ['super_admin'] },
    { title: 'Centres', count: stats.centres, icon: <LocationOnIcon />, color: '#2e7d32', path: '/centres', roles: ['super_admin', 'org_admin'] },
  ];

  const visibleConfig = configCards.filter(c => c.roles.includes(userRole));

  return (
    <Layout>
      <Fade in>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>Dashboard</Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Welcome back! Here is your overview.
          </Typography>

          <Grid container spacing={3} sx={{ mb: 4 }}>
            {statCards.map((card) => (
              <Grid item xs={12} sm={6} md={3} key={card.title}>
                <Card sx={{ cursor: 'pointer', '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 }, transition: 'all 0.3s' }} onClick={() => router.push(card.path)}>
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: card.color, width: 48, height: 48 }}>{card.icon}</Avatar>
                    <Box>
                      <Typography variant="h4" fontWeight="bold">{card.count}</Typography>
                      <Typography variant="body2" color="text.secondary">{card.title}</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {visibleConfig.length > 0 && (
            <>
              <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mt: 4 }}>Configuration</Typography>
              <Grid container spacing={3} sx={{ mb: 4 }}>
                {visibleConfig.map((card) => (
                  <Grid item xs={12} sm={6} md={3} key={card.title}>
                    <Card sx={{ cursor: 'pointer', '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 }, transition: 'all 0.3s' }} onClick={() => router.push(card.path)}>
                      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: card.color, width: 48, height: 48 }}>{card.icon}</Avatar>
                        <Box>
                          <Typography variant="h4" fontWeight="bold">{card.count}</Typography>
                          <Typography variant="body2" color="text.secondary">{card.title}</Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </>
          )}

          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>Recent Published Assessments</Typography>
                <Divider sx={{ mb: 2 }} />
                {recentAssessments.length === 0 && (
                  <Typography color="text.secondary" align="center" sx={{ py: 4 }}>No published assessments yet</Typography>
                )}
                {recentAssessments.map((a) => (
                  <Card key={a._id} variant="outlined" sx={{ mb: 2, cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }} onClick={() => router.push(`/assessments/${a._id}/results`)}>
                    <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography fontWeight="bold">{a.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Week {a.weekNumber} | {a.batch?.name} | {a.course?.name}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'right' }}>
                        <Chip size="small" label={a.status} color="success" sx={{ mb: 0.5 }} />
                        <Typography variant="body2" color="text.secondary">{a.totalMarks} marks</Typography>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>Quick Actions</Typography>
                <Divider sx={{ mb: 2 }} />
                <Button variant="contained" fullWidth sx={{ mb: 1 }} onClick={() => router.push('/assessments/new')}>
                  Create Assessment
                </Button>
                <Button variant="outlined" fullWidth sx={{ mb: 1 }} onClick={() => router.push('/students')}>
                  Manage Students
                </Button>
                <Button variant="outlined" fullWidth onClick={() => router.push('/results')}>
                  View Results
                </Button>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </Fade>
    </Layout>
  );
}
