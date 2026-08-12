# Automated Billing & Invoice Management System --- Database Models

**Version:** 1.1\
**Status:** Database Contract / Implementation Specification\
**Date:** 2026-08-12\
**Database:** MongoDB\
**ODM:** Mongoose

------------------------------------------------------------------------

# 1. Purpose

This document defines the database model for the Automated Billing &
Invoice Management System.

The system replaces the shopkeeper's Excel → manual document → PDF
workflow with a structured billing application.

The database must support:

-   customer management
-   product/service management
-   invoice creation
-   automatic invoice numbering
-   payments
-   invoice history
-   immutable historical invoices
-   PDF generation
-   permanent visual invoice snapshots
-   Cloudinary asset storage
-   analytics
-   auditability
-   secure public invoice sharing
-   future multi-user and multi-business support

The most important requirement is:

> **A finalized invoice must remain historically reproducible even if
> the business settings, customer data, product prices, invoice
> template, logo, stamp, CSS, PDF library, or application UI changes
> later.**

------------------------------------------------------------------------

# 2. Core Database Philosophy

The system has three categories of data.

``` text
MASTER DATA
    ↓
Business
Customers
Products / Services
Assets
Users

TRANSACTION DATA
    ↓
Invoices
Payments

DERIVED / ARCHIVAL DATA
    ↓
PDF
PNG/JPG Invoice Snapshot
Analytics
Audit Logs
```

The source of truth is:

``` text
MongoDB structured invoice data
```

The visual invoice snapshot is:

``` text
historical presentation copy
```

The PDF is:

``` text
document/export copy
```

These must not be confused.

------------------------------------------------------------------------

# 3. Critical Historical Invoice Principle

The old physical bill book often contains an original bill and a
carbon-paper copy.

The digital equivalent will be:

``` text
FINALIZED INVOICE
       │
       ├── Structured Invoice Record
       │       ↓
       │    MongoDB
       │
       ├── Original Visual Snapshot
       │       ↓
       │    PNG/JPG
       │       ↓
       │    Cloudinary
       │
       └── PDF Archive
               ↓
          Document Storage
```

The image snapshot is important because the invoice template may change
later.

For example:

``` text
2026 Invoice
    ↓
Old logo
Old address
Old stamp
Old layout
Old font
```

In 2027 the business may change:

``` text
New logo
New address
New template
New styling
```

The 2026 invoice must still display exactly as it was issued.

Therefore:

> **Finalized invoice snapshots are immutable.**

------------------------------------------------------------------------

# 4. Database Design Rules

## Rule 1 --- Every business-owned document contains `businessId`

Examples:

``` text
customers
products
invoices
payments
assets
audit_logs
invoice_sequences
```

All must be scoped to a business.

------------------------------------------------------------------------

## Rule 2 --- Never trust client financial values

The frontend may calculate totals for instant feedback.

The backend must recalculate:

``` text
line amounts
subtotal
discount
tax
rounding
grand total
```

before saving/finalizing.

------------------------------------------------------------------------

## Rule 3 --- Never use floating-point money

Do not use:

``` js
price: 1600.50
```

as the financial source of truth.

Use integer minor units.

For INR:

``` text
₹1,600.50
↓
160050 paise
```

Example:

``` js
amountMinor: 160050,
currency: "INR"
```

------------------------------------------------------------------------

## Rule 4 --- Finalized invoices are immutable

A finalized invoice must not be silently edited.

If a correction is needed later:

``` text
Cancel / Void
        ↓
Create corrected invoice
```

Future credit/debit note support can be added later.

------------------------------------------------------------------------

## Rule 5 --- Master data can change; transaction history cannot

Customer:

``` text
Current address can change.
```

Invoice:

``` text
Historical address must not change.
```

Product:

``` text
Current price can change.
```

Invoice:

``` text
Historical price must not change.
```

Business:

``` text
Current bank account can change.
```

Invoice:

``` text
Historical bank information must not change.
```

------------------------------------------------------------------------

## Rule 6 --- Use snapshots for finalized invoices

A finalized invoice stores:

-   customer snapshot
-   business snapshot
-   asset snapshot
-   line-item snapshot
-   tax snapshot
-   totals
-   payment terms

This makes the invoice self-contained.

------------------------------------------------------------------------

## Rule 7 --- Do not use database IDs as public invoice URLs

Use a secure random token.

Example:

``` text
/i/7F82KX91KX7...
```

------------------------------------------------------------------------

## Rule 8 --- Never calculate invoice numbers using document counts

Never use:

``` text
countDocuments() + 1
```

Use an atomic sequence.

------------------------------------------------------------------------

# 5. Collections

Implement these collections:

``` text
users
businesses
business_members
assets
customers
products
invoice_sequences
invoices
payments
audit_logs
idempotency_keys
```

Future collections only when needed:

``` text
invoice_revisions
credit_notes
debit_notes
expenses
notifications
webhook_events
inventory_movements
suppliers
```

------------------------------------------------------------------------

# 6. Relationship Overview

``` text
USER
 │
 └── BUSINESS MEMBER
          │
          ▼
       BUSINESS
          │
    ┌─────┼──────────────┐
    │     │              │
    ▼     ▼              ▼
CUSTOMERS PRODUCTS      ASSETS
    │     │
    └──┬──┘
       ▼
    INVOICES
       │
       ├── Invoice Items
       ├── Customer Snapshot
       ├── Business Snapshot
       ├── Asset Snapshot
       ├── Totals
       └── Payment Summary
              │
              ▼
           PAYMENTS
```

------------------------------------------------------------------------

# 7. `users`

Represents an authenticated person.

Business-specific authorization belongs in `business_members`.

## Schema

``` js
{
  _id: ObjectId,

  name: String,

  email: String,

  phone: String | null,

  passwordHash: String | null,

  status: "ACTIVE" | "SUSPENDED",

  lastLoginAt: Date | null,

  createdAt: Date,
  updatedAt: Date
}
```

## Rules

-   Email must be normalized to lowercase.
-   Passwords must never be stored as plaintext.
-   `passwordHash` may be null for future OAuth-only accounts.
-   Suspended users cannot authenticate/use protected resources.

## Index

``` text
email UNIQUE
```

------------------------------------------------------------------------

# 8. `businesses`

Represents the shop/company.

A business is the root tenant entity.

## Schema

