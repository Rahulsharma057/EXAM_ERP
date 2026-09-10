"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  Avatar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Fade,
  Chip,
  InputAdornment,
  IconButton,
} from "@mui/material";

import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

import { api } from "../../services/api";

export default function LoginPage() {
  const router = useRouter();

  const [isLogin, setIsLogin] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("teacher");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      // =====================================================
      // LOGIN
      // =====================================================

      if (isLogin) {
        const res = await api.login({
          email,
          password,
        });

        console.log("LOGIN RESPONSE:", res);

        if (!res?.token) {
          throw new Error(
            "Login successful but authentication token was not received."
          );
        }

        localStorage.setItem("token", res.token);

        // This is a DIRECT login (typed on this app's own login page), not
        // an SSO handoff from the portal - clear any leftover portal marker
        // from a previous SSO session so the "Switch app" menu in the
        // navbar doesn't wrongly show for a user who logged in directly.
        localStorage.removeItem("sso_portal_url");

        console.log(
          "TOKEN SAVED:",
          !!localStorage.getItem("token")
        );

        router.replace("/");
      }

      // =====================================================
      // REGISTER
      // =====================================================

      else {
        await api.register({
          name,
          email,
          password,
          role,
        });

        setIsLogin(true);
        setName("");
        setEmail("");
        setPassword("");
        setRole("teacher");
        setError("");

        alert("Registration successful! Please login.");
      }
    } catch (err) {
      console.error("LOGIN ERROR:", err);

      setError(
        err?.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "auto",

        backgroundImage: `
          linear-gradient(
            135deg,
            rgba(0, 0, 0, 0.72),
            rgba(35, 35, 35, 0.48)
          ),
          url("/images/login-bg.png")
        `,

        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",

        px: {
          xs: 1.5,
          sm: 2,
          md: 3,
        },

        py: {
          xs: 2,
          sm: 3,
        },
      }}
    >
      <Fade in timeout={450}>
        <Paper
          elevation={12}
          sx={{
            width: "100%",

            /*
             * Desktop width
             */
            maxWidth: {
              xs: 360,
              sm: 400,
              md: 400,
            },

            /*
             * Compact padding
             */
            p: {
              xs: 2.2,
              sm: 3,
              md: 3.5,
            },

            borderRadius: {
              xs: 2.5,
              sm: 3,
            },

            backgroundColor: "rgba(255,255,255,0.96)",

            backdropFilter: "blur(12px)",

            border:
              "1px solid rgba(255,255,255,0.7)",

            boxShadow:
              "0 18px 50px rgba(0,0,0,0.25)",
          }}
        >
          {/* =================================================
              HEADER
          ================================================= */}

          <Box
            sx={{
              textAlign: "center",
              mb: {
                xs: 2,
                sm: 2.5,
              },
            }}
          >
            <Avatar
              sx={{
                width: {
                  xs: 48,
                  sm: 54,
                },

                height: {
                  xs: 48,
                  sm: 54,
                },

                mx: "auto",

                mb: {
                  xs: 1,
                  sm: 1.3,
                },

                bgcolor: "#1565C0",

                boxShadow:
                  "0 6px 16px rgba(21,101,192,0.3)",
              }}
            >
              <LockOutlinedIcon
                sx={{
                  fontSize: {
                    xs: 24,
                    sm: 28,
                  },
                }}
              />
            </Avatar>

            <Typography
              sx={{
                fontWeight: 800,
                color: "#184577",

                fontSize: {
                  xs: "1.35rem",
                  sm: "1.55rem",
                  md: "1.7rem",
                },

                lineHeight: 1.2,
              }}
            >
              Weekly Assessment ERP
            </Typography>

            <Typography
              sx={{
                mt: 0.5,
                color: "text.secondary",
                fontSize: {
                  xs: "0.78rem",
                  sm: "0.82rem",
                },
              }}
            >
              {isLogin
                ? "Sign in to your account"
                : "Create a new account"}
            </Typography>
          </Box>

          {/* =================================================
              ERROR
          ================================================= */}

          {error && (
            <Alert
              severity="error"
              sx={{
                mb: 1.5,
                py: 0.3,
                px: 1.2,
                borderRadius: 1.5,

                "& .MuiAlert-message": {
                  fontSize: "0.8rem",
                },
              }}
            >
              {error}
            </Alert>
          )}

          {/* =================================================
              FORM
          ================================================= */}

          <Box
            component="form"
            onSubmit={handleSubmit}
          >
            {/* NAME */}

            {!isLogin && (
              <TextField
                label="Full Name"
                fullWidth
                size="small"
                margin="dense"
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                required
              />
            )}

            {/* EMAIL */}

            <TextField
              label="Email Address"
              type="email"
              fullWidth
              size="small"
              margin="dense"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
              autoComplete="email"
            />

            {/* PASSWORD */}

            <TextField
              label="Password"
              type={showPassword ? "text" : "password"}
              fullWidth
              size="small"
              margin="dense"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              required
              autoComplete={
                isLogin
                  ? "current-password"
                  : "new-password"
              }
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      edge="end"
                      onClick={() =>
                        setShowPassword(
                          (prev) => !prev
                        )
                      }
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <VisibilityOffIcon fontSize="small" />
                      ) : (
                        <VisibilityIcon fontSize="small" />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {/* ROLE */}

            {!isLogin && (
              <FormControl
                fullWidth
                size="small"
                margin="dense"
              >
                <InputLabel>
                  Role
                </InputLabel>

                <Select
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value)
                  }
                  label="Role"
                >
                  <MenuItem value="super_admin">
                    Super Admin
                  </MenuItem>

                  <MenuItem value="org_admin">
                    Organisation Admin
                  </MenuItem>

                  <MenuItem value="centre_admin">
                    Centre Admin
                  </MenuItem>

                  <MenuItem value="teacher">
                    Teacher
                  </MenuItem>

                  <MenuItem value="student">
                    Student
                  </MenuItem>
                </Select>
              </FormControl>
            )}

            {/* SUBMIT */}

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="medium"
              disabled={loading}
              sx={{
                mt: 1.5,
                minHeight: 42,
                borderRadius: 1.5,
                fontWeight: 700,
                fontSize: "0.9rem",

                backgroundColor: "#1565C0",

                boxShadow:
                  "0 5px 12px rgba(21,101,192,0.25)",

                "&:hover": {
                  backgroundColor: "#0D47A1",
                  boxShadow:
                    "0 7px 16px rgba(13,71,161,0.3)",
                },
              }}
            >
              {loading
                ? "Please wait..."
                : isLogin
                ? "Sign In"
                : "Create Account"}
            </Button>
          </Box>

          {/* =================================================
              DIVIDER
          ================================================= */}

          <Divider
            sx={{
              my: {
                xs: 1.5,
                sm: 2,
              },
            }}
          >
            <Chip
              label="OR"
              size="small"
              sx={{
                height: 22,
                fontSize: "0.7rem",
              }}
            />
          </Divider>

          {/* =================================================
              LOGIN / REGISTER
          ================================================= */}

          <Button
            fullWidth
            variant="text"
            size="small"
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
              setShowPassword(false);
            }}
            sx={{
              minHeight: 36,
              fontWeight: 600,
              fontSize: {
                xs: "0.78rem",
                sm: "0.82rem",
              },
              color: "#1565C0",
            }}
          >
            {isLogin
              ? "Need an account? Register"
              : "Already have an account? Sign In"}
          </Button>
        </Paper>
      </Fade>
    </Box>
  );
}