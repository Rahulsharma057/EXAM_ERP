require('dotenv').config();

const express = require('express');
const cors = require('cors');

const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

// ======================================================
// ROUTES
// ======================================================

const authRoutes = require('./routes/auth');
const orgRoutes = require('./routes/org');
const userRoutes = require('./routes/users');

const assessmentRoutes = require('./routes/assessments');
const sectionRoutes = require('./routes/sections');
const questionRoutes = require('./routes/questions');
const submissionRoutes = require('./routes/submissions');
const resultRoutes = require('./routes/results');
const excelRoutes = require('./routes/excel');
const studentRoutes = require('./routes/students');

// ======================================================
// DATABASE
// ======================================================

connectDB();

// ======================================================
// APP
// ======================================================

const app = express();

// ======================================================
// CORS
// ======================================================

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// ======================================================
// BODY PARSER
// ======================================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ======================================================
// HEALTH CHECK
// ======================================================

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
  });
});

// ======================================================
// API ROUTES
// ======================================================

app.use('/api/auth', authRoutes);

app.use('/api/org', orgRoutes);

app.use('/api/users', userRoutes);

app.use('/api/assessments', assessmentRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/excel', excelRoutes);

app.use('/api/org/students', studentRoutes);

// ======================================================
// ERROR HANDLER
// ======================================================

app.use(errorHandler);

// ======================================================
// SERVER
// ======================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});