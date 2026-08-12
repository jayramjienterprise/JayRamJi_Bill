# Automated Billing & Invoice Management System --- PRD

**Version:** 1.0\
**Status:** Draft / MVP Specification\
**Date:** 2026-08-12\
**Primary Business:** JAY RAMJI ENTERPRISE\
**Primary Goal:** Replace the shopkeeper's manual Excel → document → PDF
billing workflow with a fast, mobile-friendly web application.

------------------------------------------------------------------------

## 1. Product Overview

The Automated Billing & Invoice Management System is a web application
for creating, managing, sharing, exporting, and analyzing invoices.

The current workflow requires the shopkeeper to manually edit an Excel
invoice template, enter customer and item information, adjust the bill,
and convert the document to PDF. This is slow, error-prone, and
difficult to use on a phone.

The new system will keep the existing invoice design, branding, business
information, logo, stamp, signature, and bank details as reusable
business configuration. Only variable invoice data will be entered when
creating a bill.

### Target workflow

``` text
Login
  ↓
Create Invoice
  ↓
Select / Create Customer
  ↓
Add Services / Items
  ↓
Quantity + Price
  ↓
Automatic Amount Calculation
  ↓
Preview Invoice
  ↓
Generate Invoice
  ↓
Share / Download / Print
```

The system should make routine invoice creation possible in roughly 1--2
minutes.

------------------------------------------------------------------------

## 2. Problem Statement

The existing billing process has several problems:

1.  The shopkeeper must manually edit Excel.
2.  Fixed business information is repeatedly handled alongside changing
    invoice information.
3.  Item calculations can be entered incorrectly.
4.  Formatting can be accidentally changed.
5.  PDF conversion is a separate manual step.
6.  Finding previous invoices is difficult.
7.  There is no reliable central sales history.
8.  Customer history is not easily searchable.
9.  Product/service sales cannot easily be analyzed.
10. The process is inconvenient on mobile devices.
11. Sharing invoices requires additional manual work.
12. There is no dashboard for revenue, invoice count, pending payments,
    or top-selling services.

------------------------------------------------------------------------

## 3. Product Goals

### Primary goals

-   Create invoices without editing Excel.
-   Preserve the existing invoice appearance.
-   Automatically calculate line-item amounts and totals.
-   Automatically generate invoice numbers.
-   Generate professional PDFs from invoice data.
-   Share invoices easily.
-   Store all invoice data in MongoDB.
-   Maintain customer and service history.
-   Provide invoice search and filtering.
-   Provide basic sales analytics.
-   Support both desktop and mobile screens.
-   Allow export to PDF, Excel, and DOCX where technically appropriate.
-   Keep the application lightweight and simple for a non-technical
    shopkeeper.

### Secondary goals

-   Reuse previous invoices through duplication.
-   Maintain payment status.
-   Maintain a reusable service/product catalogue.
-   Allow business settings to be changed without changing application
    code.
-   Preserve historical invoices even when customer or business
    information changes later.

------------------------------------------------------------------------

## 4. Non-Goals for MVP

The following should NOT be built in the first version unless a real
business requirement appears:

-   Full accounting software.
-   GST filing automation.
-   Inventory/warehouse management.
-   Payroll.
-   Supplier management.
-   Multi-company enterprise management.
-   Complex subscription billing.
-   Advanced ERP functionality.
-   Native Android/iOS applications.
-   Offline-first synchronization.
-   Complex role/permission systems.
-   AI invoice generation.

The MVP should solve the billing problem first.

------------------------------------------------------------------------

## 5. Target Users

### Primary user

**Shopkeeper / Business Operator**

Needs to:

-   create invoices quickly,
-   search customers,
-   select services,
-   send invoices,
-   see previous bills,
-   track payments,
-   view basic sales information.

### Secondary user

**Business Admin / Owner**

Needs to:

-   view analytics,
-   manage business information,
-   manage services/products,
-   manage customers,
-   review invoices,
-   monitor revenue and pending amounts.

