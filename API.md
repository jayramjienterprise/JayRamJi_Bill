# Automated Billing & Invoice Management System --- API Specification

**Version:** 1.0\
**Status:** API Contract / Implementation Specification\
**Date:** 2026-08-13\
**Backend:** Node.js + Express.js + TypeScript\
**Database:** MongoDB + Mongoose\
**Storage:** Cloudinary for business assets and invoice PNG snapshots;
object storage/provider for PDFs\
**Purpose:** Define the exact APIs required for this project so
implementation AI/developers do not invent unnecessary endpoints or
business logic.

------------------------------------------------------------------------

# 1. Purpose

This document defines the API contract for the Automated Billing &
Invoice Management System.

The API exists to support this workflow:

``` text
Shopkeeper
    ↓
Login
    ↓
Business Setup
    ↓
Customers / Services
    ↓
Create Invoice Draft
    ↓
Add Items
    ↓
Preview
    ↓
Finalize
    ↓
Generate PNG Snapshot
    ↓
Generate PDF
    ↓
Share / Download
    ↓
Invoice History
    ↓
Analytics
```

The API must be designed around the database contract in `MODELS.md` and
the invoice rendering contract in `BILL_TEMPLATE.md`.

------------------------------------------------------------------------

# 2. Important Implementation Rule

> **Do not create APIs just because a database collection exists.**

An API should exist only when the frontend or a business workflow
actually needs it.

For example:

``` text
invoice_sequences
```

is an internal database mechanism.

It does NOT need:

``` text
GET /api/invoice-sequences
POST /api/invoice-sequences
```

The backend uses the sequence internally during invoice finalization.

Similarly:

``` text
audit_logs
idempotency_keys
```

are internal infrastructure.

They do not need normal CRUD APIs.

------------------------------------------------------------------------

# 3. API Design Principles

## 3.1 Business-scoped

Every protected business resource must be scoped through the
authenticated user's business membership.

Never trust a browser-provided `businessId`.

------------------------------------------------------------------------

## 3.2 Backend is the financial authority

The backend calculates:

``` text
line amounts
subtotal
discount
tax
rounding
grand total
amount in words
payment balance
```

The frontend can calculate previews, but the backend recalculates before
finalization.

------------------------------------------------------------------------

## 3.3 Finalized invoices are immutable

After:

``` text
POST /api/invoices/:invoiceId/finalize
```

the financial invoice cannot be edited.

Allowed later operations include:

``` text
cancel
record payment
reverse payment
generate/retry document
share/disable public link
```

------------------------------------------------------------------------

## 3.4 Idempotency

The following operations must support an `Idempotency-Key` header:

``` text
POST /api/invoices/:invoiceId/finalize
POST /api/invoices/:invoiceId/payments
POST /api/invoices/:invoiceId/share
```

This prevents duplicate operations caused by:

-   double taps
-   mobile retries
-   browser retries
-   unstable networks

------------------------------------------------------------------------

## 3.5 Response consistency

Successful responses should follow:

``` json
{
  "success": true,
  "data": {}
}
```

Error responses:

``` json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

Do not return raw MongoDB/Mongoose errors to the frontend.

------------------------------------------------------------------------

# 4. Authentication APIs

Authentication is required because the system contains:

-   invoices
-   customer information
-   bank information
-   business assets
-   financial analytics

------------------------------------------------------------------------

## 4.1 Register

### Endpoint

``` http
POST /api/auth/register
```

### Purpose

Create a new application user and optionally create their initial
business.

### Input

``` json
{
  "name": "Priy",
  "email": "owner@example.com",
  "password": "strong-password"
}
```

### Output

``` json
{
  "success": true,
  "data": {
    "user": {
      "id": "..."
    }
  }
}
```

The exact authentication token strategy is defined in the
architecture/security implementation.

------------------------------------------------------------------------

## 4.2 Login

### Endpoint

``` http
POST /api/auth/login
```

### Purpose

Authenticate the shopkeeper/admin.

### Input

``` json
{
  "email": "owner@example.com",
  "password": "strong-password"
}
```

### Output

``` json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "name": "Priy",
      "email": "owner@example.com"
    }
  }
}
```

------------------------------------------------------------------------

## 4.3 Get Current User

### Endpoint

``` http
GET /api/auth/me
```

### Purpose

Restore the authenticated session when the application loads.

### Input

No body.

### Output

``` json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "name": "Priy",
      "email": "owner@example.com"
    },
    "businesses": [
      {
        "id": "...",
        "name": "JAY RAMJI ENTERPRISE",
        "role": "OWNER"
      }
    ]
  }
}
```

------------------------------------------------------------------------

## 4.4 Logout

### Endpoint

``` http
POST /api/auth/logout
```

### Purpose

End the authenticated session.

### Input

None.

### Output

``` json
{
  "success": true,
  "data": null
}
```

------------------------------------------------------------------------

# 5. Business APIs

The business contains fixed invoice information.

Examples:

``` text
Shop name
Address
Phone
Bank details
PAN
GSTIN
Invoice title
Payment terms
Logo/stamp/signature
```

------------------------------------------------------------------------

## 5.1 Get Current Business

### Endpoint

``` http
GET /api/business
```

### Purpose

Load business settings for:

-   dashboard
-   invoice builder
-   settings page
-   invoice rendering

### Output

``` json
{
  "success": true,
  "data": {
    "business": {
      "id": "...",
      "name": "JAY RAMJI ENTERPRISE",
      "address": {},
      "contact": {},
      "timezone": "Asia/Kolkata",
      "taxProfile": {},
      "bankDetails": {},
      "invoiceSettings": {},
      "paymentSettings": {}
    }
  }
}
```

Sensitive values should be handled according to authorization rules.

------------------------------------------------------------------------

## 5.2 Update Business

### Endpoint

``` http
PATCH /api/business
```

### Purpose

Update shop information used by future invoices.

### Input

``` json
{
  "name": "JAY RAMJI ENTERPRISE",
  "address": {
    "line1": "...",
    "city": "Mundra",
    "state": "Gujarat",
    "postalCode": "370421",
    "country": "India"
  },
  "contact": {
    "phone": "...",
    "email": null
  }
}
```

### Important

Changing business settings must NOT modify historical invoice snapshots.

### Output

Updated business.

------------------------------------------------------------------------

## 5.3 Update Invoice Settings

### Endpoint

``` http
PATCH /api/business/invoice-settings
```

### Purpose

Update defaults for future invoices.

### Input

``` json
{
  "invoiceTitle": "TAX INVOICE",
  "prefix": "JRE",
  "defaultCurrency": "INR",
  "defaultPaymentTerms": "Within 10 days clear payment",
  "defaultTaxMode": "NONE",
  "defaultTaxRateBps": 0
}
```

### Output

Updated invoice settings.

------------------------------------------------------------------------

## 5.4 Update Payment Settings

### Endpoint

``` http
PATCH /api/business/payment-settings
```

### Purpose

Update default payment behavior.

### Input

``` json
{
  "defaultPaymentStatus": "UNPAID"
}
```

### Output

Updated settings.

------------------------------------------------------------------------

# 6. Asset APIs

Assets are stored in Cloudinary.

Supported:

``` text
LOGO
STAMP
SIGNATURE
OTHER
```

------------------------------------------------------------------------

## 6.1 Upload Business Asset

### Endpoint

``` http
POST /api/assets
```

### Content-Type

``` text
multipart/form-data
```

### Input

``` text
file: image
type: LOGO
```

### Output

``` json
{
  "success": true,
  "data": {
    "asset": {
      "id": "...",
      "type": "LOGO",
      "cloudinaryPublicId": "...",
      "secureUrl": "...",
      "format": "png",
      "width": 800,
      "height": 300,
      "active": true
    }
  }
}
```

### Rules

-   Validate MIME type.
-   Validate file size.
-   Upload to Cloudinary.
-   Create asset metadata in MongoDB.
-   Do not store binary data in MongoDB.
-   Do not overwrite historical assets.

------------------------------------------------------------------------

## 6.2 List Business Assets

### Endpoint

``` http
GET /api/assets
```

### Query

``` text
?type=LOGO
```

### Output

``` json
{
  "success": true,
  "data": {
    "assets": []
  }
}
```

------------------------------------------------------------------------

## 6.3 Activate Asset

### Endpoint

``` http
PATCH /api/assets/:assetId/activate
```

### Purpose

Make a previously uploaded asset the active asset for future invoices.

### Input

None.

### Output

Updated asset.

------------------------------------------------------------------------

## 6.4 Deactivate Asset

### Endpoint

``` http
PATCH /api/assets/:assetId/deactivate
```

### Purpose

Deactivate an asset without deleting historical references.

------------------------------------------------------------------------

# 7. Customer APIs

Customers are reusable master records.

------------------------------------------------------------------------

## 7.1 List Customers

### Endpoint

``` http
GET /api/customers
```

### Query parameters

``` text
?page=1
&limit=20
&search=AON
&active=true
```

### Purpose

Used by:

-   customer list
-   invoice builder customer search
-   dashboard/history

### Output

``` json
{
  "success": true,
  "data": {
    "customers": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 42,
      "pages": 3
    }
  }
}
```

------------------------------------------------------------------------

## 7.2 Get Customer

### Endpoint

``` http
GET /api/customers/:customerId
```

### Purpose

Load customer details.

### Output

Customer object.

------------------------------------------------------------------------

## 7.3 Create Customer

### Endpoint

``` http
POST /api/customers
```

### Input

``` json
{
  "name": "AON ENGINEERS AND CONSULTANTS PVT. LTD.",
  "contact": {
    "phone": "...",
    "email": null
  },
  "address": {
    "line1": "...",
    "city": "Ahmedabad",
    "state": "Gujarat",
    "postalCode": "...",
    "country": "India"
  },
  "taxProfile": {
    "gstin": null,
    "pan": null
  },
  "notes": null
}
```

### Output

Created customer.

------------------------------------------------------------------------

## 7.4 Update Customer

### Endpoint

``` http
PATCH /api/customers/:customerId
```

### Input

Only fields being changed.

### Output

Updated customer.

### Important

Existing finalized invoices remain unchanged because they use
`customerSnapshot`.

------------------------------------------------------------------------

## 7.5 Deactivate Customer

### Endpoint

``` http
PATCH /api/customers/:customerId/deactivate
```

### Purpose

Soft-delete/deactivate customer.

Existing invoices remain available.

------------------------------------------------------------------------

# 8. Product / Service APIs

The application should call these records "Services" in the UI when
appropriate, but the database supports both products and services.

------------------------------------------------------------------------

## 8.1 List Products/Services

### Endpoint

``` http
GET /api/products
```

### Query

``` text
?page=1
&limit=20
&search=AC
&type=SERVICE
&active=true
```

### Output

``` json
{
  "success": true,
  "data": {
    "products": [],
    "pagination": {}
  }
}
```

------------------------------------------------------------------------

## 8.2 Get Product/Service

### Endpoint

``` http
GET /api/products/:productId
```

### Output

Product/service object.

------------------------------------------------------------------------

## 8.3 Create Product/Service

### Endpoint

``` http
POST /api/products
```

### Input

``` json
{
  "type": "SERVICE",
  "name": "AC WATER SERVICE",
  "description": "AC water service",
  "uom": "JOB",
  "defaultPriceMinor": 130000,
  "currency": "INR",
  "defaultTaxRateBps": 0
}
```

### Output

Created product/service.

------------------------------------------------------------------------

## 8.4 Update Product/Service

### Endpoint

``` http
PATCH /api/products/:productId
```

### Input

Editable master data.

### Output

Updated product/service.

### Important

Changing the default price does not modify old invoices.

------------------------------------------------------------------------

## 8.5 Deactivate Product/Service

### Endpoint

``` http
PATCH /api/products/:productId/deactivate
```

### Purpose

Soft-delete/deactivate the service.

------------------------------------------------------------------------

# 9. Invoice APIs

Invoices are the central workflow.

------------------------------------------------------------------------

# 9.1 Create Invoice Draft

### Endpoint

``` http
POST /api/invoices
```

### Purpose

Create an editable invoice draft.

### Input

``` json
{
  "invoiceDate": "2026-08-13",
  "customerId": "...",
  "paymentTerms": "Within 10 days clear payment",
  "items": [
    {
      "productId": "...",
      "description": "AC WATER SERVICE",
      "uom": "JOB",
      "quantity": 1,
      "unitPriceMinor": 130000
    }
  ],
  "notes": null
}
```

### Backend behavior

The backend should:

1.  Verify customer belongs to business.
2.  Verify products belong to business.
3.  Validate quantities.
4.  Calculate line totals.
5.  Calculate totals.
6.  Return a draft.

The invoice is NOT finalized.

### Output

``` json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "...",
      "status": "DRAFT",
      "invoiceDate": "2026-08-13",
      "items": [],
      "totals": {}
    }
  }
}
```

------------------------------------------------------------------------

# 9.2 Get Invoice

### Endpoint

``` http
GET /api/invoices/:invoiceId
```

### Purpose

Load an invoice for:

-   edit if draft
-   view if finalized
-   history
-   preview

### Output

Full invoice response DTO.

------------------------------------------------------------------------

# 9.3 Update Draft Invoice

### Endpoint

``` http
PATCH /api/invoices/:invoiceId
```

### Rule

Only:

``` text
DRAFT
```

invoices may be updated.

### Input

``` json
{
  "invoiceDate": "2026-08-13",
  "customerId": "...",
  "paymentTerms": "Within 10 days clear payment",
  "items": [
    {
      "productId": "...",
      "description": "AC WATER SERVICE",
      "uom": "JOB",
      "quantity": 2,
      "unitPriceMinor": 130000
    }
  ],
  "notes": null
}
```

### Output

Updated draft with recalculated totals.

------------------------------------------------------------------------

# 9.4 Delete Draft Invoice

### Endpoint

``` http
DELETE /api/invoices/:invoiceId
```

### Rule

Only drafts can be deleted.

Finalized invoices cannot be deleted.

### Output

``` json
{
  "success": true,
  "data": null
}
```

------------------------------------------------------------------------

# 9.5 Preview Invoice

### Endpoint

``` http
POST /api/invoices/:invoiceId/preview
```

### Purpose

Generate preview data or a preview document before finalization.

### Important

Preview must NOT:

-   finalize the invoice
-   assign a permanent invoice number unless explicitly required
-   create an immutable historical snapshot
-   create a payment record

### Input

None if using saved draft.

### Output

``` json
{
  "success": true,
  "data": {
    "invoice": {},
    "previewUrl": "..."
  }
}
```

The exact preview artifact strategy is implementation-specific.

------------------------------------------------------------------------

# 10. Invoice Finalization API

This is the most important API.

## Endpoint

``` http
POST /api/invoices/:invoiceId/finalize
```

## Header

``` text
Idempotency-Key: <unique-client-generated-key>
```

## Purpose

Convert a draft into an official immutable invoice.

## Input

Usually no body.

Optional confirmation fields may be allowed:

``` json
{
  "confirm": true
}
```

## Backend workflow

``` text
Authenticate
    ↓
