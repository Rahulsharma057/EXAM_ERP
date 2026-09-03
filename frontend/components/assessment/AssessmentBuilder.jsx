'use client';
import React, { useState } from 'react';
import {
  Box, Paper, Typography, TextField, Button, IconButton,
  Card, CardContent, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, FormControl, InputLabel, Select, MenuItem,
  Divider, Grid
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import { api } from '../../services/api';

export default function AssessmentBuilder({ assessment, onUpdate }) {
  const [sections, setSections] = useState(assessment.sections || []);
  const [sectionDialog, setSectionDialog] = useState(false);
  const [questionDialog, setQuestionDialog] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [activeSectionId, setActiveSectionId] = useState(null);

  const [sectionForm, setSectionForm] = useState({ name: '', description: '', displayOrder: 1 });
  const [questionForm, setQuestionForm] = useState({
    questionText: '', questionType: 'YES_NO', maxPoints: 1, isRequired: true, options: []
  });

  const loadAssessment = async () => {
    const res = await api.getAssessment(assessment._id);
    setSections(res.data.sections || []);
    if (onUpdate) onUpdate();
  };

  const handleSaveSection = async () => {
    if (editingSection) {
      await api.updateSection(editingSection._id, sectionForm);
    } else {
      await api.createSection(assessment._id, sectionForm);
    }
    setSectionDialog(false);
    setEditingSection(null);
    setSectionForm({ name: '', description: '', displayOrder: 1 });
    await loadAssessment();
  };

  const handleSaveQuestion = async () => {
    const payload = { ...questionForm, options: questionForm.options.filter(o => o) };
    if (editingQuestion) {
      await api.updateQuestion(editingQuestion._id, payload);
    } else {
      await api.createQuestion(activeSectionId, payload);
    }
    setQuestionDialog(false);
    setEditingQuestion(null);
    setQuestionForm({ questionText: '', questionType: 'YES_NO', maxPoints: 1, isRequired: true, options: [] });
    await loadAssessment();
  };

  const handleDeleteSection = async (id) => {
    if (confirm('Delete this section and all its questions?')) {
      await api.deleteSection(id);
      await loadAssessment();
    }
  };

  const handleDeleteQuestion = async (id) => {
    if (confirm('Delete this question?')) {
      await api.deleteQuestion(id);
      await loadAssessment();
    }
  };

  const openSectionDialog = (section = null) => {
    if (section) {
      setEditingSection(section);
      setSectionForm({ name: section.name, description: section.description || '', displayOrder: section.displayOrder });
    } else {
      setEditingSection(null);
      setSectionForm({ name: '', description: '', displayOrder: sections.length + 1 });
    }
    setSectionDialog(true);
  };

  const openQuestionDialog = (sectionId, question = null) => {
    setActiveSectionId(sectionId);
    if (question) {
      setEditingQuestion(question);
      setQuestionForm({
        questionText: question.questionText,
        questionType: question.questionType,
        maxPoints: question.maxPoints,
        isRequired: question.isRequired,
        options: question.options || []
      });
    } else {
      setEditingQuestion(null);
      setQuestionForm({ questionText: '', questionType: 'YES_NO', maxPoints: 1, isRequired: true, options: [] });
    }
    setQuestionDialog(true);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Assessment Builder</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => openSectionDialog()}>
          Add Section
        </Button>
      </Box>

      {sections.map((section, idx) => (
        <Card key={section._id} sx={{ mb: 2, borderLeft: 4, borderColor: 'primary.main' }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DragHandleIcon color="action" />
                <Typography variant="h6">{section.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  ({section.questions?.length || 0} questions, {section.totalMarks} marks)
                </Typography>
              </Box>
              <Box>
                <IconButton size="small" onClick={() => openSectionDialog(section)}><EditIcon /></IconButton>
                <IconButton size="small" color="error" onClick={() => handleDeleteSection(section._id)}><DeleteIcon /></IconButton>
              </Box>
            </Box>
            {section.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{section.description}</Typography>
            )}

            <Divider sx={{ my: 1 }} />

            <Box sx={{ pl: 4 }}>
              {section.questions?.map((q, qIdx) => (
                <Paper key={q._id} sx={{ p: 2, mb: 1, bgcolor: 'grey.50' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="subtitle2">
                        {qIdx + 1}. {q.questionText}
                      </Typography>
                      <Box sx={{ mt: 0.5 }}>
                        <Chip size="small" label={q.questionType} color="primary" variant="outlined" sx={{ mr: 1 }} />
                        <Chip size="small" label={`${q.maxPoints} pts`} color="success" variant="outlined" />
                        {q.isRequired && <Chip size="small" label="Required" color="error" variant="outlined" sx={{ ml: 1 }} />}
                      </Box>
                    </Box>
                    <Box>
                      <IconButton size="small" onClick={() => openQuestionDialog(section._id, q)}><EditIcon /></IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDeleteQuestion(q._id)}><DeleteIcon /></IconButton>
                    </Box>
                  </Box>
                </Paper>
              ))}
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => openQuestionDialog(section._id)}
                sx={{ mt: 1 }}
              >
                Add Question
              </Button>
            </Box>
          </CardContent>
        </Card>
      ))}

      <Dialog open={sectionDialog} onClose={() => setSectionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingSection ? 'Edit Section' : 'Add Section'}</DialogTitle>
        <DialogContent>
          <TextField label="Section Name" fullWidth margin="normal" value={sectionForm.name} onChange={e => setSectionForm({ ...sectionForm, name: e.target.value })} />
          <TextField label="Description" fullWidth margin="normal" multiline rows={2} value={sectionForm.description} onChange={e => setSectionForm({ ...sectionForm, description: e.target.value })} />
          <TextField label="Display Order" type="number" fullWidth margin="normal" value={sectionForm.displayOrder} onChange={e => setSectionForm({ ...sectionForm, displayOrder: parseInt(e.target.value) })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSectionDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveSection}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={questionDialog} onClose={() => setQuestionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingQuestion ? 'Edit Question' : 'Add Question'}</DialogTitle>
        <DialogContent>
          <TextField label="Question Text" fullWidth margin="normal" multiline rows={2} value={questionForm.questionText} onChange={e => setQuestionForm({ ...questionForm, questionText: e.target.value })} />
          <FormControl fullWidth margin="normal">
            <InputLabel>Question Type</InputLabel>
            <Select value={questionForm.questionType} onChange={e => setQuestionForm({ ...questionForm, questionType: e.target.value })} label="Question Type">
              <MenuItem value="YES_NO">Yes / No</MenuItem>
              <MenuItem value="TEXT">Text</MenuItem>
              <MenuItem value="NUMBER">Number</MenuItem>
              <MenuItem value="SINGLE_CHOICE">Single Choice</MenuItem>
              <MenuItem value="MULTIPLE_CHOICE">Multiple Choice</MenuItem>
            </Select>
          </FormControl>
          <TextField label="Maximum Points" type="number" fullWidth margin="normal" value={questionForm.maxPoints} onChange={e => setQuestionForm({ ...questionForm, maxPoints: parseInt(e.target.value) || 0 })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQuestionDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveQuestion}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
