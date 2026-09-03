const AssessmentSection = require('../models/AssessmentSection');
const AssessmentQuestion = require('../models/AssessmentQuestion');
const Assessment = require('../models/Assessment');
const { recalculateAssessmentTotals } = require('./assessmentController');

exports.createSection = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { name, description, displayOrder } = req.body;

    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    const section = await AssessmentSection.create({
      assessment: assessmentId,
      name,
      description,
      displayOrder: displayOrder || (await AssessmentSection.countDocuments({ assessment: assessmentId })) + 1
    });

    await recalculateAssessmentTotals(assessmentId);

    res.status(201).json({ success: true, data: section });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSection = async (req, res) => {
  try {
    const section = await AssessmentSection.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    await recalculateAssessmentTotals(section.assessment);
    res.json({ success: true, data: section });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteSection = async (req, res) => {
  try {
    const section = await AssessmentSection.findById(req.params.id);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    await AssessmentSection.findByIdAndUpdate(req.params.id, { isActive: false });
    await AssessmentQuestion.updateMany({ section: req.params.id }, { isActive: false });
    await recalculateAssessmentTotals(section.assessment);

    res.json({ success: true, message: 'Section deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.reorderSections = async (req, res) => {
  try {
    const { sections } = req.body; // [{ id, displayOrder }]

    await Promise.all(
      sections.map(({ id, displayOrder }) =>
        AssessmentSection.findByIdAndUpdate(id, { displayOrder })
      )
    );

    res.json({ success: true, message: 'Sections reordered' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