Authorize business
    ↓
Verify invoice is DRAFT
    ↓
Validate customer
    ↓
Validate items
    ↓
Recalculate financial values
    ↓
Create customer snapshot
    ↓
Create business snapshot
    ↓
Create asset snapshot
    ↓
Generate amount in words
    ↓
Atomically reserve invoice number
    ↓
Finalize invoice
    ↓
Write audit log
    ↓
Commit transaction
    ↓
Generate PNG snapshot
    ↓
Upload PNG to Cloudinary
    ↓
Generate PDF
    ↓
Store document metadata
```

## Output

``` json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "...",
      "invoiceNumber": "JRE20267",
      "status": "FINALIZED",
      "document": {
        "snapshot": {
          "status": "READY",
          "secureUrl": "..."
        },
        "pdf": {
          "status": "READY",
          "secureUrl": "..."
        }
      }
    }
  }
}
```

If document generation is still running:

``` json
{
  "document": {
    "snapshot": {
      "status": "GENERATING"
    },
    "pdf": {
      "status": "GENERATING"
    }
  }
}
```

The invoice remains finalized.

------------------------------------------------------------------------

# 11. Invoice List / History API

### Endpoint

``` http
GET /api/invoices
```

### Query parameters

``` text
?page=1
&limit=20
&search=JRE20267
&customerId=...
&status=FINALIZED
&paymentStatus=UNPAID
&from=2026-08-01
&to=2026-08-31
&sortBy=invoiceDate
&sortOrder=desc
```

### Purpose

Used by:

-   invoice history
-   invoice search
-   dashboard recent invoices
-   reports

### Output

``` json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "id": "...",
        "invoiceNumber": "JRE20267",
        "invoiceDate": "2026-08-13",
        "customer": {
          "name": "AON ENGINEERS..."
        },
        "totalMinor": 445000,
        "currency": "INR",
        "status": "FINALIZED",
        "paymentStatus": "UNPAID",
        "snapshotUrl": "..."
      }
    ],
    "pagination": {}
  }
}
```

The list API should not regenerate documents.

------------------------------------------------------------------------

# 12. Invoice Original Snapshot API

### Endpoint

``` http
GET /api/invoices/:invoiceId/snapshot
```

### Purpose

Retrieve the archived visual invoice.

### Rules

For an authorized business user:

``` text
return snapshot URL/metadata
```

Do not regenerate the invoice if the snapshot already exists.

### Output

``` json
{
  "success": true,
  "data": {
    "snapshot": {
      "status": "READY",
      "secureUrl": "...",
      "format": "png",
      "width": 2480,
      "height": 3508
    }
  }
}
```

------------------------------------------------------------------------

# 13. PDF API

### Endpoint

``` http
GET /api/invoices/:invoiceId/pdf
```

### Purpose

Get the generated invoice PDF.

### Behavior

If PDF is ready:

``` text
return/download PDF
```

If PDF generation failed:

``` text
return clear retryable error
```

Do not silently generate a different invoice using current business
settings.

------------------------------------------------------------------------

# 14. Retry Snapshot Generation

### Endpoint

``` http
POST /api/invoices/:invoiceId/documents/snapshot/retry
```

### Purpose

Retry PNG generation if it failed.

### Rules

-   Invoice must be finalized.
-   Use frozen invoice snapshots.
-   Do not use current business master data.
-   Do not change financial data.

### Output

Updated document status.

------------------------------------------------------------------------

# 15. Retry PDF Generation

### Endpoint

``` http
POST /api/invoices/:invoiceId/documents/pdf/retry
```

### Purpose

Retry PDF generation.

Same historical rendering rules apply.

------------------------------------------------------------------------

# 16. Cancel Invoice

### Endpoint

``` http
POST /api/invoices/:invoiceId/cancel
```

### Input

``` json
{
  "reason": "Customer requested cancellation"
}
```

### Rules

-   Finalized invoice can be cancelled.
-   Invoice is never deleted.
-   Original PNG/PDF remain available.
-   Cancellation is audited.

### Output

``` json
{
  "success": true,
  "data": {
    "invoice": {
      "id": "...",
      "status": "CANCELLED",
      "cancelledAt": "...",
      "cancellationReason": "Customer requested cancellation"
    }
  }
}
```

------------------------------------------------------------------------

# 17. Payment APIs

Payments are separate financial records.

------------------------------------------------------------------------

# 17.1 List Invoice Payments

### Endpoint

``` http
GET /api/invoices/:invoiceId/payments
```

### Purpose

Show payment history.

### Output

``` json
{
  "success": true,
  "data": {
    "payments": []
  }
}
```

------------------------------------------------------------------------

# 17.2 Record Payment

### Endpoint

``` http
POST /api/invoices/:invoiceId/payments
```

### Header

``` text
Idempotency-Key: <unique-key>
```

### Input

``` json
{
  "amountMinor": 200000,
  "currency": "INR",
  "method": "UPI",
  "referenceNumber": "UPI123456",
  "paidAt": "2026-08-13T12:30:00+05:30",
  "notes": null
}
```

### Backend behavior

1.  Verify invoice belongs to business.
2.  Verify invoice is finalized.
3.  Validate amount.
4.  Calculate current due amount.
5.  Prevent invalid overpayment unless explicitly supported.
6.  Create payment.
7.  Update invoice payment summary.
8.  Create audit log.

### Output

``` json
{
  "success": true,
  "data": {
    "payment": {},
    "paymentSummary": {
      "paidAmountMinor": 200000,
      "dueAmountMinor": 245000,
      "status": "PARTIALLY_PAID"
    }
  }
}
```

------------------------------------------------------------------------

# 17.3 Reverse Payment

### Endpoint

``` http
POST /api/invoices/:invoiceId/payments/:paymentId/reverse
```

### Input

``` json
{
  "reason": "Payment entered incorrectly"
}
```

### Purpose

Reverse an incorrect payment without deleting financial history.

### Output

Updated payment and payment summary.

------------------------------------------------------------------------

# 18. Public Invoice APIs

Public invoice access is intentionally separate from authenticated admin
APIs.

------------------------------------------------------------------------

# 18.1 Create/Enable Public Link

### Endpoint

``` http
POST /api/invoices/:invoiceId/share
```

### Header

``` text
Idempotency-Key: <unique-key>
```

### Input

``` json
{
  "expiresAt": null
}
```

### Output

``` json
{
  "success": true,
  "data": {
    "shareUrl": "https://yourapp.com/i/7F82KX91...",
    "expiresAt": null
  }
}
```

The raw token is returned to the authorized user.

Only the token hash is stored.

------------------------------------------------------------------------

# 18.2 Disable Public Link

### Endpoint

``` http
POST /api/invoices/:invoiceId/share/disable
```

### Purpose

Disable public access.

### Output

Updated public access status.

------------------------------------------------------------------------

# 18.3 View Public Invoice

### Endpoint

``` http
GET /api/public/invoices/:token
```

### Purpose

Customer views an invoice without logging in.

### Output

Only public-safe invoice information.

``` json
{
  "success": true,
  "data": {
    "invoice": {
      "invoiceNumber": "JRE20267",
      "invoiceDate": "2026-08-13",
      "business": {},
      "customer": {},
      "items": [],
      "totals": {},
      "snapshotUrl": "...",
      "pdfUrl": "..."
    }
  }
}
```

Do not expose:

``` text
businessId
userId
audit logs
token hash
internal storage keys
unrelated business data
```

------------------------------------------------------------------------

# 19. Dashboard APIs

Dashboard APIs should provide aggregated information needed by the UI.

Do not make the frontend perform dozens of invoice queries to build the
dashboard.

------------------------------------------------------------------------

# 19.1 Dashboard Overview

### Endpoint

``` http
GET /api/dashboard/overview
```

### Query

``` text
?from=2026-08-01
&to=2026-08-31
```

### Output

``` json
{
  "success": true,
  "data": {
    "revenueMinor": 12500000,
    "invoiceCount": 42,
    "paidMinor": 9500000,
    "outstandingMinor": 3000000,
    "averageInvoiceMinor": 297619,
    "currency": "INR"
  }
}
```

------------------------------------------------------------------------

# 19.2 Dashboard Recent Invoices

### Endpoint

``` http
GET /api/dashboard/recent-invoices
```

### Query

``` text
?limit=10
```

### Output

Recent invoice summaries.

This can also be implemented as part of `/dashboard/overview` if the
frontend does not need a separate request.

Do not create duplicate endpoints without a UI requirement.

------------------------------------------------------------------------

# 20. Analytics APIs

Analytics should be derived from finalized invoices and payments.

------------------------------------------------------------------------

# 20.1 Revenue Analytics

### Endpoint

``` http
GET /api/analytics/revenue
```

### Query

``` text
?from=2026-01-01
&to=2026-08-31
&groupBy=month
```

### Output

``` json
{
  "success": true,
  "data": {
    "currency": "INR",
    "series": [
      {
        "period": "2026-01",
        "revenueMinor": 1250000
      },
      {
        "period": "2026-02",
        "revenueMinor": 1480000
      }
    ]
  }
}
```

------------------------------------------------------------------------

# 20.2 Top Services

### Endpoint

``` http
GET /api/analytics/top-services
```

### Query

``` text
?from=2026-01-01
&to=2026-08-31
&limit=10
```

### Output

``` json
{
  "success": true,
  "data": {
    "services": [
      {
        "description": "AC WATER SERVICE",
        "quantity": 82,
        "revenueMinor": 10660000
      }
    ]
  }
}
```

Use invoice item snapshots for historical accuracy.

------------------------------------------------------------------------

# 20.3 Outstanding Analytics

### Endpoint

``` http
GET /api/analytics/outstanding
```

### Output

``` json
{
  "success": true,
  "data": {
    "totalOutstandingMinor": 3000000,
    "invoiceCount": 12,
    "currency": "INR"
  }
}
```

------------------------------------------------------------------------

# 20.4 Customer Analytics

### Endpoint

``` http
GET /api/analytics/customers
```

### Query

``` text
?from=2026-01-01
&to=2026-08-31
&limit=10
```

### Output

``` json
{
  "success": true,
  "data": {
    "customers": [
      {
        "customerId": "...",
        "customerName": "AON ENGINEERS...",
        "invoiceCount": 12,
        "revenueMinor": 4500000
      }
    ]
  }
}
```

------------------------------------------------------------------------

# 21. Reports

For MVP, do not create a separate reporting engine.

The existing analytics APIs can power:

``` text
Revenue
Invoices
Outstanding
Top Services
Customers
```

If downloadable reports are required later:

``` text
GET /api/reports/revenue.csv
GET /api/reports/invoices.xlsx
```

can be added only when the feature is approved.

------------------------------------------------------------------------

# 22. Search APIs

Do not create separate search endpoints for every entity.

Use query parameters.

Examples:

``` text
GET /api/customers?search=aon

