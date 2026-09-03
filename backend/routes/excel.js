const express = require("express");
const multer = require("multer");

const router = express.Router();

const {
  exportTemplate,
  exportResults,
  importMarks,
  importStudents,
  downloadStudentTemplate,
} = require("../controllers/excelController");

const {
  protect,
  authorize,
} = require("../middleware/auth");

const upload = multer({
  storage: multer.memoryStorage(),
});

// ============================================================
// ASSESSMENT EXCEL
// ============================================================

// ============================================================
// DOWNLOAD MARKS ENTRY TEMPLATE
// ============================================================

router.get(
  "/assessments/:assessmentId/export-template",
  protect,
  authorize(
    "teacher",
    "centre_admin",
    "org_admin",
    "super_admin"
  ),
  exportTemplate
);

// ============================================================
// DOWNLOAD ASSESSMENT RESULTS
// ============================================================
//
// Dynamic export options:
//
// {
//   student: {
//     rollNumber: true,
//     name: true
//   },
//
//   parts: {
//     "<partId>": {
//       attempted: true,
//       obtained: true,
//       max: true,
//       percentage: true
//     }
//   },
//
//   sections: {
//     "<sectionId>": {
//       obtained: true,
//       max: true,
//       percentage: true
//     }
//   },
//
//   overall: {
//     totalObtained: true,
//     totalMax: true,
//     percentage: true,
//     status: true
//   }
// }
//
// Example:
//
// ?options={
//   "student":{"rollNumber":true,"name":true},
//   "parts":{
//     "PART_ID":{
//       "attempted":true,
//       "obtained":true,
//       "max":true,
//       "percentage":true
//     }
//   },
//   "sections":{
//     "SECTION_ID":{
//       "obtained":true,
//       "max":true,
//       "percentage":true
//     }
//   },
//   "overall":{
//     "totalObtained":true,
//     "totalMax":true,
//     "percentage":true,
//     "status":true
//   }
// }
//
// ============================================================

router.get(
  "/assessments/:assessmentId/export-results",
  protect,
  authorize(
    "teacher",
    "centre_admin",
    "org_admin",
    "super_admin"
  ),
  exportResults
);

// ============================================================
// IMPORT MARKS FROM EXCEL
// ============================================================

router.post(
  "/assessments/:assessmentId/import-marks",
  protect,
  authorize(
    "teacher",
    "centre_admin",
    "org_admin",
    "super_admin"
  ),
  upload.single("file"),
  importMarks
);

// ============================================================
// STUDENT EXCEL
// ============================================================

// ============================================================
// IMPORT STUDENTS
// ============================================================

router.post(
  "/import-students",
  protect,
  authorize(
    "centre_admin",
    "org_admin",
    "super_admin"
  ),
  upload.single("file"),
  importStudents
);

// ============================================================
// DOWNLOAD STUDENT IMPORT TEMPLATE
// ============================================================

router.get(
  "/student-template",
  protect,
  authorize(
    "centre_admin",
    "org_admin",
    "super_admin"
  ),
  downloadStudentTemplate
);

module.exports = router;