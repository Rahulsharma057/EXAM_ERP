const { PDFParse } = require("pdf-parse");
const mammoth = require("mammoth");
const Tesseract = require("tesseract.js");

const Assessment = require("../models/Assessment");
const AssessmentSection = require("../models/AssessmentSection");
const AssessmentQuestion = require("../models/AssessmentQuestion");
const AssessmentPart = require("../models/AssessmentPart");
const AssessmentSubmission = require("../models/AssessmentSubmission");

const { recalculateAssessmentTotals } = require("./assessmentController");

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

/* =========================================================
   FREE / LOCAL QUESTION-PAPER PARSER
   ---------------------------------------------------------
   No paid AI API involved. Works off plain text (extracted
   from PDF/DOCX directly, or via free OCR for images) using
   regex + heuristics to split a question paper into a
   Part -> Section -> Question tree (or a flat Section ->
   Question list when the assessment does not use Parts).

   Detection rules (heuristic, not AI understanding):
   - "Part <label>" headings start a new Part (only when the
     assessment uses Parts)
   - "Section <label>" headings start a new Section inside
     the current Part (or at the top level otherwise)
   - Numbered lines ("1.", "Q1)", "Q1:") start a new Question
   - Lettered lines ("A)", "(a)", "A.") directly under a
     question are treated as its options
   - "[2 marks]" / "(2 pts)" patterns set maxPoints
   - Questions found before any Section heading are grouped
     under an implicit "General" section; before any Part
     heading, under an implicit "Part 1"
========================================================= */

const QUESTION_START_RE = /^\s*(?:Q\.?\s*)?(\d{1,3})\s*[\.\):]\s+(.*)$/i;
const OPTION_LINE_RE = /^\s*\(?([A-Da-d])\)?[\.\):]\s+(.*)$/;
const PART_HEADING_RE = /^\s*part\s+([A-Za-z0-9]+)\b[:\-\s]*(.*)$/i;
const SECTION_HEADING_RE = /^\s*section\s+([A-Za-z0-9]+)\b[:\-\s]*(.*)$/i;
const MARKS_RE = /\(?\[?(\d+(?:\.\d+)?)\s*(?:marks?|pts?|points?)\]?\)?/i;
const MULTI_SELECT_HINT_RE = /select all that apply|choose all|more than one answer|check all/i;
const TRUE_FALSE_RE = /true\s*\/\s*false|true or false/i;
const YES_NO_RE = /yes\s*\/\s*no|yes or no/i;
const NUMBER_HINT_RE = /calculate|how many|what is the (value|sum|result|answer)|find the value|numeric answer/i;
const OPTIONAL_HINT_RE = /\(optional\)/i;

const cleanLine = (line) => String(line || "").replace(/\r/g, "").trim();

const extractMarks = (text) => {
  const match = text.match(MARKS_RE);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
};

const detectQuestionType = (questionText, optionLines) => {
  if (optionLines.length >= 2) {
    return MULTI_SELECT_HINT_RE.test(questionText) ? "MULTIPLE_CHOICE" : "SINGLE_CHOICE";
  }
  if (TRUE_FALSE_RE.test(questionText) || YES_NO_RE.test(questionText)) {
    return "YES_NO";
  }
  if (NUMBER_HINT_RE.test(questionText)) {
    return "NUMBER";
  }
  return "TEXT";
};

const headingLabel = (keyword, id, rest) => {
  const label = `${keyword} ${id}`.trim();
  return rest ? `${label}: ${rest}`.trim() : label;
};

/**
 * Parses raw text of a question paper into a Part -> Section -> Question
 * tree (hasParts = true) or a flat Section -> Question list (hasParts =
 * false). No AI call — pure regex/heuristics.
 */
