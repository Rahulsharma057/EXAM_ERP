'use client';

import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useRouter } from 'next/navigation';

import {
  Box,
  Typography,
  Paper,
  Button,
  Stack,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Pagination,
  CircularProgress,
  Divider,
} from '@mui/material';

import VisibilityIcon from '@mui/icons-material/Visibility';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import EventNoteIcon from '@mui/icons-material/EventNote';
import GroupsIcon from '@mui/icons-material/Groups';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

import Layout from '../../components/common/Layout';
import HierarchyFilter from '../../components/assessment/HierarchyFilter';
import { api } from '../../services/api';

// ============================================================
// BRAND TOKENS — Sleepwell inspired: deep navy + signature red
// ============================================================

const brand = {
  navy: '#0B2A4A',
  navyDeep: '#071D34',
  red: '#E01E26',
  redDeep: '#B8151C',
  paper: '#FFFFFF',
  canvas: '#F5F6FA',
  line: '#E4E7EE',
  ink: '#101828',
  slate: '#5B6472',
  slateLight: '#8A93A2',
};

const STATUS_STYLES = {
  PUBLISHED: {
    bg: '#E9F7EE',
    fg: '#1C7C3F',
    dot: '#2FA84F',
    label: 'Published',
  },
  CLOSED: {
    bg: '#FDECEC',
    fg: brand.redDeep,
    dot: brand.red,
    label: 'Closed',
  },
  ARCHIVED: {
    bg: '#EEF0F4',
    fg: brand.slate,
    dot: brand.slateLight,
    label: 'Archived',
  },
  DRAFT: {
    bg: '#FFF6E5',
    fg: '#946A00',
    dot: '#E0A400',
    label: 'Draft',
  },
};

const statusStyle = (status) =>
  STATUS_STYLES[status] || STATUS_STYLES.ARCHIVED;

const LIMIT = 20;

