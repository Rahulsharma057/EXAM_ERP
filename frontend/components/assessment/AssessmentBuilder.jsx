
"use client";

import React, { useEffect, useMemo, useState } from "react";

import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Switch,
  FormControlLabel,
  Alert,
  Stack,
  Collapse,
  Tooltip,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import ViewListIcon from "@mui/icons-material/ViewList";

import { api } from "../../services/api";

const DEFAULT_SECTION_FORM = {
  name: "",
  description: "",
  displayOrder: 1,
};

const DEFAULT_PART_FORM = {
  name: "",
  code: "",
  description: "",
  isOptional: false,
  displayOrder: 1,
};

const DEFAULT_QUESTION_FORM = {
  questionText: "",
  questionType: "YES_NO",
  maxPoints: 1,
  isRequired: true,
  options: [],
};

export default function AssessmentBuilder({
  assessment,
  onUpdate,
}) {
  const hasParts = Boolean(assessment?.hasParts);

  const [parts, setParts] = useState([]);
  const [sections, setSections] = useState([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // =========================================================
  // DIALOG STATES
  // =========================================================

  const [partDialog, setPartDialog] = useState(false);
  const [sectionDialog, setSectionDialog] =
    useState(false);
  const [questionDialog, setQuestionDialog] =
    useState(false);

  const [editingPart, setEditingPart] =
    useState(null);
  const [editingSection, setEditingSection] =
    useState(null);
  const [editingQuestion, setEditingQuestion] =
    useState(null);

  const [activePartId, setActivePartId] =
    useState(null);

  const [activeSectionId, setActiveSectionId] =
    useState(null);

  // =========================================================
  // EXPANDED PARTS
  // =========================================================

  const [expandedParts, setExpandedParts] =
    useState({});

  // =========================================================
  // FORMS
  // =========================================================

  const [partForm, setPartForm] = useState(
    DEFAULT_PART_FORM,
  );

  const [sectionForm, setSectionForm] =
    useState(DEFAULT_SECTION_FORM);

  const [questionForm, setQuestionForm] =
    useState(DEFAULT_QUESTION_FORM);

  // =========================================================
  // SYNC INITIAL DATA

// =========================================================
// SYNC ASSESSMENT DATA
// =========================================================

useEffect(() => {
  const nextParts = Array.isArray(assessment?.parts)
    ? sortByOrder(assessment.parts)
    : [];

  let nextSections = [];

  // ---------------------------------------------------------
  // DIRECT SECTION MODE
  // ---------------------------------------------------------

  if (Array.isArray(assessment?.sections)) {
    nextSections = [...assessment.sections];
  }

  // ---------------------------------------------------------
  // PARTS MODE
  // Backend response:
  //
  // assessment.parts[].sections[]
  //
  // Builder ko flat sections array chahiye.
  // ---------------------------------------------------------

  if (Array.isArray(assessment?.parts)) {
    const nestedSections = assessment.parts.flatMap((part) => {
      if (!Array.isArray(part?.sections)) {
        return [];
      }

      return part.sections.map((section) => {
        const partId =
          section?.part?._id ||
          section?.part?.id ||
          section?.part ||
          section?.partId ||
          part?._id ||
          null;

        return {
          ...section,

          // Keep both forms so all existing helpers work
          partId,
          part: section?.part || part?._id || null,
        };
      });
    });

    nextSections = [
      ...nextSections,
      ...nestedSections,
    ];
  }

  // ---------------------------------------------------------
  // REMOVE DUPLICATE SECTIONS
  // ---------------------------------------------------------

  const uniqueSections = Array.from(
    new Map(
      nextSections
        .filter((section) => section?._id)
        .map((section) => [
          String(section._id),
          section,
        ])
    ).values()
  );

  // ---------------------------------------------------------
  // SORT
  // ---------------------------------------------------------

  const sortedSections = sortByOrder(uniqueSections);

  // ---------------------------------------------------------
  // SET STATE
  // ---------------------------------------------------------

  setParts(nextParts);
  setSections(sortedSections);

  console.log("ASSESSMENT BUILDER SYNC:", {
    hasParts: Boolean(assessment?.hasParts),
    parts: nextParts,
    sections: sortedSections,
  });
}, [
  assessment?._id,
  assessment?.hasParts,
  assessment?.parts,
  assessment?.sections,
]);


  // =========================================================
  // LOAD ASSESSMENT
  // =========================================================
const loadAssessment = async () => {
  try {
    setLoading(true);
    setError("");

    const res = await api.getAssessment(
      assessment._id
    );

    const data = res?.data;

    if (!data) {
      throw new Error("Assessment data not found");
    }

    // =====================================================
    // PARTS
    // =====================================================

    const nextParts = Array.isArray(data.parts)
      ? sortByOrder(data.parts)
      : [];

    // =====================================================
    // SECTIONS
    // =====================================================
    // Backend parts mode me sections ko:
    // data.parts[].sections
    // ke andar bhej raha hai.
    //
    // Direct mode me:
    // data.sections
    // ke andar bhej raha hai.

    let nextSections = [];

    if (Array.isArray(data.sections)) {
      nextSections = [...data.sections];
    }

    // Parts ke andar nested sections ko bhi
    // flat sections array me convert karo
    if (Array.isArray(data.parts)) {
      const nestedSections = data.parts.flatMap(
        (part) =>
          Array.isArray(part.sections)
            ? part.sections.map((section) => ({
                ...section,

                // Agar backend ne part ko string diya hai
                // to ensure karo ki section ke paas partId bhi ho
                partId:
                  section.part?._id ||
                  section.part?.id ||
                  section.part ||
                  part._id,

                // Original part bhi preserve karo
                part:
                  section.part ||
                  part._id,
              }))
            : []
      );

      nextSections = [
        ...nextSections,
        ...nestedSections,
      ];
    }

    // Duplicate sections remove karo
    const uniqueSections = Array.from(
      new Map(
        nextSections.map((section) => [
          String(section._id),
          section,
        ])
      ).values()
    );

    const sortedSections =
      sortByOrder(uniqueSections);

    // =====================================================
    // UPDATE LOCAL STATE
    // =====================================================

    setParts(nextParts);
    setSections(sortedSections);

    console.log(
      "ASSESSMENT REFRESHED:",
      {
        parts: nextParts,
        sections: sortedSections,
      }
    );

    // =====================================================
    // PARENT REFRESH
    // =====================================================

    if (onUpdate) {
      try {
        await onUpdate();
      } catch (parentError) {
        console.warn(
          "Parent assessment refresh failed:",
          parentError
        );
      }
    }
  } catch (err) {
    console.error(
      "ASSESSMENT BUILDER LOAD ERROR:",
      err
    );

    const message =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.message ||
      "Failed to refresh assessment";

    setError(message);
  } finally {
    setLoading(false);
  }
};

  // =========================================================
  // HELPERS
  // =========================================================
function sortByOrder(items = []) {
  return [...items].sort(
    (a, b) =>
      Number(a?.displayOrder || 0) -
      Number(b?.displayOrder || 0),
  );
}

const getSectionPartId = (section) => {
  if (!section) return null;

  return (
    section.part?._id ||
    section.part?.id ||
    section.partId ||
    section.part ||
    null
  );
};

const getSectionsForPart = (partId) => {
  return sortByOrder(
    sections.filter(
      (section) =>
        String(getSectionPartId(section)) ===
        String(partId),
    ),
  );
};

const getDirectSections = () => {
  return sortByOrder(
    sections.filter(
      (section) => !getSectionPartId(section),
    ),
  );
};

  const getQuestionsCount = (section) => {
    return (
      section?.questions?.filter(
        (q) => q?.isActive !== false,
      ).length || 0
    );
  };

  const getSectionMarks = (section) => {
    return Number(
      section?.totalMarks || 0,
    );
  };

    const getPartMarks = (part) => {
      const nestedSections =
        getSectionsForPart(part._id);

      if (
        nestedSections.length > 0
      ) {
        return nestedSections.reduce(
          (sum, section) =>
            sum + getSectionMarks(section),
          0,
        );
      }

      return Number(
        part?.totalMarks || 0,
      );
    };

  // =========================================================
  // PART DIALOG
  // =========================================================

  const openPartDialog = (part = null) => {
    setError("");

    if (part) {
      setEditingPart(part);

      setPartForm({
        name: part.name || "",
        code: part.code || "",
        description:
          part.description || "",
        isOptional:
          Boolean(part.isOptional),
        displayOrder:
          Number(part.displayOrder || 1),
      });
    } else {
      setEditingPart(null);

      setPartForm({
        ...DEFAULT_PART_FORM,
        displayOrder:
          parts.length + 1,
      });
    }

    setPartDialog(true);
  };

  const closePartDialog = () => {
    setPartDialog(false);
    setEditingPart(null);
    setPartForm(DEFAULT_PART_FORM);
  };

  const handleSavePart = async () => {
    try {
      setSaving(true);
      setError("");

      if (!partForm.name.trim()) {
        setError("Part name is required.");
        return;
      }

      const payload = {
        name: partForm.name.trim(),
        code:
          partForm.code.trim() || undefined,
        description:
          partForm.description.trim(),
        isOptional:
          Boolean(partForm.isOptional),
        displayOrder:
          Number(partForm.displayOrder) || 1,
      };

      if (editingPart) {
        await api.updateAssessmentPart(
          editingPart._id,
          payload,
        );
      } else {
        await api.createAssessmentPart(
          assessment._id,
          payload,
        );
      }

      closePartDialog();
      await loadAssessment();
    } catch (err) {
      console.error(
        "SAVE PART ERROR:",
        err,
      );

      setError(
        err?.message ||
          "Failed to save part",
      );
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // DELETE PART
  // =========================================================

  const handleDeletePart = async (part) => {
    const confirmed = window.confirm(
      `Delete "${part.name}" and all sections/questions inside this part?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      await api.deleteAssessmentPart(
        part._id,
      );

      await loadAssessment();
    } catch (err) {
      console.error(
        "DELETE PART ERROR:",
        err,
      );

      setError(
        err?.message ||
          "Failed to delete part",
      );
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // REORDER PART
  // =========================================================

  const movePart = async (
    index,
    direction,
  ) => {
    const newIndex =
      direction === "up"
        ? index - 1
        : index + 1;

    if (
      newIndex < 0 ||
      newIndex >= parts.length
    ) {
      return;
    }

    const updated = [...parts];

    [
      updated[index],
      updated[newIndex],
    ] = [
      updated[newIndex],
      updated[index],
    ];

    const payload = updated.map(
      (part, idx) => ({
        id: part._id,
        displayOrder: idx + 1,
      }),
    );

    try {
      setSaving(true);

      await api.reorderAssessmentParts(
        assessment._id,
        payload,
      );

      await loadAssessment();
    } catch (err) {
      console.error(
        "REORDER PART ERROR:",
        err,
      );

      setError(
        err?.message ||
          "Failed to reorder parts",
      );
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // SECTION DIALOG
  // =========================================================
const openSectionDialog = (
  section = null,
  partId = null
) => {
  setError("");

  if (section) {
    setEditingSection(section);

    const sectionPartId =
      getSectionPartId(section);

    setActivePartId(sectionPartId);

    setSectionForm({
      name: section.name || "",
      description: section.description || "",
      displayOrder:
        Number(section.displayOrder || 1),
    });
  } else {
    setEditingSection(null);

    setActivePartId(
      hasParts ? partId : null
    );

    const existingSections = hasParts
      ? getSectionsForPart(partId)
      : getDirectSections();

    setSectionForm({
      name: "",
      description: "",
      displayOrder:
        existingSections.length + 1,
    });
  }

  setSectionDialog(true);
};

  const closeSectionDialog = () => {
    setSectionDialog(false);
    setEditingSection(null);
    setActivePartId(null);
    setSectionForm(
      DEFAULT_SECTION_FORM,
    );
  };
const handleSaveSection = async () => {
  if (saving) return;

  try {
    setSaving(true);
    setError("");

    // ---------------------------------------------
    // VALIDATION
    // ---------------------------------------------

    const sectionName = String(
      sectionForm.name || ""
    ).trim();

    if (!sectionName) {
      setError("Section name is required.");
      return;
    }

    const displayOrder =
      Number(sectionForm.displayOrder) || 1;

    // ---------------------------------------------
    // PART ID
    // ---------------------------------------------

    let partId = null;

    if (hasParts) {
      partId =
        activePartId ||
        editingSection?.part?._id ||
        editingSection?.part?.id ||
        editingSection?.partId ||
        editingSection?.part ||
        null;

      if (!partId) {
        setError(
          "Please select a Part before creating the section."
        );
        return;
      }

      const selectedPart = parts.find(
        (part) =>
          String(part._id) === String(partId)
      );

      if (!selectedPart) {
        setError(
          "Selected Part is invalid. Please refresh the assessment and try again."
        );
        return;
      }
    }

    // ---------------------------------------------
    // PAYLOAD
    // ---------------------------------------------

    const payload = {
      name: sectionName,
      description: String(
        sectionForm.description || ""
      ).trim(),
      displayOrder,
    };

    if (hasParts) {
      payload.partId = partId;
    }

    console.log(
      "CREATE / UPDATE SECTION PAYLOAD:",
      {
        assessmentId: assessment._id,
        sectionId: editingSection?._id || null,
        payload,
      }
    );

    // ---------------------------------------------
    // CREATE / UPDATE
    // ---------------------------------------------

    let response;

    if (editingSection) {
      response = await api.updateSection(
        editingSection._id,
        payload
      );
    } else {
      response = await api.createSection(
        assessment._id,
        payload
      );
    }

    console.log(
      "SECTION SAVE RESPONSE:",
      response
    );

    // ---------------------------------------------
    // CLOSE DIALOG
    // ---------------------------------------------

    closeSectionDialog();

    // ---------------------------------------------
    // REFRESH STRUCTURE
    // ---------------------------------------------

    await loadAssessment();

  } catch (err) {
    console.error(
      "SAVE SECTION ERROR:",
      err
    );

    const message =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.message ||
      "Failed to save section";

    setError(message);
  } finally {
    setSaving(false);
  }
};

  // =========================================================
  // DELETE SECTION
  // =========================================================

  const handleDeleteSection = async (
    section,
  ) => {
    const confirmed = window.confirm(
      `Delete "${section.name}" and all its questions?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      await api.deleteSection(
        section._id,
      );

      await loadAssessment();
    } catch (err) {
      console.error(
        "DELETE SECTION ERROR:",
        err,
      );

      setError(
        err?.message ||
          "Failed to delete section",
      );
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // REORDER SECTIONS
  // =========================================================

  const moveSection = async (
    section,
    direction,
  ) => {
   const group = hasParts
  ? getSectionsForPart(
      getSectionPartId(section),
    )
  : getDirectSections();

    const index = group.findIndex(
      (item) =>
        String(item._id) ===
        String(section._id),
    );

    const newIndex =
      direction === "up"
        ? index - 1
        : index + 1;

    if (
      index < 0 ||
      newIndex < 0 ||
      newIndex >= group.length
    ) {
      return;
    }

    const updated = [...group];

    [
      updated[index],
      updated[newIndex],
    ] = [
      updated[newIndex],
      updated[index],
    ];

    const payload = updated.map(
      (item, idx) => ({
        id: item._id,
        displayOrder: idx + 1,
      }),
    );

    try {
      setSaving(true);

      await api.reorderSections(
        payload,
      );

      await loadAssessment();
    } catch (err) {
      console.error(
        "REORDER SECTION ERROR:",
        err,
      );

      setError(
        err?.message ||
          "Failed to reorder sections",
      );
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // QUESTION DIALOG
  // =========================================================

  const openQuestionDialog = (
    sectionId,
    question = null,
  ) => {
    setError("");

    setActiveSectionId(sectionId);

    const section = sections.find(
      (item) =>
        String(item._id) ===
        String(sectionId),
    );

    if (question) {
      setEditingQuestion(question);

      setQuestionForm({
        questionText:
          question.questionText || "",
        questionType:
          question.questionType ||
          "YES_NO",
        maxPoints:
          Number(
            question.maxPoints || 1,
          ),
        isRequired:
          question.isRequired !== false,
        options:
          Array.isArray(
            question.options,
          )
            ? question.options
            : [],
      });
    } else {
      setEditingQuestion(null);

      setQuestionForm({
        ...DEFAULT_QUESTION_FORM,
        maxPoints: 1,
      });
    }

    if (section) {
     setActivePartId(
  getSectionPartId(section)
);
    }

    setQuestionDialog(true);
  };

  const closeQuestionDialog = () => {
    setQuestionDialog(false);
    setEditingQuestion(null);
    setActiveSectionId(null);
    setQuestionForm(
      DEFAULT_QUESTION_FORM,
    );
  };

  // =========================================================
  // QUESTION OPTIONS
  // =========================================================

  const requiresOptions =
    questionForm.questionType ===
      "SINGLE_CHOICE" ||
    questionForm.questionType ===
      "MULTIPLE_CHOICE";

  const addOption = () => {
    setQuestionForm((prev) => ({
      ...prev,
      options: [
        ...(prev.options || []),
        "",
      ],
    }));
  };

  const updateOption = (
    index,
    value,
  ) => {
    setQuestionForm((prev) => ({
      ...prev,
      options: prev.options.map(
        (option, optionIndex) =>
          optionIndex === index
            ? value
            : option,
      ),
    }));
  };

  const removeOption = (
    index,
  ) => {
    setQuestionForm((prev) => ({
      ...prev,
      options: prev.options.filter(
        (_, optionIndex) =>
          optionIndex !== index,
      ),
    }));
  };

  const handleSaveQuestion = async () => {
    try {
      setSaving(true);
      setError("");

      if (
        !questionForm.questionText.trim()
      ) {
        setError(
          "Question text is required.",
        );
        return;
      }

      const maxPoints = Number(
        questionForm.maxPoints,
      );

      if (
        !Number.isFinite(maxPoints) ||
        maxPoints <= 0
      ) {
        setError(
          "Maximum points must be greater than 0.",
        );
        return;
      }

      let options = [];

      if (requiresOptions) {
        options = (
          questionForm.options || []
        )
          .map((option) =>
            String(option).trim(),
          )
          .filter(Boolean);

        if (options.length < 2) {
          setError(
            "At least 2 options are required.",
          );
          return;
        }
      }

      const section = sections.find(
        (item) =>
          String(item._id) ===
          String(activeSectionId),
      );

      const payload = {
        questionText:
          questionForm.questionText.trim(),
        questionType:
          questionForm.questionType,
        maxPoints,
        isRequired:
          questionForm.isRequired !==
          false,
        options,
      };

      if (hasParts) {
      payload.partId =
  getSectionPartId(section) ||
  activePartId ||
  null;
      }

      if (editingQuestion) {
        await api.updateQuestion(
          editingQuestion._id,
          payload,
        );
      } else {
        await api.createQuestion(
          activeSectionId,
          payload,
        );
      }

      closeQuestionDialog();
      await loadAssessment();
    } catch (err) {
      console.error(
        "SAVE QUESTION ERROR:",
        err,
      );

      setError(
        err?.message ||
          "Failed to save question",
      );
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // DELETE QUESTION
  // =========================================================

  const handleDeleteQuestion = async (
    question,
  ) => {
    const confirmed = window.confirm(
      "Delete this question?",
    );

    if (!confirmed) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      await api.deleteQuestion(
        question._id,
      );

      await loadAssessment();
    } catch (err) {
      console.error(
        "DELETE QUESTION ERROR:",
        err,
      );

      setError(
        err?.message ||
          "Failed to delete question",
      );
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // REORDER QUESTIONS
  // =========================================================

  const moveQuestion = async (
    section,
    question,
    direction,
  ) => {
    const questions = sortByOrder(
      section.questions || [],
    );

    const index = questions.findIndex(
      (item) =>
        String(item._id) ===
        String(question._id),
    );

    const newIndex =
      direction === "up"
        ? index - 1
        : index + 1;

    if (
      index < 0 ||
      newIndex < 0 ||
      newIndex >= questions.length
    ) {
      return;
    }

    const updated = [...questions];

    [
      updated[index],
      updated[newIndex],
    ] = [
      updated[newIndex],
      updated[index],
    ];

    const payload = updated.map(
      (item, idx) => ({
        id: item._id,
        displayOrder: idx + 1,
      }),
    );

    try {
      setSaving(true);

      await api.reorderQuestions(
        payload,
      );

      await loadAssessment();
    } catch (err) {
      console.error(
        "REORDER QUESTION ERROR:",
        err,
      );

      setError(
        err?.message ||
          "Failed to reorder questions",
      );
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // TOGGLE PART
  // =========================================================

  const togglePart = (partId) => {
    setExpandedParts((prev) => ({
      ...prev,
      [partId]:
        prev[partId] === false
          ? true
          : false,
    }));
  };

  // =========================================================
  // RENDER QUESTION
  // =========================================================

  const renderQuestion = (
    section,
    question,
    index,
  ) => {
    const questions =
      section.questions || [];

    return (
      <Paper
        key={question._id}
        elevation={0}
        sx={{
          p: 2,
          mb: 1.5,
          bgcolor: "grey.50",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "flex-start",
            gap: 2,
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 1,
              }}
            >
              <DragHandleIcon
                color="action"
                sx={{
                  mt: 0.2,
                  display: {
                    xs: "none",
                    sm: "block",
                  },
                }}
              />

              <Typography
                variant="subtitle2"
                sx={{
                  wordBreak:
                    "break-word",
                }}
              >
                {index + 1}.{" "}
                {question.questionText}
              </Typography>
            </Box>

            <Box
              sx={{
                mt: 1,
                display: "flex",
                gap: 0.75,
                flexWrap: "wrap",
              }}
            >
              <Chip
                size="small"
                label={
                  question.questionType
                }
                color="primary"
                variant="outlined"
              />

              <Chip
                size="small"
                label={`${question.maxPoints} pts`}
                color="success"
                variant="outlined"
              />

              {question.isRequired && (
                <Chip
                  size="small"
                  label="Required"
                  color="error"
                  variant="outlined"
                />
              )}

              {!question.isRequired && (
                <Chip
                  size="small"
                  label="Optional"
                  variant="outlined"
                />
              )}

              {question.isActive ===
                false && (
                <Chip
                  size="small"
                  label="Inactive"
                  color="warning"
                />
              )}
            </Box>

            {(question.questionType ===
              "SINGLE_CHOICE" ||
              question.questionType ===
                "MULTIPLE_CHOICE") &&
              question.options?.length >
                0 && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: "block",
                    mt: 1,
                  }}
                >
                  Options:{" "}
                  {question.options.join(
                    ", ",
                  )}
                </Typography>
              )}
          </Box>

          <Stack
            direction="row"
            spacing={0}
            alignItems="center"
          >
            <Tooltip title="Move up">
              <span>
                <IconButton
                  size="small"
                  disabled={index === 0}
                  onClick={() =>
                    moveQuestion(
                      section,
                      question,
                      "up",
                    )
                  }
                >
                  <KeyboardArrowUpIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title="Move down">
              <span>
                <IconButton
                  size="small"
                  disabled={
                    index ===
                    questions.length - 1
                  }
                  onClick={() =>
                    moveQuestion(
                      section,
                      question,
                      "down",
                    )
                  }
                >
                  <KeyboardArrowDownIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>

            <IconButton
              size="small"
              onClick={() =>
                openQuestionDialog(
                  section._id,
                  question,
                )
              }
            >
              <EditIcon />
            </IconButton>

            <IconButton
              size="small"
              color="error"
              onClick={() =>
                handleDeleteQuestion(
                  question,
                )
              }
            >
              <DeleteIcon />
            </IconButton>
          </Stack>
        </Box>
      </Paper>
    );
  };

  // =========================================================
  // RENDER SECTION
  // =========================================================

  const renderSection = (
    section,
    sectionIndex,
    sectionGroup,
  ) => {
    return (
      <Card
        key={section._id}
        elevation={0}
        sx={{
          mb: 2,
          borderLeft: 4,
          borderColor:
            "primary.main",
          border: "1px solid",
          borderLeftWidth: 4,
        }}
      >
        <CardContent>
          <Box
            sx={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "flex-start",
              gap: 2,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems:
                  "flex-start",
                gap: 1,
                minWidth: 0,
                flex: 1,
              }}
            >
              <DragHandleIcon
                color="action"
                sx={{
                  display: {
                    xs: "none",
                    sm: "block",
                  },
                }}
              />

              <Box sx={{ minWidth: 0 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems:
                      "center",
                    gap: 1,
                    flexWrap:
                      "wrap",
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      wordBreak:
                        "break-word",
                    }}
                  >
                    {sectionIndex +
                      1}
                    . {section.name}
                  </Typography>

                  <Chip
                    size="small"
                    label={`${getQuestionsCount(
                      section,
                    )} questions`}
                    variant="outlined"
                  />

                  <Chip
                    size="small"
                    label={`${getSectionMarks(
                      section,
                    )} marks`}
                    color="success"
                    variant="outlined"
                  />
                </Box>

                {section.description && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mt: 0.75,
                    }}
                  >
                    {
                      section.description
                    }
                  </Typography>
                )}
              </Box>
            </Box>

            <Stack
              direction="row"
              spacing={0}
            >
              <Tooltip title="Move up">
                <span>
                  <IconButton
                    size="small"
                    disabled={
                      sectionIndex ===
                      0
                    }
                    onClick={() =>
                      moveSection(
                        section,
                        "up",
                      )
                    }
                  >
                    <KeyboardArrowUpIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>

              <Tooltip title="Move down">
                <span>
                  <IconButton
                    size="small"
                    disabled={
                      sectionIndex ===
                      sectionGroup.length -
                        1
                    }
                    onClick={() =>
                      moveSection(
                        section,
                        "down",
                      )
                    }
                  >
                    <KeyboardArrowDownIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>

              <IconButton
                size="small"
                onClick={() =>
                  openSectionDialog(
                    section,
                  )
                }
              >
                <EditIcon />
              </IconButton>

              <IconButton
                size="small"
                color="error"
                onClick={() =>
                  handleDeleteSection(
                    section,
                  )
                }
              >
                <DeleteIcon />
              </IconButton>
            </Stack>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box
            sx={{
              pl: {
                xs: 0,
                sm: 2,
                md: 4,
              },
            }}
          >
            {sortByOrder(
              section.questions || [],
            ).map(
              (question, index) =>
                renderQuestion(
                  section,
                  question,
                  index,
                ),
            )}

            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() =>
                openQuestionDialog(
                  section._id,
                )
              }
              sx={{ mt: 0.5 }}
            >
              Add Question
            </Button>
          </Box>
        </CardContent>
      </Card>
    );
  };

  // =========================================================
  // DIRECT SECTIONS
  // =========================================================

  const directSections =
    useMemo(
      () => getDirectSections(),
      [sections],
    );

  // =========================================================
  // RETURN
  // =========================================================

  return (
    <Box>
      {/* ===================================================== */}
      {/* ERROR */}
      {/* ===================================================== */}

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          onClose={() => setError("")}
        >
          {error}
        </Alert>
      )}

      {/* ===================================================== */}
      {/* HEADER */}
      {/* ===================================================== */}

      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: {
              xs: "flex-start",
              sm: "center",
            },
            gap: 2,
            flexWrap: "wrap",
          }}
        >
          <Box>
            <Box
              sx={{
                display: "flex",
                alignItems:
                  "center",
                gap: 1,
                flexWrap: "wrap",
              }}
            >
              {hasParts ? (
                <AccountTreeIcon color="primary" />
              ) : (
                <ViewListIcon color="primary" />
              )}

              <Typography
                variant="h6"
                fontWeight={700}
              >
                {hasParts
                  ? "Parts Assessment"
                  : "Section Assessment"}
              </Typography>

              <Chip
                size="small"
                label={
                  hasParts
                    ? "Part → Section → Question"
                    : "Section → Question"
                }
                color={
                  hasParts
                    ? "secondary"
                    : "primary"
                  }
                variant="outlined"
              />
            </Box>

            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.5 }}
            >
              {hasParts
                ? "Create optional or required parts, then add sections and questions inside each part."
                : "Create unlimited sections and questions for this assessment."}
            </Typography>
          </Box>

          {hasParts ? (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() =>
                openPartDialog()
              }
              disabled={saving}
            >
              Add Part
            </Button>
          ) : (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() =>
                openSectionDialog()
              }
              disabled={saving}
            >
              Add Section
            </Button>
          )}
        </Box>
      </Paper>

      {/* ===================================================== */}
      {/* PARTS MODE */}
      {/* ===================================================== */}

      {hasParts && (
        <>
          {parts.length === 0 && (
            <Alert
              severity="info"
              sx={{ mb: 2 }}
            >
              No parts created yet. Add a
              Part to start building this
              assessment.
            </Alert>
          )}

          {parts.map(
            (part, partIndex) => {
              const partSections =
                getSectionsForPart(
                  part._id,
                );

              const isExpanded =
                expandedParts[
                  part._id
                ] !== false;

              return (
                <Card
                  key={part._id}
                  elevation={0}
                  sx={{
                    mb: 2,
                    border: "1px solid",
                    borderColor:
                      "divider",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      p: 2,
                      bgcolor:
                        "primary.50",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "flex-start",
                        gap: 2,
                      }}
                    >
                      <Box
                        sx={{
                          display:
                            "flex",
                          gap: 1,
                          minWidth: 0,
                          flex: 1,
                        }}
                      >
                        <DragHandleIcon
                          color="action"
                          sx={{
                            display: {
                              xs: "none",
                              sm: "block",
                            },
                          }}
                        />

                        <Box
                          sx={{
                            minWidth: 0,
                          }}
                        >
                          <Box
                            sx={{
                              display:
                                "flex",
                              alignItems:
                                "center",
                              gap: 1,
                              flexWrap:
                                "wrap",
                            }}
                          >
                            <Typography
                              variant="h6"
                              fontWeight={700}
                              sx={{
                                wordBreak:
                                  "break-word",
                              }}
                            >
                              Part{" "}
                              {partIndex +
                                1}
                              :{" "}
                              {
                                part.name
                              }
                            </Typography>

                            {part.code && (
                              <Chip
                                size="small"
                                label={
                                  part.code
                                }
                                variant="outlined"
                              />
                            )}

                            {part.isOptional ? (
                              <Chip
                                size="small"
                                label="Optional"
                                color="warning"
                              />
                            ) : (
                              <Chip
                                size="small"
                                label="Required Part"
                                color="success"
                              />
                            )}
                          </Box>

                          {part.description && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{
                                mt: 0.5,
                              }}
                            >
                              {
                                part.description
                              }
                            </Typography>
                          )}

                          <Box
                            sx={{
                              mt: 1,
                              display:
                                "flex",
                              gap: 1,
                              flexWrap:
                                "wrap",
                            }}
                          >
                            <Chip
                              size="small"
                              variant="outlined"
                              label={`${partSections.length} sections`}
                            />

                            <Chip
                              size="small"
                              color="success"
                              variant="outlined"
                              label={`${getPartMarks(
                                part,
                              )} marks`}
                            />

                            <Chip
                              size="small"
                              variant="outlined"
                              label={`${partSections.reduce(
                                (
                                  total,
                                  section,
                                ) =>
                                  total +
                                  getQuestionsCount(
                                    section,
                                  ),
                                0,
                              )} questions`}
                            />
                          </Box>
                        </Box>
                      </Box>

                      <Stack
                        direction="row"
                        spacing={0}
                      >
                        <Tooltip title="Move up">
                          <span>
                            <IconButton
                              size="small"
                              disabled={
                                partIndex ===
                                0
                              }
                              onClick={() =>
                                movePart(
                                  partIndex,
                                  "up",
                                )
                              }
                            >
                              <KeyboardArrowUpIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>

                        <Tooltip title="Move down">
                          <span>
                            <IconButton
                              size="small"
                              disabled={
                                partIndex ===
                                parts.length -
                                  1
                              }
                              onClick={() =>
                                movePart(
                                  partIndex,
                                  "down",
                                )
                              }
                            >
                              <KeyboardArrowDownIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>

                        <IconButton
                          size="small"
                          onClick={() =>
                            openPartDialog(
                              part,
                            )
                          }
                        >
                          <EditIcon />
                        </IconButton>

                        <IconButton
                          size="small"
                          color="error"
                          onClick={() =>
                            handleDeletePart(
                              part,
                            )
                          }
                        >
                          <DeleteIcon />
                        </IconButton>

                        <IconButton
                          size="small"
                          onClick={() =>
                            togglePart(
                              part._id,
                            )
                          }
                        >
                          {isExpanded ? (
                            <ExpandLessIcon />
                          ) : (
                            <ExpandMoreIcon />
                          )}
                        </IconButton>
                      </Stack>
                    </Box>
                  </Box>

                  <Collapse
                    in={isExpanded}
                  >
                    <CardContent>
                      <Box
                        sx={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          alignItems:
                            "center",
                          mb: 2,
                          gap: 1,
                          flexWrap:
                            "wrap",
                        }}
                      >
                        <Typography
                          variant="subtitle1"
                          fontWeight={700}
                        >
                          Sections
                        </Typography>

                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={
                            <AddIcon />
                          }
                          onClick={() =>
                            openSectionDialog(
                              null,
                              part._id,
                            )
                          }
                          disabled={saving}
                        >
                          Add Section
                        </Button>
                      </Box>

                      {partSections.length ===
                        0 && (
                        <Alert
                          severity="info"
                          sx={{
                            mb: 2,
                          }}
                        >
                          No sections in
                          this part yet.
                        </Alert>
                      )}

                      {partSections.map(
                        (
                          section,
                          sectionIndex,
                        ) =>
                          renderSection(
                            section,
                            sectionIndex,
                            partSections,
                          ),
                      )}
                    </CardContent>
                  </Collapse>
                </Card>
              );
            },
          )}
        </>
      )}

      {/* ===================================================== */}
      {/* DIRECT SECTION MODE */}
      {/* ===================================================== */}

      {!hasParts && (
        <>
          {directSections.length ===
            0 && (
            <Alert
              severity="info"
              sx={{ mb: 2 }}
            >
              No sections created yet.
              Click "Add Section" to start
              building the assessment.
            </Alert>
          )}

          {directSections.map(
            (section, index) =>
              renderSection(
                section,
                index,
                directSections,
              ),
          )}
        </>
      )}

      {/* ===================================================== */}
      {/* PART DIALOG */}
      {/* ===================================================== */}

      <Dialog
        open={partDialog}
        onClose={
          saving
            ? undefined
            : closePartDialog
        }
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingPart
            ? "Edit Part"
            : "Add Part"}
        </DialogTitle>

        <DialogContent>
          <TextField
            label="Part Name"
            fullWidth
            required
            margin="normal"
            value={partForm.name}
            onChange={(e) =>
              setPartForm(
                (prev) => ({
                  ...prev,
                  name: e.target.value,
                }),
              )
            }
          />

          <TextField
            label="Part Code"
            fullWidth
            margin="normal"
            value={partForm.code}
            onChange={(e) =>
              setPartForm(
                (prev) => ({
                  ...prev,
                  code:
                    e.target.value.toUpperCase(),
                }),
              )
            }
            helperText="Optional unique code"
          />

          <TextField
            label="Description"
            fullWidth
            multiline
            rows={3}
            margin="normal"
            value={
              partForm.description
            }
            onChange={(e) =>
              setPartForm(
                (prev) => ({
                  ...prev,
                  description:
                    e.target.value,
                }),
              )
            }
          />

          <TextField
            label="Display Order"
            type="number"
            fullWidth
            margin="normal"
            inputProps={{
              min: 1,
            }}
            value={
              partForm.displayOrder
            }
            onChange={(e) =>
              setPartForm(
                (prev) => ({
                  ...prev,
                  displayOrder:
                    Number(
                      e.target.value,
                    ) || 1,
                }),
              )
            }
          />

          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Switch
                checked={
                  Boolean(
                    partForm.isOptional,
                  )
                }
                onChange={(e) =>
                  setPartForm(
                    (prev) => ({
                      ...prev,
                      isOptional:
                        e.target.checked,
                    }),
                  )
                }
              />
            }
            label="Optional Part"
          />

          {partForm.isOptional && (
            <Alert
              severity="warning"
              sx={{ mt: 1 }}
            >
              Students will be able to
              choose whether to attempt
              this Part. If skipped, its
              marks will be completely
              excluded from the final
              denominator.
            </Alert>
          )}
        </DialogContent>

        <DialogActions>
          <Button
            onClick={closePartDialog}
            disabled={saving}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={handleSavePart}
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : "Save Part"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===================================================== */}
      {/* SECTION DIALOG */}
      {/* ===================================================== */}

      <Dialog
        open={sectionDialog}
        onClose={
          saving
            ? undefined
            : closeSectionDialog
        }
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingSection
            ? "Edit Section"
            : "Add Section"}
        </DialogTitle>

        <DialogContent>
          {hasParts && (
            <Alert
              severity="info"
              sx={{ mt: 1, mb: 1 }}
            >
              Section will be created
              inside the selected Part.
            </Alert>
          )}

          <TextField
            label="Section Name"
            fullWidth
            required
            margin="normal"
            value={sectionForm.name}
            onChange={(e) =>
              setSectionForm(
                (prev) => ({
                  ...prev,
                  name: e.target.value,
                }),
              )
            }
          />

          <TextField
            label="Description"
            fullWidth
            margin="normal"
            multiline
            rows={3}
            value={
              sectionForm.description
            }
            onChange={(e) =>
              setSectionForm(
                (prev) => ({
                  ...prev,
                  description:
                    e.target.value,
                }),
              )
            }
          />

          <TextField
            label="Display Order"
            type="number"
            fullWidth
            margin="normal"
            inputProps={{
              min: 1,
            }}
            value={
              sectionForm.displayOrder
            }
            onChange={(e) =>
              setSectionForm(
                (prev) => ({
                  ...prev,
                  displayOrder:
                    Number(
                      e.target.value,
                    ) || 1,
                }),
              )
            }
          />
        </DialogContent>

        <DialogActions>
          <Button
            onClick={closeSectionDialog}
            disabled={saving}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={handleSaveSection}
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : "Save Section"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===================================================== */}
      {/* QUESTION DIALOG */}
      {/* ===================================================== */}

      <Dialog
        open={questionDialog}
        onClose={
          saving
            ? undefined
            : closeQuestionDialog
        }
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingQuestion
            ? "Edit Question"
            : "Add Question"}
        </DialogTitle>

        <DialogContent>
          <TextField
            label="Question Text"
            fullWidth
            required
            margin="normal"
            multiline
            rows={3}
            value={
              questionForm.questionText
            }
            onChange={(e) =>
              setQuestionForm(
                (prev) => ({
                  ...prev,
                  questionText:
                    e.target.value,
                }),
              )
            }
          />

          <FormControl
            fullWidth
            margin="normal"
          >
            <InputLabel>
              Question Type
            </InputLabel>

            <Select
              value={
                questionForm.questionType
              }
              onChange={(e) =>
                setQuestionForm(
                  (prev) => ({
                    ...prev,
                    questionType:
                      e.target.value,
                    options:
                      e.target.value ===
                        "SINGLE_CHOICE" ||
                      e.target.value ===
                        "MULTIPLE_CHOICE"
                        ? prev.options
                        : [],
                  }),
                )
              }
              label="Question Type"
            >
              <MenuItem value="YES_NO">
                Yes / No
              </MenuItem>

              <MenuItem value="TEXT">
                Text
              </MenuItem>

              <MenuItem value="NUMBER">
                Number
              </MenuItem>

              <MenuItem value="SINGLE_CHOICE">
                Single Choice
              </MenuItem>

              <MenuItem value="MULTIPLE_CHOICE">
                Multiple Choice
              </MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Maximum Points"
            type="number"
            fullWidth
            margin="normal"
            inputProps={{
              min: 0.01,
              step: 0.01,
            }}
            value={
              questionForm.maxPoints
            }
            onChange={(e) =>
              setQuestionForm(
                (prev) => ({
                  ...prev,
                  maxPoints:
                    Number(
                      e.target.value,
                    ) || 0,
                }),
              )
            }
          />

          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Switch
                checked={
                  questionForm.isRequired !==
                  false
                }
                onChange={(e) =>
                  setQuestionForm(
                    (prev) => ({
                      ...prev,
                      isRequired:
                        e.target.checked,
                    }),
                  )
                }
              />
            }
            label="Required Question"
          />

          {/* ================================================= */}
          {/* OPTIONS */}
          {/* ================================================= */}

          {requiresOptions && (
            <Paper
              elevation={0}
              sx={{
                mt: 2,
                p: 2,
                border:
                  "1px solid",
                borderColor:
                  "divider",
                borderRadius: 2,
              }}
            >
              <Box
                sx={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  gap: 1,
                  mb: 1,
                }}
              >
                <Typography
                  fontWeight={600}
                >
                  Answer Options
                </Typography>

                <Button
                  size="small"
                  startIcon={
                    <AddIcon />
                  }
                  onClick={
                    addOption
                  }
                >
                  Add Option
                </Button>
              </Box>

              {questionForm.options
                ?.length ===
                0 && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                >
                  Add at least two
                  options.
                </Typography>
              )}

              <Stack spacing={1}>
                {(
                  questionForm.options ||
                  []
                ).map(
                  (
                    option,
                    index,
                  ) => (
                    <Box
                      key={
                        index
                      }
                      sx={{
                        display:
                          "flex",
                        gap: 1,
                        alignItems:
                          "center",
                      }}
                    >
                      <TextField
                        size="small"
                        fullWidth
                        label={`Option ${
                          index +
                          1
                        }`}
                        value={
                          option
                        }
                        onChange={(
                          e,
                        ) =>
                          updateOption(
                            index,
                            e
                              .target
                              .value,
                          )
                        }
                      />

                      <IconButton
                        color="error"
                        onClick={() =>
                          removeOption(
                            index,
                          )
                        }
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  ),
                )}
              </Stack>
            </Paper>
          )}
        </DialogContent>

        <DialogActions>
          <Button
            onClick={
              closeQuestionDialog
            }
            disabled={saving}
          >
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={
              handleSaveQuestion
            }
            disabled={saving}
          >
            {saving
              ? "Saving..."
              : "Save Question"}
          </Button>
        </DialogActions>
      </Dialog>

      {loading && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mt: 2,
            textAlign: "center",
          }}
        >
          Refreshing assessment
          structure...
        </Typography>
      )}
    </Box>
  );
}

