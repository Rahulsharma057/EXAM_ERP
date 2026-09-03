const xlsx = require('xlsx');
const Assessment = require('../models/Assessment');
const AssessmentSection = require('../models/AssessmentSection');
const AssessmentQuestion = require('../models/AssessmentQuestion');
const AssessmentSubmission = require('../models/AssessmentSubmission');
const AssessmentAnswer = require('../models/AssessmentAnswer');
const Student = require('../models/Student');
const Batch = require('../models/Batch');
const { calculateSubmissionScores } = require('./submissionController');

exports.exportTemplate = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const assessment = await Assessment.findById(assessmentId)
      .populate('batch', 'name')
      .populate('course', 'name')
      .populate('centre', 'name')
      .populate('organisation', 'name');

    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    const sections = await AssessmentSection.find({ assessment: assessmentId, isActive: true })
      .sort('displayOrder');

    const students = await Student.find({ batch: assessment.batch, isActive: true })
      .sort('rollNumber')
      .select('rollNumber name');

    const headers = ['Roll Number', 'Student Name'];
    const sectionQuestions = [];

    for (const section of sections) {
      const questions = await AssessmentQuestion.find({
        section: section._id,
        isActive: true
      }).sort('displayOrder');

      for (const q of questions) {
        headers.push(`${section.name} - ${q.questionText} (Max: ${q.maxPoints})`);
        sectionQuestions.push({ sectionId: section._id, questionId: q._id, maxPoints: q.maxPoints });
      }
    }

    headers.push('Total', 'Percentage', 'Status');

    const rows = students.map(student => {
      const row = { 'Roll Number': student.rollNumber, 'Student Name': student.name };
      sectionQuestions.forEach(sq => {
        row[`${sq.sectionId}_${sq.questionId}`] = '';
      });
      row['Total'] = '';
      row['Percentage'] = '';
      row['Status'] = 'PENDING';
      return row;
    });

    const ws = xlsx.utils.json_to_sheet(rows, { header: headers });
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Marks Entry');

    const metaData = [
      ['Assessment', assessment.name],
      ['Week', assessment.weekNumber],
      ['Batch', assessment.batch.name],
      ['Course', assessment.course.name],
      ['Centre', assessment.centre.name],
      ['Organisation', assessment.organisation.name],
      ['Total Marks', assessment.totalMarks],
      ['Instructions', 'Enter YES/NO for Yes/No questions. Do NOT modify Total/Percentage - backend recalculates.']
    ];
    const metaWs = xlsx.utils.aoa_to_sheet(metaData);
    xlsx.utils.book_append_sheet(wb, metaWs, 'Metadata');

    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `${assessment.organisation.name}_${assessment.centre.name}_${assessment.course.name}_${assessment.batch.name}_Week${String(assessment.weekNumber).padStart(2, '0')}.xlsx`
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.exportResults = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const assessment = await Assessment.findById(assessmentId)
      .populate('batch', 'name')
      .populate('course', 'name')
      .populate('centre', 'name')
      .populate('organisation', 'name');

    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    const sections = await AssessmentSection.find({ assessment: assessmentId, isActive: true })
      .sort('displayOrder');

    const students = await Student.find({ batch: assessment.batch, isActive: true })
      .sort('rollNumber');

    const submissions = await AssessmentSubmission.find({
      assessment: assessmentId
    }).populate('student', 'rollNumber');

    const subMap = {};
    submissions.forEach(s => { subMap[s.student.rollNumber] = s; });

    const headers = ['Roll Number', 'Student Name'];
    sections.forEach(s => {
      headers.push(`${s.name} (Obtained)`, `${s.name} (Max)`, `${s.name} (%)`);
    });
    headers.push('Total Obtained', 'Total Max', 'Overall %', 'Status');

    const rows = students.map(student => {
      const sub = subMap[student.rollNumber];
      const row = {
        'Roll Number': student.rollNumber,
        'Student Name': student.name
      };

      let totalObtained = 0;
      let totalMax = 0;

      sections.forEach(section => {
        const secScore = sub?.sectionScores.find(s => 
          s.sectionId.toString() === section._id.toString()
        );
        const obtained = secScore?.obtainedMarks || 0;
        const max = secScore?.maxMarks || section.totalMarks;
        const pct = max > 0 ? ((obtained / max) * 100).toFixed(2) + '%' : '0%';

        row[`${section.name} (Obtained)`] = obtained;
        row[`${section.name} (Max)`] = max;
        row[`${section.name} (%)`] = pct;

        totalObtained += obtained;
        totalMax += max;
      });

      row['Total Obtained'] = totalObtained;
      row['Total Max'] = totalMax;
      row['Overall %'] = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(2) + '%' : '0%';
      row['Status'] = sub?.status || 'PENDING';

      return row;
    });

    const ws = xlsx.utils.json_to_sheet(rows, { header: headers });
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Results');

    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `${assessment.organisation.name}_${assessment.centre.name}_${assessment.course.name}_${assessment.batch.name}_Week${String(assessment.weekNumber).padStart(2, '0')}_Results.xlsx`
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.importMarks = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { assessmentId } = req.params;
    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    if (assessment.status !== 'PUBLISHED') {
      return res.status(400).json({ success: false, message: 'Assessment must be published to import marks' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws);

    const sections = await AssessmentSection.find({ assessment: assessmentId, isActive: true })
      .sort('displayOrder');

    const sectionQuestions = [];
    for (const section of sections) {
      const questions = await AssessmentQuestion.find({
        section: section._id,
        isActive: true
      }).sort('displayOrder');
      sectionQuestions.push({ section, questions });
    }

    const students = await Student.find({ batch: assessment.batch, isActive: true });
    const studentMap = {};
    students.forEach(s => { studentMap[s.rollNumber] = s; });

    const results = { success: [], failed: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rollNumber = row['Roll Number']?.toString().trim();

      if (!rollNumber) {
        results.failed.push({ row: i + 2, reason: 'Roll Number missing' });
        continue;
      }

      const student = studentMap[rollNumber];
      if (!student) {
        results.failed.push({ row: i + 2, rollNumber, reason: 'Student not found in batch' });
        continue;
      }

      const answers = [];
      let hasData = false;

      for (const sq of sectionQuestions) {
        for (const q of sq.questions) {
          const colName = `${sq.section.name} - ${q.questionText} (Max: ${q.maxPoints})`;
          const val = row[colName];

          if (val !== undefined && val !== null && val !== '') {
            hasData = true;
            let answerValue = val.toString().trim().toUpperCase();

            if (q.questionType === 'YES_NO') {
              if (!['YES', 'NO'].includes(answerValue)) {
                results.failed.push({ 
                  row: i + 2, 
                  rollNumber, 
                  reason: `Invalid value for Yes/No question: ${val}` 
                });
                continue;
              }
            }

            answers.push({ questionId: q._id.toString(), answerValue });
          }
        }
      }

      if (!hasData) {
        results.failed.push({ row: i + 2, rollNumber, reason: 'No marks found for student' });
        continue;
      }

      await AssessmentSubmission.deleteOne({ assessment: assessmentId, student: student._id });
      await AssessmentAnswer.deleteMany({ assessment: assessmentId, student: student._id });

      const sectionSnapshot = [];
      for (const sq of sectionQuestions) {
        const qTotal = sq.questions.reduce((sum, q) => sum + q.maxPoints, 0);
        sectionSnapshot.push({
          sectionId: sq.section._id,
          name: sq.section.name,
          displayOrder: sq.section.displayOrder,
          totalMarks: qTotal
        });
      }

      const submission = await AssessmentSubmission.create({
        assessment: assessmentId,
        student: student._id,
        batch: assessment.batch,
        assessmentSnapshot: {
          name: assessment.name,
          weekNumber: assessment.weekNumber,
          totalMarks: assessment.totalMarks,
          sections: sectionSnapshot
        },
        submittedBy: req.user.id,
        status: 'PENDING'
      });

      const answerDocs = [];
      for (const ans of answers) {
        const question = await AssessmentQuestion.findById(ans.questionId);
        if (!question) continue;

        let score = 0;
        if (question.questionType === 'YES_NO') {
          score = ans.answerValue === 'YES' ? question.maxPoints : 0;
        }

        answerDocs.push({
          submission: submission._id,
          assessment: assessmentId,
          student: student._id,
          question: question._id,
          section: question.section,
          questionSnapshot: {
            questionText: question.questionText,
            questionType: question.questionType,
            maxPoints: question.maxPoints,
            sectionName: sq.section.name,
            displayOrder: question.displayOrder
          },
          answerValue: ans.answerValue,
          awardedScore: score,
          gradedBy: req.user.id,
          gradedAt: new Date()
        });
      }

      await AssessmentAnswer.insertMany(answerDocs);
      await calculateSubmissionScores(submission._id);

      results.success.push({ row: i + 2, rollNumber, name: student.name });
    }

    res.json({
      success: true,
      data: {
        totalRows: rows.length,
        imported: results.success.length,
        failed: results.failed.length,
        details: results
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.importStudents = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { batchId } = req.body;
    const batch = await Batch.findById(batchId)
      .populate('course')
      .populate('centre')
      .populate('organisation');

    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws);

    const requiredHeaders = ['Roll Number', 'Student Name'];
    const headers = Object.keys(rows[0] || {});

    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required headers: ${missingHeaders.join(', ')}`
      });
    }

    const existingStudents = await Student.find({ batch: batchId });
    const existingRolls = new Set(existingStudents.map(s => s.rollNumber));
    const existingNames = new Set(existingStudents.map(s => s.name.toLowerCase()));

    const results = { success: [], failed: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rollNumber = row['Roll Number']?.toString().trim();
      const name = row['Student Name']?.toString().trim();

      if (!rollNumber) {
        results.failed.push({ row: i + 2, reason: 'Roll Number missing' });
        continue;
      }
      if (!name) {
        results.failed.push({ row: i + 2, rollNumber, reason: 'Student Name missing' });
        continue;
      }
      if (existingRolls.has(rollNumber)) {
        results.failed.push({ row: i + 2, rollNumber, reason: 'Duplicate Roll Number' });
        continue;
      }
      if (existingNames.has(name.toLowerCase())) {
        results.failed.push({ row: i + 2, rollNumber, reason: 'Duplicate Student Name' });
        continue;
      }

      const mobile = row['Mobile']?.toString().trim();
      if (mobile && !/^[0-9]{10,15}$/.test(mobile.replace(/[^0-9]/g, ''))) {
        results.failed.push({ row: i + 2, rollNumber, reason: 'Invalid mobile number' });
        continue;
      }

      await Student.create({
        rollNumber,
        name,
        fatherName: row['Father Name']?.toString().trim() || '',
        mobile: mobile || '',
        gender: row['Gender']?.toString().trim() || '',
        dateOfBirth: row['DOB'] || null,
        organisation: batch.organisation._id,
        centre: batch.centre._id,
        course: batch.course._id,
        batch: batchId
      });

      existingRolls.add(rollNumber);
      existingNames.add(name.toLowerCase());
      results.success.push({ row: i + 2, rollNumber, name });
    }

    res.json({
      success: true,
      data: {
        totalRows: rows.length,
        imported: results.success.length,
        failed: results.failed.length,
        details: results
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
exports.downloadStudentTemplate = async (req, res) => {
  try {
    const { batchId } = req.query;

    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: 'batchId is required',
      });
    }

    const batch = await Batch.findById(batchId)
      .populate('course', 'name code')
      .populate('centre', 'name')
      .populate('organisation', 'name');

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found',
      });
    }

    // ============================================================
    // STUDENT TEMPLATE
    // IMPORTANT:
    // Headers exactly match importStudents()
    // ============================================================

    const headers = [
      'Roll Number',
      'Student Name',
      'Father Name',
      'Mother Name',
      'Mobile',
      'Email',
      'Gender',
      'DOB',
    ];

    // One empty sample row
    const rows = [
      {
        'Roll Number': '',
        'Student Name': '',
        'Father Name': '',
        'Mother Name': '',
        'Mobile': '',
        'Email': '',
        'Gender': '',
        'DOB': '',
      },
    ];

    const ws = xlsx.utils.json_to_sheet(rows, {
      header: headers,
    });

    // Column widths
    ws['!cols'] = [
      { wch: 16 }, // Roll Number
      { wch: 28 }, // Student Name
      { wch: 25 }, // Father Name
      { wch: 25 }, // Mother Name
      { wch: 16 }, // Mobile
      { wch: 30 }, // Email
      { wch: 12 }, // Gender
      { wch: 16 }, // DOB
    ];

    const wb = xlsx.utils.book_new();

    xlsx.utils.book_append_sheet(
      wb,
      ws,
      'Students'
    );

    // ============================================================
    // INSTRUCTIONS SHEET
    // ============================================================

    const instructions = [
      ['Student Import Template'],
      [''],
      ['Batch', batch.name || ''],
      ['Course', batch.course?.name || ''],
      ['Course Code', batch.course?.code || ''],
      ['Centre', batch.centre?.name || ''],
      ['Organisation', batch.organisation?.name || ''],
      [''],
      ['Instructions'],
      ['1. Roll Number is required.'],
      ['2. Student Name is required.'],
      ['3. Mobile should contain 10 to 15 digits.'],
      ['4. Gender should be Male, Female or Other.'],
      ['5. DOB should be entered as YYYY-MM-DD.'],
      ['6. Do not change the column names.'],
      ['7. Do not add Organisation, Centre, Course or Batch columns.'],
      ['8. Organisation, Centre, Course and Batch are automatically taken from the selected Batch.'],
    ];

    const instructionWs =
      xlsx.utils.aoa_to_sheet(instructions);

    instructionWs['!cols'] = [
      { wch: 85 },
      { wch: 30 },
    ];

    xlsx.utils.book_append_sheet(
      wb,
      instructionWs,
      'Instructions'
    );

    // ============================================================
    // CREATE EXCEL BUFFER
    // ============================================================

    const buffer = xlsx.write(wb, {
      type: 'buffer',
      bookType: 'xlsx',
    });

    const safeBatchName = String(
      batch.name || 'Batch'
    ).replace(/[^a-zA-Z0-9_-]/g, '_');

    const filename =
      `Student_Import_Template_${safeBatchName}.xlsx`;

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    return res.send(buffer);

  } catch (error) {
    console.error(
      'DOWNLOAD STUDENT TEMPLATE ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};