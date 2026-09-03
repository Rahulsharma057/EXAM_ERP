const AssessmentQuestion = require('../models/AssessmentQuestion');
const AssessmentSection = require('../models/AssessmentSection');
const { recalculateAssessmentTotals } = require('./assessmentController');

exports.createQuestion = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const {
      questionText, questionType, options,
      maxPoints, isRequired, displayOrder, scoringConfig
    } = req.body;

    const section = await AssessmentSection.findById(sectionId);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    const count = await AssessmentQuestion.countDocuments({ section: sectionId });

    const question = await AssessmentQuestion.create({
      section: sectionId,
      assessment: section.assessment,
      questionText,
      questionType: questionType || 'YES_NO',
      options: options || [],
      maxPoints: maxPoints || 1,
      isRequired: isRequired !== false,
      displayOrder: displayOrder || count + 1,
      scoringConfig: scoringConfig || {}
    });

    await recalculateAssessmentTotals(section.assessment);

    res.status(201).json({ success: true, data: question });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateQuestion = async (req, res) => {
  try {
    const question = await AssessmentQuestion.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    await recalculateAssessmentTotals(question.assessment);
    res.json({ success: true, data: question });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const question = await AssessmentQuestion.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    await AssessmentQuestion.findByIdAndUpdate(req.params.id, { isActive: false });
    await recalculateAssessmentTotals(question.assessment);

    res.json({ success: true, message: 'Question deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.reorderQuestions = async (req, res) => {
  try {
    const { questions } = req.body;

    await Promise.all(
      questions.map(({ id, displayOrder }) =>
        AssessmentQuestion.findByIdAndUpdate(id, { displayOrder })
      )
    );

    res.json({ success: true, message: 'Questions reordered' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
