const Anthropic = require("@anthropic-ai/sdk");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

const Assessment = require("../models/Assessment");
const AssessmentSection = require("../models/AssessmentSection");
const AssessmentQuestion = require("../models/AssessmentQuestion");
const AssessmentPart = require("../models/AssessmentPart");
const AssessmentSubmission = require("../models/AssessmentSubmission");

const { recalculateAssessmentTotals } = require("./assessmentController");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_QUESTION_TYPES = [
  "YES_NO",
  "TEXT",
  "NUMBER",
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
];

/* =========================================================
   HELPERS (same conventions as the other assessment controllers)
========================================================= */

const getUserId = (req) => req.user?._id || req.user?.id;

const isTeacher = (user) => String(user?.role || "").toUpperCase() === "TEACHER";

const isTeacherAssignedToBatch = (user, batchId) => {
  if (!isTeacher(user)) return true;
  const assignedBatches = (user.batches || []).map((id) => id?.toString());
  return assignedBatches.includes(batchId?.toString());
};

// NOTE: same gap flagged earlier — this only restricts teachers to their
// assigned batch, org_admin/centre_admin are not scoped to their own
// organisation/centre here. Apply the same hierarchy fix here once it's
// added to the Part/Section controllers, so this stays consistent.
const getAssessmentAccess = async (assessmentId, user) => {
  const assessment = await Assessment.findById(assessmentId);
  if (!assessment) {
    return { assessment: null, error: { status: 404, message: "Assessment not found" } };
  }
  if (!isTeacherAssignedToBatch(user, assessment.batch)) {
    return {
      assessment: null,
      error: { status: 403, message: "You are not authorized to access this assessment" },
    };
  }
  return { assessment, error: null };
};

const isStructureLocked = async (assessment) => {
  const hasSubmissions = await AssessmentSubmission.exists({ assessment: assessment._id });
  return Boolean(hasSubmissions) || ["PUBLISHED", "CLOSED", "ARCHIVED"].includes(assessment.status);
};

// Strips ```json fences etc. and parses the model's response defensively.
const parseModelJson = (text) => {
  const cleaned = String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Could not find a JSON array in the model's response.");
  }

  return JSON.parse(cleaned.slice(start, end + 1));
};

