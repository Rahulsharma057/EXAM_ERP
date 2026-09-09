"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box, CircularProgress, Typography, Stack } from "@mui/material";

/**
 * SSO handoff receiver for the Exam ERP app.
 *
 * The Portal (https://<your-portal>.vercel.app) redirects here as:
 *   https://exam-erp-jet.vercel.app/sso?token=<jwt>
 *
 * This page stores that token exactly the way the normal login page does
 * (see app/login/page.js: localStorage.setItem("token", res.token)) and
 * then sends the user into the app as if they'd logged in directly here.
 *
 * Install at: app/sso/page.js in the exam-erp-jet project.
 */
function SsoReceiver() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      router.replace("/login");
      return;
    }

    localStorage.setItem("token", token);

    // Hard redirect (not router.replace) so RootLayout's auth check and any
    // context providers re-initialize cleanly with the new token in place.
    window.location.replace("/");
  }, [router, searchParams]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#F5F7FB",
      }}
    >
      <Stack spacing={2} alignItems="center">
        <CircularProgress size={32} thickness={4} sx={{ color: "#184577" }} />
        <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#64748B" }}>Signing you in…</Typography>
      </Stack>
    </Box>
  );
}

export default function SsoReceiverPage() {
  return (
    <Suspense fallback={null}>
      <SsoReceiver />
    </Suspense>
  );
}