``` js
{
  _id: ObjectId,

  name: String,

  legalName: String | null,

  displayName: String | null,

  address: {
    line1: String,
    line2: String | null,
    city: String | null,
    state: String | null,
    postalCode: String | null,
    country: String
  },

  contact: {
    phone: String | null,
    email: String | null,
    website: String | null
  },

  timezone: String,

  taxProfile: {
    gstin: String | null,
    pan: String | null,
    taxRegistrationType: String | null
  },

  bankDetails: {
    bankName: String | null,
    accountHolderName: String | null,
    accountNumber: String | null,
    ifsc: String | null,
    branch: String | null
  },

  invoiceSettings: {
    invoiceTitle: String,
    prefix: String,
    defaultCurrency: "INR",

    defaultPaymentTerms: String | null,

    defaultTaxMode:
      "NONE" |
      "EXCLUSIVE" |
      "INCLUSIVE",

    defaultTaxRateBps: Number,

    numberingMode:
      "SEQUENTIAL"
  },

  paymentSettings: {
    defaultPaymentStatus:
      "UNPAID"
  },

  status:
    "ACTIVE" |
    "SUSPENDED" |
    "ARCHIVED",

  createdAt: Date,
  updatedAt: Date
}
```

## Initial timezone

``` text
Asia/Kolkata
```

The timezone must be stored explicitly.

------------------------------------------------------------------------

# 9. `business_members`

Allows users to belong to businesses.

This is important even if the MVP has only one shopkeeper.

## Schema

``` js
{
  _id: ObjectId,

  businessId: ObjectId,

  userId: ObjectId,

  role:
    "OWNER" |
    "ADMIN" |
    "STAFF",

  status:
    "ACTIVE" |
    "INVITED" |
    "SUSPENDED",

  createdAt: Date,
  updatedAt: Date
}
```

## Indexes

``` text
{ businessId: 1, userId: 1 } UNIQUE
{ userId: 1, status: 1 }
```

------------------------------------------------------------------------

# 10. `assets`

Stores metadata for Cloudinary assets.

Used for:

-   logo
-   stamp
-   signature
-   future business document assets

## Schema

``` js
{
  _id: ObjectId,

  businessId: ObjectId,

  type:
    "LOGO" |
    "STAMP" |
    "SIGNATURE" |
    "OTHER",

  cloudinaryPublicId: String,

  secureUrl: String,

  format: String | null,

  width: Number | null,

  height: Number | null,

  version: Number | null,

  active: Boolean,

  createdAt: Date,
  updatedAt: Date
}
```

## Important

Do not delete an old asset automatically if it is referenced by a
finalized invoice snapshot.

Historical invoices must remain reproducible.

------------------------------------------------------------------------

# 11. `customers`

Reusable customer master data.

## Schema

``` js
{
  _id: ObjectId,

  businessId: ObjectId,

  name: String,

  contact: {
    phone: String | null,
    email: String | null
  },

  address: {
    line1: String | null,
    line2: String | null,
    city: String | null,
    state: String | null,
    postalCode: String | null,
    country: String
  },

  taxProfile: {
    gstin: String | null,
    pan: String | null
  },

  notes: String | null,

  active: Boolean,

  deletedAt: Date | null,

  createdAt: Date,
  updatedAt: Date
}
```

## Rules

Do not make these globally unique:

``` text
customer name
phone
```

Two different customers may share the same name or phone.

## Indexes

``` text
{ businessId: 1, name: 1 }
{ businessId: 1, "contact.phone": 1 }
{ businessId: 1, "taxProfile.gstin": 1 }
{ businessId: 1, active: 1 }
```

------------------------------------------------------------------------

# 12. `products`

Represents products or services.

The UI may call them "Services".

## Schema

``` js
{
  _id: ObjectId,

  businessId: ObjectId,

  type:
    "SERVICE" |
    "PRODUCT",

  name: String,

  description: String | null,

  uom: String,

  defaultPriceMinor: Number,

  currency: "INR",

  defaultTaxRateBps: Number,

  active: Boolean,

  deletedAt: Date | null,

  createdAt: Date,
  updatedAt: Date
}
```

Example:

``` text
AC Water Service
UOM: JOB
Default Price: 160000 paise
```

The default price is only a starting value.

The invoice stores the actual charged price.

## Indexes

``` text
{ businessId: 1, name: 1 }
{ businessId: 1, active: 1 }
```

------------------------------------------------------------------------

# 13. UOM

Initial supported units:

``` text
JOB
NOS
PCS
HOUR
DAY
KG
SET
UNIT
```

A custom UOM string may be allowed.

Do not create a separate UOM collection in MVP.

------------------------------------------------------------------------

# 14. `invoice_sequences`

Responsible for safe invoice numbering.

## Schema

``` js
{
  _id: ObjectId,

  businessId: ObjectId,

  key: "INVOICE",

  prefix: String,

  nextNumber: Number,

  updatedAt: Date
}
```

## Index

``` text
{ businessId: 1, key: 1 } UNIQUE
```

## Number generation

Use an atomic MongoDB update:

``` text
findOneAndUpdate
+
$inc
```

Never use:

``` text
countDocuments() + 1
```

------------------------------------------------------------------------

# 15. Invoice Numbering Policy

Recommended:

``` text
Draft
 ↓
Finalize
 ↓
Reserve invoice number atomically
 ↓
Save finalized invoice
```

This prevents unused draft numbers.

If the business later requires numbers at draft creation, numbers may be
reserved, but abandoned numbers must never be silently reused.

------------------------------------------------------------------------

# 16. `invoices`

This is the central financial document.

## Schema

``` js
{
  _id: ObjectId,

  businessId: ObjectId,

  invoiceNumber: String | null,

  invoiceDate: Date,

  status:
    "DRAFT" |
    "FINALIZED" |
    "CANCELLED",

  currency: "INR",

  customerId: ObjectId | null,

  customerSnapshot: {},

  businessSnapshot: {},

  assetSnapshot: {},

  items: [],

  totals: {},

  amountInWords: String,

  paymentTerms: String | null,

  notes: String | null,

  paymentSummary: {},

  publicAccess: {},

  document: {},

  createdBy: ObjectId,

  finalizedBy: ObjectId | null,

  cancelledBy: ObjectId | null,

  cancellationReason: String | null,

  finalizedAt: Date | null,

  cancelledAt: Date | null,

  createdAt: Date,

  updatedAt: Date
}
```