const sanitizeParsedQuestions = (raw) => {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((q) => {
      const questionText = String(q?.questionText || "").trim();
      if (!questionText) return null;

      let questionType = String(q?.questionType || "TEXT").toUpperCase();
      if (!VALID_QUESTION_TYPES.includes(questionType)) questionType = "TEXT";

      let options = Array.isArray(q?.options)
        ? q.options.map((o) => String(o).trim()).filter(Boolean)
        : [];
      if (!["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(questionType)) options = [];

      let maxPoints = Number(q?.maxPoints);
      if (!Number.isFinite(maxPoints) || maxPoints < 0) maxPoints = 1;

      return {
        questionText,
        questionType,
        options,
        maxPoints,
        isRequired: q?.isRequired === false ? false : true,
        suggestedSection: q?.suggestedSection ? String(q.suggestedSection).trim() : null,
      };
    })
    .filter(Boolean);
};

const EXTRACTION_PROMPT = `You are extracting exam questions from a question paper so they can be imported into an assessment builder.

Read the provided content (text or image of a question paper) and return ONLY a JSON array — no prose, no markdown fences, no explanation before or after it.

Each item in the array must look like this:
{
  "questionText": "the full question text",
  "questionType": "YES_NO" | "TEXT" | "NUMBER" | "SINGLE_CHOICE" | "MULTIPLE_CHOICE",
  "options": ["option A", "option B"],   // only for SINGLE_CHOICE / MULTIPLE_CHOICE, else []
  "maxPoints": 2,                          // best guess from marks mentioned near the question, default 1 if not mentioned
  "isRequired": true,
  "suggestedSection": "Section A"          // section/part heading this question falls under, or null if none is visible
}

Rules:
- questionType guess: if options are lettered/numbered (A/B/C/D, 1/2/3/4) and only one answer is expected, use SINGLE_CHOICE. If multiple answers are expected ("select all that apply"), use MULTIPLE_CHOICE. If it's a yes/no or true/false question, use YES_NO. If it expects a numeric answer, use NUMBER. Otherwise use TEXT.
- Preserve the original question order.
- Do not invent questions that are not present in the source.
- Do not include answer keys or instructions as questions.
- Return [] if no questions are found.`;

/* =========================================================
   EXTRACT — parse a file into draft questions (NOT saved yet)
========================================================= */

exports.extractQuestions = async (req, res) => {
  try {
    const { assessmentId } = req.params;

    const { assessment, error } = await getAssessmentAccess(assessmentId, req.user);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    if (await isStructureLocked(assessment)) {
      return res.status(400).json({
        success: false,
        message: "Assessment structure cannot be modified after publishing, closing, archiving, or receiving submissions.",
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded." });
    }

    const { buffer, mimetype, originalname } = req.file;

    let modelContent; // Anthropic message content blocks
    let warnings = [];

    if (mimetype.startsWith("image/")) {
      modelContent = [
        {
          type: "image",
          source: { type: "base64", media_type: mimetype, data: buffer.toString("base64") },
        },
        { type: "text", text: EXTRACTION_PROMPT },
      ];
    } else if (mimetype === "application/pdf") {
      const parsed = await pdfParse(buffer);
      const text = (parsed.text || "").trim();

      if (text.length < 40) {
        return res.status(400).json({
          success: false,
          message:
            "This PDF doesn't seem to contain selectable text (likely a scanned/photographed PDF). Please use the camera/photo option instead, or upload a text-based PDF/DOCX.",
        });
      }

      modelContent = [{ type: "text", text: `${EXTRACTION_PROMPT}\n\n--- QUESTION PAPER TEXT ---\n${text}` }];
    } else if (
      mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const { value: text } = await mammoth.extractRawText({ buffer });
      if (!text || text.trim().length < 40) {
        return res.status(400).json({
          success: false,
          message: "Could not find readable text in this Word document.",
        });
      }

      modelContent = [{ type: "text", text: `${EXTRACTION_PROMPT}\n\n--- QUESTION PAPER TEXT ---\n${text}` }];
    } else {
      return res.status(400).json({
        success: false,
        message: `Unsupported file type: ${mimetype}. Upload a PDF, DOCX, or an image (JPG/PNG).`,
      });
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 8000,
      messages: [{ role: "user", content: modelContent }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock) {
      return res.status(502).json({ success: false, message: "The model did not return any text." });
    }

    let rawQuestions;
    try {
      rawQuestions = parseModelJson(textBlock.text);
    } catch (parseErr) {
      console.error("IMPORT PARSE ERROR:", parseErr, textBlock.text);
      return res.status(502).json({
        success: false,
        message: "Could not understand the extracted content. Try a clearer photo/file, or add questions manually.",
      });
    }

    const questions = sanitizeParsedQuestions(rawQuestions);

    if (questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No questions could be found in this file. Try a clearer photo, or a different file.",
      });
    }

    if (mimetype.startsWith("image/")) {
      warnings.push("Extracted from a photo — please double-check question text, options and marks before saving.");
    }

    return res.json({
      success: true,
      data: {
        fileName: originalname,
        questions,
        warnings,
      },
    });
  } catch (error) {
    console.error("EXTRACT QUESTIONS ERROR:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to extract questions." });
  }
};

/* =========================================================
   COMMIT — actually save the (reviewed/edited) questions
========================================================= */

exports.commitImportedQuestions = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { partId, sectionId, newSectionName, questions } = req.body;

    const { assessment, error } = await getAssessmentAccess(assessmentId, req.user);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    if (await isStructureLocked(assessment)) {
      return res.status(400).json({
        success: false,
        message: "Assessment structure cannot be modified after publishing, closing, archiving, or receiving submissions.",
      });
    }

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, message: "No questions to import." });
    }

    // --------------------------------------------------------
    // RESOLVE PART (only relevant if assessment.hasParts)
    // --------------------------------------------------------
    let resolvedPartId = null;
    if (assessment.hasParts) {
      if (!partId) {
        return res.status(400).json({ success: false, message: "Select a Part to import into." });
      }
      const part = await AssessmentPart.findOne({ _id: partId, assessment: assessmentId, isActive: true });
      if (!part) {
        return res.status(400).json({ success: false, message: "Invalid Part." });
      }
      resolvedPartId = part._id;
    } else if (partId) {
      return res.status(400).json({ success: false, message: "This assessment does not use Parts." });
    }

    // --------------------------------------------------------
    // RESOLVE SECTION — reuse an existing one, or create new
    // --------------------------------------------------------
    let section;
    if (sectionId) {
      section = await AssessmentSection.findOne({
        _id: sectionId,
        assessment: assessmentId,
        isActive: true,
        part: resolvedPartId,
      });
      if (!section) {
        return res.status(400).json({ success: false, message: "Selected section not found." });
      }
    } else {
      const name = String(newSectionName || "Imported Questions").trim() || "Imported Questions";
      const sectionFilter = { assessment: assessmentId, isActive: true, part: resolvedPartId };
      const count = await AssessmentSection.countDocuments(sectionFilter);
      section = await AssessmentSection.create({
        assessment: assessmentId,
        part: resolvedPartId,
        name,
        description: "",
        displayOrder: count + 1,
        isActive: true,
      });
    }

    // --------------------------------------------------------
    // INSERT QUESTIONS
    // --------------------------------------------------------
    const existingCount = await AssessmentQuestion.countDocuments({
      section: section._id,
      isActive: true,
    });

    const docs = questions.map((q, index) => {
      const questionType = VALID_QUESTION_TYPES.includes(String(q.questionType).toUpperCase())
        ? String(q.questionType).toUpperCase()
        : "TEXT";

      const options = ["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(questionType)
        ? (Array.isArray(q.options) ? q.options.map((o) => String(o).trim()).filter(Boolean) : [])
        : [];

      return {
        assessment: assessmentId,
        part: resolvedPartId,
        section: section._id,
        questionText: String(q.questionText || "").trim(),
        questionType,
        options,
        maxPoints: Number.isFinite(Number(q.maxPoints)) && Number(q.maxPoints) >= 0 ? Number(q.maxPoints) : 1,
        isRequired: q.isRequired !== false,
        displayOrder: existingCount + index + 1,
        isActive: true,
        scoringConfig: {},
      };
    });

    const validDocs = docs.filter((d) => d.questionText);
    if (validDocs.length === 0) {
      return res.status(400).json({ success: false, message: "None of the imported questions had valid text." });
    }

    const created = await AssessmentQuestion.insertMany(validDocs);

    await recalculateAssessmentTotals(assessmentId);

    return res.status(201).json({
      success: true,
      message: `${created.length} question(s) imported into "${section.name}".`,
      data: { section, questions: created },
    });
  } catch (error) {
    console.error("COMMIT IMPORT ERROR:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to import questions." });
  }
};