const parseStructuredQuestions = (rawText, hasParts) => {
  const lines = String(rawText || "")
    .split("\n")
    .map(cleanLine)
    .filter((line) => line.length > 0);

  const parts = []; // used when hasParts = true
  const flatSections = []; // used when hasParts = false

  let currentPart = null;
  let currentSection = null;

  let currentQuestion = null;
  let bodyLines = [];
  let optionLines = [];

  const findOrCreatePart = (name) => {
    let part = parts.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (!part) {
      part = { name, sections: [] };
      parts.push(part);
    }
    return part;
  };

  const findOrCreateSectionIn = (sectionsArr, name) => {
    let section = sectionsArr.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (!section) {
      section = { name, questions: [] };
      sectionsArr.push(section);
    }
    return section;
  };

  const getActiveSectionsArray = () => {
    if (!hasParts) return flatSections;
    if (!currentPart) {
      currentPart = findOrCreatePart("Part 1");
    }
    return currentPart.sections;
  };

  const ensureCurrentSection = () => {
    const sectionsArr = getActiveSectionsArray();
    if (!currentSection || !sectionsArr.includes(currentSection)) {
      currentSection = findOrCreateSectionIn(sectionsArr, "General");
    }
    return currentSection;
  };

  const flushCurrentQuestion = () => {
    if (!currentQuestion) return;

    const fullBody = [currentQuestion.firstLine, ...bodyLines].join(" ").trim();
    const marks = extractMarks(fullBody);
    const options = optionLines.map((opt) => opt.replace(OPTION_LINE_RE, "$2").trim());
    const questionText = fullBody.replace(MARKS_RE, "").trim();

    if (questionText) {
      const section = ensureCurrentSection();
      section.questions.push({
        questionText,
        questionType: detectQuestionType(fullBody, options),
        options,
        maxPoints: marks !== null ? marks : 1,
        isRequired: !OPTIONAL_HINT_RE.test(fullBody),
      });
    }

    currentQuestion = null;
    bodyLines = [];
    optionLines = [];
  };

  for (const line of lines) {
    if (hasParts) {
      const partMatch = line.match(PART_HEADING_RE);
      if (partMatch) {
        flushCurrentQuestion();
        currentPart = findOrCreatePart(headingLabel("Part", partMatch[1], partMatch[2]));
        currentSection = null;
        continue;
      }
    }

    const sectionMatch = line.match(SECTION_HEADING_RE);
    if (sectionMatch) {
      flushCurrentQuestion();
      const sectionsArr = getActiveSectionsArray();
      currentSection = findOrCreateSectionIn(sectionsArr, headingLabel("Section", sectionMatch[1], sectionMatch[2]));
      continue;
    }

    // If this assessment has no Parts, still treat a stray "Part X" line
    // as a section-level boundary rather than losing it entirely.
    if (!hasParts) {
      const partAsSectionMatch = line.match(PART_HEADING_RE);
      if (partAsSectionMatch) {
        flushCurrentQuestion();
        currentSection = findOrCreateSectionIn(
          flatSections,
          headingLabel("Part", partAsSectionMatch[1], partAsSectionMatch[2])
        );
        continue;
      }
    }

    const questionMatch = line.match(QUESTION_START_RE);
    if (questionMatch) {
      flushCurrentQuestion();
      currentQuestion = { number: questionMatch[1], firstLine: questionMatch[2] };
      continue;
    }

    const optionMatch = line.match(OPTION_LINE_RE);
    if (optionMatch && currentQuestion) {
      optionLines.push(line);
      continue;
    }

    if (currentQuestion) {
      bodyLines.push(line);
    }
    // Lines before the first detected question number are ignored
    // (typically paper title, instructions, student name fields, etc.)
  }

  flushCurrentQuestion();

  if (hasParts) {
    return parts
      .map((part) => ({
        name: part.name,
        sections: part.sections.filter((s) => s.questions.length > 0),
      }))
      .filter((part) => part.sections.length > 0);
  }

  return flatSections.filter((s) => s.questions.length > 0);
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
      };
    })
    .filter(Boolean);
};