------------------------------------------------------------------------

# 17. Invoice Customer Snapshot

This stores exactly what was printed.

``` js
customerSnapshot: {
  name: String,

  contact: {
    phone: String | null,
    email: String | null
  },

  address: {
    line1: String | null,
    line2: String | null,
    city: String | null,
    state: String | null,
    postalCode: String | null,
    country: String
  },

  taxProfile: {
    gstin: String | null,
    pan: String | null
  }
}
```

`customerId` remains useful for navigation.

But historical rendering must use:

``` text
customerSnapshot
```

------------------------------------------------------------------------

# 18. Invoice Business Snapshot

Stores the business information printed on the invoice.

``` js
businessSnapshot: {
  name: String,

  legalName: String | null,

  displayName: String | null,

  address: {
    line1: String,
    line2: String | null,
    city: String | null,
    state: String | null,
    postalCode: String | null,
    country: String
  },

  contact: {
    phone: String | null,
    email: String | null,
    website: String | null
  },

  timezone: String,

  taxProfile: {
    gstin: String | null,
    pan: String | null,
    taxRegistrationType: String | null
  },

  bankDetails: {
    bankName: String | null,
    accountHolderName: String | null,
    accountNumber: String | null,
    ifsc: String | null,
    branch: String | null
  },

  invoiceTitle: String,

  paymentTerms: String | null
}
```

This prevents future business setting changes from altering historical
invoices.

------------------------------------------------------------------------

# 19. Invoice Asset Snapshot

Stores the assets used for the invoice.

``` js
assetSnapshot: {
  logo: {
    assetId: ObjectId | null,
    cloudinaryPublicId: String | null,
    secureUrl: String | null
  },

  stamp: {
    assetId: ObjectId | null,
    cloudinaryPublicId: String | null,
    secureUrl: String | null
  },

  signature: {
    assetId: ObjectId | null,
    cloudinaryPublicId: String | null,
    secureUrl: String | null
  }
}
```

The snapshot should preserve the exact asset references used when the
invoice was finalized.

------------------------------------------------------------------------

# 20. Invoice Items

Invoice items must be self-contained snapshots.

## Schema

``` js
{
  productId: ObjectId | null,

  type:
    "SERVICE" |
    "PRODUCT",

  description: String,

  uom: String,

  quantity: Number,

  unitPriceMinor: Number,

  taxableAmountMinor: Number,

  taxes: [
    {
      type: String,

      rateBps: Number,

      amountMinor: Number
    }
  ],

  taxAmountMinor: Number,

  lineTotalMinor: Number
}
```

Example:

``` json
{
  "productId": "ObjectId(...)",
  "type": "SERVICE",
  "description": "AC Water Service",
  "uom": "JOB",
  "quantity": 2,
  "unitPriceMinor": 160000,
  "taxableAmountMinor": 320000,
  "taxes": [],
  "taxAmountMinor": 0,
  "lineTotalMinor": 320000
}
```

------------------------------------------------------------------------

# 21. Why Invoice Items Store Snapshots

Suppose today's service is:

``` text
AC Water Service
₹1,600
```

Next year:

``` text
AC Water Service
₹2,000
```

Old invoice must remain:

``` text
AC Water Service
₹1,600
```

Therefore:

``` text
productId
+
description
+
unitPrice
+
tax
+
UOM
```

are stored on the invoice item.

------------------------------------------------------------------------

# 22. Quantity

Quantity may contain decimals.

Examples:

``` text
1
2
2.5
0.75
```

Validate a maximum precision such as:

``` text
3 decimal places
```

unless the business later requires more.

For strict financial/measurement calculations, MongoDB `Decimal128` can
be considered for quantity.

------------------------------------------------------------------------

# 23. Money Representation

All financial values use integer minor units.

Examples:

``` text
₹1,600
→ 160000

₹1,600.50
→ 160050

₹99.50
→ 9950
```

Every monetary field must have:

``` text
amountMinor
currency
```

The MVP supports:

``` text
INR
```

but the schema keeps currency explicit.

------------------------------------------------------------------------

# 24. Tax Representation

Use basis points.

``` text
5%  → 500
9%  → 900
18% → 1800
```

Invoice taxes are stored as:

``` js
taxes: [
  {
    type: "CGST",
    rateBps: 900,
    amountMinor: 28800
  },
  {
    type: "SGST",
    rateBps: 900,
    amountMinor: 28800
  }
]
```

This allows future GST support without redesigning the invoice item.

------------------------------------------------------------------------

# 25. Invoice Totals

``` js
totals: {
  subtotalMinor: Number,

  discountMinor: Number,

  taxableAmountMinor: Number,

  taxes: [
    {
      type: String,
      rateBps: Number,
      amountMinor: Number
    }
  ],

  taxTotalMinor: Number,

  roundingMinor: Number,

  grandTotalMinor: Number,

  currency: "INR"
}
```

Formula:

``` text
Subtotal
    ↓
- Discount
    ↓
Taxable Amount
    ↓
+ Tax
    ↓
+/- Rounding
    ↓
Grand Total
```

------------------------------------------------------------------------

# 26. Amount in Words

Store:

``` js
amountInWords: String
```

Example:

``` text
Three Thousand Two Hundred Rupees Only
```

It must be generated from the server-calculated final total.

The user should not manually enter this field.

------------------------------------------------------------------------

# 27. Payment Architecture

Do not make the invoice's `paidAmount` the only payment source.

Use:

``` text
invoices
   │
   └── paymentSummary
              │
              └── derived/denormalized

payments
   │
   └── actual payment records
```

This supports multiple payments.

------------------------------------------------------------------------

# 28. `payments`

## Schema

``` js
{
  _id: ObjectId,

  businessId: ObjectId,

  invoiceId: ObjectId,

  amountMinor: Number,

  currency: "INR",

  method:
    "CASH" |
    "UPI" |
    "BANK_TRANSFER" |
    "CARD" |
    "CHEQUE" |
    "OTHER",

  referenceNumber: String | null,

  paidAt: Date,

  notes: String | null,

  recordedBy: ObjectId,

  status:
    "CONFIRMED" |
    "REVERSED",

  createdAt: Date,

  updatedAt: Date
}
```

