'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Box, AppBar, Toolbar, Typography, Drawer, List, ListItem, ListItemIcon, ListItemText,
  IconButton, Avatar, Divider, Chip, Tooltip, Collapse
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BusinessIcon from '@mui/icons-material/Business';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SchoolIcon from '@mui/icons-material/School';
import GroupsIcon from '@mui/icons-material/Groups';
import AssessmentIcon from '@mui/icons-material/Assessment';
import BarChartIcon from '@mui/icons-material/BarChart';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import { api } from '../../services/api';

const DRAWER_WIDTH = 280;

const ROLE_COLORS = {
  super_admin: '#d32f2f',
  org_admin: '#ed6c02',
  centre_admin: '#2e7d32',
  teacher: '#1565c0',
  student: '#7b1fa2'
};

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  org_admin: 'Org Admin',
  centre_admin: 'Centre Admin',
  teacher: 'Teacher',
  student: 'Student'
};

export default function Layout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [orgOpen, setOrgOpen] = useState(true);

  useEffect(() => {
    api.getMe().then(res => setUser(res.user)).catch(() => {});
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  const isActive = (path) => pathname === path || pathname.startsWith(path + '/');

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/', roles: ['super_admin', 'org_admin', 'centre_admin', 'teacher', 'student'] },
    { text: 'Results', icon: <BarChartIcon />, path: '/results', roles: ['super_admin', 'org_admin', 'centre_admin', 'teacher', 'student'] },
    { text: 'Assessments', icon: <AssessmentIcon />, path: '/assessments', roles: ['super_admin', 'org_admin', 'centre_admin', 'teacher'] },
    { text: 'Students', icon: <SchoolIcon />, path: '/students', roles: ['super_admin', 'org_admin', 'centre_admin', 'teacher'] },
    {
  text: 'Users',
  icon: <PeopleAltIcon />,
  path: '/users',
  roles: ['super_admin'],
},
  ];

  const orgMenu = [
    { text: 'Organisations', icon: <BusinessIcon />, path: '/organisations', roles: ['super_admin'] },
    { text: 'Centres', icon: <LocationOnIcon />, path: '/centres', roles: ['super_admin', 'org_admin'] },
    { text: 'Courses', icon: <SchoolIcon />, path: '/courses', roles: ['super_admin', 'org_admin', 'centre_admin'] },
    { text: 'Batches', icon: <GroupsIcon />, path: '/batches', roles: ['super_admin', 'org_admin', 'centre_admin', 'teacher'] },
  ];

  const userRole = user?.role || '';
  const visibleMenu = menuItems.filter(item => item.roles.includes(userRole));
  const visibleOrg = orgMenu.filter(item => item.roles.includes(userRole));

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: ROLE_COLORS[userRole] || '#1976d2', width: 40, height: 40 }}>
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </Avatar>
          <Box>
            <Typography variant="subtitle2" noWrap fontWeight="bold">{user?.name || 'User'}</Typography>
            <Chip size="small" label={ROLE_LABELS[userRole] || userRole} sx={{ bgcolor: ROLE_COLORS[userRole], color: 'white', height: 20, fontSize: '0.7rem' }} />
          </Box>
        </Box>
      </Toolbar>

      <List sx={{ flex: 1, overflow: 'auto', py: 1 }}>
        {visibleMenu.map((item) => (
          <ListItem
            button
            key={item.text}
            onClick={() => { router.push(item.path); setMobileOpen(false); }}
            selected={isActive(item.path)}
            sx={{
              mx: 1, my: 0.5, borderRadius: 2,
              '&.Mui-selected': { bgcolor: 'primary.main', color: 'white', '& .MuiListItemIcon-root': { color: 'white' } },
              '&:hover': { bgcolor: 'action.hover' }
            }}
          >
            <ListItemIcon sx={{ minWidth: 36, color: isActive(item.path) ? 'white' : 'text.secondary' }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: isActive(item.path) ? 'bold' : 'normal' }} />
          </ListItem>
        ))}

        {visibleOrg.length > 0 && (
          <>
            <Divider sx={{ my: 1 }} />
            <ListItem button onClick={() => setOrgOpen(!orgOpen)} sx={{ mx: 1, borderRadius: 2 }}>
              <ListItemText primary="Configuration" primaryTypographyProps={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'text.secondary' }} />
              {orgOpen ? <ExpandLess /> : <ExpandMore />}
            </ListItem>
            <Collapse in={orgOpen} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {visibleOrg.map((item) => (
                  <ListItem
                    button
                    key={item.text}
                    onClick={() => { router.push(item.path); setMobileOpen(false); }}
                    selected={isActive(item.path)}
                    sx={{
                      pl: 4, mx: 1, my: 0.5, borderRadius: 2,
                      '&.Mui-selected': { bgcolor: 'primary.light', color: 'primary.contrastText' }
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.text} />
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </>
        )}
      </List>

      <Divider />
      <List sx={{ py: 1 }}>
        <ListItem button onClick={handleLogout} sx={{ mx: 1, borderRadius: 2, color: 'error.main' }}>
          <ListItemIcon sx={{ minWidth: 36, color: 'error.main' }}><LogoutIcon /></ListItemIcon>
          <ListItemText primary="Logout" />
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" elevation={1} sx={{ width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, ml: { md: `${DRAWER_WIDTH}px` }, bgcolor: 'background.paper', color: 'text.primary' }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(!mobileOpen)} sx={{ mr: 2, display: { md: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" fontWeight="bold" color="primary">
            Weekly Assessment ERP
          </Typography>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH, borderRight: 1, borderColor: 'divider' } }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 4 }, mt: 8, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, minHeight: '100vh', bgcolor: 'grey.50' }}>
        {children}
      </Box>
    </Box>
  );
}
