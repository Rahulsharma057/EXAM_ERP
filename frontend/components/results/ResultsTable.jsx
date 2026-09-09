"use client";

import React, { useMemo, useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Typography,
  Box,
  Stack,
  Tooltip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Checkbox,
  FormControlLabel,
  Divider,
  Collapse,
  Grid,
  CircularProgress,
} from "@mui/material";

import VisibilityIcon from "@mui/icons-material/Visibility";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import BlockIcon from "@mui/icons-material/Block";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import SelectAllIcon from "@mui/icons-material/SelectAll";
import ClearAllIcon from "@mui/icons-material/ClearAll";

/* ============================================================
   WHAT'S IN THIS FILE
   ------------------------------------------------------------
   1. HELPERS               -- small pure functions
   2. ON-SCREEN TABLE        -- the simple 6-column list every
                                user sees (Roll No, Student,
                                Total, %, Status, Actions).
                                Per-section/per-part scores are
                                intentionally NOT shown here --
                                click the eye icon to see those
                                in StudentResultDetail instead.
   3. EXPORT DIALOG          -- the "Export Excel" button and
                                its field-picker modal. This is
                                unrelated to the on-screen table
                                and still lets you choose
                                part/section columns for the
                                downloaded file.
   ============================================================ */

// ============================================================
// 1. HELPERS
// ============================================================

const getId = (value) => {
  if (!value) return null;

  if (typeof value === "object") {
    return value._id || value.id || value.partId || value.sectionId || null;
  }

  return value;
};

const sameId = (a, b) => {
  const first = getId(a);
  const second = getId(b);

  if (!first || !second) return false;

  return String(first) === String(second);
};

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const PART_FIELDS = [
  ["attempted", "Attempted"],
  ["obtained", "Obtained"],
  ["max", "Max Marks"],
  ["percentage", "Percentage"],
];

const SECTION_FIELDS = [
  ["obtained", "Obtained"],
  ["max", "Max Marks"],
  ["percentage", "Percentage"],
];

// ============================================================
// COMPONENT
// ============================================================

