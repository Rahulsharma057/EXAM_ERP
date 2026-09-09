"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import {
  Add,
  Block,
  CheckCircle,
  DeleteOutline,
  Edit,
  LockReset,
  People,
  PersonAdd,
  Search,
  School,
  Refresh,
} from "@mui/icons-material";

import { api } from "../../services/api";
import Layout from "../../components/common/Layout";

// ============================================================
// ROLES
// ============================================================

const ROLES = [
  {
    value: "super_admin",
    label: "Super Admin",
    description: "Full system access",
  },
  {
    value: "org_admin",
    label: "Organisation Admin",
    description: "Manage organisation",
  },
  {
    value: "centre_admin",
    label: "Centre Admin",
    description: "Manage centre",
  },
  {
    value: "teacher",
    label: "Teacher",
    description: "Manage assigned batches",
  },
  {
    value: "student",
    label: "Student",
    description: "Student account",
  },
];

// ============================================================
// INITIAL FORM
// ============================================================

const initialForm = {
  name: "",
  email: "",
  password: "",
  role: "teacher",
  mobile: "",
  organisation: "",
  centre: "",
  course: "",
  batches: [],
  studentId: "",
  isActive: true,
};

// ============================================================
// HELPERS
// ============================================================

const getRoleLabel = (role) =>
  ROLES.find((item) => item.value === role)?.label || role;

const getInitials = (name = "") =>
  name
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

// ============================================================
// USERS PAGE
// ============================================================