For the MVP, one business owner/admin model is sufficient.

------------------------------------------------------------------------

# 6. Existing Excel Reference

The uploaded workbook is the source reference for the existing billing
workflow.

Workbook sheets include:

-   `RAVI JADEJA RAMANIYA`
-   `KADAR KHAN WASHING MACHINE`
-   `Sheet2`
-   `DHANJAY AC STOWNSHIP`
-   `West Coast`
-   `AON`

The invoice sheets contain recurring business information such as:

-   JAY RAMJI ENTERPRISE
-   business address
-   mobile number
-   TAX INVOICE heading
-   SOLD TO section
-   invoice information
-   item/service table
-   payment terms
-   bank information
-   amount in words
-   branding/stamp/signature elements where applicable.

`Sheet2` contains a service catalogue with fields similar to:

-   Types Of Service
-   UOM
-   Price

Example services include:

-   AC Water Service
-   AC Dry Service
-   AC Water Service (Up To 5 Ton)
-   AC Water Service (Up 5 To 8.5 Ton)
-   Preventive Maintenance (PM) AC Health Check
-   AC Fault Identify And PCB Remove And Installation

The application should use the workbook as a business-process reference,
but should NOT reproduce Excel's implementation or formulas. The web
application will use structured data and its own calculation logic.

------------------------------------------------------------------------

# 7. Invoice Data Model

## Fixed business information

Configured once in Business Settings:

-   Business name
-   Logo
-   Address
-   Phone
-   Email, if applicable
-   GSTIN, if applicable
-   PAN, if applicable
-   Bank name
-   Account number
-   IFSC
-   Branch
-   Stamp
-   Signature
-   Invoice title
-   Invoice prefix
-   Payment terms
-   Footer / notes
-   Default tax configuration

## Variable invoice information

Entered or selected during invoice creation:

-   Invoice number
-   Invoice date
-   Customer
-   Customer address
-   Customer phone
-   Customer GSTIN, if applicable
-   Payment terms
-   Description of goods/services
-   UOM
-   Quantity
-   Unit price
-   Line amount
-   Tax, if applicable
-   Discount, if applicable
-   Subtotal
-   Total
-   Amount in words
-   Payment status

------------------------------------------------------------------------

# 8. Core Features

## 8.1 Authentication

The system must provide secure login.

### MVP

-   Email/username
-   Password
-   Login
-   Logout
-   Protected dashboard routes
-   Password hashing
-   Authentication middleware

Future:

-   Google login
-   Password reset
-   Multi-user access

------------------------------------------------------------------------

# 9. Business Settings

The admin can configure the fixed invoice information.

### Business Profile

-   Business name
-   Address
-   Phone
-   Email
-   GSTIN
-   PAN

### Bank Details

-   Bank name
-   Account holder
-   Account number
-   IFSC
-   Branch

### Invoice Settings

-   Invoice prefix
-   Starting invoice number
-   Invoice title
-   Default payment terms
-   Tax defaults
-   Footer text

### Assets

Upload through Cloudinary:

-   Logo
-   Stamp
-   Signature

The uploaded assets must be previewable and replaceable.

------------------------------------------------------------------------

# 10. Customer Management

The system must maintain reusable customer records.

### Customer fields

-   Name
-   Address
-   Phone
-   Email
-   GSTIN
-   Notes
-   Created date
-   Updated date

### Operations

-   Create customer
-   Edit customer
-   Delete/deactivate customer
-   Search customer
-   View customer details
-   View customer invoice history
-   View customer total billed amount
-   View pending amount

### Invoice snapshot requirement

When an invoice is created, customer information used on that invoice
must be stored as a snapshot.

Example:

``` json
{
  "customerSnapshot": {
    "name": "AON ENGINEERS AND CONSULTANTS PVT. LTD.",
    "address": "Customer address at time of invoice",
    "phone": "Customer phone",
    "gstin": "Customer GSTIN"
  }
}
```