const buildQuestionDocs = (questions, assessmentId, partId, sectionId) => {
  return questions
    .map((q, index) => {
      const questionText = String(q?.questionText || "").trim();
      if (!questionText) return null;

      const questionType = VALID_QUESTION_TYPES.includes(String(q?.questionType).toUpperCase())
        ? String(q.questionType).toUpperCase()
        : "TEXT";

      const options = ["SINGLE_CHOICE", "MULTIPLE_CHOICE"].includes(questionType)
        ? (Array.isArray(q?.options) ? q.options.map((o) => String(o).trim()).filter(Boolean) : [])
        : [];

      return {
        assessment: assessmentId,
        part: partId,
        section: sectionId,
        questionText,
        questionType,
        options,
        maxPoints: Number.isFinite(Number(q?.maxPoints)) && Number(q.maxPoints) >= 0 ? Number(q.maxPoints) : 1,
        isRequired: q?.isRequired !== false,
        displayOrder: index + 1,
        isActive: true,
        scoringConfig: {},
      };
    })
    .filter(Boolean);
};

/* =========================================================
   EXTRACT — parse a file into a draft Part/Section/Question
   tree (NOT saved yet)
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

    let text = "";
    let warnings = [];

    if (mimetype.startsWith("image/")) {
      warnings.push(
        "Extracted from a photo using free OCR — accuracy is lower than a text-based file, especially for handwriting. Please review the detected structure carefully before saving."
      );

      const {
        data: { text: ocrText },
      } = await Tesseract.recognize(buffer, "eng");

      text = ocrText || "";

      if (text.trim().length < 20) {
        return res.status(400).json({
          success: false,
          message:
            "Could not read readable text from this photo. Try a clearer, well-lit photo of a printed (not handwritten) question paper, or upload a text-based PDF/DOCX instead.",
        });
      }
    } else if (mimetype === "application/pdf") {
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        text = (result?.text || "").trim();
      } finally {
        await parser.destroy();
      }

      if (text.length < 40) {
        return res.status(400).json({
          success: false,
          message:
            "This PDF doesn't seem to contain selectable text (likely a scanned/photographed PDF). Please use the camera/photo option instead, or upload a text-based PDF/DOCX.",
        });
      }
    } else if (
      mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const { value: docText } = await mammoth.extractRawText({ buffer });
      text = (docText || "").trim();

      if (text.length < 40) {
        return res.status(400).json({
          success: false,
          message: "Could not find readable text in this Word document.",
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: `Unsupported file type: ${mimetype}. Upload a PDF, DOCX, or an image (JPG/PNG).`,
      });
    }

    const hasParts = Boolean(assessment.hasParts);
    const rawStructure = parseStructuredQuestions(text, hasParts);

    let totalQuestions = 0;
    let structure;

    if (hasParts) {
      structure = rawStructure
        .map((part) => ({
          name: part.name,
          sections: part.sections
            .map((section) => {
              const questions = sanitizeParsedQuestions(section.questions);
              totalQuestions += questions.length;
              return { name: section.name, questions };
            })
            .filter((section) => section.questions.length > 0),
        }))
        .filter((part) => part.sections.length > 0);
    } else {
      structure = rawStructure
        .map((section) => {
          const questions = sanitizeParsedQuestions(section.questions);
          totalQuestions += questions.length;
          return { name: section.name, questions };
        })
        .filter((section) => section.questions.length > 0);
    }

    if (totalQuestions === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No questions could be detected in this file. This free parser relies on numbered questions (e.g. \"1.\", \"Q1)\") and headings like \"Part A\" / \"Section 1\" — try a clearer file, a different format, or add questions manually.",
      });
    }

    warnings.push(
      "Parts, Sections and Questions were auto-detected using free local parsing (no AI) based on headings and numbering — please review the structure before saving."
    );

    return res.json({
      success: true,
      data: {
        fileName: originalname,
        hasParts,
        structure,
        warnings,
      },
    });
  } catch (error) {
    console.error("EXTRACT QUESTIONS ERROR:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to extract questions." });
  }
};

/* =========================================================
   COMMIT — actually save the (reviewed/edited) Part/Section/
   Question tree
========================================================= */

