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
  Chip,
  Alert,
  CircularProgress,
  Divider,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import {
  UploadFile,
  PhotoCamera,
  DeleteOutline,
  Add,
} from "@mui/icons-material";
import { api } from "../../services/api";

const QUESTION_TYPES = ["YES_NO", "TEXT", "NUMBER", "SINGLE_CHOICE", "MULTIPLE_CHOICE"];

export default function AssessmentImportDialog({
  open,
  onClose,
  assessment,
  parts = [],
  sections = [],
  onImported,
}) {
  const [tab, setTab] = useState(0); // 0 = file upload, 1 = camera
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const [extracting, setExtracting] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState([]);
  const [questions, setQuestions] = useState(null); // null = nothing extracted yet

  const [targetPartId, setTargetPartId] = useState("");
  const [targetSectionId, setTargetSectionId] = useState(""); // "" = create new
  const [newSectionName, setNewSectionName] = useState("Imported Questions");

  const reset = () => {
    setQuestions(null);
    setWarnings([]);
    setError("");
    setTargetPartId("");
    setTargetSectionId("");
    setNewSectionName("Imported Questions");
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
    setQuestions(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await api.extractAssessmentQuestions(assessment._id, formData);

      if (!res?.success) {
        throw new Error(res?.message || "Could not extract questions.");
      }

      setQuestions(res.data.questions);
      setWarnings(res.data.warnings || []);
    } catch (err) {
      setError(err?.message || "Could not extract questions from this file.");
    } finally {
      setExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const updateQuestion = (index, patch) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const removeQuestion = (index) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateOption = (qIndex, optIndex, value) => {
    setQuestions((prev) => {
      const next = [...prev];
      const options = [...(next[qIndex].options || [])];
      options[optIndex] = value;
      next[qIndex] = { ...next[qIndex], options };
      return next;
    });
  };

  const addOption = (qIndex) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[qIndex] = { ...next[qIndex], options: [...(next[qIndex].options || []), ""] };
      return next;
    });
  };

  const removeOption = (qIndex, optIndex) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[qIndex] = {
        ...next[qIndex],
        options: (next[qIndex].options || []).filter((_, i) => i !== optIndex),
      };
      return next;
    });
  };

  const handleCommit = async () => {
    setError("");

    if (assessment.hasParts && !targetPartId) {
      setError("Select a Part to import into.");
      return;
    }
    if (!targetSectionId && !newSectionName.trim()) {
      setError("Enter a name for the new section, or pick an existing one.");
      return;
    }

    setCommitting(true);
    try {
      const payload = {
        partId: assessment.hasParts ? targetPartId : undefined,
        sectionId: targetSectionId || undefined,
        newSectionName: targetSectionId ? undefined : newSectionName.trim(),
        questions,
      };

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

  const partSections = sections.filter((s) =>
    assessment.hasParts ? String(s.part) === String(targetPartId) : !s.part,
  );

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Import Questions</DialogTitle>

      <DialogContent dividers>
        {!questions ? (
          <Box>
            <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
              <Tab icon={<UploadFile fontSize="small" />} iconPosition="start" label="Upload file" />
              <Tab icon={<PhotoCamera fontSize="small" />} iconPosition="start" label="Take photo" />
            </Tabs>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {extracting ? (
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 6, gap: 1.5 }}>
                <CircularProgress size={28} />
                <Typography variant="body2" color="text.secondary">
                  Reading the question paper...
                </Typography>
              </Box>
            ) : tab === 0 ? (
              <Box
                sx={{
                  border: "2px dashed",
                  borderColor: "divider",
                  borderRadius: 2,
                  py: 5,
                  textAlign: "center",
                }}
              >
                <UploadFile sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
                <Typography fontWeight={600} mb={0.5}>Upload a PDF or Word file</Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  Works best with typed question papers.
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
              <Box
                sx={{
                  border: "2px dashed",
                  borderColor: "divider",
                  borderRadius: 2,
                  py: 5,
                  textAlign: "center",
                }}
              >
                <PhotoCamera sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
                <Typography fontWeight={600} mb={0.5}>Take a photo of the paper</Typography>
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
              <Alert key={i} severity="warning">{w}</Alert>
            ))}
            {error && <Alert severity="error">{error}</Alert>}

            <Alert severity="info">
              {questions.length} question{questions.length === 1 ? "" : "s"} found — review and edit before saving.
            </Alert>

            <Divider />

            <Typography variant="caption" fontWeight={700} color="text.secondary">
              IMPORT INTO
            </Typography>

            {assessment.hasParts && (
              <FormControl size="small" fullWidth>
                <InputLabel>Part</InputLabel>
                <Select
                  label="Part"
                  value={targetPartId}
                  onChange={(e) => {
                    setTargetPartId(e.target.value);
                    setTargetSectionId("");
                  }}
                >
                  {parts.map((p) => (
                    <MenuItem key={p._id} value={p._id}>{p.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <FormControl size="small" fullWidth>
                <InputLabel>Existing section (optional)</InputLabel>
                <Select
                  label="Existing section (optional)"
                  value={targetSectionId}
                  onChange={(e) => setTargetSectionId(e.target.value)}
                  disabled={assessment.hasParts && !targetPartId}
                >
                  <MenuItem value="">— Create new section —</MenuItem>
                  {partSections.map((s) => (
                    <MenuItem key={s._id} value={s._id}>{s.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              {!targetSectionId && (
                <TextField
                  size="small"
                  fullWidth
                  label="New section name"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                />
              )}
            </Stack>

            <Divider />

            <Stack spacing={1.2}>
              {questions.map((q, index) => (
                <Box key={index} sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <TextField
                      fullWidth
                      size="small"
                      multiline
                      label={`Question ${index + 1}`}
                      value={q.questionText}
                      onChange={(e) => updateQuestion(index, { questionText: e.target.value })}
                    />
                    <IconButton size="small" onClick={() => removeQuestion(index)} sx={{ color: "error.main" }}>
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Stack>

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
                    <TextField
                      select
                      size="small"
                      label="Type"
                      value={q.questionType}
                      onChange={(e) => updateQuestion(index, { questionType: e.target.value })}
                      sx={{ minWidth: 170 }}
                    >
                      {QUESTION_TYPES.map((t) => (
                        <MenuItem key={t} value={t}>{t.replace("_", " ")}</MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      size="small"
                      type="number"
                      label="Marks"
                      value={q.maxPoints}
                      onChange={(e) => updateQuestion(index, { maxPoints: Number(e.target.value) })}
                      sx={{ maxWidth: 120 }}
                    />
                  </Stack>

                  {["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(q.questionType) && (
                    <Box sx={{ mt: 1 }}>
                      <Stack spacing={0.7}>
                        {(q.options || []).map((opt, optIndex) => (
                          <Stack direction="row" spacing={1} key={optIndex} alignItems="center">
                            <TextField
                              size="small"
                              fullWidth
                              value={opt}
                              onChange={(e) => updateOption(index, optIndex, e.target.value)}
                            />
                            <IconButton size="small" onClick={() => removeOption(index, optIndex)}>
                              <DeleteOutline fontSize="small" />
                            </IconButton>
                          </Stack>
                        ))}
                        <Button size="small" startIcon={<Add />} onClick={() => addOption(index)} sx={{ alignSelf: "flex-start", textTransform: "none" }}>
                          Add option
                        </Button>
                      </Stack>
                    </Box>
                  )}
                </Box>
              ))}
            </Stack>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={extracting || committing} sx={{ textTransform: "none" }}>
          Cancel
        </Button>
        {questions && (
          <>
            <Button onClick={reset} disabled={committing} sx={{ textTransform: "none" }}>
              Start Over
            </Button>
            <Button
              variant="contained"
              onClick={handleCommit}
              disabled={committing || questions.length === 0}
              startIcon={committing ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              {committing ? "Saving..." : `Add ${questions.length} Question${questions.length === 1 ? "" : "s"}`}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}