# Jay Ramji Enterprise - Automated Billing & Invoice Management System

A production-grade, secure, multi-tenant billing and invoice management system built for high-reliability shopkeeper operations. Replaces manual Excel/Word sheet editing with an automated digital bill book, automated A4 document generation, immutable sequence numbering, live calculations, and secure sharing.

---

## Technical Stack

- **Frontend:** Next.js (App Router) + React 19 + TypeScript + Tailwind CSS (v4) + Turbopack
- **Backend:** Node.js + Express.js + TypeScript
- **Database:** MongoDB (with ACID multi-document transactions & indexes) + Mongoose ODM
- **Document Engine:** Puppeteer (Headless Chrome rendering exact A4 vector PDFs and PNG snapshots)
- **Asset / Cloud Storage:** Cloudinary
- **Testing:** Jest + Supertest (19 comprehensive end-to-end and financial suites)

---

## Core Shopkeeper Workflow

```text
LOGIN / REGISTER
       ↓
  DASHBOARD
       ↓
  CREATE BILL
       ↓
SELECT CUSTOMER (Inline search & instant add)
       ↓
ADD ITEMS & SERVICES (Live calculation & price override)
       ↓
PREVIEW INVOICE (Exact A4 draft layout review)
       ↓
FINALIZE INVOICE (Destructive warning confirmation modal)
       ↓
SEQUENCE ALLOCATED & SNAPSHOTS FROZEN (Immutable)
       ↓
BACKGROUND PDF / PNG GENERATED (With real-time polling & retry)
       ↓
DOWNLOAD / SHARE (Print, Download PDF/PNG, or generate public share link)
```

---

## Key Architectural Guarantees

1. **Financial Precision:** All monetary amounts are processed internally in minor units (paise/integer cents) to prevent floating-point inaccuracies. Grand totals round to the nearest rupee with automated Indian currency numbering words (e.g. `₹2,220` -> "Two Thousand Two Hundred Twenty Rupees Only").
2. **Document & Invoice Immutability:** Once finalized, invoice records, financial totals, customer snapshots, business snapshots, and asset snapshots are permanently frozen. Later changes to master customer or business records do not alter historical invoices.
3. **Strict Business Isolation (IDOR Protection):** Every database query and route is scoped to the active tenant business ID extracted from validated JWT session cookies and headers. Cross-business data access is rejected with `404 Not Found`.
4. **Resilient Background Document Generation:** PDF and PNG generation runs asynchronously via Puppeteer and uploads directly to Cloudinary. Invoices display real-time status indicators (`GENERATING`, `READY`, `FAILED`) with automated client polling and retry capabilities.
5. **Multi-Document ACID Transactions:** All finalization sequences, draft updates, payments, and member registrations execute within MongoDB sessions with rollback safety.

---

## Getting Started & Development

### 1. Prerequisites
- **Node.js:** v18.0.0 or higher
- **MongoDB:** v6.0+ (running locally or MongoDB Atlas)
- **npm:** v9.0+

### 2. Environment Configuration

Copy the example environment files:
```bash
# Root & Backend configuration
cp backend/.env.example backend/.env

# Frontend configuration
cp frontend/.env.example frontend/.env.local
```

Configure your `backend/.env` with your MongoDB URI, JWT Secret, and Cloudinary keys:
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/jayramji_bill
JWT_SECRET=development_jwt_signing_secret_key_1234567890
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
FRONTEND_URL=http://localhost:3000
```

### 3. Install Dependencies
```bash
npm install
npm run install:all
```

### 4. Running Locally
Start both backend and frontend concurrently:
```bash
npm run dev
```
- **Frontend App:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:5000](http://localhost:5000)
- **Health Check:** [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## Automated Test Suites

Run the complete billing and E2E test suite:
```bash
npm run test --prefix backend
```

---

## Production Build & Deployment

### Production Build Verification
```bash
# Backend compilation
npm run build --prefix backend

# Frontend compilation
npm run build --prefix frontend
```

### Deployment Guidelines
1. **Database:** Use MongoDB Atlas or a self-hosted replica set (required for transactions). Enable automated hourly/daily backups.
2. **Cloud Storage:** Configure Cloudinary credentials in `backend/.env`. Generated PDFs and PNGs are stored under `businesses/:businessId/invoices/:invoiceId/`.
3. **Backend Service:** Run with Node.js process manager (e.g. PM2 or Docker container) setting `NODE_ENV=production`.
4. **Frontend Service:** Deploy Next.js to Vercel, Node.js server, or standalone Docker container.
5. **HTTPS / Domain:** Place behind reverse proxy (Nginx / Cloudflare) with valid SSL certificates and `FRONTEND_URL` matching the public domain.
