"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Stack,
  Typography,
  Tabs,
  Tab,
  TextField,
  MenuItem,
  IconButton,
  Alert,
  CircularProgress,
  Divider,
  Chip,
  Paper,
} from "@mui/material";
import {
  UploadFile,
  PhotoCamera,
  DeleteOutline,
  Add,
  AccountTree,
  ViewList,
} from "@mui/icons-material";
import { api } from "../../services/api";

const QUESTION_TYPES = ["YES_NO", "TEXT", "NUMBER", "SINGLE_CHOICE", "MULTIPLE_CHOICE"];

// Internally we always keep a `parts` array shape:
// [{ name, sections: [{ name, questions: [...] }] }]
// When the assessment does not use Parts, there is exactly one
// synthetic wrapper part (never shown in the UI) so all the edit
// handlers below can stay uniform.
const FLAT_WRAPPER_NAME = "__flat__";

export default function AssessmentImportDialog({
  open,
  onClose,
  assessment,
  onImported,
}) {
  const [tab, setTab] = useState(0); // 0 = file upload, 1 = camera
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const hasPartsMode = Boolean(assessment?.hasParts);

  const [extracting, setExtracting] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [draftParts, setDraftParts] = useState(null); // null = nothing extracted yet

  const reset = () => {
    setDraftParts(null);
    setWarnings([]);
    setError("");
  };

  const handleClose = () => {
    if (extracting || committing) return;
    reset();
    onClose();
  };

  const handleFileSelected = async (file) => {
    if (!file) return;
    setError("");
    setExtracting(true);
    setDraftParts(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await api.extractAssessmentQuestions(assessment._id, formData);

      if (!res?.success) {
        throw new Error(res?.message || "Could not extract questions.");
      }

      const { structure, warnings: apiWarnings } = res.data;

      if (hasPartsMode) {
        setDraftParts(structure);
      } else {
        setDraftParts([{ name: FLAT_WRAPPER_NAME, sections: structure }]);
      }

      setWarnings(apiWarnings || []);
    } catch (err) {
      setError(err?.message || "Could not extract questions from this file.");
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  // ===========================================================
  // TREE EDIT HELPERS (always operate on draftParts)
  // ===========================================================

  const updatePartName = (partIndex, name) => {
    setDraftParts((prev) => prev.map((p, i) => (i === partIndex ? { ...p, name } : p)));
  };

  const removePart = (partIndex) => {
    setDraftParts((prev) => prev.filter((_, i) => i !== partIndex));
  };

  const addPart = () => {
    setDraftParts((prev) => [
      ...prev,
      { name: `Part ${prev.length + 1}`, sections: [{ name: "Section 1", questions: [] }] },
    ]);
  };

  const updateSectionName = (partIndex, sectionIndex, name) => {
    setDraftParts((prev) => {
      const next = [...prev];
      const sections = [...next[partIndex].sections];
      sections[sectionIndex] = { ...sections[sectionIndex], name };
      next[partIndex] = { ...next[partIndex], sections };
      return next;
    });
  };

  const removeSection = (partIndex, sectionIndex) => {
    setDraftParts((prev) => {
      const next = [...prev];
      next[partIndex] = {
        ...next[partIndex],
        sections: next[partIndex].sections.filter((_, i) => i !== sectionIndex),
      };
      return next;
    });
  };

  const addSection = (partIndex) => {
    setDraftParts((prev) => {
      const next = [...prev];
      const sections = next[partIndex].sections;
      next[partIndex] = {
        ...next[partIndex],
        sections: [...sections, { name: `Section ${sections.length + 1}`, questions: [] }],
      };
      return next;
    });
  };

  const updateQuestion = (partIndex, sectionIndex, qIndex, patch) => {
    setDraftParts((prev) => {
      const next = [...prev];
      const sections = [...next[partIndex].sections];
      const questions = [...sections[sectionIndex].questions];
      questions[qIndex] = { ...questions[qIndex], ...patch };
      sections[sectionIndex] = { ...sections[sectionIndex], questions };
      next[partIndex] = { ...next[partIndex], sections };
      return next;
    });
  };

  const removeQuestion = (partIndex, sectionIndex, qIndex) => {
    setDraftParts((prev) => {
      const next = [...prev];
      const sections = [...next[partIndex].sections];
      sections[sectionIndex] = {
        ...sections[sectionIndex],
        questions: sections[sectionIndex].questions.filter((_, i) => i !== qIndex),
      };
      next[partIndex] = { ...next[partIndex], sections };
      return next;
    });
  };

  const updateOption = (partIndex, sectionIndex, qIndex, optIndex, value) => {
    setDraftParts((prev) => {
      const next = [...prev];
      const sections = [...next[partIndex].sections];
      const questions = [...sections[sectionIndex].questions];
      const options = [...(questions[qIndex].options || [])];
      options[optIndex] = value;
      questions[qIndex] = { ...questions[qIndex], options };
      sections[sectionIndex] = { ...sections[sectionIndex], questions };
      next[partIndex] = { ...next[partIndex], sections };
      return next;
    });
  };

  const addOption = (partIndex, sectionIndex, qIndex) => {
    setDraftParts((prev) => {
      const next = [...prev];
      const sections = [...next[partIndex].sections];
      const questions = [...sections[sectionIndex].questions];
      questions[qIndex] = {
        ...questions[qIndex],
        options: [...(questions[qIndex].options || []), ""],
      };
      sections[sectionIndex] = { ...sections[sectionIndex], questions };
      next[partIndex] = { ...next[partIndex], sections };
      return next;
    });
  };

  const removeOption = (partIndex, sectionIndex, qIndex, optIndex) => {
    setDraftParts((prev) => {
      const next = [...prev];
      const sections = [...next[partIndex].sections];
      const questions = [...sections[sectionIndex].questions];
      questions[qIndex] = {
        ...questions[qIndex],
        options: (questions[qIndex].options || []).filter((_, i) => i !== optIndex),
      };
      sections[sectionIndex] = { ...sections[sectionIndex], questions };
      next[partIndex] = { ...next[partIndex], sections };
      return next;
    });
  };

  // ===========================================================
  // TOTALS
  // ===========================================================

  const totals = (draftParts || []).reduce(
    (acc, part) => {
      acc.sections += part.sections.length;
      acc.questions += part.sections.reduce((sum, s) => sum + s.questions.length, 0);
      return acc;
    },
    { sections: 0, questions: 0 }
  );

  // ===========================================================
  // COMMIT
  // ===========================================================

  const handleCommit = async () => {
    setError("");

    if (totals.questions === 0) {
      setError("No questions to import.");
      return;
    }

    setCommitting(true);
    try {
      const cleanedParts = draftParts
        .map((part) => ({
          name: part.name,
          sections: part.sections.filter((s) => s.questions.length > 0),
        }))
        .filter((part) => part.sections.length > 0);

      const payload = hasPartsMode
        ? { structure: cleanedParts }
        : { structure: cleanedParts[0]?.sections || [] };

      const res = await api.commitImportedQuestions(assessment._id, payload);

      if (!res?.success) {
        throw new Error(res?.message || "Could not import questions.");
      }

      onImported?.();
      reset();
      onClose();
    } catch (err) {
      setError(err?.message || "Could not import questions.");
    } finally {
      setCommitting(false);
    }
  };

  // ===========================================================
  // RENDER: single question editor block
  // ===========================================================

  const renderQuestionEditor = (partIndex, sectionIndex, question, qIndex) => (
    <Box
      key={qIndex}
      sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2, mb: 1 }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          fullWidth
          size="small"
          multiline
          label={`Question ${qIndex + 1}`}
          value={question.questionText}
          onChange={(e) =>
            updateQuestion(partIndex, sectionIndex, qIndex, { questionText: e.target.value })
          }
        />
        <IconButton
          size="small"
          onClick={() => removeQuestion(partIndex, sectionIndex, qIndex)}
          sx={{ color: "error.main" }}
        >
          <DeleteOutline fontSize="small" />
        </IconButton>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
        <TextField
          select
          size="small"
          label="Type"
          value={question.questionType}
          onChange={(e) =>
            updateQuestion(partIndex, sectionIndex, qIndex, { questionType: e.target.value })
          }
          sx={{ minWidth: 170 }}
        >
          {QUESTION_TYPES.map((t) => (
            <MenuItem key={t} value={t}>
              {t.replace("_", " ")}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          size="small"
          type="number"
          label="Marks"
          value={question.maxPoints}
          onChange={(e) =>
            updateQuestion(partIndex, sectionIndex, qIndex, {
              maxPoints: Number(e.target.value),
            })
          }
          sx={{ maxWidth: 120 }}
        />
      </Stack>

      {["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(question.questionType) && (
        <Box sx={{ mt: 1 }}>
          <Stack spacing={0.7}>
            {(question.options || []).map((opt, optIndex) => (
              <Stack direction="row" spacing={1} key={optIndex} alignItems="center">
                <TextField
                  size="small"
                  fullWidth
                  value={opt}
                  onChange={(e) =>
                    updateOption(partIndex, sectionIndex, qIndex, optIndex, e.target.value)
                  }
                />
                <IconButton
                  size="small"
                  onClick={() => removeOption(partIndex, sectionIndex, qIndex, optIndex)}
                >
                  <DeleteOutline fontSize="small" />
                </IconButton>
              </Stack>
            ))}
            <Button
              size="small"
              startIcon={<Add />}
              onClick={() => addOption(partIndex, sectionIndex, qIndex)}
              sx={{ alignSelf: "flex-start", textTransform: "none" }}
            >
              Add option
            </Button>
          </Stack>
        </Box>
      )}
    </Box>
  );

  // ===========================================================
  // RENDER: a section block (with its questions)
  // ===========================================================

  const renderSectionBlock = (partIndex, section, sectionIndex, sectionsLength) => (
    <Paper
      key={sectionIndex}
      elevation={0}
      sx={{ p: 1.5, mb: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2 }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <TextField
          size="small"
          fullWidth
          label="Section name"
          value={section.name}
          onChange={(e) => updateSectionName(partIndex, sectionIndex, e.target.value)}
        />
        <Chip size="small" label={`${section.questions.length} questions`} variant="outlined" />
        <IconButton
          size="small"
          color="error"
          disabled={sectionsLength === 1}
          onClick={() => removeSection(partIndex, sectionIndex)}
        >
          <DeleteOutline fontSize="small" />
        </IconButton>
      </Stack>

      {section.questions.map((q, qIndex) => renderQuestionEditor(partIndex, sectionIndex, q, qIndex))}

      {section.questions.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
          No questions in this section.
        </Typography>
      )}
    </Paper>
  );

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Import Questions</DialogTitle>

      <DialogContent dividers>
        {!draftParts ? (
          <Box>
            <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
              <Tab icon={<UploadFile fontSize="small" />} iconPosition="start" label="Upload file" />
              <Tab icon={<PhotoCamera fontSize="small" />} iconPosition="start" label="Take photo" />
            </Tabs>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {extracting ? (
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 6, gap: 1.5 }}>
                <CircularProgress size={28} />
                <Typography variant="body2" color="text.secondary">
                  Reading the question paper and detecting Parts, Sections and Questions...
                </Typography>
              </Box>
            ) : tab === 0 ? (
              <Box sx={{ border: "2px dashed", borderColor: "divider", borderRadius: 2, py: 5, textAlign: "center" }}>
                <UploadFile sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
                <Typography fontWeight={600} mb={0.5}>
                  Upload a PDF or Word file
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Works best with typed question papers using headings like "Part A" / "Section 1"
                  and numbered questions ("1.", "Q1)").
                </Typography>
                <Button variant="contained" component="label">
                  Choose File
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    accept=".pdf,.docx"
                    onChange={(e) => handleFileSelected(e.target.files?.[0])}
                  />
                </Button>
              </Box>
            ) : (
              <Box sx={{ border: "2px dashed", borderColor: "divider", borderRadius: 2, py: 5, textAlign: "center" }}>
                <PhotoCamera sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
                <Typography fontWeight={600} mb={0.5}>
                  Take a photo of the paper
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Best with clear, well-lit, printed text. Handwriting may not scan accurately.
                </Typography>
                <Button variant="contained" component="label">
                  Open Camera
                  <input
                    ref={cameraInputRef}
                    type="file"
                    hidden
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => handleFileSelected(e.target.files?.[0])}
                  />
                </Button>
              </Box>
            )}
          </Box>
        ) : (
          <Stack spacing={2}>
            {warnings.map((w, i) => (
              <Alert key={i} severity="warning">
                {w}
              </Alert>
            ))}
            {error && <Alert severity="error">{error}</Alert>}

            <Alert severity="info" icon={hasPartsMode ? <AccountTree fontSize="small" /> : <ViewList fontSize="small" />}>
              {hasPartsMode
                ? `${draftParts.length} part(s), ${totals.sections} section(s), ${totals.questions} question(s) detected — review and edit before saving.`
                : `${totals.sections} section(s), ${totals.questions} question(s) detected — review and edit before saving.`}
            </Alert>

            <Divider />

            {hasPartsMode ? (
              <>
                {draftParts.map((part, partIndex) => (
                  <Paper
                    key={partIndex}
                    elevation={0}
                    sx={{ p: 1.5, mb: 1, border: "1px solid", borderColor: "primary.light", borderRadius: 2, bgcolor: "primary.50" }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                      <TextField
                        size="small"
                        fullWidth
                        label="Part name"
                        value={part.name}
                        onChange={(e) => updatePartName(partIndex, e.target.value)}
                      />
                      <IconButton
                        size="small"
                        color="error"
                        disabled={draftParts.length === 1}
                        onClick={() => removePart(partIndex)}
                      >
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Stack>

                    {part.sections.map((section, sectionIndex) =>
                      renderSectionBlock(partIndex, section, sectionIndex, part.sections.length)
                    )}

                    <Button
                      size="small"
                      startIcon={<Add />}
                      onClick={() => addSection(partIndex)}
                      sx={{ textTransform: "none" }}
                    >
                      Add Section to this Part
                    </Button>
                  </Paper>
                ))}

                <Button size="small" variant="outlined" startIcon={<Add />} onClick={addPart} sx={{ alignSelf: "flex-start", textTransform: "none" }}>
                  Add Part
                </Button>
              </>
            ) : (
              draftParts[0]?.sections.map((section, sectionIndex) =>
                renderSectionBlock(0, section, sectionIndex, draftParts[0].sections.length)
              )
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={extracting || committing} sx={{ textTransform: "none" }}>
          Cancel
        </Button>
        {draftParts && (
          <>
            <Button onClick={reset} disabled={committing} sx={{ textTransform: "none" }}>
              Start Over
            </Button>
            <Button
              variant="contained"
              onClick={handleCommit}
              disabled={committing || totals.questions === 0}
              startIcon={committing ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              {committing ? "Saving..." : `Import ${totals.questions} Question${totals.questions === 1 ? "" : "s"}`}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}