Changing the customer later must not modify old invoices.

------------------------------------------------------------------------

# 11. Product / Service Catalogue

The service catalogue should replace repetitive manual typing.

### Service fields

-   Service name
-   UOM
-   Default price
-   Description
-   Active/inactive
-   Created date
-   Updated date

### Operations

-   Add service
-   Edit service
-   Deactivate service
-   Search service
-   Set default price
-   Import initial services from existing Excel
-   Select service while creating invoice

The shopkeeper must still be able to override the default price for an
individual invoice.

------------------------------------------------------------------------

# 12. Invoice Creation

This is the most important feature of the application.

## Step 1 --- Customer

The user can:

-   search existing customer,
-   select customer,
-   create a new customer.

Selecting a customer should automatically populate the customer's
details.

------------------------------------------------------------------------

## Step 2 --- Invoice Information

System automatically generates:

-   invoice number
-   invoice date

User can select/edit date if required and if business rules allow it.

Example:

``` text
Invoice No: JRE20267
Invoice Date: 12 Aug 2026
```

------------------------------------------------------------------------

## Step 3 --- Add Items

User can add one or more services.

Each line contains:

-   Description
-   UOM
-   Quantity
-   Unit Price
-   Amount

Amount must be calculated automatically:

``` text
Amount = Quantity × Unit Price
```

Example:

``` text
AC Water Service
Qty: 2
Price: ₹1,600
Amount: ₹3,200
```

------------------------------------------------------------------------

## Step 4 --- Totals

The system automatically calculates:

``` text
Subtotal
- Discount, if enabled
+ Tax, if applicable
= Total
```

The calculation must happen both on the client and server.

The server is the final authority before saving the invoice.

------------------------------------------------------------------------

## Step 5 --- Amount in Words

The system should automatically convert the final total to words.

Example:

``` text
Three Thousand Two Hundred Rupees Only
```

The wording should be generated from the numeric invoice total rather
than manually entered.

------------------------------------------------------------------------

## Step 6 --- Preview

Before final generation, the user sees the actual invoice design.

The preview should closely match the existing Excel invoice template.

Actions:

-   Edit
-   Generate
-   Cancel

------------------------------------------------------------------------

# 13. Invoice Numbering

Invoice numbers should be generated automatically.

Example:

``` text
JRE20267
JRE20268
JRE20269
```

Business settings should control:

-   Prefix
-   Starting number

The backend must prevent duplicate invoice numbers.

Invoice numbers should not be manually typed during normal invoice
creation.

------------------------------------------------------------------------

# 14. Invoice Rendering

The invoice should NOT be generated by editing an Excel file.

Recommended flow:

``` text
MongoDB invoice data
        ↓
React invoice template
        ↓
HTML + CSS
        ↓
PDF renderer
        ↓
PDF
```

The invoice template should contain:

-   Business header
-   Logo
-   Invoice title
-   Invoice number/date
-   Customer information
-   Item table
-   Totals
-   Amount in words
-   Bank details
-   Terms
-   Stamp
-   Signature
-   Footer

The template should be fixed and data-driven.

------------------------------------------------------------------------

# 15. PDF Generation

The system must generate a print-quality PDF.

Requirements:

-   A4 layout
-   Fixed margins
-   Correct page breaks
-   Logo preserved
-   Stamp preserved
-   Signature preserved
-   Tables aligned
-   Currency formatted correctly
-   No accidental clipping
-   Print-friendly
-   Consistent output across invoices

Possible implementation:

-   HTML/CSS invoice template
-   Playwright or Puppeteer/Chromium for PDF generation

The exact library can be finalized during technical design.

------------------------------------------------------------------------

# 16. Invoice Sharing

After invoice generation:

``` text
Invoice Created

JRE20267
₹4,450

[Share]
[Download PDF]
[Print]
```

### Share options