GET /api/products?search=water

GET /api/invoices?search=JRE20267
```

This keeps the API surface smaller.

------------------------------------------------------------------------

# 23. Health API

### Endpoint

``` http
GET /api/health
```

### Purpose

Deployment/load-balancer health check.

### Output

``` json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

Do not expose secrets or detailed infrastructure information.

------------------------------------------------------------------------

# 24. API Authentication Matrix

  API Group            Authentication
  -------------------- -----------------------------------------------
  `/api/auth/*`        Public except authenticated session endpoints
  `/api/business/*`    Required
  `/api/assets/*`      Required
  `/api/customers/*`   Required
  `/api/products/*`    Required
  `/api/invoices/*`    Required
  `/api/payments/*`    Required
  `/api/dashboard/*`   Required
  `/api/analytics/*`   Required
  `/api/public/*`      Public token
  `/api/health`        Public/internal

------------------------------------------------------------------------

# 25. Authorization Matrix

  Operation                    OWNER   ADMIN          STAFF
  -------------------------- ------- ------- --------------
  View invoices                  Yes     Yes            Yes
  Create invoice                 Yes     Yes            Yes
  Finalize invoice               Yes     Yes          Yes\*
  Cancel invoice                 Yes     Yes   Configurable
  Record payment                 Yes     Yes            Yes
  Manage customers               Yes     Yes            Yes
  Manage products                Yes     Yes            Yes
  Change bank details            Yes     Yes             No
  Change business settings       Yes     Yes             No
  Upload business assets         Yes     Yes             No
  View analytics                 Yes     Yes   Configurable
  Manage staff                   Yes     Yes             No