------------------------------------------------------------------------

# 29. Multiple Payment Example

Invoice:

``` text
Total: ₹10,000
```

Payments:

``` text
₹4,000 CASH
₹6,000 UPI
```

Invoice summary:

``` text
Paid: ₹10,000
Due: ₹0
Status: PAID
```

The payment records remain separate.

------------------------------------------------------------------------

# 30. Invoice Payment Summary

For fast invoice-list queries:

``` js
paymentSummary: {
  paidAmountMinor: Number,

  dueAmountMinor: Number,

  status:
    "UNPAID" |
    "PARTIALLY_PAID" |
    "PAID"
}
```

Source of truth:

``` text
payments
```

The summary is denormalized for performance.

------------------------------------------------------------------------

# 31. Payment Rules

``` text
paidAmount >= 0
paidAmount <= invoice total
due = total - confirmed payments
```

If a payment is reversed:

``` text
payment.status = REVERSED
```

and the invoice summary is recalculated.

Do not silently delete financial payment records.

------------------------------------------------------------------------

# 32. Public Invoice Access

Use a secure random token.

``` js
publicAccess: {
  enabled: Boolean,

  tokenHash: String | null,

  createdAt: Date | null,

  expiresAt: Date | null
}
```

Example:

``` text
https://yourapp.com/i/7F82KX91KX7...
```

The raw token should not be stored in MongoDB when it is not needed.

Store a hash:

``` text
raw token
   ↓
SHA-256 / secure hash
   ↓
tokenHash
```

------------------------------------------------------------------------

# 33. Document Storage Architecture

This system intentionally stores multiple representations.

``` text
                     FINALIZED INVOICE
                            │
                ┌───────────┼───────────┐
                │           │           │
                ▼           ▼           ▼
           MongoDB       PNG/JPG       PDF
           Structured     Snapshot     Document
              Data           │           │
                             │           │
                             ▼           ▼
                         Cloudinary   Document Storage
```

### MongoDB

Source of truth.

### PNG/JPG

Historical visual snapshot.

### PDF

Official document/export copy.

------------------------------------------------------------------------

# 34. Why Store PNG/JPG?

The image snapshot is the digital equivalent of the old shopkeeper's
duplicate/carbon copy.

It provides:

-   instant viewing
-   stable historical appearance
-   mobile-friendly preview
-   quick sharing
-   thumbnail generation
-   protection against future template changes

It should be created when the invoice is finalized.

------------------------------------------------------------------------

# 35. PNG vs JPG

Recommended default:

``` text
PNG
```

because invoice documents contain:

-   text
-   tables
-   logos
-   thin borders
-   stamps
-   signatures

PNG generally preserves these elements better.

JPG may be used if file size becomes a concern.

Do not store both unless there is a real requirement.

------------------------------------------------------------------------

# 36. Snapshot Generation Flow

Recommended:

``` text
Create Draft
     ↓
Finalize
     ↓
Server validates invoice
     ↓
Server recalculates totals
     ↓
Generate invoice number
     ↓
Freeze snapshots
     ↓
Render final invoice HTML
     ↓
Render PNG snapshot
     ↓
Upload PNG to Cloudinary
     ↓
Generate PDF
     ↓
Store document metadata
     ↓
Mark invoice finalized
```

However, invoice persistence and document generation should be designed
so a temporary Cloudinary/PDF failure does not destroy the financial
invoice.

A safer production flow is:

``` text
Validate
 ↓
Finalize invoice transaction
 ↓
Commit invoice
 ↓
Generate snapshot/PDF
 ↓
Update document status
```

This means the invoice can exist even if document rendering temporarily
fails.

------------------------------------------------------------------------

# 37. Document Status

``` js
document: {
  snapshot: {
    status:
      "NOT_GENERATED" |
      "GENERATING" |
      "READY" |
      "FAILED",

    provider: "CLOUDINARY",

    publicId: String | null,

    secureUrl: String | null,

    format: "png",

    width: Number | null,

    height: Number | null,

    generatedAt: Date | null,

    checksum: String | null
  },

  pdf: {
    status:
      "NOT_GENERATED" |
      "GENERATING" |
      "READY" |
      "FAILED",

    provider:
      "OBJECT_STORAGE" |
      "CLOUDINARY",

    storageKey: String | null,

    secureUrl: String | null,

    generatedAt: Date | null,

    checksum: String | null
  }
}
```

------------------------------------------------------------------------

# 38. Snapshot Immutability

Once:

``` text
document.snapshot.status = READY
```

the snapshot must not be replaced for the same finalized invoice.

If the snapshot is lost:

``` text
regenerate from the exact stored invoice snapshot
```

But do not regenerate using current business/customer/product data.

------------------------------------------------------------------------

# 39. Cloudinary Usage

Cloudinary is appropriate for:

``` text
business logo
business stamp
business signature
invoice PNG snapshots
```

The database stores:

``` text
Cloudinary publicId
secureUrl
format
dimensions
checksum
```

Do not store binary image data inside MongoDB.

------------------------------------------------------------------------

# 40. PDF Storage

PDFs are better treated as document artifacts.

Recommended architecture:

``` text
Invoice data → PDF
               ↓
Object Storage
```

Possible future storage:

``` text
Cloudflare R2
AWS S3
Supabase Storage
```

The exact provider can be decided during architecture implementation.

The database stores metadata only.

------------------------------------------------------------------------

# 41. Invoice History UI Data

The invoice history page should use MongoDB invoice metadata:

``` text
Invoice number
Date
Customer name
Total
Payment status
Snapshot URL
PDF status
```

It should NOT generate a PDF every time the list loads.

The snapshot should be immediately available.

------------------------------------------------------------------------

# 42. Invoice History Example

``` text
Invoices

┌──────────────────────────────────────────────┐
│ JRE20267                                     │
│ AON ENGINEERS                                │
│ 12 Aug 2026                                  │
│ ₹4,450                                       │
│                                              │
│ [ View Original ] [ PDF ] [ Share ]          │
└──────────────────────────────────────────────┘
```

`View Original` loads the archived snapshot.

This creates the feeling of a digital bill book.

------------------------------------------------------------------------

# 43. Thumbnail Strategy

Cloudinary can generate optimized thumbnails from the PNG snapshot.

Do not create and store another MongoDB document for every thumbnail.