export default function ResultsTable({
  results = [],
  sections = [],
  parts = [],
  hasParts = false,
  assessment = {},
  onViewStudent,
  onExportResults,
}) {
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({
    student: true,
    parts: true,
    sections: true,
    overall: true,
  });

  // ==========================================================
  // NORMALIZE (still needed for the Export dialog's field list,
  // even though the on-screen table no longer renders columns
  // per section/part)
  // ==========================================================

  const safeResults = Array.isArray(results) ? results : [];

  const rawParts =
    Array.isArray(parts) && parts.length > 0
      ? parts
      : Array.isArray(assessment?.parts)
        ? assessment.parts
        : Array.isArray(assessment?.structure?.parts)
          ? assessment.structure.parts
          : [];

  const rawSections =
    Array.isArray(sections) && sections.length > 0
      ? sections
      : Array.isArray(assessment?.sections)
        ? assessment.sections
        : Array.isArray(assessment?.structure?.sections)
          ? assessment.structure.sections
          : [];

  const safeParts = rawParts;
  const safeSections = rawSections;

  const partsMode =
    Boolean(hasParts) ||
    Boolean(assessment?.hasParts) ||
    Boolean(assessment?.structure?.hasParts) ||
    safeParts.length > 0;

  const getPartId = (part, index) => getId(part) || `part-${index}`;
  const getSectionId = (section, index) => getId(section) || `section-${index}`;

  // Used only to build the Export dialog's checkbox tree.
  const sectionColumns = useMemo(() => {
    if (!partsMode) {
      return safeSections.map((section, index) => ({
        id: getSectionId(section, index),
        name: section?.name || section?.sectionName || `Section ${index + 1}`,
        partId: null,
        partName: null,
        isOptionalPart: false,
        section,
        part: null,
        index,
      }));
    }

    const columns = [];

    safeParts.forEach((part, partIndex) => {
      const partId = getPartId(part, partIndex);
      const partName = part?.name || part?.partName || `Part ${partIndex + 1}`;

      let partSections = [];

      if (Array.isArray(part?.sections)) {
        partSections = part.sections;
      }

      if (partSections.length === 0 && safeSections.length > 0) {
        partSections = safeSections.filter(
          (section) =>
            sameId(section?.partId, partId) ||
            sameId(section?.part, partId) ||
            sameId(section?.part?._id, partId),
        );
      }

      partSections.forEach((section, sectionIndex) => {
        const sectionId = getSectionId(section, `${partIndex}-${sectionIndex}`);

        columns.push({
          id: sectionId,
          name:
            section?.name ||
            section?.sectionName ||
            `Section ${sectionIndex + 1}`,
          partId,
          partName,
          isOptionalPart: Boolean(part?.isOptional),
          section,
          part,
          partIndex,
          sectionIndex,
        });
      });
    });

    if (columns.length === 0 && safeSections.length > 0) {
      return safeSections.map((section, index) => {
        const part = section?.part || null;
        const partId = section?.partId || getId(part) || null;

        return {
          id: getSectionId(section, index),
          name: section?.name || section?.sectionName || `Section ${index + 1}`,
          partId,
          partName: section?.partName || part?.name || null,
          isOptionalPart: Boolean(section?.partIsOptional || part?.isOptional),
          section,
          part,
          index,
        };
      });
    }

    return columns;
  }, [partsMode, safeParts, safeSections]);

  const partGroups = useMemo(() => {
    if (!partsMode) return [];

    return safeParts.map((part, index) => {
      const partId = getPartId(part, index);
      const partName = part?.name || part?.partName || `Part ${index + 1}`;
      const partSections = sectionColumns.filter((section) =>
        sameId(section.partId, partId),
      );

      return {
        id: partId,
        name: partName,
        isOptional: Boolean(part?.isOptional),
        sectionCount: partSections.length,
        sections: partSections,
      };
    });
  }, [partsMode, safeParts, sectionColumns]);

  // ==========================================================
  // DEFAULT EXPORT OPTIONS
  // ==========================================================

  const createDefaultExportOptions = () => {
    const sectionOptions = {};

    sectionColumns.forEach((section) => {
      sectionOptions[String(section.id)] = {
        obtained: true,
        max: true,
        percentage: true,
      };
    });

    const partOptions = {};

    partGroups.forEach((part) => {
      partOptions[String(part.id)] = {
        selected: true,
        attempted: true,
        obtained: true,
        max: true,
        percentage: true,
      };
    });

    return {
      student: { rollNumber: true, name: true },
      parts: partOptions,
      sections: sectionOptions,
      overall: {
        totalObtained: true,
        totalMax: true,
        percentage: true,
        status: true,
      },
    };
  };

  const [exportOptions, setExportOptions] = useState(
    createDefaultExportOptions,
  );

  const getPartCheckboxState = (part) => {
    const options = exportOptions.parts?.[String(part.id)] || {};
    const selectedFields = PART_FIELDS.filter(([key]) =>
      Boolean(options[key]),
    ).length;
    const totalFields = PART_FIELDS.length;
    const checked = Boolean(options.selected) && selectedFields > 0;
    const indeterminate = selectedFields > 0 && selectedFields < totalFields;

    return { checked, indeterminate };
  };

  const getSectionCheckboxState = (section) => {
    const options = exportOptions.sections?.[String(section.id)] || {};
    const selectedFields = SECTION_FIELDS.filter(([key]) =>
      Boolean(options[key]),
    ).length;
    const totalFields = SECTION_FIELDS.length;

    return {
      checked: selectedFields === totalFields,
      indeterminate: selectedFields > 0 && selectedFields < totalFields,
    };
  };

  const resetExportOptions = () =>
    setExportOptions(createDefaultExportOptions());

  const handleOpenExport = () => {
    setExportOptions(createDefaultExportOptions());
    setExportDialogOpen(true);
  };

  const handleCloseExport = () => {
    if (exporting) return;
    setExportDialogOpen(false);
  };

  const toggleGroup = (group) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const updateStudentField = (field, checked) => {
    setExportOptions((prev) => ({
      ...prev,
      student: { ...(prev.student || {}), [field]: checked },
    }));
  };

  const togglePartSelection = (partId, checked) => {
    const key = String(partId);

    setExportOptions((prev) => {
      const currentPart = prev.parts?.[key] || {};

      const nextParts = {
        ...(prev.parts || {}),
        [key]: {
          ...currentPart,
          selected: checked,
          attempted: checked,
          obtained: checked,
          max: checked,
          percentage: checked,
        },
      };

      const nextSections = { ...(prev.sections || {}) };
      const part = partGroups.find((item) => sameId(item.id, partId));

      // Cascade this Part's checked state to all of its sections.
      part?.sections?.forEach((section) => {
        nextSections[String(section.id)] = {
          obtained: checked,
          max: checked,
          percentage: checked,
        };
      });

      return { ...prev, parts: nextParts, sections: nextSections };
    });
  };

  const updatePartField = (partId, field, checked) => {
    const key = String(partId);

    setExportOptions((prev) => {
      const current = prev.parts?.[key] || {};
      const next = { ...current, [field]: checked };
      const hasAnyField = PART_FIELDS.some(([fieldKey]) =>
        Boolean(next[fieldKey]),
      );
      next.selected = hasAnyField;

      return { ...prev, parts: { ...(prev.parts || {}), [key]: next } };
    });
  };

  const toggleSectionSelection = (sectionId, checked) => {
    const key = String(sectionId);

    setExportOptions((prev) => ({
      ...prev,
      sections: {
        ...(prev.sections || {}),
        [key]: { obtained: checked, max: checked, percentage: checked },
      },
    }));
  };

  const updateSectionField = (sectionId, field, checked) => {
    const key = String(sectionId);

    setExportOptions((prev) => ({
      ...prev,
      sections: {
        ...(prev.sections || {}),
        [key]: { ...(prev.sections?.[key] || {}), [field]: checked },
      },
    }));
  };

  const updateOverallField = (field, checked) => {
    setExportOptions((prev) => ({
      ...prev,
      overall: { ...(prev.overall || {}), [field]: checked },
    }));
  };

  const selectAllExportFields = () =>
    setExportOptions(createDefaultExportOptions());

  const hasSelectedExportFields = () => {
    const studentSelected = Object.values(exportOptions.student || {}).some(
      Boolean,
    );
    const overallSelected = Object.values(exportOptions.overall || {}).some(
      Boolean,
    );

    const partsSelected = Object.values(exportOptions.parts || {}).some(
      (part) => PART_FIELDS.some(([key]) => Boolean(part?.[key])),
    );

    const sectionsSelected = Object.values(exportOptions.sections || {}).some(
      (section) => SECTION_FIELDS.some(([key]) => Boolean(section?.[key])),
    );

    return (
      studentSelected || overallSelected || partsSelected || sectionsSelected
    );
  };

  const handleDownloadExcel = async () => {
    if (exporting || !hasSelectedExportFields()) return;

    if (!onExportResults) {
      console.error("onExportResults prop is missing");
      return;
    }

    try {
      setExporting(true);

      const cleanParts = {};

      Object.entries(exportOptions.parts || {}).forEach(([partId, values]) => {
        cleanParts[partId] = {
          attempted: Boolean(values?.attempted),
          obtained: Boolean(values?.obtained),
          max: Boolean(values?.max),
          percentage: Boolean(values?.percentage),
        };
      });

      const cleanSections = {};

      Object.entries(exportOptions.sections || {}).forEach(
        ([sectionId, values]) => {
          cleanSections[sectionId] = {
            obtained: Boolean(values?.obtained),
            max: Boolean(values?.max),
            percentage: Boolean(values?.percentage),
          };
        },
      );

      const finalOptions = {
        student: {
          rollNumber: Boolean(exportOptions.student?.rollNumber),
          name: Boolean(exportOptions.student?.name),
        },
        parts: cleanParts,
        sections: cleanSections,
        overall: {
          totalObtained: Boolean(exportOptions.overall?.totalObtained),
          totalMax: Boolean(exportOptions.overall?.totalMax),
          percentage: Boolean(exportOptions.overall?.percentage),
          status: Boolean(exportOptions.overall?.status),
        },
      };

      await onExportResults(finalOptions);
      setExportDialogOpen(false);
    } catch (error) {
      console.error("Excel export failed:", error);
    } finally {
      setExporting(false);
    }
  };

  // ==========================================================
  // EMPTY
  // ==========================================================

  if (safeResults.length === 0) {
    return (
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        No students found for this assessment.
      </Alert>
    );
  }

  // ==========================================================
  // 2. ON-SCREEN TABLE (simplified)
  // ==========================================================

  return (
    <>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: { xs: "100%", sm: "auto" },
          gap: 1.5,
          m:1
        }}
      >
        <Typography
          sx={{
            fontSize: "1rem",
            fontWeight: 800,
            color: "#151516",
          }}
        >
          Student Results
        </Typography>
        <Button
          fullWidth
          variant="contained"
          startIcon={
            exporting ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              <FileDownloadIcon />
            )
          }
          onClick={handleOpenExport}
          disabled={exporting}
          sx={{
            maxWidth: { xs: "100%", sm: 180 },
            borderRadius: 1,
            textTransform: "none",
            fontWeight: 700,
          }}
        >
          {exporting ? "Exporting..." : "Export Excel"}
        </Button>
      </Box>
      <TableContainer
        component={Paper}
        sx={{ borderRadius: 1, border: "1px solid", borderColor: "divider" }}
      >
        <Table size="small" stickyHeader>
   <TableHead
  sx={{
    backgroundColor: "#0D47A1",
    "& .MuiTableCell-root": {
      backgroundColor: "#0D47A1",
      color: "#FFFFFF",
      fontWeight: 700,
      fontSize: "0.7rem",
      borderBottom: "1px solid #0A3A82",
    },
  }}