exports.commitImportedQuestions = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { structure } = req.body;

    const { assessment, error } = await getAssessmentAccess(assessmentId, req.user);
    if (error) return res.status(error.status).json({ success: false, message: error.message });

    if (await isStructureLocked(assessment)) {
      return res.status(400).json({
        success: false,
        message: "Assessment structure cannot be modified after publishing, closing, archiving, or receiving submissions.",
      });
    }

    if (!Array.isArray(structure) || structure.length === 0) {
      return res.status(400).json({ success: false, message: "No questions to import." });
    }

    let createdParts = 0;
    let createdSections = 0;
    let createdQuestions = 0;

    if (assessment.hasParts) {
      let partOrder = await AssessmentPart.countDocuments({ assessment: assessmentId, isActive: true });

      for (const partInput of structure) {
        const sectionsInput = Array.isArray(partInput?.sections) ? partInput.sections : [];
        const hasAnyQuestion = sectionsInput.some(
          (s) => Array.isArray(s?.questions) && s.questions.length > 0
        );
        if (!hasAnyQuestion) continue;

        const partName = String(partInput?.name || "Imported Part").trim() || "Imported Part";

        partOrder += 1;
        const part = await AssessmentPart.create({
          assessment: assessmentId,
          name: partName,
          description: "",
          isOptional: false,
          displayOrder: partOrder,
          isActive: true,
          createdBy: getUserId(req),
          updatedBy: getUserId(req),
        });
        createdParts += 1;

        let sectionOrder = 0;

        for (const sectionInput of sectionsInput) {
          const questions = Array.isArray(sectionInput?.questions) ? sectionInput.questions : [];
          if (questions.length === 0) continue;

          const sectionName = String(sectionInput?.name || "Imported Questions").trim() || "Imported Questions";

          sectionOrder += 1;
          const section = await AssessmentSection.create({
            assessment: assessmentId,
            part: part._id,
            name: sectionName,
            description: "",
            displayOrder: sectionOrder,
            isActive: true,
          });
          createdSections += 1;

          const docs = buildQuestionDocs(questions, assessmentId, part._id, section._id);
          if (docs.length) {
            await AssessmentQuestion.insertMany(docs);
            createdQuestions += docs.length;
          }
        }
      }
    } else {
      let sectionOrder = await AssessmentSection.countDocuments({
        assessment: assessmentId,
        isActive: true,
        part: null,
      });

      for (const sectionInput of structure) {
        const questions = Array.isArray(sectionInput?.questions) ? sectionInput.questions : [];
        if (questions.length === 0) continue;

        const sectionName = String(sectionInput?.name || "Imported Questions").trim() || "Imported Questions";

        sectionOrder += 1;
        const section = await AssessmentSection.create({
          assessment: assessmentId,
          part: null,
          name: sectionName,
          description: "",
          displayOrder: sectionOrder,
          isActive: true,
        });
        createdSections += 1;

        const docs = buildQuestionDocs(questions, assessmentId, null, section._id);
        if (docs.length) {
          await AssessmentQuestion.insertMany(docs);
          createdQuestions += docs.length;
        }
      }
    }

    if (createdQuestions === 0) {
      return res.status(400).json({ success: false, message: "None of the imported questions had valid text." });
    }

    await recalculateAssessmentTotals(assessmentId);

    const message = assessment.hasParts
      ? `${createdQuestions} question(s) imported across ${createdParts} part(s) and ${createdSections} section(s).`
      : `${createdQuestions} question(s) imported across ${createdSections} section(s).`;

    return res.status(201).json({
      success: true,
      message,
      data: { createdParts, createdSections, createdQuestions },
    });
  } catch (error) {
    console.error("COMMIT IMPORT ERROR:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to import questions." });
  }
};