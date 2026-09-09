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
   No paid AI API involved. Works off the raw text extracted
   from a PDF/DOCX (or via free OCR for images).

   Real-world PDFs frequently lose true line breaks when their
   text is extracted (headings end up glued onto the end of the
   previous line). So instead of splitting by line, this parser
   scans the WHOLE text as one string and finds question
   boundaries using a strict, self-correcting sequential number
   scan ("1.", "2.", "3." ... must increase by exactly 1 to be
   accepted — this rejects incidental numbers like "(Yes=3, No=0)"
   or "-- 1 of 2 --").

   For each question's raw text block:
   - lettered option lists (A) B) C) ...) are detected and
     pulled out as options
   - a trailing "(Yes=N, No=0)" or "[N marks]" pattern sets
     maxPoints (and, for the Yes/No form, marks the question as
     YES_NO type)
   - any short leftover text AFTER that pattern is treated as
     the heading for the NEXT block (this is what recovers
     headings that got glued onto the end of a question)

   Explicit "Part <label>" / "Section <label>" headings (only
   when literally present) are still honoured. Any other
   detected heading is treated as a Section name — this parser
   cannot reliably tell a Part-level heading apart from a
   Section-level one when the source document doesn't label
   them, so everything lands under a single implicit Part in
   that case. Rename/regroup manually in the review screen if
   the source paper actually has multiple Parts without saying
   "Part".
========================================================= */

const NUMBER_TOKEN_RE = /(?<![\w.=])(\d{1,3})[.)]\s+/g;
const OPTION_TOKEN_RE = /(?<![\w.])([A-D])[.)]\s+/g;
const PART_HEADING_RE = /^part\s+([A-Za-z0-9]+)\b[:\-\s]*(.*)$/i;
const SECTION_HEADING_RE = /^section\s+([A-Za-z0-9]+)\b[:\-\s]*(.*)$/i;
// A heading ending in "(...)" — e.g. "Basic Bodice (Sample)", "Unit 2 (Variation)" —
// is treated as a Part-level heading even without the literal word "Part". This is a
// common way real assessment papers label major variants/groups.
const PART_LIKE_QUALIFIER_RE = /\([^)]*\)\s*$/;
const YES_NO_MARKS_RE = /\(?\s*yes\s*=\s*(\d+(?:\.\d+)?)\s*,?\s*no\s*=\s*0\s*\)?/i;
const GENERIC_MARKS_RE = /\(?\[?(\d+(?:\.\d+)?)\s*(?:marks?|pts?|points?)\]?\)?/i;
const YES_EQUALS_RE = /yes\s*=\s*\d/i;
const MULTI_SELECT_HINT_RE = /select all that apply|choose all|more than one answer|check all/i;
const TRUE_FALSE_RE = /true\s*\/\s*false|true or false/i;
const YES_NO_SLASH_RE = /yes\s*\/\s*no|yes or no/i;
const NUMBER_HINT_RE = /calculate|how many|what is the (value|sum|result|answer)|find the value|numeric answer/i;
const OPTIONAL_HINT_RE = /\(optional\)/i;
const PAGE_BREAK_ARTIFACT_RE = /--\s*\d+\s*of\s*\d+\s*--/gi;

const headingLabel = (keyword, id, rest) => {
  const label = `${keyword} ${id}`.trim();
  return rest ? `${label}: ${rest}`.trim() : label;
};

/**
 * Finds question-start boundaries in the whole text using a strict
 * sequential scan: the first accepted number must be 1, 2 or 3, and
 * every subsequent accepted number must be exactly one more than the
 * last. Anything that breaks the sequence is ignored as noise
 * (marks like "(Yes=3, No=0)", page-break artifacts, etc).
 */
