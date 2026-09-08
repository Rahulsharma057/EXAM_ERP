"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import {
  Box,
  CircularProgress,
  Typography,
} from "@mui/material";

const theme = createTheme({
  palette: {
    primary: {
      main: "#184577",
      dark: "#0D47A1",
      light: "#E3F2FD",
      contrastText: "#FFFFFF",
    },

    secondary: {
      main: "#D32F2F",
      dark: "#B71C1C",
      light: "#FFEBEE",
      contrastText: "#FFFFFF",
    },

    background: {
      default: "#F5F7FB",
      paper: "#FFFFFF",
    },

    text: {
      primary: "#172033",
      secondary: "#64748B",
    },
  },

  typography: {
    fontFamily: [
      "Inter",
      "Roboto",
      "Arial",
      "sans-serif",
    ].join(","),
  },

  shape: {
    borderRadius: 10,
  },

  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },

      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 700,
          borderRadius: 10,
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },

    MuiTextField: {
      defaultProps: {
        size: "small",
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: "none",
        },
      },
    },
  },
});

export default function RootLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  const [authChecking, setAuthChecking] = useState(true);

  // ----------------------------------------------------------
  // PUBLIC ROUTES
  // ----------------------------------------------------------

  const isLoginPage = pathname === "/login";

  // ----------------------------------------------------------
  // AUTH CHECK
  // ----------------------------------------------------------

  useEffect(() => {
    // Login page ko kabhi protect mat karo
    if (isLoginPage) {
      setAuthChecking(false);
      return;
    }

    // Browser only
    if (typeof window === "undefined") {
      return;
    }

    const token = localStorage.getItem("token");

    console.log("AUTH CHECK:", {
      pathname,
      hasToken: !!token,
    });

    // --------------------------------------------------------
    // TOKEN NAHI HAI
    // --------------------------------------------------------

    if (!token) {
      router.replace("/login");
      return;
    }

    // --------------------------------------------------------
    // TOKEN HAI
    // --------------------------------------------------------

    setAuthChecking(false);
  }, [pathname, router, isLoginPage]);

  // ----------------------------------------------------------
  // AUTH CHECKING SCREEN
  // ----------------------------------------------------------

  if (authChecking && !isLoginPage) {
    return (
      <html lang="en">
        <head>
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          />
        </head>

        <body>
          <ThemeProvider theme={theme}>
            <CssBaseline />

            <Box
              sx={{
                minHeight: "100vh",
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: 2,
                bgcolor: "#F5F7FB",
              }}
            >
              <CircularProgress
                size={32}
                thickness={4}
                sx={{
                  color: "#184577",
                }}
              />

              <Typography
                sx={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#64748B",
                }}
              >
                Checking authentication...
              </Typography>
            </Box>
          </ThemeProvider>
        </body>
      </html>
    );
  }

  // ----------------------------------------------------------
  // NORMAL APP
  // ----------------------------------------------------------

  return (
    <html lang="en">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
      </head>

      <body>
        <ThemeProvider theme={theme}>
          <CssBaseline />

          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}