Store the original Cloudinary asset reference and derive transformations
from it.

Example conceptual flow:

``` text
Original PNG
    ↓
Cloudinary transformation
    ↓
Thumbnail
```

This keeps storage simpler.

------------------------------------------------------------------------

# 44. Invoice Rendering Source

The invoice renderer must render from:

``` text
invoice.businessSnapshot
invoice.customerSnapshot
invoice.assetSnapshot
invoice.items
invoice.totals
invoice.amountInWords
```

It must NOT fetch current master records to fill missing historical
information.

------------------------------------------------------------------------

# 45. Historical Rendering Guarantee

The following must never happen:

``` text
Old invoice
    ↓
Current business settings
    ↓
Current customer
    ↓
Current product price
    ↓
Different old invoice
```

Correct:

``` text
Old invoice
    ↓
Frozen invoice snapshots
    ↓
Same invoice
```

------------------------------------------------------------------------

# 46. `document.checksum`

A checksum can be stored for integrity verification.

Example:

``` text
SHA-256
```

The checksum can be generated from the final artifact.

This helps detect accidental replacement/corruption.

It is optional for the first implementation but recommended in the
schema.

------------------------------------------------------------------------

# 47. `audit_logs`

Tracks important business actions.

## Schema

``` js
{
  _id: ObjectId,

  businessId: ObjectId,

  actorUserId: ObjectId,

  action: String,

  entityType:
    "INVOICE" |
    "CUSTOMER" |
    "PRODUCT" |
    "BUSINESS" |
    "PAYMENT" |
    "ASSET",

  entityId: ObjectId,

  metadata: Object,

  createdAt: Date
}
```

Examples:

``` text
INVOICE_CREATED
INVOICE_FINALIZED
INVOICE_CANCELLED
PAYMENT_RECORDED
PAYMENT_REVERSED
CUSTOMER_CREATED
CUSTOMER_UPDATED
PRODUCT_CREATED
PRODUCT_UPDATED
BUSINESS_SETTINGS_UPDATED
ASSET_UPLOADED
```

------------------------------------------------------------------------

# 48. Audit Log Rules

Do not store:

-   passwords
-   API keys
-   Cloudinary secrets
-   payment credentials
-   full authentication tokens

Audit logs are business history, not a secret dump.

------------------------------------------------------------------------

# 49. `idempotency_keys`

Prevents duplicate operations.

Important for:

``` text
invoice finalization
payment creation
```

## Schema

``` js
{
  _id: ObjectId,

  businessId: ObjectId,

  userId: ObjectId,

  key: String,

  operation: String,

  requestHash: String,

  responseStatus: Number,

  responseBody: Object,

  createdAt: Date,

  expiresAt: Date
}
```

## Index

``` text
{ businessId: 1, key: 1 } UNIQUE
```

------------------------------------------------------------------------

# 50. Invoice Finalization Transaction

Finalization should follow:

``` text
1. Authenticate user
2. Authorize business
3. Validate draft
4. Validate customer
5. Validate items
6. Recalculate amounts
7. Recalculate tax
8. Recalculate totals
9. Generate amount in words
10. Create customer snapshot
11. Create business snapshot
12. Create asset snapshot
13. Atomically reserve invoice number
14. Save finalized invoice
15. Create audit log
16. Commit transaction
17. Generate PNG snapshot
18. Generate PDF
19. Update document status
```

If step 17 or 18 fails:

``` text
Invoice remains finalized.
```

The document generation process can retry.

------------------------------------------------------------------------

# 51. Why Document Generation Is Separate

Financial correctness must not depend on a rendering service.

Bad:

``` text
PDF failed
↓
invoice creation failed
```

Better:

``` text
Invoice saved
↓
PDF failed
↓
Invoice still exists
↓
[Retry PDF]
```

This is important for production reliability.

------------------------------------------------------------------------

# 52. Document Generation Retry

If:

``` text
snapshot.status = FAILED
```

the UI should allow:

``` text
[ Retry Snapshot ]
```

Likewise:

``` text
pdf.status = FAILED
```

allows:

``` text
[ Retry PDF ]
```

------------------------------------------------------------------------

# 53. Finalized Invoice Immutability

After finalization, the following must not be edited:

``` text
invoiceNumber
invoiceDate
customerSnapshot
businessSnapshot
assetSnapshot
items
totals
amountInWords
```

Payment records can change independently.

Invoice cancellation is a separate operation.

------------------------------------------------------------------------

# 54. Draft Invoice

Drafts may contain:

``` text
customerId
items
notes
paymentTerms
```

but they are not official financial documents.

Drafts can be edited.

Drafts may be deleted according to business rules.

------------------------------------------------------------------------

# 55. Invoice Cancellation

Never delete a finalized invoice.

Use:

``` js
status: "CANCELLED",

cancelledAt: Date,

cancelledBy: ObjectId,

cancellationReason: String
```

The original snapshot and PDF remain available.

The UI can show:

``` text
CANCELLED
```

over the archived invoice.

------------------------------------------------------------------------

# 56. Business Tenancy

Never trust a browser-provided `businessId`.

Bad:

``` text
GET /api/invoices?businessId=123
```

Good:

``` text
Authenticated user
      ↓
Business membership
      ↓
Authorized businessId
      ↓
Query
```

Every query must be tenant-scoped.

------------------------------------------------------------------------

# 57. Mandatory Tenant Filtering

Bad:

``` js
Invoice.findById(invoiceId)
```

Good:

``` js
Invoice.findOne({
  _id: invoiceId,
  businessId: authorizedBusinessId
})
```

This rule applies to:

``` text
customers
products
invoices
payments
assets
audit logs
```

------------------------------------------------------------------------

# 58. Index Strategy

## Users

``` text
email UNIQUE
```

## Business Members

``` text
{ businessId: 1, userId: 1 } UNIQUE
{ userId: 1, status: 1 }
```

## Customers

``` text
{ businessId: 1, name: 1 }
{ businessId: 1, "contact.phone": 1 }
{ businessId: 1, active: 1 }
```

## Products

``` text
{ businessId: 1, name: 1 }
{ businessId: 1, active: 1 }
```

## Invoice Sequences

``` text
{ businessId: 1, key: 1 } UNIQUE
```

## Invoices