const findQuestionBoundaries = (text) => {
  const rawMatches = [];
  let match;
  NUMBER_TOKEN_RE.lastIndex = 0;
  while ((match = NUMBER_TOKEN_RE.exec(text)) !== null) {
    rawMatches.push({
      number: Number(match[1]),
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  const boundaries = [];
  let expected = null;

  for (const m of rawMatches) {
    if (expected === null) {
      if (m.number >= 1 && m.number <= 3) {
        boundaries.push(m);
        expected = m.number + 1;
      }
      continue;
    }
    if (m.number === expected) {
      boundaries.push(m);
      expected += 1;
    }
    // else: skip — breaks the sequence, treated as noise
  }

  return boundaries;
};

/** Pulls a sequential A) B) C) (D)) option list out of a question's raw text. */
const extractOptions = (raw) => {
  const rawMatches = [];
  let m;
  OPTION_TOKEN_RE.lastIndex = 0;
  while ((m = OPTION_TOKEN_RE.exec(raw)) !== null) {
    rawMatches.push({ letter: m[1].toUpperCase(), start: m.index, end: m.index + m[0].length });
  }

  const sequence = "ABCD";
  const accepted = [];
  let expectedIdx = 0;
  for (const m2 of rawMatches) {
    if (m2.letter === sequence[expectedIdx]) {
      accepted.push(m2);
      expectedIdx += 1;
      if (expectedIdx >= sequence.length) break;
    }
  }

  if (accepted.length < 2) {
    return { questionCore: raw, options: [] };
  }

  const questionCore = raw.slice(0, accepted[0].start).trim();
  const options = accepted.map((opt, i) => {
    const start = opt.end;
    const end = i + 1 < accepted.length ? accepted[i + 1].start : raw.length;
    return raw.slice(start, end).trim();
  });

  return { questionCore, options };
};

/**
 * Separates a question's marks annotation from a possible trailing
 * heading fragment that got glued onto it during text extraction.
 */
const extractMarksAndHeading = (raw) => {
  const yesNoMatch = raw.match(YES_NO_MARKS_RE);
  const genericMatch = raw.match(GENERIC_MARKS_RE);

  let questionText = raw.trim();
  let maxPoints = 1;
  let trailingHeading = null;
  let chosen = null;

  if (yesNoMatch && genericMatch) {
    chosen =
      raw.indexOf(yesNoMatch[0]) >= raw.indexOf(genericMatch[0])
        ? { match: yesNoMatch, strip: false }
        : { match: genericMatch, strip: true };
  } else if (yesNoMatch) {
    chosen = { match: yesNoMatch, strip: false };
  } else if (genericMatch) {
    chosen = { match: genericMatch, strip: true };
  }

  if (chosen) {
    const { match, strip } = chosen;
    maxPoints = Number(match[1]) || 1;

    const matchEnd = raw.indexOf(match[0]) + match[0].length;
    const before = raw.slice(0, matchEnd);
    const after = raw.slice(matchEnd).trim();

    questionText = strip ? before.replace(match[0], "").trim() : before.trim();

    if (after) {
      const wordCount = after.split(/\s+/).filter(Boolean).length;
      if (wordCount > 0 && wordCount <= 8) {
        trailingHeading = after.replace(/[-\u2013\u2014]+$/, "").trim();
      } else {
        // Doesn't look like a short heading — keep it attached rather than lose it
        questionText = `${questionText} ${after}`.trim();
      }
    }
  }

  questionText = questionText.replace(PAGE_BREAK_ARTIFACT_RE, "").trim();
  if (trailingHeading) {
    trailingHeading = trailingHeading.replace(PAGE_BREAK_ARTIFACT_RE, "").trim();
    if (!trailingHeading) trailingHeading = null;
  }

  return { questionText, maxPoints, trailingHeading };
};

/**
 * Splits a heading fragment around its first "(...)" qualifier, so a glued
 * blob like "Basic Bodice (Sample) Online Research" becomes two separate
 * headings: "Basic Bodice (Sample)" (Part-like) and "Online Research"
 * (Section-like), instead of one combined string.
 */
const splitHeadingFragments = (text) => {
  const cleaned = String(text || "").trim();
  if (!cleaned) return [];

  const match = cleaned.match(/^(.*?\([^)]*\))\s*(.*)$/);
  if (match) {
    const first = match[1].trim();
    const rest = match[2].trim();
    return rest ? [first, rest] : [first];
  }

  return [cleaned];
};

/** Best-effort heading recovery from the text that appears before Question 1. */
const extractPreambleHeading = (preamble) => {
  const cleaned = preamble.replace(PAGE_BREAK_ARTIFACT_RE, "").trim();
  if (!cleaned) return null;

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const last = sentences[sentences.length - 1] || "";
  const wordCount = last.split(/\s+/).filter(Boolean).length;

  if (
    wordCount > 0 &&
    wordCount <= 8 &&
    !/assessment|prepared|question bank|instructions?/i.test(last)
  ) {
    return last.replace(/\.$/, "").trim();
  }

  return null;
};

const detectQuestionType = (questionText, options) => {
  if (options.length >= 2) {
    return MULTI_SELECT_HINT_RE.test(questionText) ? "MULTIPLE_CHOICE" : "SINGLE_CHOICE";
  }
  if (YES_EQUALS_RE.test(questionText) || TRUE_FALSE_RE.test(questionText) || YES_NO_SLASH_RE.test(questionText)) {
    return "YES_NO";
  }
  if (NUMBER_HINT_RE.test(questionText)) {
    return "NUMBER";
  }
  return "TEXT";
};

/**
 * Parses raw text of a question paper into a Part -> Section -> Question
 * tree (hasParts = true) or a flat Section -> Question list (hasParts =
 * false). No AI call — pure regex/heuristics, robust to lost line breaks.
 */
const parseStructuredQuestions = (rawText, hasParts) => {
  const normalized = String(rawText || "").replace(/\s+/g, " ").trim();
  const boundaries = findQuestionBoundaries(normalized);

  if (boundaries.length === 0) {
    return hasParts ? [] : [];
  }

  const parts = [];
  const flatSections = [];

  let currentPart = null;
  let currentSection = null;
  let pendingHeadingQueue = splitHeadingFragments(
    extractPreambleHeading(normalized.slice(0, boundaries[0].start)) || ""
  );

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

  const applyPendingHeadings = () => {
    while (pendingHeadingQueue.length > 0) {
      const heading = pendingHeadingQueue.shift();
      if (!heading) continue;

      if (hasParts) {
        const partMatch = heading.match(PART_HEADING_RE);
        const looksLikePart = Boolean(partMatch) || PART_LIKE_QUALIFIER_RE.test(heading);

        if (looksLikePart) {
          const partName = partMatch
            ? headingLabel("Part", partMatch[1], partMatch[2])
            : heading;
          currentPart = findOrCreatePart(partName);
          currentSection = null;
          continue;
        }
      }

      const sectionMatch = heading.match(SECTION_HEADING_RE);
      const sectionName = sectionMatch
        ? headingLabel("Section", sectionMatch[1], sectionMatch[2])
        : heading;
      const sectionsArr = getActiveSectionsArray();
      currentSection = findOrCreateSectionIn(sectionsArr, sectionName);
    }

    if (!currentSection) {
      const sectionsArr = getActiveSectionsArray();
      currentSection = findOrCreateSectionIn(sectionsArr, "General");
    }
  };

  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i].end;
    const end = i + 1 < boundaries.length ? boundaries[i + 1].start : normalized.length;
    const rawBlock = normalized.slice(start, end).trim();

    const { questionCore, options } = extractOptions(rawBlock);
    const { questionText, maxPoints, trailingHeading } = extractMarksAndHeading(questionCore);

    applyPendingHeadings();

    if (questionText) {
      currentSection.questions.push({
        questionText,
        questionType: detectQuestionType(questionText, options),
        options,
        maxPoints,
        isRequired: !OPTIONAL_HINT_RE.test(questionText),
      });
    }

    if (trailingHeading) {
      pendingHeadingQueue.push(...splitHeadingFragments(trailingHeading));
    }
  }

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
          "No questions could be detected in this file. This free parser relies on numbered questions (e.g. \"1.\", \"Q1)\") — try a clearer file, a different format, or add questions manually.",
      });
    }

    warnings.push(
      "Parts, Sections and Questions were auto-detected using free local parsing (no AI) based on headings, marks patterns and numbering — please review the structure before saving. Headings that don't explicitly say \"Part\" are grouped as Sections under a single Part."
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