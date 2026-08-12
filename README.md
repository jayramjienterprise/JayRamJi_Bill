# Jay Ramji Enterprise - Automated Billing & Invoice Management System

This project is a modular monolith application for managing billing and invoices. It replaces manual Excel-based document creation with a clean, fast, and mobile-friendly web application.

Currently, the application is in:
**PHASE 1 — PROJECT FOUNDATION**

---

## Technical Stack

- **Frontend:** Next.js (App Router) + React + TypeScript + Tailwind CSS (v4)
- **Backend:** Node.js + Express.js + TypeScript
- **Database:** MongoDB + Mongoose ODM
- **Storage:** Cloudinary (configured for assets and snapshots)

---

## Directory Structure

```text
JayRamJi_Bill/
├── package.json         # Workspace control scripts
├── .gitignore           # Git ignore exclusions
├── README.md            # Setup and instructions
├── backend/             # Express.js server application
│   ├── src/
│   │   ├── config/      # System config validation (Zod)
│   │   ├── database/    # Mongoose connection & graceful shutdown
│   │   ├── middleware/  # Request validation & centralized error handler
│   │   ├── services/    # Integration services (Cloudinary)
│   │   ├── app.ts       # Express app setup, CORS, parsing rules
│   │   └── server.ts    # Application bootstrap entrypoint
│   ├── tsconfig.json    # Strict TypeScript configuration
│   └── .env.example     # Environment template keys
└── frontend/            # Next.js web client
    ├── src/
    │   ├── app/         # App router pages & Tailwind styling
    │   └── lib/api/     # Centralized fetch API client & types
    ├── tsconfig.json    # TypeScript configurations
    └── package.json     # Web configuration rules
```

---

## Prerequisites

- **Node.js** (v18 or higher recommended)
- **npm** (v9 or higher)
- **MongoDB** (running locally or a cloud URI instance)

---

## Environment Variables

### Backend Configuration

Create a `.env` file in the `backend/` directory referencing `backend/.env.example`:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/jayramji_bill
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
FRONTEND_URL=http://localhost:3000
```

---

## Development Instructions

### 1. Install Dependencies

Install all project dependencies across the workspace using the root script:
```bash
npm install
npm run install:all
```

### 2. Start Services

To launch both the Next.js frontend and Express backend concurrently:
```bash
npm run dev
```

Or run them individually:
- **Backend only:** `npm run dev:backend` (Runs on `http://localhost:5000`)
- **Frontend only:** `npm run dev:frontend` (Runs on `http://localhost:3000`)

### 3. Verify Health Check

The backend health check is accessible at:
```http
GET http://localhost:5000/api/health
```

Expected Response:
```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```