export default function UsersPage() {
  // ==========================================================
  // LIST STATE
  // ==========================================================

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);

  // ==========================================================
  // STATS
  // ==========================================================

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    super_admin: 0,
    org_admin: 0,
    centre_admin: 0,
    teacher: 0,
    student: 0,
  });

  // ==========================================================
  // FORM / DIALOG
  // ==========================================================

  const [openDialog, setOpenDialog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [form, setForm] = useState(initialForm);

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState("");

  // ==========================================================
  // HIERARCHY DATA
  // ==========================================================

  const [organisations, setOrganisations] = useState([]);
  const [centres, setCentres] = useState([]);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [students, setStudents] = useState([]);

  const [hierarchyLoading, setHierarchyLoading] = useState(false);

  // ==========================================================
  // PASSWORD DIALOG
  // ==========================================================

  const [passwordDialog, setPasswordDialog] = useState(false);
  const [passwordUser, setPasswordUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // ==========================================================
  // LOAD USERS
  // ==========================================================

  const loadUsers = async () => {
    try {
      setLoading(true);

      const response = await api.getUsers({
        page: page + 1,
        limit: rowsPerPage,
        search: search.trim() || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      });

      const data = response?.data || [];

      setUsers(Array.isArray(data) ? data : []);

      setTotalUsers(
        Number(
          response?.pagination?.total ??
            response?.total ??
            response?.count ??
            data.length,
        ),
      );
    } catch (error) {
      console.error("Failed to load users:", error);
      setUsers([]);
      setTotalUsers(0);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // LOAD STATS
  // ==========================================================

  const loadStats = async () => {
    try {
      const response = await api.getUserStats();

      console.log("USER STATS RESPONSE:", response);

      const data = response?.data || {};
      const byRole = data?.byRole || {};

      setStats({
        total: Number(data?.total ?? 0),
        active: Number(data?.active ?? 0),
        inactive: Number(data?.inactive ?? 0),

        super_admin: Number(byRole?.super_admin ?? 0),
        org_admin: Number(byRole?.org_admin ?? 0),
        centre_admin: Number(byRole?.centre_admin ?? 0),
        teacher: Number(byRole?.teacher ?? 0),
        student: Number(byRole?.student ?? 0),
      });
    } catch (error) {
      console.error("Failed to load user stats:", error);

      setStats({
        total: 0,
        active: 0,
        inactive: 0,
        super_admin: 0,
        org_admin: 0,
        centre_admin: 0,
        teacher: 0,
        student: 0,
      });
    }
  };

  useEffect(() => {
    loadUsers();
  }, [page, rowsPerPage, roleFilter, statusFilter]);

  useEffect(() => {
    loadStats();
  }, []);

  // ==========================================================
  // SEARCH DEBOUNCE
  // ==========================================================

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0);
      loadUsers();
    }, 400);

    return () => clearTimeout(timer);
  }, [search]);

  // ==========================================================
  // LOAD ORGANISATIONS
  // ==========================================================

  const loadOrganisations = async () => {
    try {
      const response = await api.getOrganisations();
      setOrganisations(response?.data || []);
    } catch (error) {
      console.error("Failed to load organisations:", error);
      setOrganisations([]);
    }
  };

  // ==========================================================
  // OPEN CREATE
  // ==========================================================

  const handleCreate = async () => {
    setEditingUser(null);
    setForm(initialForm);
    setCentres([]);
    setCourses([]);
    setBatches([]);
    setStudents([]);
    setFormError("");

    await loadOrganisations();

    setOpenDialog(true);
  };

  // ==========================================================
  // OPEN EDIT
  // ==========================================================

  const handleEdit = async (user) => {
    try {
      setFormLoading(true);
      setFormError("");

      const response = await api.getUser(user._id || user.id);
      const data = response?.data || response?.user || response;

      setEditingUser(data);

      const batchIds =
        data?.batches?.map((batch) =>
          typeof batch === "string" ? batch : batch?._id,
        ) || [];

      setForm({
        name: data?.name || "",
        email: data?.email || "",
        password: "",
        role: data?.role || "teacher",
        mobile: data?.mobile || "",

        organisation:
          typeof data?.organisation === "string"
            ? data.organisation
            : data?.organisation?._id || "",

        centre:
          typeof data?.centre === "string"
            ? data.centre
            : data?.centre?._id || "",

        course:
          typeof data?.course === "string"
            ? data.course
            : data?.course?._id || "",

        batches: batchIds,

        studentId:
          typeof data?.studentId === "string"
            ? data.studentId
            : data?.studentId?._id || "",

        isActive: data?.isActive !== false,
      });

      await loadOrganisations();

      if (data?.organisation?._id || data?.organisation) {
        const orgId =
          typeof data.organisation === "string"
            ? data.organisation
            : data.organisation._id;

        await loadCentres(orgId);
      }

      if (data?.centre?._id || data?.centre) {
        const centreId =
          typeof data.centre === "string" ? data.centre : data.centre._id;

        await loadCourses(centreId);
      }

      if (data?.course?._id || data?.course) {
        const courseId =
          typeof data.course === "string" ? data.course : data.course._id;

        await loadBatches(courseId);
      }

      if (data?.role === "student" && batchIds.length > 0) {
        await loadStudents(batchIds[0]);
      }

      setOpenDialog(true);
    } catch (error) {
      setFormError(error?.message || "Failed to load user");
    } finally {
      setFormLoading(false);
    }
  };

  // ==========================================================
  // CLOSE FORM
  // ==========================================================

  const handleCloseDialog = () => {
    if (formLoading) return;

    setOpenDialog(false);
    setEditingUser(null);
    setForm(initialForm);
    setCentres([]);
    setCourses([]);
    setBatches([]);
    setStudents([]);
    setFormError("");
  };

  // ==========================================================
  // ORGANISATION CHANGE
  // ==========================================================

  const handleOrganisationChange = async (event) => {
    const organisationId = event.target.value;

    setForm((prev) => ({
      ...prev,
      organisation: organisationId,
      centre: "",
      course: "",
      batches: [],
      studentId: "",
    }));

    setCentres([]);
    setCourses([]);
    setBatches([]);
    setStudents([]);

    if (organisationId) {
      await loadCentres(organisationId);
    }
  };

  // ==========================================================
  // LOAD CENTRES
  // ==========================================================

  const loadCentres = async (organisationId) => {
    try {
      setHierarchyLoading(true);

      const response = await api.getCentres(organisationId);

      setCentres(response?.data || []);
    } catch (error) {
      console.error("Failed to load centres:", error);
      setCentres([]);
    } finally {
      setHierarchyLoading(false);
    }
  };

  // ==========================================================
  // CENTRE CHANGE
  // ==========================================================

  const handleCentreChange = async (event) => {
    const centreId = event.target.value;

    setForm((prev) => ({
      ...prev,
      centre: centreId,
      course: "",
      batches: [],
      studentId: "",
    }));

    setCourses([]);
    setBatches([]);
    setStudents([]);

    if (centreId) {
      await loadCourses(centreId);
    }
  };

  // ==========================================================
  // LOAD COURSES
  // ==========================================================

  const loadCourses = async (centreId) => {
    try {
      setHierarchyLoading(true);

      const response = await api.getCourses(centreId);

      setCourses(response?.data || []);
    } catch (error) {
      console.error("Failed to load courses:", error);
      setCourses([]);
    } finally {
      setHierarchyLoading(false);
    }
  };

  // ==========================================================
  // COURSE CHANGE
  // ==========================================================

  const handleCourseChange = async (event) => {
    const courseId = event.target.value;

    setForm((prev) => ({
      ...prev,
      course: courseId,
      batches: [],
      studentId: "",
    }));

    setBatches([]);
    setStudents([]);

    if (courseId) {
      await loadBatches(courseId);
    }
  };

  // ==========================================================
  // LOAD BATCHES
  // ==========================================================

  const loadBatches = async (courseId) => {
    try {
      setHierarchyLoading(true);

      const response = await api.getBatches(courseId);

      setBatches(response?.data || []);
    } catch (error) {
      console.error("Failed to load batches:", error);
      setBatches([]);
    } finally {
      setHierarchyLoading(false);
    }
  };

  // ==========================================================
  // BATCH CHANGE
  // ==========================================================

  const handleBatchChange = async (event) => {
    const value = event.target.value;

    if (form.role === "teacher") {
      const selectedBatches =
        typeof value === "string" ? value.split(",") : value;

      setForm((prev) => ({
        ...prev,
        batches: selectedBatches,
        studentId: "",
      }));

      setStudents([]);
      return;
    }

    const batchId = value;

    setForm((prev) => ({
      ...prev,
      batches: batchId ? [batchId] : [],
      studentId: "",
    }));

    setStudents([]);

    if (batchId && form.role === "student") {
      await loadStudents(batchId);
    }
  };

  // ==========================================================
  // LOAD STUDENTS
  // ==========================================================

  const loadStudents = async (batchId) => {
    try {
      setHierarchyLoading(true);

      const response = await api.getBatchStudents(batchId);

      setStudents(response?.data || []);
    } catch (error) {
      console.error("Failed to load students:", error);
      setStudents([]);
    } finally {
      setHierarchyLoading(false);
    }
  };

  // ==========================================================
  // ROLE CHANGE
  // ==========================================================

  const handleRoleChange = async (event) => {
    const role = event.target.value;

    setForm((prev) => ({
      ...prev,
      role,
      organisation: "",
      centre: "",
      course: "",
      batches: [],
      studentId: "",
    }));

    setCentres([]);
    setCourses([]);
    setBatches([]);
    setStudents([]);

    if (role !== "super_admin") {
      await loadOrganisations();
    }
  };

  // ==========================================================
  // FORM FIELD
  // ==========================================================

  const handleFieldChange = (field) => (event) => {
    setForm((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  // ==========================================================
  // VALIDATION
  // ==========================================================

  const validateForm = () => {
    if (!form.name.trim()) {
      return "Name is required";
    }

    if (!form.email.trim()) {
      return "Email is required";
    }

    if (!editingUser && !form.password.trim()) {
      return "Password is required";
    }

    if (!form.role) {
      return "Role is required";
    }

    if (form.role === "org_admin") {
      if (!form.organisation) {
        return "Organisation is required for Organisation Admin";
      }
    }

    if (
      ["centre_admin", "teacher", "student"].includes(form.role) &&
      !form.organisation
    ) {
      return "Organisation is required";
    }

    if (
      ["centre_admin", "teacher", "student"].includes(form.role) &&
      !form.centre
    ) {
      return "Centre is required";
    }

    if (["teacher", "student"].includes(form.role) && !form.course) {
      return "Course is required";
    }

    if (form.role === "teacher" && form.batches.length === 0) {
      return "Select at least one batch for teacher";
    }

    if (form.role === "student" && form.batches.length !== 1) {
      return "Select exactly one batch for student";
    }

    if (form.role === "student" && !form.studentId) {
      return "Student profile is required";
    }

    return null;
  };

  // ==========================================================
  // CREATE / UPDATE
  // ==========================================================

  const handleSubmit = async () => {
    try {
      setFormError("");

      const validationError = validateForm();

      if (validationError) {
        setFormError(validationError);
        return;
      }

      setFormLoading(true);

      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        mobile: form.mobile.trim(),
        isActive: form.isActive,
        batches: form.batches,
      };

      if (form.password.trim()) {
        payload.password = form.password;
      }

      if (form.organisation) {
        payload.organisation = form.organisation;
      }

      if (form.centre) {
        payload.centre = form.centre;
      }

      if (form.course) {
        payload.course = form.course;
      }

      if (form.role === "student") {
        payload.studentId = form.studentId;
        payload.batches = [form.batches[0]];
      }

      if (form.role === "super_admin") {
        delete payload.organisation;
        delete payload.centre;
        delete payload.course;
        delete payload.batches;
        delete payload.studentId;
      }

      if (editingUser) {
        await api.updateUser(editingUser._id || editingUser.id, payload);
      } else {
        await api.createUser(payload);
      }

      handleCloseDialog();

      await Promise.all([loadUsers(), loadStats()]);
    } catch (error) {
      console.error(error);
      setFormError(error?.message || "Failed to save user");
    } finally {
      setFormLoading(false);
    }
  };

  // ==========================================================
  // TOGGLE STATUS
  // ==========================================================

  const handleToggleStatus = async (user) => {
    try {
      await api.toggleUserStatus(user._id || user.id);

      await Promise.all([loadUsers(), loadStats()]);
    } catch (error) {
      console.error(error);
      alert(error?.message || "Failed to change user status");
    }
  };

  // ==========================================================
  // DELETE / DEACTIVATE
  // ==========================================================

  const handleDelete = async (user) => {
    const confirmed = window.confirm(
      `Are you sure you want to deactivate "${user.name}"?`,
    );

    if (!confirmed) return;

    try {
      await api.deleteUser(user._id || user.id);

      await Promise.all([loadUsers(), loadStats()]);
    } catch (error) {
      console.error(error);
      alert(error?.message || "Failed to deactivate user");
    }
  };

  // ==========================================================
  // PASSWORD RESET
  // ==========================================================

  const openPasswordDialog = (user) => {
    setPasswordUser(user);
    setNewPassword("");
    setPasswordError("");
    setPasswordDialog(true);
  };

  const closePasswordDialog = () => {
    if (passwordLoading) return;

    setPasswordDialog(false);
    setPasswordUser(null);
    setNewPassword("");
    setPasswordError("");
  };

  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      setPasswordError("Password is required");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }

    try {
      setPasswordLoading(true);
      setPasswordError("");

      await api.resetUserPassword(
        passwordUser._id || passwordUser.id,
        newPassword,
      );

      closePasswordDialog();
    } catch (error) {
      setPasswordError(error?.message || "Failed to reset password");
    } finally {
      setPasswordLoading(false);
    }
  };

  // ==========================================================
  // REFRESH
  // ==========================================================

  const handleRefresh = async () => {
    await Promise.all([loadUsers(), loadStats()]);
  };

  // ==========================================================
  // ROLE COLOR
  // ==========================================================

  const getRoleColor = (role) => {
    switch (role) {
      case "super_admin":
        return "error";

      case "org_admin":
        return "warning";

      case "centre_admin":
        return "secondary";

      case "teacher":
        return "primary";

      case "student":
        return "success";

      default:
        return "default";
    }
  };

  // ==========================================================
  // FILTERED USERS
  // ==========================================================

  const visibleUsers = useMemo(() => {
    return users;
  }, [users]);

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <Layout>
      <Box
        sx={{
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
          overflowX: "hidden",
          px: {
            xs: 1,
            sm: 1.5,
            md: 1,
          },
          py: {
            xs: 1.25,
            sm: 1.5,
            md: 0,
          },
        }}
      >
        {/* ====================================================
            HEADER
        ==================================================== */}

        <Box
          sx={{
            mb: 1.5,
            mx: -1,
            p: { xs: 1.25, sm: 1.5 },
            // borderRadius: 2.5,
            background:
              "linear-gradient(135deg, #15498d 0%, #283199 55%, #1a5793 100%)",
            border: "1px solid #dbeafe",

            display: "flex",
            alignItems: {
              xs: "stretch",
              md: "center",
            },
            justifyContent: "space-between",

            flexDirection: {
              xs: "column",
              md: "row",
            },

            gap: {
              xs: 1,
              md: 1.5,
            },
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Avatar
                sx={{
                  width: { xs: 34, sm: 40 },
                  height: { xs: 34, sm: 40 },
                  bgcolor: "#ab1919",
                  borderRadius: 1.5,
                }}
              >
                <People fontSize="small" />
              </Avatar>

              <Box sx={{ minWidth: 0, p: { xs: 0, sm: 0.5 } }}>
                <Typography
                  sx={{
                    fontSize: {
                      xs: "1.15rem",
                      sm: "1.35rem",
                      md: "1.5rem",
                    },
                    lineHeight: 1.15,
                    fontWeight: 800,
                    color: "#f6f8fc",
                  }}
                >
                  User Management
                </Typography>

                <Typography
                  sx={{
                    mt: 0.2,
                    fontSize: {
                      xs: "0.68rem",
                      sm: "0.74rem",
                    },
                    color: "#e1e5ea",
                  }}
                >
                  Manage users, roles and access
                </Typography>
              </Box>
            </Stack>
          </Box>

          <Stack
            direction="row"
            spacing={0.75}
            sx={{
              width: {
                xs: "100%",
                md: "auto",
              },
            }}
          >
            <Button
              variant="contained"
              size="small"
              startIcon={<PersonAdd fontSize="small" />}
              onClick={handleCreate}
              sx={{
                flex: {
                  xs: 1,
                  md: "unset",
                },

                minWidth: {
                  xs: "100%",
                  sm: 145,
                  md: 155,
                },

                minHeight: 40,
                px: 2.2,
                py: 0.8,

                //      borderRadius: 1.5,
                textTransform: "none",
                fontWeight: 700,
                fontSize: "0.875rem",

                background:
                  "linear-gradient(135deg, rgb(46, 187, 55) 0%, #35c533 100%)",

                boxShadow: "0 3px 8px rgba(36, 209, 47, 0.18)",

                transition: "all 0.2s ease",

                "&:hover": {
                  background:
                    "linear-gradient(135deg, #32d43d 0%, #3ae038 100%)",
                  boxShadow: "0 5px 14px rgba(36, 209, 47, 0.28)",
                  transform: "translateY(-1px)",
                },

                "&:active": {
                  transform: "translateY(0)",
                },

                "& .MuiButton-startIcon": {
                  marginRight: 0.7,
                },
              }}
            >
              Create User
            </Button>
            <Tooltip title="Refresh">
              <IconButton
                onClick={handleRefresh}
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: 1.5,
                  border: "1px solid #dbe3ef",
                  background: "#fff",

                  "&:hover": {
                    background: "#eff6ff",
                    color: "#2563eb",
                  },
                }}
              >
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        <Grid
          container
          spacing={{ xs: 1, sm: 1.25, md: 1.5 }}
          sx={{
            mb: 1.5,
            width: "100%",
            mx: 0,
          }}
        >
          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              title="Total Users"
              value={stats.total}
              icon={<People fontSize="small" />}
              subtitle="All accounts"
              accent="primary"
            />
          </Grid>

          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              title="Active"
              value={stats.active}
              icon={<CheckCircle fontSize="small" />}
              subtitle="Active accounts"
              accent="success"
            />
          </Grid>

          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              title="Teachers"
              value={stats.teacher}
              icon={<School fontSize="small" />}
              subtitle="Teacher accounts"
              accent="info"
            />
          </Grid>

          <Grid item xs={6} sm={6} md={3}>
            <StatCard
              title="Students"
              value={stats.student}
              icon={<People fontSize="small" />}
              subtitle="Student accounts"
              accent="warning"
            />
          </Grid>
        </Grid>
        {/* ====================================================
            ROLE SUMMARY
        ==================================================== */}

        {/* <Card
  elevation={0}
  sx={{
    mb: 1.5,
    borderRadius: 2,
    border: "1px solid #e5e7eb",
    background: "#fff",
  }}
>
  <CardContent
    sx={{
      p: { xs: 1, sm: 1.25 },
      "&:last-child": {
        pb: { xs: 1, sm: 1.25 },
      },
    }}
  >
    <Stack
      direction="row"
      alignItems="center"
      spacing={1}
      sx={{ mb: 0.8 }}
    >
      <Box
        sx={{
          width: 4,
          height: 18,
          borderRadius: 5,
          background: "#2563eb",
        }}
      />

      <Typography
        sx={{
          fontSize: {
            xs: "0.78rem",
            sm: "0.85rem",
          },
          fontWeight: 800,
          color: "#0f172a",
        }}
      >
        Users by Role
      </Typography>
    </Stack>

    <Stack
      direction="row"
      spacing={0.7}
      useFlexGap
      flexWrap="wrap"
    >
      <RoleSummary
        label="Super Admin"
        value={stats.super_admin}
      />

      <RoleSummary
        label="Org Admin"
        value={stats.org_admin}
      />

      <RoleSummary
        label="Centre Admin"
        value={stats.centre_admin}
      />

      <RoleSummary
        label="Teacher"
        value={stats.teacher}
      />

      <RoleSummary
        label="Student"
        value={stats.student}
      />
    </Stack>
  </CardContent>
</Card> */}

        {/* ====================================================
            FILTERS
        ==================================================== */}

        <Card
          sx={{
            my: 1.5,
            borderRadius: 1,
            width: "100%",
            maxWidth: "100%",
          }}
        >
          <CardContent
            sx={{
              p: {
                xs: 1,
                sm: 0,
              },
              "&:last-child": {
                pb: {
                  xs: 1,
                  sm: 1,
                },
              },
            }}
          >
            <Grid
              container
              spacing={1}
              sx={{
                width: "100%",
                m: 0,
              }}
            >
              <Grid item xs={12} md={5}>
                <TextField
                  fullWidth
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email or mobile..."
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Role</InputLabel>

                  <Select
                    value={roleFilter}
                    label="Role"
                    onChange={(e) => {
                      setRoleFilter(e.target.value);
                      setPage(0);
                    }}
                  >
                    <MenuItem value="">All Roles</MenuItem>

                    {ROLES.map((role) => (
                      <MenuItem key={role.value} value={role.value}>
                        {role.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Status</InputLabel>

                  <Select
                    value={statusFilter}
                    label="Status"
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(0);
                    }}
                  >
                    <MenuItem value="">All Status</MenuItem>

                    <MenuItem value="active">Active</MenuItem>

                    <MenuItem value="inactive">Inactive</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid
                item
                xs={12}
                md={1}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: {
                    xs: "flex-start",
                    md: "center",
                  },
                }}
              >
                <Tooltip title="Clear Filters">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setSearch("");
                      setRoleFilter("");
                      setStatusFilter("");
                      setPage(0);
                    }}
                  >
                    <Refresh fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* ====================================================
            TABLE
        ==================================================== */}

        <Card
          sx={{
            borderRadius: 1,
            overflow: "hidden",
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
            border: "1px solid #E6EAF0",
            boxShadow: "0 2px 8px rgba(16, 24, 40, 0.04)",
          }}
        >
          <TableContainer
            sx={{
              width: "100%",
              maxWidth: "100%",
              overflowX: "auto",
              overflowY: "hidden",
              position: "relative",

              "&::-webkit-scrollbar": {
                height: 6,
              },

              "&::-webkit-scrollbar-track": {
                backgroundColor: "#F1F3F6",
              },

              "&::-webkit-scrollbar-thumb": {
                borderRadius: 10,
                backgroundColor: "#B8C0CC",
              },

              "&::-webkit-scrollbar-thumb:hover": {
                backgroundColor: "#98A2B3",
              },
            }}
          >
            <Table
              size="small"
              stickyHeader
              sx={{
                minWidth: {
                  xs: 1050,
                  md: 1120,
                },

                tableLayout: "auto",

                // =========================
                // ALL TABLE CELLS
                // =========================
                "& .MuiTableCell-root": {
                  py: 0.6,
                  px: 1.25,
                  whiteSpace: "nowrap",
                  fontSize: "0.75rem",
                  borderBottom: "1px solid #EEF1F5",
                },

                // =========================
                // TABLE HEADER
                // =========================
                "& .MuiTableHead-root .MuiTableCell-root": {
                  py: 0.85,
                  px: 1.25,
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: "#FFFFFF",
                  backgroundColor: "#1d2ba5",
                  borderBottom: "none",
                  height: 42,
                },

                // =========================
                // TABLE BODY ROW
                // =========================
                "& .MuiTableBody-root .MuiTableRow-root": {
                  height: 48,
                },

                "& .MuiTableBody-root .MuiTableRow-root:hover": {
                  backgroundColor: "#F5F9FF",
                },

                "& .MuiTableBody-root .MuiTableRow-root:hover .MuiTableCell-root":
                  {
                    backgroundColor: "#F5F9FF",
                  },
                // =========================
                // STICKY ACTION HEADER
                // =========================
                "& .sticky-action-header": {
                  position: "sticky",
                  right: 0,
                  zIndex: 5,

                  width: 105,
                  minWidth: 105,
                  maxWidth: 105,

                  backgroundColor: "#20349a !important",
                  color: "#FFFFFF !important",
                  borderLeft: "1px solid rgba(255,255,255,0.18)",
                  boxShadow: "-4px 0 8px rgba(0,0,0,0.08)",

                  px: 0.5,
                },

                // =========================
                // STICKY ACTION BODY
                // =========================
                "& .sticky-action-cell": {
                  position: "sticky",
                  right: 0,
                  zIndex: 3,

                  width: 105,
                  minWidth: 105,
                  maxWidth: 105,

                  backgroundColor: "#FFFFFF",
                  borderLeft: "1px solid #E5E7EB",
                  boxShadow: "-4px 0 8px rgba(0,0,0,0.04)",

                  px: 0.5,
                },

                "& .MuiTableBody-root .MuiTableRow-root:hover .sticky-action-cell":
                  {
                    backgroundColor: "#F5F9FF",
                  },
                "& .MuiTableBody-root .MuiTableRow-root:hover .sticky-action-cell":
                  {
                    backgroundColor: "#F5F9FF",
                  },
              }}
            >
              {/* ========================================================= */}
              {/* TABLE HEAD */}
              {/* ========================================================= */}

              <TableHead>
                <TableRow>
                  <TableCell
                          align="center"
                    sx={{
                      minWidth: 220,
                   
                    }}
                  >
                    <b>User</b>
                  </TableCell>

                  <TableCell
                             align="center"
                    sx={{
                      minWidth: 105,
                    }}
                  >
                    <b>Role</b>
                  </TableCell>

                  <TableCell
                    sx={{
                      minWidth: 160,
                    }}
                  >
                    <b>Organisation</b>
                  </TableCell>

                  <TableCell
                    sx={{
                      minWidth: 150,
                    }}
                  >
                    <b>Centre</b>
                  </TableCell>

                  <TableCell
                    sx={{
                      minWidth: 150,
                    }}
                  >
                    <b>Course</b>
                  </TableCell>

                  <TableCell
                    sx={{
                      minWidth: 170,
                    }}
                  >
                    <b>Batches</b>
                  </TableCell>

                  <TableCell
                    sx={{
                      minWidth: 110,
                    }}
                  >
                    <b>Status</b>
                  </TableCell>

                  {/* STICKY ACTION HEADER */}
                  <TableCell
                    align="center"
                    className="sticky-action-header"
                    sx={{
                      width: 125,
                      minWidth: 125,
                      maxWidth: 125,
                      px: 0.5,
                      py: 0.85,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <b>Actions</b>
                  </TableCell>
                </TableRow>
              </TableHead>

              {/* ========================================================= */}
              {/* TABLE BODY */}
              {/* ========================================================= */}

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Box
                        sx={{
                          minHeight: 180,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <CircularProgress size={28} />
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : visibleUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Box
                        sx={{
                          py: 5,
                          textAlign: "center",
                        }}
                      >
                        <People
                          sx={{
                            fontSize: 42,
                            color: "text.disabled",
                            mb: 1,
                          }}
                        />

                        <Typography
                          variant="h6"
                          color="text.secondary"
                          sx={{
                            fontSize: "0.95rem",
                            fontWeight: 700,
                          }}
                        >
                          No users found
                        </Typography>

                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            fontSize: "0.72rem",
                            mt: 0.3,
                          }}
                        >
                          Try changing your filters or create a new user.
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleUsers.map((user) => {
                    const userId = user._id || user.id;

                    const batchesList = user.batches || [];

                    return (
                      <TableRow key={userId} hover>
                        {/* ================================================= */}
                        {/* USER */}
                        {/* ================================================= */}

                        <TableCell>
                          <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            sx={{
                              minWidth: 205,
                            }}
                          >
                            <Avatar
                              sx={{
                                width: 32,
                                height: 32,
                                fontSize: 11,
                                fontWeight: 700,
                                flexShrink: 0,
                                backgroundColor: "#E3F2FD",
                                color: "#1565C0",
                              }}
                            >
                              {getInitials(user.name)}
                            </Avatar>

                            <Box
                              sx={{
                                minWidth: 0,
                              }}
                            >
                              <Typography
                                fontWeight={700}
                                variant="body2"
                                noWrap
                                sx={{
                                  fontSize: "0.77rem",
                                  lineHeight: 1.25,
                                }}
                              >
                                {user.name}
                              </Typography>

                              <Typography
                                variant="caption"
                                color="text.secondary"
                                noWrap
                                display="block"
                                sx={{
                                  fontSize: "0.66rem",
                                  lineHeight: 1.2,
                                  mt: 0.2,
                                }}
                              >
                                {user.email}
                              </Typography>

                              {user.mobile && (
                                <Typography
                                  variant="caption"
                                  display="block"
                                  color="text.secondary"
                                  noWrap
                                  sx={{
                                    fontSize: "0.64rem",
                                    lineHeight: 1.2,
                                    mt: 0.15,
                                  }}
                                >
                                  {user.mobile}
                                </Typography>
                              )}
                            </Box>
                          </Stack>
                        </TableCell>

                        {/* ================================================= */}
                        {/* ROLE */}
                        {/* ================================================= */}

                        <TableCell>
                          <Chip
                            size="small"
                            label={getRoleLabel(user.role)}
                            color={getRoleColor(user.role)}
                            variant="outlined"
                            sx={{
                              height: 23,
                              fontSize: "0.65rem",
                              fontWeight: 600,
                              borderRadius: 1,
                              "& .MuiChip-label": {
                                px: 1,
                              },
                            }}
                          />
                        </TableCell>

                        {/* ================================================= */}
                        {/* ORGANISATION */}
                        {/* ================================================= */}

                        <TableCell>
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{
                              fontSize: "0.73rem",
                              color: "#344054",
                            }}
                          >
                            {user.organisation?.name || "—"}
                          </Typography>
                        </TableCell>

                        {/* ================================================= */}
                        {/* CENTRE */}
                        {/* ================================================= */}

                        <TableCell>
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{
                              fontSize: "0.73rem",
                              color: "#344054",
                            }}
                          >
                            {user.centre?.name || "—"}
                          </Typography>
                        </TableCell>

                        {/* ================================================= */}
                        {/* COURSE */}
                        {/* ================================================= */}

                        <TableCell>
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{
                              fontSize: "0.73rem",
                              color: "#344054",
                            }}
                          >
                            {user.course?.name || "—"}
                          </Typography>
                        </TableCell>

                        {/* ================================================= */}
                        {/* BATCHES */}
                        {/* ================================================= */}

                        <TableCell>
                          {batchesList.length > 0 ? (
                            <Stack
                              direction="row"
                              spacing={0.4}
                              useFlexGap
                              flexWrap="wrap"
                              sx={{
                                maxWidth: 170,
                              }}
                            >
                              {batchesList.slice(0, 2).map((batch, index) => (
                                <Chip
                                  key={
                                    typeof batch === "string"
                                      ? batch
                                      : batch?._id || index
                                  }
                                  size="small"
                                  label={
                                    typeof batch === "string"
                                      ? batch
                                      : batch?.name || "Batch"
                                  }
                                  sx={{
                                    height: 22,
                                    fontSize: "0.63rem",
                                    borderRadius: 1,
                                    backgroundColor: "#F2F4F7",
                                    color: "#344054",
                                    "& .MuiChip-label": {
                                      px: 0.8,
                                    },
                                  }}
                                />
                              ))}

                              {batchesList.length > 2 && (
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={`+${batchesList.length - 2}`}
                                  sx={{
                                    height: 22,
                                    fontSize: "0.63rem",
                                    borderRadius: 1,
                                    "& .MuiChip-label": {
                                      px: 0.8,
                                    },
                                  }}
                                />
                              )}
                            </Stack>
                          ) : (
                            <Typography
                              component="span"
                              sx={{
                                color: "#98A2B3",
                                fontSize: "0.75rem",
                              }}
                            >
                              —
                            </Typography>
                          )}
                        </TableCell>

                        {/* ================================================= */}
                        {/* STATUS */}
                        {/* ================================================= */}

                        <TableCell>
                          <Chip
                            size="small"
                            label={user.isActive ? "Active" : "Inactive"}
                            color={user.isActive ? "success" : "default"}
                            icon={user.isActive ? <CheckCircle /> : <Block />}
                            sx={{
                              height: 23,
                              fontSize: "0.65rem",
                              fontWeight: 600,
                              borderRadius: 1,
                              "& .MuiChip-icon": {
                                fontSize: 13,
                              },
                              "& .MuiChip-label": {
                                px: 0.8,
                              },
                            }}
                          />
                        </TableCell>

                        {/* ================================================= */}
                        {/* STICKY ACTIONS */}
                        {/* ================================================= */}

                        <TableCell align="right" className="sticky-action-cell">
                          <Stack
                            direction="row"
                            spacing={0.35}
                            justifyContent="flex-end"
                            alignItems="center"
                            sx={{
                              minWidth: 100,
                            }}
                          >
                            {/* EDIT */}
                            <Tooltip title="Edit User" arrow>
                              <IconButton
                                size="small"
                                onClick={() => handleEdit(user)}
                                sx={{
                                  width: 20,
                                  height: 30,
                                  borderRadius: 1,
                                  color: "#1565C0",
                                  "&:hover": {
                                    backgroundColor: "rgba(21,101,192,0.08)",
                                  },
                                }}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            {/* RESET PASSWORD */}
                            <Tooltip title="Reset Password" arrow>
                              <IconButton
                                size="small"
                                onClick={() => openPasswordDialog(user)}
                                sx={{
                                  width: 22,
                                  height: 30,
                                  borderRadius: 1,
                                  color: "#7B1FA2",
                                  "&:hover": {
                                    backgroundColor: "rgba(123,31,162,0.08)",
                                  },
                                }}
                              >
                                <LockReset fontSize="small" />
                              </IconButton>
                            </Tooltip>

                            {/* ACTIVATE / DEACTIVATE */}
                            <Tooltip
                              title={
                                user.isActive
                                  ? "Deactivate User"
                                  : "Activate User"
                              }
                              arrow
                            >
                              <IconButton
                                size="small"
                                color={user.isActive ? "warning" : "success"}
                                onClick={() => handleToggleStatus(user)}
                                sx={{
                                  width: 20,
                                  height: 30,
                                  borderRadius: 1,
                                  "&:hover": {
                                    backgroundColor: user.isActive
                                      ? "rgba(237,108,2,0.08)"
                                      : "rgba(46,125,50,0.08)",
                                  },
                                }}
                              >
                                {user.isActive ? (
                                  <Block fontSize="small" />
                                ) : (
                                  <CheckCircle fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>

                            {/* DELETE / DEACTIVATE */}
                            <Tooltip title="Deactivate" arrow>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDelete(user)}
                                disabled={!user.isActive}
                                sx={{
                                  width: 22,
                                  height: 30,
                                  borderRadius: 1,
                                  "&:hover": {
                                    backgroundColor: "rgba(211,47,47,0.08)",
                                  },
                                }}
                              >
                                <DeleteOutline fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* ============================================================= */}
          {/* PAGINATION */}
          {/* ============================================================= */}

          <Divider />

          <Box
            sx={{
              width: "100%",
              overflowX: "auto",
              backgroundColor: "#FFFFFF",
            }}
          >
            <TablePagination
              component="div"
              count={totalUsers}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(parseInt(event.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
              sx={{
                minWidth: 350,

                "& .MuiTablePagination-toolbar": {
                  minHeight: 46,
                  px: {
                    xs: 1,
                    sm: 2,
                  },
                },

                "& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows":
                  {
                    fontSize: "0.7rem",
                    color: "#667085",
                  },

                "& .MuiTablePagination-select": {
                  fontSize: "0.72rem",
                },

                "& .MuiTablePagination-actions button": {
                  width: 30,
                  height: 30,
                },
              }}
            />
          </Box>
        </Card>

        {/* ====================================================
            CREATE / EDIT DIALOG
        ==================================================== */}

        <Dialog
          open={openDialog}
          onClose={handleCloseDialog}
          fullWidth
          maxWidth="md"
          fullScreen={false}
          PaperProps={{
            sx: {
              width: "100%",
              maxWidth: "850px",
              m: {
                xs: 0.5,
                sm: 2,
              },
              borderRadius: {
                xs: 1.5,
                sm: 2,
              },
              maxHeight: {
                xs: "calc(100% - 8px)",
                sm: "calc(100% - 32px)",
              },
            },
          }}
        >
          <DialogTitle
            sx={{
              fontWeight: 800,
              fontSize: {
                xs: "1rem",
                sm: "1.15rem",
              },
              px: {
                xs: 2,
                sm: 2.5,
              },
              py: 1.5,
            }}
          >
            {editingUser ? "Edit User" : "Create New User"}
          </DialogTitle>

          <DialogContent
            dividers
            sx={{
              px: {
                xs: 1.5,
                sm: 2.5,
              },
              py: 2,
              overflowX: "hidden",
            }}
          >
            {formError && (
              <Alert
                severity="error"
                sx={{
                  mb: 1.5,
                  py: 0.5,
                }}
                onClose={() => setFormError("")}
              >
                {formError}
              </Alert>
            )}

            <Grid container spacing={1.5}>
              {/* NAME */}

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Full Name"
                  value={form.name}
                  onChange={handleFieldChange("name")}
                  required
                />
              </Grid>

              {/* EMAIL */}

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={handleFieldChange("email")}
                  required
                />
              </Grid>

              {/* MOBILE */}

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Mobile"
                  value={form.mobile}
                  onChange={handleFieldChange("mobile")}
                />
              </Grid>

              {/* ROLE */}

              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Role</InputLabel>

                  <Select
                    value={form.role}
                    label="Role"
                    onChange={handleRoleChange}
                  >
                    {ROLES.map((role) => (
                      <MenuItem key={role.value} value={role.value}>
                        <Box>
                          <Typography
                            variant="body2"
                            fontWeight={700}
                            sx={{
                              fontSize: "0.78rem",
                            }}
                          >
                            {role.label}
                          </Typography>

                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{
                              fontSize: "0.65rem",
                            }}
                          >
                            {role.description}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* PASSWORD */}

              {!editingUser && (
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Password"
                    type="password"
                    value={form.password}
                    onChange={handleFieldChange("password")}
                    required
                  />
                </Grid>
              )}

              {/* ACTIVE */}

              <Grid item xs={12} md={6}>
                <Box
                  sx={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    px: 0.5,
                  }}
                >
                  <FormControlLabel
                    control={
                      <Switch
                        size="small"
                        checked={form.isActive}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            isActive: event.target.checked,
                          }))
                        }
                      />
                    }
                    label="Active User"
                    sx={{
                      "& .MuiFormControlLabel-label": {
                        fontSize: "0.78rem",
                      },
                    }}
                  />
                </Box>
              </Grid>

              {/* ==================================================
                  ORGANISATION HIERARCHY
              ================================================== */}

              {form.role !== "super_admin" && (
                <>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 0.5 }}>
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        color="text.secondary"
                        sx={{
                          fontSize: "0.65rem",
                        }}
                      >
                        ORGANISATION HIERARCHY
                      </Typography>
                    </Divider>
                  </Grid>

                  {/* ORGANISATION */}

                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Organisation</InputLabel>

                      <Select
                        value={form.organisation}
                        label="Organisation"
                        onChange={handleOrganisationChange}
                        disabled={hierarchyLoading}
                      >
                        <MenuItem value="">Select Organisation</MenuItem>

                        {organisations.map((org) => (
                          <MenuItem key={org._id} value={org._id}>
                            {org.name}
                            {org.code ? ` (${org.code})` : ""}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* CENTRE */}

                  {["centre_admin", "teacher", "student"].includes(
                    form.role,
                  ) && (
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Centre</InputLabel>

                        <Select
                          value={form.centre}
                          label="Centre"
                          onChange={handleCentreChange}
                          disabled={!form.organisation || hierarchyLoading}
                        >
                          <MenuItem value="">Select Centre</MenuItem>

                          {centres.map((centre) => (
                            <MenuItem key={centre._id} value={centre._id}>
                              {centre.name}
                              {centre.code ? ` (${centre.code})` : ""}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  )}

                  {/* COURSE */}

                  {["teacher", "student"].includes(form.role) && (
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Course</InputLabel>

                        <Select
                          value={form.course}
                          label="Course"
                          onChange={handleCourseChange}
                          disabled={!form.centre || hierarchyLoading}
                        >
                          <MenuItem value="">Select Course</MenuItem>

                          {courses.map((course) => (
                            <MenuItem key={course._id} value={course._id}>
                              {course.name}
                              {course.code ? ` (${course.code})` : ""}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  )}

                  {/* TEACHER BATCH */}

                  {form.role === "teacher" && (
                    <Grid item xs={12}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Assign Batches</InputLabel>

                        <Select
                          multiple
                          value={form.batches}
                          onChange={handleBatchChange}
                          input={<OutlinedInput label="Assign Batches" />}
                          disabled={!form.course || hierarchyLoading}
                          renderValue={(selected) => (
                            <Stack
                              direction="row"
                              spacing={0.4}
                              useFlexGap
                              flexWrap="wrap"
                              sx={{
                                maxWidth: "100%",
                              }}
                            >
                              {selected.map((id) => {
                                const batch = batches.find(
                                  (item) => item._id === id,
                                );

                                return (
                                  <Chip
                                    key={id}
                                    size="small"
                                    label={batch?.name || id}
                                    sx={{
                                      height: 23,
                                      fontSize: "0.65rem",
                                    }}
                                  />
                                );
                              })}
                            </Stack>
                          )}
                        >
                          {batches.map((batch) => (
                            <MenuItem key={batch._id} value={batch._id}>
                              {batch.name}
                              {batch.code ? ` (${batch.code})` : ""}
                            </MenuItem>
                          ))}
                        </Select>

                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            mt: 0.5,
                            ml: 1,
                            fontSize: "0.65rem",
                          }}
                        >
                          Teacher can be assigned to multiple batches.
                        </Typography>
                      </FormControl>
                    </Grid>
                  )}

                  {/* STUDENT BATCH */}

                  {form.role === "student" && (
                    <>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Batch</InputLabel>

                          <Select
                            value={form.batches[0] || ""}
                            label="Batch"
                            onChange={handleBatchChange}
                            disabled={!form.course || hierarchyLoading}
                          >
                            <MenuItem value="">Select Batch</MenuItem>

                            {batches.map((batch) => (
                              <MenuItem key={batch._id} value={batch._id}>
                                {batch.name}
                                {batch.code ? ` (${batch.code})` : ""}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      {/* STUDENT PROFILE */}

                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Student Profile</InputLabel>

                          <Select
                            value={form.studentId}
                            label="Student Profile"
                            onChange={handleFieldChange("studentId")}
                            disabled={!form.batches[0] || hierarchyLoading}
                          >
                            <MenuItem value="">Select Student</MenuItem>

                            {students.map((student) => (
                              <MenuItem key={student._id} value={student._id}>
                                {student.rollNumber
                                  ? `${student.rollNumber} - `
                                  : ""}
                                {student.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    </>
                  )}
                </>
              )}

              {/* SUPER ADMIN INFO */}

              {form.role === "super_admin" && (
                <Grid item xs={12}>
                  <Alert
                    severity="warning"
                    sx={{
                      py: 0.5,
                      fontSize: "0.75rem",
                    }}
                  >
                    Super Admin has global access and does not need
                    Organisation, Centre, Course or Batch assignment.
                  </Alert>
                </Grid>
              )}
            </Grid>
          </DialogContent>

          <DialogActions
            sx={{
              px: {
                xs: 1.5,
                sm: 2.5,
              },
              py: 1.25,
              gap: 0.75,
              flexWrap: {
                xs: "wrap",
                sm: "nowrap",
              },
            }}
          >
            <Button
              onClick={handleCloseDialog}
              disabled={formLoading}
              size="small"
              sx={{
                textTransform: "none",
                minHeight: 38,
              }}
            >
              Cancel
            </Button>

            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={formLoading}
              size="small"
              startIcon={
                formLoading ? (
                  <CircularProgress size={16} />
                ) : editingUser ? (
                  <Edit fontSize="small" />
                ) : (
                  <Add fontSize="small" />
                )
              }
              sx={{
                minWidth: 135,
                minHeight: 38,
                textTransform: "none",
                fontWeight: 700,
              }}
            >
              {formLoading
                ? "Saving..."
                : editingUser
                  ? "Update User"
                  : "Create User"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ====================================================
            PASSWORD RESET DIALOG
        ==================================================== */}

        <Dialog
          open={passwordDialog}
          onClose={closePasswordDialog}
          fullWidth
          maxWidth="xs"
          PaperProps={{
            sx: {
              m: {
                xs: 1,
                sm: 2,
              },
              width: "100%",
              borderRadius: 2,
            },
          }}
        >
          <DialogTitle
            sx={{
              fontWeight: 800,
              fontSize: "1rem",
              py: 1.5,
            }}
          >
            Reset Password
          </DialogTitle>

          <DialogContent
            dividers
            sx={{
              px: {
                xs: 1.5,
                sm: 2.5,
              },
              py: 1.75,
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mb: 1.5,
                fontSize: "0.75rem",
              }}
            >
              Reset password for <b>{passwordUser?.name}</b>.
            </Typography>

            {passwordError && (
              <Alert
                severity="error"
                sx={{
                  mb: 1.5,
                  py: 0.5,
                }}
              >
                {passwordError}
              </Alert>
            )}

            <TextField
              fullWidth
              size="small"
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoFocus
            />
          </DialogContent>

          <DialogActions
            sx={{
              px: {
                xs: 1.5,
                sm: 2.5,
              },
              py: 1.25,
            }}
          >
            <Button
              onClick={closePasswordDialog}
              disabled={passwordLoading}
              size="small"
              sx={{
                textTransform: "none",
              }}
            >
              Cancel
            </Button>

            <Button
              variant="contained"
              onClick={handleResetPassword}
              disabled={passwordLoading}
              size="small"
              startIcon={
                passwordLoading ? (
                  <CircularProgress size={16} />
                ) : (
                  <LockReset fontSize="small" />
                )
              }
              sx={{
                textTransform: "none",
                fontWeight: 700,
              }}
            >
              Reset Password
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  );
}

// ============================================================
// STAT CARD
// ============================================================
const StatCard = ({ title, value, icon, subtitle, accent = "primary" }) => {
  const accentColors = {
    primary: "#1565C0",
    success: "#2E7D32",
    info: "#0288D1",
    warning: "#ED6C02",
  };

  const color = accentColors[accent] || accentColors.primary;

  return (
    <Card
      elevation={0}
      sx={{
        width: "100%",
        height: 60,
        borderRadius: 1.5,
        border: "1px solid #E6EAF0",
        backgroundColor: "#FFFFFF",
        overflow: "hidden",
        transition: "all 0.2s ease",
        "&:hover": {
          transform: "translateY(-1px)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
        },
      }}
    >
      <CardContent
        sx={{
          height: "100%",
          p: "8px 12px !important",
          display: "flex",
          alignItems: "center",
        }}
      >
        {/* Icon */}
        <Box
          sx={{
            width: 34,
            height: 34,
            minWidth: 34,
            borderRadius: 1.2,
            mr: 1.2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: `${color}12`,
            color: color,
            "& svg": {
              fontSize: 19,
            },
          }}
        >
          {icon}
        </Box>

        {/* Title + Subtitle */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <Typography
            sx={{
              fontSize: "0.78rem",
              fontWeight: 700,
              color: "#344054",
              lineHeight: 1.15,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </Typography>

          <Typography
            sx={{
              mt: 0.3,
              fontSize: "0.64rem",
              fontWeight: 500,
              color: "#98A2B3",
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {subtitle}
          </Typography>
        </Box>

        {/* Count */}
        <Typography
          sx={{
            ml: 1,
            fontSize: "1.3rem",
            fontWeight: 800,
            color: "#101828",
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
};
// ============================================================
// ROLE SUMMARY
// ============================================================

function RoleSummary({ label, value }) {
  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.7,
        px: 1,
        py: 0.55,
        borderRadius: 1.5,
        backgroundColor: "#f8fafc",
        border: "1px solid #e2e8f0",
        minHeight: 30,
        maxWidth: "100%",
      }}
    >
      <Typography
        sx={{
          fontSize: {
            xs: "0.64rem",
            sm: "0.68rem",
          },
          fontWeight: 600,
          color: "#64748b",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </Typography>

      <Box
        sx={{
          minWidth: 22,
          height: 21,
          px: 0.6,
          borderRadius: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#2563eb",
          color: "#fff",
        }}
      >
        <Typography
          sx={{
            fontSize: "0.65rem",
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          {Number(value || 0)}
        </Typography>
      </Box>
    </Box>
  );
}