-   Copy public invoice link
-   WhatsApp
-   Native browser share
-   PDF download

Public invoice URLs should use a secure random identifier rather than
exposing sensitive database IDs.

Example:

``` text
https://app.example.com/i/7F82KX91
```

The public invoice page should expose only the information intended for
the customer.

------------------------------------------------------------------------

# 17. Export

The system should support:

### PDF

Primary export format.

### Excel

Useful for accounting and existing business workflows.

Generated XLSX should contain structured invoice data.

### DOCX

Optional MVP export.

If DOCX generation significantly increases complexity, it can be
implemented after PDF and Excel.

The invoice database remains the source of truth; exports are generated
from stored invoice data.

------------------------------------------------------------------------

# 18. Invoice History

Users can view all invoices.

### Columns

-   Invoice number
-   Date
-   Customer
-   Total
-   Payment status
-   Created at

### Actions

-   View
-   Preview
-   Download PDF
-   Share
-   Duplicate
-   Edit where permitted
-   Mark payment
-   Delete/void

### Search

Search by:

-   Invoice number
-   Customer name
-   Phone
-   Date

### Filters

-   Date range
-   Payment status
-   Customer
-   Amount range

------------------------------------------------------------------------

# 19. Duplicate Invoice

Users should be able to duplicate an existing invoice.

Example:

``` text
JRE20267
     ↓
Duplicate
     ↓
New Invoice
JRE20268
```

The new invoice must receive:

-   new invoice number
-   new invoice date
-   copied item structure

The user can then modify quantities/prices/customer information.

------------------------------------------------------------------------

# 20. Payment Tracking

Each invoice should have a payment status.

MVP statuses:

-   Unpaid
-   Partially Paid
-   Paid

Invoice fields:

-   Total amount
-   Paid amount
-   Remaining amount
-   Payment status
-   Last payment date

Formula:

``` text
Remaining = Total - Paid
```

The application should prevent paid amount from exceeding invoice total
unless an explicit business rule is later introduced.

------------------------------------------------------------------------

# 21. Dashboard

The dashboard should focus on useful business information rather than
excessive analytics.

### Summary cards

-   Today's sales
-   This month's sales
-   Total invoices
-   Pending payments
-   Paid amount

### Charts

-   Daily/monthly revenue
-   Invoice count
-   Paid vs unpaid
-   Top services

### Tables

-   Recent invoices
-   Top customers
-   Top services

------------------------------------------------------------------------

# 22. Analytics

The analytics module should provide:

## Revenue

-   Today
-   This week
-   This month
-   Custom date range

## Invoice metrics

-   Total invoices
-   Paid invoices
-   Pending invoices
-   Partially paid invoices

## Service metrics

-   Number sold
-   Revenue generated
-   Top services

## Customer metrics

-   Number of invoices
-   Total billed
-   Total paid
-   Outstanding balance

Analytics must be calculated from invoice records, not from manually
maintained counters.

------------------------------------------------------------------------

# 23. Mobile Experience

The application must be mobile-first for invoice creation.

Important mobile requirements:

-   Large touch targets
-   Simple forms
-   Searchable dropdowns
-   Easy item addition
-   Sticky total
-   Easy generate/share buttons
-   Responsive invoice preview
-   No horizontal scrolling in normal application screens

Primary mobile flow:

``` text
Dashboard
  ↓
Create Invoice
  ↓
Select Customer
  ↓
Add Item
  ↓
Enter Quantity
  ↓
Review Total
  ↓
Generate
  ↓
Share
```

------------------------------------------------------------------------

# 24. Desktop Experience

Desktop should provide a more information-dense layout.

Suggested navigation:

``` text
Dashboard
Invoices
Customers
Services
Reports
Business Settings
Profile
Logout
```

The invoice builder can use a two-column layout:

``` text
Left:
Invoice form

Right:
Live invoice preview
```

On mobile it should become a single-column flow.

------------------------------------------------------------------------

