# Weekly Assessment Management Module

Complete ERP module for weekly student assessments with React + Next.js + MUI + Node + Express + JWT + MongoDB.

## Project Structure

```
weekly-assessment-module/
├── backend/
│   ├── config/           # Database & constants
│   ├── controllers/      # Business logic
│   ├── middleware/       # Auth, validation, error handling
│   ├── models/           # Mongoose schemas
│   ├── routes/           # API routes
│   ├── server.js         # Entry point
│   └── package.json
└── frontend/
    ├── app/              # Next.js App Router pages
    ├── components/         # Reusable components
    ├── services/         # API service layer
    └── package.json
```

## Backend Setup

```bash
cd backend
npm install
# Create .env file (see .env.example)
npm run dev
```

## Frontend Setup

```bash
cd frontend
npm install
# Create .env.local file (see .env.local.example)
npm run dev
```

## Features

- Organisation → Centre → Course → Batch → Student hierarchy
- Dynamic assessment builder (unlimited sections & questions)
- YES/NO, TEXT, NUMBER, SINGLE_CHOICE, MULTIPLE_CHOICE question types
- Server-side score calculation (question → section → total → percentage)
- Historical snapshot safety (submissions preserve assessment state)
- Excel import/export for marks and students
- Role-based access control (JWT)
- Publish/Schedule/Close/Archive workflow
- Results dashboard with section-wise breakdown
