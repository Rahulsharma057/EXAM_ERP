"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Avatar,
  Divider,
  Chip,
  Tooltip,
  Collapse,
  Menu,
  MenuItem,
} from "@mui/material";

import DashboardIcon from "@mui/icons-material/Dashboard";
import BusinessIcon from "@mui/icons-material/Business";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import SchoolIcon from "@mui/icons-material/School";
import GroupsIcon from "@mui/icons-material/Groups";
import AssessmentIcon from "@mui/icons-material/Assessment";
import BarChartIcon from "@mui/icons-material/BarChart";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import AppsOutlinedIcon from "@mui/icons-material/AppsOutlined";
import SwapHorizOutlinedIcon from "@mui/icons-material/SwapHorizOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";

import { api } from "../../services/api";

const DRAWER_WIDTH = 280;

const ROLE_COLORS = {
  super_admin: "#d32f2f",
  org_admin: "#ed6c02",
  centre_admin: "#2e7d32",
  teacher: "#1565c0",
  student: "#7b1fa2",
};

const ROLE_LABELS = {
  super_admin: "Super Admin",
  org_admin: "Org Admin",
  centre_admin: "Centre Admin",
  teacher: "Teacher",
  student: "Student",
};

export default function Layout({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [orgOpen, setOrgOpen] = useState(true);

  // =========================================================
  // SSO PORTAL SWITCHER
  // Only shown if this session came in via the portal handoff
  // (see app/sso/page.js, which sets this localStorage key).
  // =========================================================

  const [portalUrl, setPortalUrl] = useState(null);
  const [switchAnchor, setSwitchAnchor] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPortalUrl(localStorage.getItem("sso_portal_url"));
    }
  }, []);

  useEffect(() => {
    api
      .getMe()
      .then((res) => setUser(res.user))
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("sso_portal_url");
    router.push("/login");
  };

  const isActive = (path) =>
    pathname === path || pathname.startsWith(path + "/");

  const menuItems = [
    {
      text: "Dashboard",
      icon: <DashboardIcon />,
      path: "/",
      roles: [
        "super_admin",
        "org_admin",
        "centre_admin",
        "teacher",
        "student",
      ],
    },
    {
      text: "Results",
      icon: <BarChartIcon />,
      path: "/results",
      roles: [
        "super_admin",
        "org_admin",
        "centre_admin",
        "teacher",
        "student",
      ],
    },
    {
      text: "Assessments",
      icon: <AssessmentIcon />,
      path: "/assessments",
      roles: [
        "super_admin",
        "org_admin",
        "centre_admin",
        "teacher",
      ],
    },
    {
      text: "Students",
      icon: <SchoolIcon />,
      path: "/students",
      roles: [
        "super_admin",
        "org_admin",
        "centre_admin",
        "teacher",
      ],
    },
    {
      text: "Users",
      icon: <PeopleAltIcon />,
      path: "/users",
      roles: ["super_admin"],
    },
  ];

  const orgMenu = [
    {
      text: "Organisations",
      icon: <BusinessIcon />,
      path: "/organisations",
      roles: ["super_admin"],
    },
    {
      text: "Centres",
      icon: <LocationOnIcon />,
      path: "/centres",
      roles: ["super_admin", "org_admin"],
    },
    {
      text: "Courses",
      icon: <SchoolIcon />,
      path: "/courses",
      roles: [
        "super_admin",
        "org_admin",
        "centre_admin",
      ],
    },
    {
      text: "Batches",
      icon: <GroupsIcon />,
      path: "/batches",
      roles: [
        "super_admin",
        "org_admin",
        "centre_admin",
        "teacher",
      ],
    },
  ];

  const userRole = user?.role || "";

  const visibleMenu = menuItems.filter((item) =>
    item.roles.includes(userRole)
  );

  const visibleOrg = orgMenu.filter((item) =>
    item.roles.includes(userRole)
  );

  const drawer = (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* USER HEADER */}
      <Toolbar
        sx={{
          px: 2,
          minHeight: 72,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            minWidth: 0,
          }}
        >
          <Avatar
            sx={{
              bgcolor:
                ROLE_COLORS[userRole] || "#1976d2",
              width: 40,
              height: 40,
              flexShrink: 0,
            }}
          >
            {user?.name?.charAt(0)?.toUpperCase() ||
              "U"}
          </Avatar>

          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              noWrap
              fontWeight="bold"
            >
              {user?.name || "User"}
            </Typography>

            <Chip
              size="small"
              label={
                ROLE_LABELS[userRole] || userRole
              }
              sx={{
                bgcolor:
                  ROLE_COLORS[userRole] || "#1976d2",
                color: "white",
                height: 20,
                fontSize: "0.7rem",
              }}
            />
          </Box>
        </Box>
      </Toolbar>

      {/* MENU */}
      <List
        sx={{
          flex: 1,
          overflow: "auto",
          py: 1,
        }}
      >
        {visibleMenu.map((item) => (
          <ListItem
            button
            key={item.text}
            onClick={() => {
              router.push(item.path);
              setMobileOpen(false);
            }}
            selected={isActive(item.path)}
            sx={{
              mx: 1,
              my: 0.4,
              borderRadius: 2,

              "&.Mui-selected": {
                bgcolor: "primary.main",
                color: "white",

                "& .MuiListItemIcon-root": {
                  color: "white",
                },
              },

              "&:hover": {
                bgcolor: "action.hover",
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 36,
                color: isActive(item.path)
                  ? "white"
                  : "text.secondary",
              }}
            >
              {item.icon}
            </ListItemIcon>

            <ListItemText
              primary={item.text}
              primaryTypographyProps={{
                fontWeight: isActive(item.path)
                  ? "bold"
                  : "normal",
                fontSize: "0.9rem",
              }}
            />
          </ListItem>
        ))}

        {/* CONFIGURATION */}
        {visibleOrg.length > 0 && (
          <>
            <Divider sx={{ my: 1 }} />

            <ListItem
              button
              onClick={() => setOrgOpen(!orgOpen)}
              sx={{
                mx: 1,
                borderRadius: 2,
              }}
            >
              <ListItemText
                primary="Configuration"
                primaryTypographyProps={{
                  fontWeight: "bold",
                  fontSize: "0.85rem",
                  color: "text.secondary",
                }}
              />

              {orgOpen ? (
                <ExpandLess />
              ) : (
                <ExpandMore />
              )}
            </ListItem>

            <Collapse
              in={orgOpen}
              timeout="auto"
              unmountOnExit
            >
              <List
                component="div"
                disablePadding
              >
                {visibleOrg.map((item) => (
                  <ListItem
                    button
                    key={item.text}
                    onClick={() => {
                      router.push(item.path);
                      setMobileOpen(false);
                    }}
                    selected={isActive(item.path)}
                    sx={{
                      pl: 4,
                      mx: 1,
                      my: 0.4,
                      borderRadius: 2,

                      "&.Mui-selected": {
                        bgcolor: "primary.light",
                        color:
                          "primary.contrastText",
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 32,
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>

                    <ListItemText
                      primary={item.text}
                      primaryTypographyProps={{
                        fontSize: "0.88rem",
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </Collapse>
          </>
        )}
      </List>

      {/* LOGOUT */}
      <Divider />

      <List sx={{ py: 1 }}>
        <ListItem
          button
          onClick={handleLogout}
          sx={{
            mx: 1,
            borderRadius: 2,
            color: "error.main",
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: 36,
              color: "error.main",
            }}
          >
            <LogoutIcon />
          </ListItemIcon>

          <ListItemText primary="Logout" />
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box
      sx={{
        display: "flex",
        width: "100%",
        minHeight: "100vh",
        overflowX: "hidden",
      }}
    >
      {/* =====================================================
          TOP APP BAR
      ===================================================== */}

      <AppBar
        position="fixed"
        elevation={1}
        sx={{
          width: {
            md: `calc(100% - ${DRAWER_WIDTH}px)`,
          },

          ml: {
            md: `${DRAWER_WIDTH}px`,
          },

          bgcolor: "background.paper",
          color: "text.primary",

          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Toolbar
          sx={{
            minHeight: {
              xs: 60,
              md: 64,
            },

            px: {
              xs: 1.5,
              sm: 2,
              md: 2.5,
            },

            gap: {
              xs: 1,
              md: 1.5,
            },
          }}
        >
          {/* MOBILE MENU */}
          <IconButton
            color="inherit"
            edge="start"
            onClick={() =>
              setMobileOpen(!mobileOpen)
            }
            sx={{
              mr: 0.5,
              display: {
                xs: "flex",
                md: "none",
              },
            }}
          >
            <MenuIcon />
          </IconButton>

          {/* =================================================
              SLEEPWELL FOUNDATION LOGO
          ================================================= */}

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: {
                xs: 0.8,
                sm: 1,
                md: 1.2,
              },

              minWidth: 0,
            }}
          >
            <Box
              component="img"
              src="/images/sleepwell-foundation-logo.png"
              alt="Sleepwell Foundation"
              sx={{
                width: {
                  xs: 34,
                  sm: 42,
                  md: 188,
                },

                height: {
                  xs: 34,
                  sm: 42,
                  md: 45,
                },

                objectFit: "contain",
                flexShrink: 0,
              }}
            />

            <Box
              sx={{
                width: "1px",
                height: {
                  xs: 24,
                  sm: 28,
                  md: 32,
                },
                bgcolor: "divider",
                flexShrink: 0,
              }}
            />

            <Typography
              variant="h6"
              noWrap
              component="div"
              fontWeight="bold"
              color="primary"
              sx={{
                fontSize: {
                  xs: "0.9rem",
                  sm: "1rem",
                  md: "1.15rem",
                },

                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Weekly Assessment ERP
            </Typography>
          </Box>

          {/* Spacer pushes everything after this to the far right */}
          <Box sx={{ flexGrow: 1 }} />

          {/* =====================================================
              SSO PORTAL SWITCHER (only visible if logged in via portal)
          ===================================================== */}

          {portalUrl && (
            <>
              <Tooltip title="Switch app">
                <IconButton
                  onClick={(e) => setSwitchAnchor(e.currentTarget)}
                  sx={{ color: "primary.main" }}
                >
                  <AppsOutlinedIcon />
                </IconButton>
              </Tooltip>

              <Menu
                anchorEl={switchAnchor}
                open={!!switchAnchor}
                onClose={() => setSwitchAnchor(null)}
                PaperProps={{
                  elevation: 4,
                  sx: {
                    mt: 1,
                    minWidth: 220,
                    borderRadius: 1.5,
                    border: "1px solid rgba(0,0,0,0.06)",
                  },
                }}
              >
                <MenuItem disabled sx={{ opacity: "1 !important" }}>
                  <Typography fontWeight={700} fontSize="0.78rem" color="text.secondary">
                    Signed in via Portal
                  </Typography>
                </MenuItem>

                <Divider />

                <MenuItem
                  onClick={() => {
                    window.location.href = portalUrl;
                  }}
                >
                  <SwapHorizOutlinedIcon fontSize="small" sx={{ mr: 1.2, color: "primary.main" }} />
                  Switch app
                </MenuItem>

                <MenuItem
                  onClick={() => {
                    window.location.href = `${portalUrl}/dashboard`;
                  }}
                >
                  <HomeOutlinedIcon fontSize="small" sx={{ mr: 1.2, color: "primary.main" }} />
                  Portal dashboard
                </MenuItem>
              </Menu>
            </>
          )}
        </Toolbar>
      </AppBar>

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <Box
        component="nav"
        sx={{
          width: {
            md: DRAWER_WIDTH,
          },

          flexShrink: {
            md: 0,
          },
        }}
      >
        {/* MOBILE DRAWER */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: {
              xs: "block",
              md: "none",
            },

            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: DRAWER_WIDTH,
            },
          }}
        >
          {drawer}
        </Drawer>

        {/* DESKTOP DRAWER */}
        <Drawer
          variant="permanent"
          sx={{
            display: {
              xs: "none",
              md: "block",
            },

            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: DRAWER_WIDTH,
              borderRight: 1,
              borderColor: "divider",
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          width: {
            xs: "100%",
            md: `calc(100% - ${DRAWER_WIDTH}px)`,
          },

          mt: {
            xs: 7.5,
            md: 8,
          },

          minHeight: "100vh",

          bgcolor: "grey.50",

          overflowX: "hidden",
        }}
      >
        {children}
      </Box>
    </Box>
  );
}