# 25. Suggested Pages

``` text
/login

/dashboard

/invoices
/invoices/new
/invoices/[id]
/invoices/[id]/preview

/customers
/customers/new
/customers/[id]

/services
/services/new

/reports

/settings/business
/settings/invoice
/settings/assets
```

------------------------------------------------------------------------

# 26. Data Model

## users

``` text
_id
name
email
passwordHash
role
businessId
createdAt
updatedAt
```

## businesses

``` text
_id
name
address
phone
email
gstin
pan

bankDetails:
  bankName
  accountHolder
  accountNumber
  ifsc
  branch

invoiceSettings:
  prefix
  nextNumber
  title
  defaultPaymentTerms
  taxSettings

assets:
  logoUrl
  stampUrl
  signatureUrl

createdAt
updatedAt
```

## customers

``` text
_id
businessId
name
address
phone
email
gstin
notes
active
createdAt
updatedAt
```

## products/services

``` text
_id
businessId
name
uom
defaultPrice
description
active
createdAt
updatedAt
```

## invoices

``` text
_id
businessId

invoiceNumber
invoiceDate

customerId

customerSnapshot:
  name
  address
  phone
  email
  gstin

items:
  - productId
    description
    uom
    quantity
    unitPrice
    amount

subtotal
discount
tax
total
amountInWords

payment:
  status
  paidAmount
  remainingAmount
  lastPaymentDate

paymentTerms
notes

publicToken

createdAt
updatedAt
```

------------------------------------------------------------------------

# 27. MongoDB Requirements

Use indexes for common queries.

Recommended indexes:

``` text
businessId
invoiceNumber + businessId
invoiceDate + businessId
customerId + businessId
customer name + businessId
publicToken
```

Invoice numbers must be unique within a business.

------------------------------------------------------------------------

# 28. Backend Requirements

Recommended backend stack:

-   Node.js
-   Express.js
-   TypeScript
-   MongoDB
-   Mongoose
-   JWT or secure session authentication
-   Cloudinary
-   PDF generation library
-   XLSX generation library
-   DOCX generation library if enabled

Backend responsibilities:

-   Authentication
-   Authorization
-   Invoice validation
-   Invoice numbering
-   Invoice calculations
-   Customer management
-   Service management
-   Business settings
-   PDF generation
-   Export generation
-   Analytics
-   Public invoice access

------------------------------------------------------------------------

# 29. Frontend Requirements

Recommended frontend stack:

-   Next.js
-   App Router
-   TypeScript
-   Tailwind CSS
-   React
-   Responsive design
-   Accessible form controls

The frontend must not be responsible for final financial calculations
alone.

Client-side calculation is for immediate UI feedback.

The backend must validate and recalculate totals before persisting the
invoice.

------------------------------------------------------------------------

# 30. Cloudinary Requirements

Cloudinary should store business assets such as:

-   logo
-   stamp
-   signature

The application should store only Cloudinary URLs/public identifiers in
MongoDB.

Do not store large image binaries directly inside MongoDB.

------------------------------------------------------------------------

# 31. Security Requirements

-   Passwords must never be stored as plain text.
-   Protected API routes must require authentication.
-   Users must only access their own business data.
-   Public invoice links must use non-guessable tokens.
-   Sensitive bank/business information must not be exposed through
    unrelated APIs.
-   Validate all invoice input on the backend.
-   Sanitize user-controlled content before rendering where required.
-   Do not trust client-side totals.
-   Use environment variables for secrets.
-   Never commit database credentials, JWT secrets, Cloudinary secrets,
    or API keys.

------------------------------------------------------------------------

# 32. Audit / Data Integrity

For MVP, maintain:

-   createdAt
-   updatedAt
-   createdBy where useful

Invoices should preferably be immutable after finalization.

Recommended model:

``` text
Draft
  ↓
Finalized
  ↓
Paid / Partially Paid / Unpaid
```

Editing a finalized invoice should be restricted.