`STAFF` permissions should be enforced by backend authorization
middleware.

Do not rely on hiding buttons in the frontend.

------------------------------------------------------------------------

# 26. Error Codes

Use stable application-level error codes.

Examples:

``` text
AUTH_INVALID_CREDENTIALS
AUTH_UNAUTHORIZED
AUTH_FORBIDDEN

BUSINESS_NOT_FOUND
BUSINESS_ACCESS_DENIED

CUSTOMER_NOT_FOUND
CUSTOMER_INACTIVE

PRODUCT_NOT_FOUND
PRODUCT_INACTIVE

INVOICE_NOT_FOUND
INVOICE_NOT_EDITABLE
INVOICE_ALREADY_FINALIZED
INVOICE_ALREADY_CANCELLED
INVOICE_INVALID_ITEMS
INVOICE_CALCULATION_ERROR
INVOICE_FINALIZATION_FAILED

PAYMENT_NOT_FOUND
PAYMENT_INVALID_AMOUNT
PAYMENT_ALREADY_REVERSED
PAYMENT_EXCEEDS_DUE

ASSET_NOT_FOUND
ASSET_UPLOAD_FAILED

DOCUMENT_NOT_READY
DOCUMENT_GENERATION_FAILED

PUBLIC_LINK_DISABLED
PUBLIC_LINK_EXPIRED
PUBLIC_INVOICE_NOT_FOUND

IDEMPOTENCY_CONFLICT
VALIDATION_ERROR
INTERNAL_SERVER_ERROR
```

