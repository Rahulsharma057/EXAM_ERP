
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
} from "@mui/material";

import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

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

        // ---------------------------------------------------
        // CHECK TOKEN
        // ---------------------------------------------------

        if (!res?.token) {
          throw new Error(
            "Login successful but authentication token was not received."
          );
        }

        // ---------------------------------------------------
        // SAVE TOKEN
        // ---------------------------------------------------

        localStorage.setItem("token", res.token);

        console.log(
          "TOKEN SAVED:",
          !!localStorage.getItem("token")
        );

        // ---------------------------------------------------
        // GO TO DASHBOARD
        // ---------------------------------------------------

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
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        p: 2,
      }}
    >
      <Fade in>
        <Paper
          elevation={10}
          sx={{
            p: {
              xs: 3,
              md: 5,
            },
            width: "100%",
            maxWidth: 450,
            borderRadius: 3,
          }}
        >
          {/* =================================================
              HEADER
          ================================================= */}

          <Box
            sx={{
              textAlign: "center",
              mb: 3,
            }}
          >
            <Avatar
              sx={{
                m: "0 auto",
                bgcolor: "primary.main",
                width: 64,
                height: 64,
                mb: 2,
              }}
            >
              <LockOutlinedIcon fontSize="large" />
            </Avatar>

            <Typography
              variant="h4"
              fontWeight="bold"
              color="primary"
            >
              Weekly Assessment ERP
            </Typography>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 0.5,
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
                mb: 2,
                borderRadius: 2,
              }}
            >
              {error}
            </Alert>
          )}

          {/* =================================================
              FORM
          ================================================= */}

          <form onSubmit={handleSubmit}>
            {/* NAME */}

            {!isLogin && (
              <TextField
                label="Full Name"
                fullWidth
                margin="normal"
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
              margin="normal"
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
              type="password"
              fullWidth
              margin="normal"
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
            />

            {/* ROLE */}

            {!isLogin && (
              <FormControl
                fullWidth
                margin="normal"
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
              size="large"
              sx={{
                mt: 2,
                py: 1.5,
                borderRadius: 2,
                fontWeight: "bold",
              }}
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : isLogin
                ? "Sign In"
                : "Create Account"}
            </Button>
          </form>

          {/* =================================================
              DIVIDER
          ================================================= */}

          <Divider sx={{ my: 2 }}>
            <Chip
              label="OR"
              size="small"
            />
          </Divider>

          {/* =================================================
              LOGIN / REGISTER TOGGLE
          ================================================= */}

          <Button
            fullWidth
            variant="text"
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
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