``` text
{ businessId: 1, invoiceNumber: 1 } UNIQUE

{ businessId: 1, invoiceDate: -1 }

{ businessId: 1, customerId: 1, invoiceDate: -1 }

{ businessId: 1, status: 1, invoiceDate: -1 }

{ businessId: 1, "paymentSummary.status": 1, invoiceDate: -1 }

{ businessId: 1, createdAt: -1 }

{ "publicAccess.tokenHash": 1 } UNIQUE SPARSE
```

## Payments

``` text
{ businessId: 1, invoiceId: 1, paidAt: -1 }

{ businessId: 1, paidAt: -1 }
```

## Assets

``` text
{ businessId: 1, type: 1, active: 1 }
```

## Audit Logs

``` text
{ businessId: 1, createdAt: -1 }

{ businessId: 1, entityType: 1, entityId: 1, createdAt: -1 }
```

------------------------------------------------------------------------

# 59. Invoice Document Indexing

Do not index every nested document status unnecessarily.

The main invoice queries are:

``` text
invoice history
customer history
date range
payment status
invoice number
```

Document generation status can be queried when needed.

Avoid excessive indexes because every index increases write cost.

------------------------------------------------------------------------

# 60. MongoDB Document Size

Normal invoices should embed:

``` text
items[]
```

directly inside the invoice.

This is preferable to creating:

``` text
invoice_items
```

for every line.

A normal invoice with 1--50 items is easily manageable.

If the business eventually creates extremely large invoices, revisit the
design.

------------------------------------------------------------------------

# 61. Embedded vs Referenced Data

## Embed

``` text
customerSnapshot
businessSnapshot
assetSnapshot
items
totals
paymentSummary
```

## Reference

``` text
businessId
customerId
productId
createdBy
payments
assets
```

This gives historical independence while maintaining navigation to
master records.

------------------------------------------------------------------------

# 62. Date and Time Rules

MongoDB timestamps:

``` text
createdAt
updatedAt
paidAt
finalizedAt
```

should be stored as UTC timestamps.

Business-local date:

``` text
invoiceDate
```

must be interpreted in:

``` text
business.timezone
```

Current business:

``` text
Asia/Kolkata
```

This prevents monthly report/date-boundary bugs.

------------------------------------------------------------------------

# 63. Soft Deletion

Customers:

``` text
active: false
deletedAt: Date
```

Products:

``` text
active: false
deletedAt: Date
```

Do not remove historical invoice references.

------------------------------------------------------------------------

# 64. Hard Deletion Rules

Do not hard-delete:

``` text
finalized invoices
payments
audit logs
```

Prefer:

``` text
cancel
reverse
archive
```

------------------------------------------------------------------------

# 65. Analytics Source

Analytics should be derived from:

``` text
invoices
payments
invoice.items
```

Examples:

### Revenue

``` text
SUM(invoices.totals.grandTotalMinor)
```

for finalized invoices.

### Top services

Aggregate:

``` text
items.description
items.lineTotalMinor
```

### Outstanding

``` text
invoice payment summary
```

or confirmed payment records.

Do not make manually updated counters the source of truth.

------------------------------------------------------------------------

# 66. Denormalization

Allowed:

``` text
invoice.paymentSummary
invoice.customerSnapshot
invoice.businessSnapshot
```

These have clear purposes.

Avoid unnecessary denormalization such as:

``` text
business.totalRevenue
business.totalInvoices
```

unless later performance requirements justify materialized reporting.

------------------------------------------------------------------------

# 67. Validation

Use validation at multiple levels:

``` text
Frontend
   ↓
API schema validation
   ↓
Business rules
   ↓
Mongoose validation
   ↓
MongoDB indexes
```

Recommended API validation library:

``` text
Zod
```

------------------------------------------------------------------------

# 68. Financial Validation

For every invoice:

``` text
quantity > 0
unitPrice >= 0
discount >= 0
tax >= 0
grandTotal >= 0
```

Server recalculates:

``` text
lineTotal
subtotal
tax
discount
rounding
grandTotal
```

Client totals are never authoritative.

------------------------------------------------------------------------

# 69. API DTO Separation

Do not return raw Mongoose documents directly.

Use response DTOs.

This prevents accidental exposure of:

``` text
tokenHash
internal storage keys
audit metadata
internal IDs
sensitive bank information
```

------------------------------------------------------------------------

# 70. Bank Information

Bank account information is sensitive business information.

Full bank details should only be returned to authorized business users
who need them.

Where possible, list responses should mask the account:

``` text
XXXXXX4821
```

The invoice rendering service may access the full value when generating
the invoice.

------------------------------------------------------------------------

# 71. Asset Lifecycle

When a logo changes:

``` text
Old Logo
   ↓
remains stored
   ↓
Old invoice snapshots continue working

New Logo
   ↓
active business asset
   ↓
new invoices use it
```

Never overwrite the old Cloudinary asset if historical invoices depend
on it.

Prefer versioned asset records.

------------------------------------------------------------------------

# 72. Invoice Snapshot Lifecycle

``` text
Draft
 ↓
Finalized
 ↓
Snapshot generated
 ↓
Snapshot READY
 ↓
Immutable
```

The snapshot belongs to that invoice version.

If the invoice is cancelled:

``` text
Snapshot remains.
```

------------------------------------------------------------------------

# 73. Public Link Lifecycle

Public links should be:

``` text
Enabled
Disabled
Optional Expiration
```

If a public link is disabled:

``` text
/i/token
```

should no longer expose the invoice.

The archived image/PDF remains available to authorized staff.

------------------------------------------------------------------------

# 74. Public Invoice Security

Public invoice pages should not expose:

-   internal MongoDB IDs
-   audit information
-   internal user information
-   Cloudinary management credentials
-   unrelated business data

Only the intended invoice content should be visible.

------------------------------------------------------------------------

# 75. Invoice Snapshot and PDF Relationship

They are two representations of the same finalized invoice.

``` text
Invoice
  │
  ├── Snapshot
  │     └── Fast visual archive
  │
  └── PDF
        └── Printable/shareable document
```

Neither replaces the structured invoice record.

------------------------------------------------------------------------

# 76. Recommended Storage

## MongoDB

``` text
Structured business data
Invoices
Payments
Metadata
```

## Cloudinary

``` text
Business logo
Stamp
Signature
Invoice PNG snapshot
```

## Object Storage

``` text
Invoice PDFs
Future documents
```