------------------------------------------------------------------------

# 27. Pagination

List APIs should support:

``` text
page
limit
```

Recommended maximum:

``` text
limit <= 100
```

Default:

``` text
limit = 20
```

Do not allow unlimited invoice/customer queries.

------------------------------------------------------------------------

# 28. Date Filtering

Date-based APIs should accept:

``` text
from=YYYY-MM-DD
to=YYYY-MM-DD
```

Interpret date ranges using the business timezone.

Do not accidentally exclude invoices at the end of the day because of
UTC conversion.

------------------------------------------------------------------------

# 29. Sorting

Allow only whitelisted fields.

Example invoices:

``` text
invoiceDate
invoiceNumber
createdAt
```

Do not allow arbitrary MongoDB field names from query parameters.

------------------------------------------------------------------------

# 30. API Security Rules

The backend must protect against:

-   IDOR
-   cross-business access
-   unauthorized invoice cancellation
-   unauthorized bank-data access
-   duplicate invoice creation
-   duplicate payments
-   mass pagination abuse
-   arbitrary MongoDB query injection
-   file upload abuse
-   malicious public tokens

------------------------------------------------------------------------

# 31. File Upload Rules

For:

``` text
POST /api/assets
```

validate:

``` text
MIME type
file size
image dimensions
extension
```

Allowed image types should initially be:

``` text
PNG
JPG/JPEG
WEBP
```

Do not trust the filename alone.

------------------------------------------------------------------------

# 32. Invoice API Does Not Accept Raw Business Data During Finalization

Do not allow the frontend to submit:

``` json
{
  "businessName": "fake business",
  "bankAccount": "fake account"
}
```

during finalization.

The backend obtains business information from the authorized business
and creates the snapshot.

Same for customer/product validation.

------------------------------------------------------------------------

# 33. Invoice API Does Not Trust Product Price

The frontend may send:

``` json
{
  "productId": "...",
  "unitPriceMinor": 130000
}
```

The backend should decide whether this override is allowed.

It must never blindly trust:

``` text
product.defaultPriceMinor
```

or the client price.

The final price is an invoice decision and must be validated according
to business rules.

------------------------------------------------------------------------

# 34. Invoice Calculation Endpoint

A separate calculation endpoint is optional.

If the frontend needs server-authoritative calculations before
finalization:

### Endpoint

``` http
POST /api/invoices/calculate
```

### Input

Draft invoice payload.

### Output

``` json
{
  "success": true,
  "data": {
    "items": [],
    "totals": {},
    "amountInWords": "..."
  }
}
```

However:

> **Do not create this endpoint if the draft create/update APIs already
> return server-calculated totals.**

Avoid redundant APIs.

------------------------------------------------------------------------

# 35. Recommended Minimal API Surface

The actual MVP should implement these first.