export default function ResultsPage() {
  const router = useRouter();

  const [filters, setFilters] = useState({});
  const [assessments, setAssessments] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ==========================================================
  // LOAD
  // ==========================================================

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError('');

        const params = {
          ...filters,
          page,
          limit: LIMIT,
          status: 'PUBLISHED',
        };

        const res = await api.getAssessments(params);

        if (!mounted) return;

        setAssessments(res?.data || []);
        setTotal(res?.pagination?.total || 0);
      } catch (err) {
        console.error('LOAD ASSESSMENTS ERROR:', err);

        if (!mounted) return;

        setError(
          err?.message ||
            'Could not load assessments. Please try again.'
        );
        setAssessments([]);
        setTotal(0);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [filters, page]);

  // ==========================================================
  // STATS STRIP — derived from what's actually on screen
  // ==========================================================

  const stats = useMemo(() => {
    const batchesInView = new Set(
      assessments
        .map((a) => a.batch?._id || a.batch)
        .filter(Boolean)
    ).size;

    const currentWeek = assessments.reduce(
      (max, a) => Math.max(max, Number(a.weekNumber) || 0),
      0
    );

    return {
      total,
      batchesInView,
      currentWeek,
    };
  }, [assessments, total]);

  const totalPages = Math.max(
    Math.ceil(total / LIMIT),
    1
  );

  const rangeStart = total === 0 ? 0 : (page - 1) * LIMIT + 1;
  const rangeEnd = Math.min(page * LIMIT, total);

  return (
    <Layout>
      <Box sx={{ bgcolor: "brand.canvas", minHeight: '100%' }}>
        {/* ====================================================
            HEADER BAND
        ===================================================== */}

        <Box
          sx={{
            background: "rgb(24, 45, 139)",
            color: '#fff',
            px: { xs: 2.5, md: 5 },
            py: { xs: 3.5, md: 3 },
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* subtle accent shape — the one bold move */}
          <Box
            sx={{
              position: 'absolute',
              top: -60,
              right: -60,
              width: 220,
              height: 220,
              borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, ${brand.red}55, transparent 70%)`,
              pointerEvents: 'none',
            }}
          />

          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', md: 'flex-end' }}
            spacing={2}
            sx={{ position: 'relative' }}
          >
            <Box>
           {/*    <Typography
                variant="overline"
                sx={{
                  color: brand.red,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                }}
              >
                Sleepwell Foundation
              </Typography> */}

              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  lineHeight: 1.2,
                  mt: 0.5,
                }}
              >
                Results Dashboard
              </Typography>

              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.75)',
                  mt: 0.75,
                  maxWidth: 480,
                }}
              >
                Every published assessment across your batches, in one place.
              </Typography>
            </Box>

            {/* -------------------------------------------------
                STAT STRIP
            -------------------------------------------------- */}

            <Stack
              direction="row"
              spacing={{ xs: 1.5, sm: 2 }}
              sx={{ width: { xs: '100%', md: 'auto' } }}
            >
              <StatPill
                icon={<AssignmentTurnedInIcon />}
                value={stats.total}
                label="Published"
              />
              <StatPill
                icon={<GroupsIcon />}
                value={stats.batchesInView}
                label="Batches shown"
              />
              <StatPill
                icon={<EventNoteIcon />}
                value={stats.currentWeek || '—'}
                label="Latest week"
              />
            </Stack>
          </Stack>
        </Box>

        {/* ====================================================
            BODY
        ===================================================== */}

        <Box sx={{ px: { xs: 2.5, md: 2 }, py: { xs: 3, md: 2 } }}>
          {/* FILTER CARD */}

          <Paper
            elevation={0}
            sx={{
              p: { xs: 2, md: 2.5 },
              mb: 3,
              borderRadius: 2.5,
              border: `1px solid ${brand.line}`,
            }}
          >
            <Typography
              sx={{
                fontWeight: 700,
                color: brand.ink,
                mb: 1.5,
                fontSize: 15,
              }}
            >
              Filter results
            </Typography>

            <HierarchyFilter
              onChange={(next) => {
                setPage(1);
                setFilters(next);
              }}
              values={filters}
            />
          </Paper>

          {/* ==================================================
              TABLE CARD
          =================================================== */}

          <Paper
            elevation={0}
            sx={{
              borderRadius: 2.5,
              border: `1px solid ${brand.line}`,
              overflow: 'hidden',
            }}
          >
            {loading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState message={error} />
            ) : assessments.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {/* Desktop / tablet table */}
                <Box
                  sx={{
                    display: { xs: 'none', sm: 'block' },
                  }}
                >
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          {[
                            'Assessment',
                            'Week',
                            'Batch',
                            'Status',
                            '',
                          ].map((label, i) => (
                            <TableCell
                              key={label || `col-${i}`}
                              sx={{
                                bgcolor: brand.canvas,
                                color: brand.slate,
                                fontWeight: 700,
                                fontSize: 12.5,
                                letterSpacing: '0.02em',
                                borderBottom: `1px solid ${brand.line}`,
                              }}
                            >
                              {label}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>

                      <TableBody>
                        {assessments.map((a) => (
                          <ResultRow
                            key={a._id}
                            assessment={a}
                            onView={() =>
                              router.push(
                                `/assessments/${a._id}/results`
                              )
                            }
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>

                {/* Mobile stacked cards */}
                <Box
                  sx={{
                    display: { xs: 'block', sm: 'none' },
                    p: 1.5,
                  }}
                >
                  <Stack spacing={1.25} divider={<Divider />}>
                    {assessments.map((a) => (
                      <ResultCardMobile
                        key={a._id}
                        assessment={a}
                        onView={() =>
                          router.push(
                            `/assessments/${a._id}/results`
                          )
                        }
                      />
                    ))}
                  </Stack>
                </Box>

                {/* FOOTER: range + pagination */}

                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems="center"
                  spacing={1.5}
                  sx={{
                    px: { xs: 2, sm: 3 },
                    py: 2,
                    borderTop: `1px solid ${brand.line}`,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ color: brand.slate }}
                  >
                    Showing {rangeStart}–{rangeEnd} of {total}
                  </Typography>

                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={(e, v) => setPage(v)}
                    shape="rounded"
                    sx={{
                      '& .Mui-selected': {
                        bgcolor: `${brand.navy} !important`,
                        color: '#fff',
                      },
                    }}
                  />
                </Stack>
              </>
            )}
          </Paper>
        </Box>
      </Box>
    </Layout>
  );
}

// ============================================================
// STAT PILL
// ============================================================

function StatPill({ icon, value, label }) {
  return (
    <Box
      sx={{
        bgcolor: 'rgb(47, 28, 116)',
        border: '1px solid rgba(23, 18, 114, 0.94)',
        borderRadius: 2,
        px: 2,
        py: 1.25,
        minWidth: 108,
        flex: { xs: 1, md: 'initial' },
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center">
        <Box
          sx={{
            color: '#fff',
            opacity: 0.85,
            display: 'flex',
            '& svg': { fontSize: 18 },
          }}
        >
          {icon}
        </Box>

        <Typography
          sx={{ color: '#fff', fontWeight: 700, fontSize: 20 }}
        >
          {value}
        </Typography>
      </Stack>

      <Typography
        sx={{
          color: 'rgba(255,255,255,0.65)',
          fontSize: 12,
          mt: 0.25,
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}

// ============================================================
// DESKTOP ROW
// ============================================================

function ResultRow({ assessment, onView }) {
  const style = statusStyle(assessment.status);

  return (
    <TableRow
      hover
      sx={{
        '&:last-of-type td': { borderBottom: 'none' },
        borderLeft: `3px solid ${style.dot}`,
      }}
    >
      <TableCell sx={{ borderBottom: `1px solid ${brand.line}` }}>
        <Typography sx={{ fontWeight: 600, color: brand.ink }}>
          {assessment.name}
        </Typography>
        {assessment.code && (
          <Typography
            variant="caption"
            sx={{ color: brand.slateLight }}
          >
            {assessment.code}
          </Typography>
        )}
      </TableCell>

      <TableCell sx={{ borderBottom: `1px solid ${brand.line}` }}>
        <Typography
          sx={{
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 13.5,
            color: brand.slate,
          }}
        >
          Week {assessment.weekNumber}
        </Typography>
      </TableCell>

      <TableCell sx={{ borderBottom: `1px solid ${brand.line}` }}>
        <Typography sx={{ color: brand.ink, fontSize: 14 }}>
          {assessment.batch?.name || '—'}
        </Typography>
      </TableCell>

      <TableCell sx={{ borderBottom: `1px solid ${brand.line}` }}>
        <Chip
          size="small"
          label={style.label}
          sx={{
            bgcolor: style.bg,
            color: style.fg,
            fontWeight: 700,
            fontSize: 12,
            '& .MuiChip-label': { px: 1.25 },
          }}
        />
      </TableCell>

      <TableCell
        align="right"
        sx={{ borderBottom: `1px solid ${brand.line}` }}
      >
        <Button
          size="small"
          onClick={onView}
          endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            color: brand.red,
            '&:hover': {
              bgcolor: 'rgba(224,30,38,0.08)',
            },
          }}
        >
          View results
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ============================================================
// MOBILE CARD
// ============================================================

function ResultCardMobile({ assessment, onView }) {
  const style = statusStyle(assessment.status);

  return (
    <Box
      sx={{
        borderLeft: `3px solid ${style.dot}`,
        pl: 1.5,
        py: 0.5,
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
      >
        <Box>
          <Typography sx={{ fontWeight: 600, color: brand.ink }}>
            {assessment.name}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: brand.slateLight }}
          >
            Week {assessment.weekNumber} · {assessment.batch?.name || '—'}
          </Typography>
        </Box>

        <Chip
          size="small"
          label={style.label}
          sx={{
            bgcolor: style.bg,
            color: style.fg,
            fontWeight: 700,
            fontSize: 11,
          }}
        />
      </Stack>

      <Button
        fullWidth
        size="small"
        variant="outlined"
        startIcon={<VisibilityIcon sx={{ fontSize: 16 }} />}
        onClick={onView}
        sx={{
          mt: 1.25,
          textTransform: 'none',
          fontWeight: 700,
          borderColor: brand.line,
          color: brand.navy,
        }}
      >
        View results
      </Button>
    </Box>
  );
}

// ============================================================
// STATES
// ============================================================

function LoadingState() {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={1.5}
      sx={{ py: 8 }}
    >
      <CircularProgress size={28} sx={{ color: brand.navy }} />
      <Typography sx={{ color: brand.slate, fontSize: 14 }}>
        Loading assessments…
      </Typography>
    </Stack>
  );
}

function ErrorState({ message }) {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={1}
      sx={{ py: 8, px: 3, textAlign: 'center' }}
    >
      <Typography sx={{ fontWeight: 700, color: brand.ink }}>
        Couldn't load results
      </Typography>
      <Typography sx={{ color: brand.slate, fontSize: 14 }}>
        {message}
      </Typography>
    </Stack>
  );
}

function EmptyState() {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={1}
      sx={{ py: 8, px: 3, textAlign: 'center' }}
    >
      <AssignmentTurnedInIcon
        sx={{ fontSize: 36, color: brand.slateLight }}
      />
      <Typography sx={{ fontWeight: 700, color: brand.ink }}>
        No published assessments yet
      </Typography>
      <Typography sx={{ color: brand.slate, fontSize: 14, maxWidth: 320 }}>
        Once an assessment is published for one of your batches, it will show up here with its results.
      </Typography>
    </Stack>
  );
}