If an invoice needs correction later, consider creating a
corrected/voided invoice rather than silently changing historical
financial data.

------------------------------------------------------------------------

# 33. Invoice Status

Separate invoice status from payment status.

### Invoice status

-   Draft
-   Finalized
-   Cancelled

### Payment status

-   Unpaid
-   Partially Paid
-   Paid

This prevents confusing invoice lifecycle with payment lifecycle.

------------------------------------------------------------------------

# 34. Validation Rules

Examples:

### Customer

-   Name required
-   Phone optional
-   Address optional depending on business requirement

### Invoice

-   Customer required
-   Invoice date required
-   At least one item required
-   Quantity must be greater than zero
-   Price cannot be negative
-   Amount calculated by server
-   Total cannot be negative

### Payment

-   Paid amount \>= 0
-   Paid amount \<= total
-   Remaining = total - paid amount

------------------------------------------------------------------------

# 35. Error Handling

The application should provide understandable errors.

Examples:

``` text
"Please select a customer."

"Add at least one item."

"Quantity must be greater than 0."

"Price cannot be negative."

"Unable to generate invoice. Please try again."

"Invoice number already exists."
```

Avoid exposing raw database or server errors to the shopkeeper.

------------------------------------------------------------------------

# 36. Performance Requirements

The application should feel fast on normal mobile internet.

Targets:

-   Dashboard initial load: ideally under 2 seconds after API response.
-   Customer search: responsive while typing.
-   Adding invoice items: instant.
-   Calculations: instant.
-   Invoice preview: immediate.
-   PDF generation: show progress/loading state.
-   Large invoice history: pagination.

Avoid loading all invoices/customers at once.

------------------------------------------------------------------------

# 37. Backup / Reliability

The database is the source of truth.

The system should be designed so that:

``` text
Invoice data
    ↓
MongoDB
```

is saved before the user is told that an invoice has been successfully
created.

PDF generation failure must not destroy the invoice record.

If PDF generation fails:

``` text
Invoice saved ✓
PDF generation failed
[Retry PDF]
```

------------------------------------------------------------------------

# 38. API Overview

Example API structure:

``` text
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me

GET    /api/business
PUT    /api/business

POST   /api/customers
GET    /api/customers
GET    /api/customers/:id
PUT    /api/customers/:id
DELETE /api/customers/:id

POST   /api/services
GET    /api/services
PUT    /api/services/:id
DELETE /api/services/:id

POST   /api/invoices
GET    /api/invoices
GET    /api/invoices/:id
PUT    /api/invoices/:id
POST   /api/invoices/:id/finalize
POST   /api/invoices/:id/duplicate
POST   /api/invoices/:id/payment
GET    /api/invoices/:id/pdf
GET    /api/invoices/:id/excel

GET    /api/public/invoices/:token

GET    /api/analytics/summary
GET    /api/analytics/revenue
GET    /api/analytics/services
GET    /api/analytics/customers
```

Exact API contracts should be finalized during technical design.

------------------------------------------------------------------------

# 39. Invoice Export Architecture

All formats must be generated from the same invoice data.

``` text
                 Invoice JSON
                      │
          ┌───────────┼───────────┐
          ↓           ↓           ↓
       HTML/PDF      XLSX        DOCX
```

Do not maintain three separate invoice data sources.

------------------------------------------------------------------------

# 40. Business Rules

1.  Every invoice belongs to exactly one business.
2.  Every finalized invoice has a unique invoice number within that
    business.
3.  Every invoice has at least one item.
4.  Line amount = quantity × unit price.
5.  Invoice total is calculated by the backend.
6.  Customer snapshot is stored on invoice creation/finalization.
7.  Historical invoices must remain stable.
8.  Invoice numbering is automatic.
9.  PDF is an output of invoice data, not the primary data store.
10. MongoDB is the source of truth.
11. Cloudinary stores business image assets.
12. Public invoice links must use secure tokens.
13. Finalized invoices should not be silently modified.
14. Payment status is tracked separately from invoice status.