## Authentication

``` text
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
POST   /api/auth/logout
```

## Business

``` text
GET    /api/business
PATCH  /api/business
PATCH  /api/business/invoice-settings
PATCH  /api/business/payment-settings
```

## Assets

``` text
POST   /api/assets
GET    /api/assets
PATCH  /api/assets/:assetId/activate
PATCH  /api/assets/:assetId/deactivate
```

## Customers

``` text
GET    /api/customers
GET    /api/customers/:customerId
POST   /api/customers
PATCH  /api/customers/:customerId
PATCH  /api/customers/:customerId/deactivate
```

## Products/Services

``` text
GET    /api/products
GET    /api/products/:productId
POST   /api/products
PATCH  /api/products/:productId
PATCH  /api/products/:productId/deactivate
```

## Invoices

``` text
GET    /api/invoices
POST   /api/invoices
GET    /api/invoices/:invoiceId
PATCH  /api/invoices/:invoiceId
DELETE /api/invoices/:invoiceId
POST   /api/invoices/:invoiceId/preview
POST   /api/invoices/:invoiceId/finalize
POST   /api/invoices/:invoiceId/cancel
GET    /api/invoices/:invoiceId/snapshot
GET    /api/invoices/:invoiceId/pdf
POST   /api/invoices/:invoiceId/documents/snapshot/retry
POST   /api/invoices/:invoiceId/documents/pdf/retry
```

## Payments

``` text
GET    /api/invoices/:invoiceId/payments
POST   /api/invoices/:invoiceId/payments
POST   /api/invoices/:invoiceId/payments/:paymentId/reverse
```

## Sharing

``` text
POST   /api/invoices/:invoiceId/share
POST   /api/invoices/:invoiceId/share/disable
GET    /api/public/invoices/:token
```

## Dashboard

``` text
GET    /api/dashboard/overview
GET    /api/dashboard/recent-invoices
```

## Analytics

``` text
GET    /api/analytics/revenue
GET    /api/analytics/top-services
GET    /api/analytics/outstanding
GET    /api/analytics/customers
```

## Infrastructure

``` text
GET    /api/health
```

------------------------------------------------------------------------

# 36. APIs That Should NOT Be Created

Do not create generic CRUD APIs for internal collections:

``` text
invoice_sequences
audit_logs
idempotency_keys
```

Do not create APIs such as:

``` text
GET /api/invoice-sequences
POST /api/audit-logs
GET /api/idempotency-keys
```

These are backend implementation details.

------------------------------------------------------------------------

# 37. API-to-Database Mapping

  API                Primary Collection
  ------------------ ------------------------------
  Auth               users
  Business           businesses
  Membership         business_members
  Assets             assets
  Customers          customers
  Products           products
  Invoice sequence   invoice_sequences internally
  Invoices           invoices
  Payments           payments
  Audit              audit_logs internally
  Idempotency        idempotency_keys internally
  Analytics          invoices + payments

------------------------------------------------------------------------

# 38. Invoice Creation Data Flow

``` text
Frontend
   │
   │ POST /api/invoices
   ▼
Express Controller
   │
   ▼
Request Validation
   │
   ▼
Authorization
   │
   ▼
Invoice Service
   │
   ├── Customer validation
   ├── Product validation
   ├── Price validation
   ├── Calculation
   └── Draft creation
   │
   ▼
MongoDB
   │
   ▼
Invoice Response
   │
   ▼
Frontend
```

------------------------------------------------------------------------

# 39. Invoice Finalization Data Flow

``` text
Frontend
   │
   │ POST /finalize
   ▼
Auth Middleware
   │
   ▼
Business Authorization
   │
   ▼
Idempotency Check
   │
   ▼
Invoice Service
   │
   ├── Validate draft
   ├── Recalculate totals
   ├── Create snapshots
   ├── Atomic invoice number
   ├── Finalize invoice
   └── Audit log
   │
   ▼
MongoDB Transaction
   │
   ▼
Invoice Finalized
   │
   ├───────────────┐
   ▼               ▼
PNG Renderer      PDF Renderer
   │               │
   ▼               ▼
Cloudinary       Object Storage
   │               │
   └───────┬───────┘
           ▼
     Update Document
           │
           ▼
      Final Response
```

------------------------------------------------------------------------

# 40. Important Document Failure Behavior

Suppose:

``` text
Invoice finalization succeeds
PNG generation fails
PDF generation succeeds
```

Response should still represent:

``` text
Invoice: FINALIZED
Snapshot: FAILED
PDF: READY
```

The invoice must not become a draft again.

The user should see:

``` text
Invoice finalized

PDF ✓
Original image ⚠ Retry
```

------------------------------------------------------------------------

# 41. Invoice History Does Not Regenerate Documents

When:

``` text
GET /api/invoices
```

is called:

Do not:

``` text
load invoice
↓
render HTML
↓
generate PNG
```

The history API should simply return stored metadata:

``` text
snapshotUrl
pdf status
invoice details
```

This makes the application fast.

------------------------------------------------------------------------

# 42. Public Invoice Does Not Query Current Master Data

For:

``` text
GET /api/public/invoices/:token
```

use the finalized invoice snapshots.

Do not fetch:

``` text
current business
current customer
current product
```

to reconstruct the public invoice.

------------------------------------------------------------------------

# 43. Analytics Rules

Revenue analytics should only include:

``` text
FINALIZED
```