This separation keeps each storage system responsible for what it
handles best.

------------------------------------------------------------------------

# 77. Future Invoice Revisions

Do not implement for MVP.

If later required:

``` js
invoice_revisions: {
  _id: ObjectId,

  businessId: ObjectId,

  invoiceId: ObjectId,

  version: Number,

  snapshot: Object,

  changedBy: ObjectId,

  reason: String | null,

  createdAt: Date
}
```

However, finalized invoices should still normally be immutable.

------------------------------------------------------------------------

# 78. Future Credit Notes

If refunds/adjustments become necessary, add:

``` text
credit_notes
```

rather than editing old invoices.

A credit note should reference:

``` text
originalInvoiceId
```

This preserves the financial history.

------------------------------------------------------------------------

# 79. Future Debit Notes

Same principle:

``` text
debit_notes
```

should reference the original invoice.

Do not rewrite the original invoice to represent later charges.

------------------------------------------------------------------------

# 80. Future Inventory

Do not add inventory collections now.

If inventory is introduced later, create proper transaction-based stock
movement records rather than putting a mutable `stock` number into
invoices.

Possible future model:

``` text
inventory_movements
```

------------------------------------------------------------------------

# 81. Future Expenses

Do not mix expenses into invoices.

If required later:

``` text
expenses
```

should be a separate transaction domain.

------------------------------------------------------------------------

# 82. Future Multi-Business

The current schema already supports:

``` text
User
  ↓
BusinessMember
  ↓
Business A
Business B
```

The same user can potentially manage multiple businesses.

No fundamental invoice schema redesign should be required.

------------------------------------------------------------------------

# 83. Future Staff Roles

Existing role structure:

``` text
OWNER
ADMIN
STAFF
```

can later be expanded into permission checks.

Do not create a large permission matrix until actual requirements
appear.

------------------------------------------------------------------------

# 84. Future Notifications

If reminders are added later:

``` text
notifications
```

should be separate from invoice records.

Do not put notification history into invoices.

------------------------------------------------------------------------

# 85. Future WhatsApp Integration

WhatsApp message logs, if needed, should be stored separately.

For example:

``` text
message_delivery_logs
```

This prevents communication history from polluting the invoice model.

------------------------------------------------------------------------

# 86. Transaction Requirements

Use MongoDB transactions for operations involving multiple related
writes.

Important examples:

### Finalization

``` text
invoice sequence
+
invoice
+
audit log
```

### Payment

``` text
payment
+
invoice payment summary
+
audit log
```

Transactions require a MongoDB deployment that supports them.

------------------------------------------------------------------------

# 87. Concurrency Protection

The system must handle:

``` text
two users creating invoices
two users recording payments
double-clicks
network retries
multiple browser tabs
```

Protection:

``` text
unique indexes
atomic updates
transactions
idempotency keys
server validation
```

Frontend button disabling is not enough.

------------------------------------------------------------------------

# 88. Invoice Number Race Condition

Wrong:

``` text
Request A reads 267
Request B reads 267

A → 268
B → 268
```

Correct:

``` text
Request A
   ↓
atomic $inc
   ↓
268

Request B
   ↓
atomic $inc
   ↓
269
```

------------------------------------------------------------------------

# 89. Backup and Recovery Principle

The structured invoice record is the most important data.

The application must be able to recover invoice rendering from:

``` text
MongoDB invoice record
```

even if:

``` text
PNG is temporarily unavailable
PDF is temporarily unavailable
```

The archived snapshot is valuable, but it is not the only source of
truth.

------------------------------------------------------------------------

# 90. Document Regeneration

If a PNG/PDF artifact is lost:

``` text
Invoice structured data
        +
historical snapshots
        ↓
regenerate
```

Do not use current:

``` text
business settings
customer record
product record
```

for regeneration.

------------------------------------------------------------------------

# 91. Checksum and Integrity

For generated files:

``` text
SHA-256 checksum
```

can be stored.

Example:

``` js
checksum: "..."
```

This can later be used to verify that the stored artifact matches the
generated artifact.

------------------------------------------------------------------------

# 92. Complete Invoice Example

Conceptual finalized invoice:

``` js
{
  _id: ObjectId,

  businessId: ObjectId,

  invoiceNumber: "JRE20267",

  invoiceDate: "2026-08-12",

  status: "FINALIZED",

  currency: "INR",

  customerId: ObjectId,

  customerSnapshot: {
    name: "AON ENGINEERS AND CONSULTANTS PVT. LTD.",

    contact: {
      phone: "...",
      email: null
    },

    address: {
      line1: "...",
      line2: null,
      city: "Ahmedabad",
      state: "Gujarat",
      postalCode: "...",
      country: "India"
    },

    taxProfile: {
      gstin: null,
      pan: null
    }
  },

  businessSnapshot: {
    name: "JAY RAMJI ENTERPRISE",

    address: {
      line1: "...",
      line2: null,
      city: "Ahmedabad",
      state: "Gujarat",
      postalCode: "...",
      country: "India"
    },

    contact: {
      phone: "...",
      email: null,
      website: null
    },

    timezone: "Asia/Kolkata",

    taxProfile: {
      gstin: null,
      pan: "..."
    },

    bankDetails: {
      bankName: "...",
      accountHolderName: "...",
      accountNumber: "...",
      ifsc: "...",
      branch: "..."
    },

    invoiceTitle: "TAX INVOICE",

    paymentTerms: "30 Days"
  },

  assetSnapshot: {
    logo: {
      assetId: ObjectId,
      cloudinaryPublicId: "business/logo-v3",
      secureUrl: "..."
    },

    stamp: {
      assetId: ObjectId,
      cloudinaryPublicId: "business/stamp-v2",
      secureUrl: "..."
    },

    signature: {
      assetId: ObjectId,
      cloudinaryPublicId: "business/signature-v1",
      secureUrl: "..."
    }
  },

  items: [
    {
      productId: ObjectId,

      type: "SERVICE",

      description: "AC Water Service",

      uom: "JOB",

      quantity: 2,

      unitPriceMinor: 160000,

      taxableAmountMinor: 320000,

      taxes: [],

      taxAmountMinor: 0,

      lineTotalMinor: 320000
    }
  ],

  totals: {
    subtotalMinor: 320000,

    discountMinor: 0,

    taxableAmountMinor: 320000,

    taxes: [],

    taxTotalMinor: 0,

    roundingMinor: 0,

    grandTotalMinor: 320000,

    currency: "INR"
  },

  amountInWords:
    "Three Thousand Two Hundred Rupees Only",

  paymentTerms: "30 Days",

  notes: null,

  paymentSummary: {
    paidAmountMinor: 0,

    dueAmountMinor: 320000,

    status: "UNPAID"
  },

  publicAccess: {
    enabled: true,

    tokenHash: "...",

    createdAt: "...",

    expiresAt: null
  },

  document: {
    snapshot: {
      status: "READY",

      provider: "CLOUDINARY",

      publicId:
        "invoices/JRE20267/snapshot",

      secureUrl: "...",

      format: "png",

      width: 2480,

      height: 3508,

      generatedAt: "...",

      checksum: "..."
    },

    pdf: {
      status: "READY",

      provider: "OBJECT_STORAGE",

      storageKey:
        "invoices/JRE20267/invoice.pdf",

      secureUrl: "...",

      generatedAt: "...",

      checksum: "..."
    }
  },

  createdBy: ObjectId,

  finalizedBy: ObjectId,

  cancelledBy: null,

  cancellationReason: null,

  finalizedAt: "...",

  cancelledAt: null,

  createdAt: "...",

  updatedAt: "..."
}
```