------------------------------------------------------------------------

# 41. MVP Acceptance Criteria

The MVP is successful when a shopkeeper can:

-   [ ] Log in.
-   [ ] Configure business information.
-   [ ] Upload logo/stamp/signature.
-   [ ] Add customers.
-   [ ] Add services/products.
-   [ ] Search and select a customer.
-   [ ] Add multiple invoice items.
-   [ ] Change quantity.
-   [ ] Change price.
-   [ ] See automatic line totals.
-   [ ] See automatic invoice total.
-   [ ] Generate invoice number automatically.
-   [ ] Preview the invoice.
-   [ ] Generate an A4 PDF.
-   [ ] Download the PDF.
-   [ ] Share a public invoice link.
-   [ ] Share the invoice through WhatsApp/browser share.
-   [ ] Export invoice data to Excel.
-   [ ] View invoice history.
-   [ ] Search invoices.
-   [ ] Filter invoices.
-   [ ] Duplicate an invoice.
-   [ ] Track payment status.
-   [ ] View dashboard sales metrics.
-   [ ] View top services/customers.
-   [ ] Use the core workflow comfortably on mobile.

------------------------------------------------------------------------

# 42. MVP Success Metric

The most important metric is not the number of dashboard charts.

The primary success metric is:

> **Can the shopkeeper create and send a correct invoice without opening
> Excel?**

Target workflow:

``` text
Open app
→ Create Invoice
→ Select customer
→ Add services
→ Review
→ Generate
→ Share
```

Target: routine invoice creation should take approximately 1--2 minutes.

------------------------------------------------------------------------

# 43. Future Features

After the MVP is stable, possible additions include:

-   WhatsApp Business API integration
-   Automatic payment reminders
-   Razorpay/payment links
-   GST invoice enhancements
-   GST reports
-   Inventory tracking
-   Purchase records
-   Supplier management
-   Multiple employees
-   Role-based access
-   Multiple businesses
-   Customer portal
-   Recurring invoices
-   Expense tracking
-   Advanced financial reports
-   PWA/offline support
-   Native mobile app

These should not delay the MVP.

------------------------------------------------------------------------

# 44. Implementation Principle

The project must be built incrementally.

Before implementing each module:

1.  Inspect the existing code.
2.  Identify what is already implemented.
3.  Do not recreate working modules.
4.  Do not overwrite working implementations unnecessarily.
5.  Implement only the missing functionality.
6.  Verify the implementation before moving to the next module.
7.  Keep the application runnable after every module.

The invoice workflow and existing Excel template are the primary
business references.

------------------------------------------------------------------------

# 45. Recommended Implementation Order

``` text
Module 1
Project Foundation
        ↓
Module 2
Authentication
        ↓
Module 3
Business Settings + Assets
        ↓
Module 4
Customers
        ↓
Module 5
Services / Product Catalogue
        ↓
Module 6
Invoice Builder
        ↓
Module 7
Invoice Template + PDF
        ↓
Module 8
Invoice History + Search
        ↓
Module 9
Sharing + Public Invoice
        ↓
Module 10
Excel / DOCX Export
        ↓
Module 11
Payment Tracking
        ↓
Module 12
Dashboard + Analytics
        ↓
Module 13
Testing + Production Hardening
```

------------------------------------------------------------------------

# 46. Final Product Definition

The finished application is a **simple billing operating system for the
shopkeeper**, not an Excel replacement with a prettier interface.

The core principle is:

``` text
Fixed business information
        +
Customer information
        +
Service catalogue
        +
Invoice-specific quantities/prices
        ↓
Structured Invoice
        ↓
One source of truth
        ↓
PDF / Excel / DOCX / Share Link / Print
        ↓
Historical data + Analytics
```

The shopkeeper should never need to manually format the bill or convert
the invoice to PDF again.