>
            <TableRow sx={{ "& th": { bgcolor: "grey.50", fontWeight: 700 } }}>
              <TableCell sx={{ whiteSpace: "nowrap" }}>Roll No</TableCell>
              <TableCell>Student</TableCell>
              <TableCell align="center">Total</TableCell>
              <TableCell align="center">%</TableCell>
              <TableCell align="center">Status</TableCell>
              <TableCell align="center">Actions</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {safeResults.map((row, rowIndex) => {
              const student = row?.student || {};
              const studentId =
                getId(student) || row?.studentId || `student-${rowIndex}`;

              const totalObtained = Number(row?.totalObtained) || 0;
              const totalMax = Number(row?.totalMax) || 0;

              const percentage =
                row?.overallPercentage !== undefined &&
                row?.overallPercentage !== null
                  ? round2(row.overallPercentage)
                  : totalMax > 0
                    ? round2((totalObtained / totalMax) * 100)
                    : 0;

              const status = String(row?.status || "PENDING").toUpperCase();
              const completed = status === "COMPLETED";

              return (
                <TableRow
                  key={studentId}
                  hover
                  sx={{ "&:nth-of-type(odd)": { bgcolor: "action.hover" } }}
                >
                  <TableCell sx={{ whiteSpace: "nowrap" }}>
                    {student?.rollNumber || student?.rollNo || "-"}
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>
                      {student?.name || student?.fullName || "Unknown Student"}
                    </Typography>
                  </TableCell>

                  <TableCell align="center">
                    <Typography fontWeight={700}>
                      {totalObtained}/{totalMax}
                    </Typography>
                  </TableCell>

                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={`${percentage}%`}
                      color={
                        completed
                          ? percentage >= 60
                            ? "success"
                            : "warning"
                          : "default"
                      }
                      variant={completed ? "filled" : "outlined"}
                    />
                  </TableCell>

                  <TableCell align="center">
                    {completed ? (
                      <Chip
                        size="small"
                        icon={<CheckCircleIcon />}
                        label="Completed"
                        color="success"
                      />
                    ) : (
                      <Chip
                        size="small"
                        icon={<PendingActionsIcon />}
                        label="Pending"
                        color="warning"
                        variant="outlined"
                      />
                    )}
                  </TableCell>

                  <TableCell align="center">
                    <Tooltip title="View full result (part/section breakdown)">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => onViewStudent?.(studentId)}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ======================================================
          3. EXPORT DIALOG (Excel field picker -- unchanged
             behavior, just a separate concern from the table
             above)
      ====================================================== */}

      <Dialog
        open={exportDialogOpen}
        onClose={handleCloseExport}
        fullWidth
        maxWidth="md"
        PaperProps={{ sx: { borderRadius: { xs: 0, sm: 3 } } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          <Typography variant="h6" fontWeight={800}>
            Export Assessment Results
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Choose Parts, Sections and the fields you want in Excel.
          </Typography>
        </DialogTitle>

        <DialogContent dividers sx={{ maxHeight: { xs: "72vh", sm: "70vh" } }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            justifyContent="flex-end"
            mb={2}
          >
            <Button
              size="small"
              variant="outlined"
              startIcon={<SelectAllIcon />}
              onClick={selectAllExportFields}
              disabled={exporting}
            >
              Select All
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              startIcon={<ClearAllIcon />}
              onClick={resetExportOptions}
              disabled={exporting}
            >
              Reset
            </Button>
          </Stack>

          {/* STUDENT */}
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              mb: 1.5,
            }}
          >
            <Box
              sx={{ px: 2, py: 1.2, cursor: "pointer" }}
              onClick={() => toggleGroup("student")}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography fontWeight={800}>Student Information</Typography>
                {expandedGroups.student ? (
                  <ExpandLessIcon />
                ) : (
                  <ExpandMoreIcon />
                )}
              </Stack>
            </Box>
            <Collapse in={expandedGroups.student}>
              <Divider />
              <Box sx={{ p: 1.5 }}>
                <Grid container spacing={1}>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={Boolean(exportOptions.student?.rollNumber)}
                          onChange={(e) =>
                            updateStudentField("rollNumber", e.target.checked)
                          }
                          disabled={exporting}
                        />
                      }
                      label="Roll Number"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={Boolean(exportOptions.student?.name)}
                          onChange={(e) =>
                            updateStudentField("name", e.target.checked)
                          }
                          disabled={exporting}
                        />
                      }
                      label="Student Name"
                    />
                  </Grid>
                </Grid>
              </Box>
            </Collapse>
          </Box>

          {/* PART-WISE */}
          {partsMode && partGroups.length > 0 && (
            <Box
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                mb: 1.5,
              }}
            >
              <Box
                sx={{ px: 2, py: 1.2, cursor: "pointer" }}
                onClick={() => toggleGroup("parts")}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Typography fontWeight={800}>Part-wise Fields</Typography>
                  {expandedGroups.parts ? (
                    <ExpandLessIcon />
                  ) : (
                    <ExpandMoreIcon />
                  )}
                </Stack>
              </Box>
              <Collapse in={expandedGroups.parts}>
                <Divider />
                <Box sx={{ p: 1.5 }}>
                  <Stack spacing={1.5}>
                    {partGroups.map((part) => {
                      const partState = getPartCheckboxState(part);
                      const options =
                        exportOptions.parts?.[String(part.id)] || {};

                      return (
                        <Box
                          key={part.id}
                          sx={{
                            border: "1px solid",
                            borderColor: partState.checked
                              ? "primary.main"
                              : "divider",
                            borderRadius: 2,
                            overflow: "hidden",
                          }}
                        >
                          <Box
                            sx={{
                              px: 1.5,
                              py: 1,
                              bgcolor: partState.checked
                                ? "action.selected"
                                : "background.paper",
                            }}
                          >
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              justifyContent="space-between"
                              alignItems={{ xs: "flex-start", sm: "center" }}
                              spacing={1}
                            >
                              <FormControlLabel
                                sx={{ m: 0 }}
                                control={
                                  <Checkbox
                                    checked={partState.checked}
                                    indeterminate={partState.indeterminate}
                                    onChange={(e) =>
                                      togglePartSelection(
                                        part.id,
                                        e.target.checked,
                                      )
                                    }
                                    disabled={exporting}
                                  />
                                }
                                label={
                                  <Typography fontWeight={800}>
                                    {part.name}
                                  </Typography>
                                }
                              />
                              {part.isOptional && (
                                <Chip
                                  size="small"
                                  label="Optional"
                                  color="warning"
                                  variant="outlined"
                                />
                              )}
                            </Stack>
                          </Box>

                          <Divider />

                          <Box sx={{ px: 1.5, py: 1 }}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              fontWeight={700}
                            >
                              Part Fields
                            </Typography>
                            <Grid container spacing={1} mt={0.1}>
                              {PART_FIELDS.map(([key, label]) => (
                                <Grid item xs={12} sm={6} md={3} key={key}>
                                  <FormControlLabel
                                    control={
                                      <Checkbox
                                        checked={Boolean(options[key])}
                                        onChange={(e) =>
                                          updatePartField(
                                            part.id,
                                            key,
                                            e.target.checked,
                                          )
                                        }
                                        disabled={exporting}
                                      />
                                    }
                                    label={label}
                                  />
                                </Grid>
                              ))}
                            </Grid>
                          </Box>

                          {part.sections?.length > 0 && (
                            <>
                              <Divider />
                              <Box
                                sx={{
                                  px: 1.5,
                                  py: 1.2,
                                  bgcolor: "background.default",
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  fontWeight={800}
                                  color="text.secondary"
                                >
                                  Sections
                                </Typography>
                                <Stack spacing={1} mt={1}>
                                  {part.sections.map((section) => {
                                    const sectionState =
                                      getSectionCheckboxState(section);
                                    const sectionOptions =
                                      exportOptions.sections?.[
                                        String(section.id)
                                      ] || {};

                                    return (
                                      <Box
                                        key={section.id}
                                        sx={{
                                          border: "1px solid",
                                          borderColor: sectionState.checked
                                            ? "primary.main"
                                            : "divider",
                                          borderRadius: 2,
                                          bgcolor: "background.paper",
                                        }}
                                      >
                                        <Box sx={{ px: 1.5, py: 0.8 }}>
                                          <FormControlLabel
                                            sx={{ m: 0 }}
                                            control={
                                              <Checkbox
                                                checked={sectionState.checked}
                                                indeterminate={
                                                  sectionState.indeterminate
                                                }
                                                onChange={(e) =>
                                                  toggleSectionSelection(
                                                    section.id,
                                                    e.target.checked,
                                                  )
                                                }
                                                disabled={exporting}
                                              />
                                            }
                                            label={
                                              <Typography fontWeight={700}>
                                                {section.name}
                                              </Typography>
                                            }
                                          />
                                        </Box>
                                        <Divider />
                                        <Box sx={{ px: 1.5, py: 0.8 }}>
                                          <Grid container spacing={1}>
                                            {SECTION_FIELDS.map(
                                              ([key, label]) => (
                                                <Grid
                                                  item
                                                  xs={12}
                                                  sm={4}
                                                  key={key}
                                                >
                                                  <FormControlLabel
                                                    control={
                                                      <Checkbox
                                                        checked={Boolean(
                                                          sectionOptions[key],
                                                        )}
                                                        onChange={(e) =>
                                                          updateSectionField(
                                                            section.id,
                                                            key,
                                                            e.target.checked,
                                                          )
                                                        }
                                                        disabled={exporting}
                                                      />
                                                    }
                                                    label={label}
                                                  />
                                                </Grid>
                                              ),
                                            )}
                                          </Grid>
                                        </Box>
                                      </Box>
                                    );
                                  })}
                                </Stack>
                              </Box>
                            </>
                          )}
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              </Collapse>
            </Box>
          )}

          {/* DIRECT / ALL SECTIONS */}
          {sectionColumns.length > 0 && (
            <Box
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                mb: 1.5,
              }}
            >
              <Box
                sx={{ px: 2, py: 1.2, cursor: "pointer" }}
                onClick={() => toggleGroup("sections")}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <Typography fontWeight={800}>Section-wise Fields</Typography>
                  {expandedGroups.sections ? (
                    <ExpandLessIcon />
                  ) : (
                    <ExpandMoreIcon />
                  )}
                </Stack>
              </Box>
              <Collapse in={expandedGroups.sections}>
                <Divider />
                <Box sx={{ p: 1.5 }}>
                  <Stack spacing={1.5}>
                    {(!partsMode
                      ? sectionColumns
                      : sectionColumns.filter(
                          (section) =>
                            !partGroups.some((part) =>
                              sameId(part.id, section.partId),
                            ),
                        )
                    ).map((section) => {
                      const state = getSectionCheckboxState(section);
                      const options =
                        exportOptions.sections?.[String(section.id)] || {};

                      return (
                        <Box
                          key={section.id}
                          sx={{
                            border: "1px solid",
                            borderColor: state.checked
                              ? "primary.main"
                              : "divider",
                            borderRadius: 2,
                          }}
                        >
                          <Box sx={{ px: 1.5, py: 0.8 }}>
                            <FormControlLabel
                              sx={{ m: 0 }}
                              control={
                                <Checkbox
                                  checked={state.checked}
                                  indeterminate={state.indeterminate}
                                  onChange={(e) =>
                                    toggleSectionSelection(
                                      section.id,
                                      e.target.checked,
                                    )
                                  }
                                  disabled={exporting}
                                />
                              }
                              label={
                                <Typography fontWeight={700}>
                                  {section.partName
                                    ? `${section.partName} → ${section.name}`
                                    : section.name}
                                </Typography>
                              }
                            />
                          </Box>
                          <Divider />
                          <Box sx={{ px: 1.5, py: 1 }}>
                            <Grid container spacing={1}>
                              {SECTION_FIELDS.map(([key, label]) => (
                                <Grid item xs={12} sm={4} key={key}>
                                  <FormControlLabel
                                    control={
                                      <Checkbox
                                        checked={Boolean(options[key])}
                                        onChange={(e) =>
                                          updateSectionField(
                                            section.id,
                                            key,
                                            e.target.checked,
                                          )
                                        }
                                        disabled={exporting}
                                      />
                                    }
                                    label={label}
                                  />
                                </Grid>
                              ))}
                            </Grid>
                          </Box>
                        </Box>
                      );
                    })}
                  </Stack>
                </Box>
              </Collapse>
            </Box>
          )}

          {/* OVERALL */}
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
            }}
          >
            <Box
              sx={{ px: 2, py: 1.2, cursor: "pointer" }}
              onClick={() => toggleGroup("overall")}
            >
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography fontWeight={800}>Overall Result</Typography>
                {expandedGroups.overall ? (
                  <ExpandLessIcon />
                ) : (
                  <ExpandMoreIcon />
                )}
              </Stack>
            </Box>
            <Collapse in={expandedGroups.overall}>
              <Divider />
              <Box sx={{ p: 1.5 }}>
                <Grid container spacing={1}>
                  {[
                    ["totalObtained", "Total Obtained"],
                    ["totalMax", "Total Max Marks"],
                    ["percentage", "Overall Percentage"],
                    ["status", "Status"],
                  ].map(([key, label]) => (
                    <Grid item xs={12} sm={6} md={3} key={key}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={Boolean(exportOptions.overall?.[key])}
                            onChange={(e) =>
                              updateOverallField(key, e.target.checked)
                            }
                            disabled={exporting}
                          />
                        }
                        label={label}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Collapse>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, gap: 1 }}>
          <Button
            onClick={handleCloseExport}
            color="inherit"
            disabled={exporting}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={
              exporting ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <FileDownloadIcon />
              )
            }
            onClick={handleDownloadExcel}
            disabled={exporting || !hasSelectedExportFields()}
            sx={{
              borderRadius: 2,
              fontWeight: 700,
              textTransform: "none",
              minWidth: 150,
            }}
          >
            {exporting ? "Generating..." : "Download Excel"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