------------------------------------------------------------------------

# 93. Final Collection Map

The MVP database is:

``` text
┌──────────────────────┐
│ users                │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ business_members     │
└──────────┬───────────┘
           │
           ▼
┌─────────────────────────────────┐
│ businesses                      │
│                                 │
│ business settings               │
│ bank details                    │
│ invoice settings                │
└──────┬──────────┬───────────────┘
       │          │
       │          ├───────────────┐
       │          │               │
       ▼          ▼               ▼
┌───────────┐ ┌───────────┐ ┌───────────┐
│ customers │ │ products  │ │  assets   │
└─────┬─────┘ └─────┬─────┘ └───────────┘
      │              │
      └───────┬──────┘
              ▼
       ┌───────────────┐
       │   invoices    │
       │               │
       │ snapshots     │
       │ items[]       │
       │ totals        │
       │ payment       │
       │ documents     │
       └───────┬───────┘
               │
               ▼
       ┌───────────────┐
       │   payments    │
       └───────────────┘

business
   │
   ├── invoice_sequences
   ├── audit_logs
   └── idempotency_keys
```

------------------------------------------------------------------------

# 94. Final MVP Collection List

Implement now:

``` text
1. users
2. businesses
3. business_members
4. assets
5. customers
6. products
7. invoice_sequences
8. invoices
9. payments
10. audit_logs
11. idempotency_keys
```

Do not implement yet:

``` text
invoice_revisions
credit_notes
debit_notes
expenses
notifications
webhook_events
inventory_movements
suppliers
subscriptions
```

------------------------------------------------------------------------

# 95. Why This Model Should Not Need Major Redesign Later

This design specifically protects against:

  Future Problem                 Protection
  ------------------------------ ----------------------------------------
  Customer address changes       Customer snapshot
  Customer deleted               Invoice snapshot
  Product price changes          Item price snapshot
  Product deleted                Item description snapshot
  Business address changes       Business snapshot
  Bank account changes           Business snapshot
  Logo changes                   Asset snapshot
  Stamp changes                  Asset snapshot
  Invoice template changes       PNG snapshot + structured invoice
  PDF renderer changes           Archived document + structured invoice
  Duplicate invoice numbers      Atomic sequence
  Multiple payments              Payments collection
  Double payment submission      Idempotency key
  Multiple staff                 Business members
  Multiple businesses            Business ID tenancy
  Accidental invoice editing     Finalized immutability
  Invoice cancellation           Cancelled status
  Public URL guessing            Random token + hash
  Cloudinary asset replacement   Versioned asset records
  Analytics inconsistency        Invoice/payment source of truth
  Failed PDF generation          Invoice independent of artifact
  Failed PNG generation          Retryable document status
  Timezone bugs                  Explicit business timezone
  Floating-point money errors    Integer minor units

------------------------------------------------------------------------

# 96. Non-Negotiable Implementation Rules

The implementation must NOT:

1.  Store financial amounts as floating-point values.
2.  Generate invoice numbers using document counts.
3.  Trust frontend totals.
4.  Render historical invoices from current master data.
5.  Delete finalized invoices.
6.  Delete payment history.
7.  Expose raw MongoDB IDs as public invoice URLs.
8.  Store images directly inside MongoDB.
9.  Overwrite historical Cloudinary assets.
10. Remove `businessId` filtering from business-owned queries.
11. Create a separate invoice-item collection for ordinary invoice sizes
    without a demonstrated need.
12. Treat the PNG/PDF as the financial source of truth.
13. Treat MongoDB structured data as disposable.
14. Make invoice creation dependent on successful PDF generation.
15. Reuse abandoned finalized invoice numbers.
16. Allow a payment to exceed the invoice balance without an explicit
    future business rule.
17. Silently modify finalized invoice snapshots.
18. Expose sensitive bank/authentication information through generic
    APIs.
19. Add future accounting complexity before it is required.
20. Change this schema casually without considering existing production
    documents.

------------------------------------------------------------------------

# 97. Final Architecture Principle

The most important relationship is:

``` text
                  MASTER DATA
                       │
                       ▼
                  CREATE BILL
                       │
                       ▼
               FINALIZE INVOICE
                       │
                       ▼
             ┌───────────────────┐
             │ FROZEN INVOICE    │
             │                   │
             │ Customer Snapshot │
             │ Business Snapshot │
             │ Asset Snapshot    │
             │ Item Snapshots    │
             │ Financial Totals  │
             └─────────┬─────────┘
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
       Structured Record      Visual Archive
          MongoDB              PNG/JPG
             │                 Cloudinary
             │
             └──────────┬──────────┐
                        ▼          ▼
                       PDF      Analytics
```

The fundamental rule is:

> **Master data is allowed to change. A finalized financial document is
> not.**

The PNG/JPG snapshot provides the digital equivalent of the old
carbon-paper copy, while MongoDB remains the authoritative structured
record and the PDF remains the printable/shareable document
representation.

This separation gives the application a stable foundation for future
billing, accounting, reporting, and document-management features.