invoices.

Cancelled invoices should be excluded from normal revenue totals.

Payment analytics should use:

``` text
CONFIRMED
```

payments.

Reversed payments should not count as successful payments.

------------------------------------------------------------------------

# 44. API Versioning

Recommended base:

``` text
/api/v1
```

if the project expects a long-lived public API.

Example:

``` text
POST /api/v1/invoices
```

If the project is strictly internal and the team wants a simpler MVP,
`/api` is acceptable.

The important rule is:

> Choose one convention and keep it consistent.

------------------------------------------------------------------------

# 45. Recommended Backend Structure

The API implementation should roughly follow:

``` text
src/
├── modules/
│   ├── auth/
│   ├── business/
│   ├── assets/
│   ├── customers/
│   ├── products/
│   ├── invoices/
│   ├── payments/
│   ├── dashboard/
│   └── analytics/
│
├── middleware/
├── config/
├── database/
├── shared/
│   ├── errors/
│   ├── validation/
│   ├── auth/
│   └── utils/
│
└── app.ts
```

Each module should contain:

``` text
controller
service
repository
schema/validation
routes
types/dto
```

Do not put all endpoints into one giant controller.

------------------------------------------------------------------------

# 46. Invoice Module Internal Services

The invoice module should separate responsibilities:

``` text
InvoiceController
      ↓
InvoiceService
      ├── InvoiceCalculationService
      ├── InvoiceSnapshotService
      ├── InvoiceNumberService
      ├── InvoiceDocumentService
      └── InvoicePublicAccessService
```

This is especially important because invoice finalization is more
complex than ordinary CRUD.

------------------------------------------------------------------------

# 47. API Implementation Rules for AI

Any AI implementing these APIs must:

1.  Read `MODELS.md` first.
2.  Read `BILL_TEMPLATE.md` before implementing invoice
    rendering/document APIs.
3.  Never invent fields that are not required by the project.
4.  Never create generic CRUD APIs for internal collections.
5.  Never bypass business authorization.
6.  Never trust client totals.
7.  Never modify finalized invoices.
8.  Never generate invoice numbers using counts.
9.  Never use current master data to render old invoices.
10. Preserve the PNG snapshot requirement.
11. Store Cloudinary metadata, not image binaries, in MongoDB.
12. Keep PDF generation separate from financial invoice finalization.
13. Support retries for failed document generation.
14. Use idempotency for financial write operations.
15. Return DTOs instead of raw Mongoose documents.
16. Validate every request.
17. Use transactions where multiple financial writes must remain
    consistent.
18. Do not implement future accounting features that are not in this
    contract.
19. Do not change the database schema without updating `MODELS.md`.
20. Do not add an API unless a real frontend/business workflow requires
    it.

------------------------------------------------------------------------

# 48. API Contract Summary

The system has five major API domains:

``` text
AUTH
  ↓
Who is using the system?

BUSINESS
  ↓
Who is issuing the bill?

MASTER DATA
  ↓
Who is being billed?
What is being sold?

INVOICES + PAYMENTS
  ↓
What financial transactions happened?

DOCUMENTS + ANALYTICS
  ↓
How is the bill preserved, shared, and analyzed?
```

------------------------------------------------------------------------

# 49. Final API Principle

The API should make the shopkeeper's workflow:

``` text
Old:

Open Excel
   ↓
Find template
   ↓
Edit customer
   ↓
Enter services
   ↓
Calculate
   ↓
Fix formatting
   ↓
Export PDF
   ↓
Save
   ↓
Share


New:

Login
   ↓
Create Invoice
   ↓
Select Customer
   ↓
Select Services
   ↓
Enter Qty
   ↓
Automatic Calculation
   ↓
Preview
   ↓
Finalize
   ↓
Automatic Invoice Number
   ↓
Automatic PNG Snapshot
   ↓
Automatic PDF
   ↓
Share
   ↓
Invoice permanently searchable
```

The API layer exists to make this workflow reliable, fast, and
repeatable.

------------------------------------------------------------------------

# 50. Final MVP API Checklist

Before considering the backend API complete, verify:

``` text
[ ] Authentication works
[ ] Business settings work
[ ] Logo/stamp/signature upload works
[ ] Customers CRUD works
[ ] Products/services CRUD works
[ ] Draft invoice creation works
[ ] Draft invoice editing works
[ ] Server-side calculations work
[ ] Invoice finalization works
[ ] Atomic invoice numbering works
[ ] Customer snapshot works
[ ] Business snapshot works
[ ] Asset snapshot works
[ ] Invoice PNG snapshot works
[ ] Cloudinary upload works
[ ] PDF generation works
[ ] PDF retry works
[ ] PNG retry works
[ ] Invoice history works
[ ] Original snapshot preview works
[ ] Invoice cancellation works
[ ] Payments work
[ ] Payment reversal works
[ ] Public invoice link works
[ ] Public link disable works
[ ] Dashboard overview works
[ ] Revenue analytics works
[ ] Top services analytics works
[ ] Outstanding analytics works
[ ] Customer analytics works
[ ] Audit logs are created internally
[ ] Idempotency is implemented
[ ] Business-level authorization is enforced
[ ] Historical invoices remain unchanged
[ ] No raw internal IDs are exposed publicly
```

This checklist defines the API completion boundary for the current
project. Anything beyond it should be treated as a new feature rather
than silently added to the MVP.
