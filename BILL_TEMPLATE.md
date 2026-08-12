# Bill / Invoice Template Specification

**Version:** 1.0\
**Status:** Invoice Rendering Contract\
**Date:** 2026-08-12\
**Source:** Existing `A0N AC WORK APSEZ.xlsx` workbook\
**Purpose:** Define exactly what the generated bill contains, which
fields are fixed, which fields are dynamic, and how the final invoice
should be displayed.

------------------------------------------------------------------------

# 1. Purpose of This Document

This document defines the **actual bill document**, not the dashboard
UI.

The application must use this specification to generate:

-   Invoice preview
-   PNG/JPG historical snapshot
-   PDF
-   Print output
-   Future DOCX/Excel representations where applicable

The current Excel workbook is the visual/business reference.

The website must replace the Excel editing process, but the generated
bill should remain familiar to the shopkeeper and customers.

------------------------------------------------------------------------

# 2. Existing Bill Structure

The existing bill is an A4-style invoice containing these major
sections:

``` text
┌──────────────────────────────────────────────────────────────┐
│ BUSINESS HEADER                                              │
│ JAY RAMJI ENTERPRISE                                         │
│ Address / Mobile                                             │
│                                                              │
│                         TAX INVOICE                           │
│                                                              │
│ SOLD TO                                                      │
│ Customer Name                                                │
│ Customer Address                                             │
│                                                              │
│ Invoice No.       Invoice Date       Terms of Payment         │
│                                                              │
│ ┌────┬──────────────────────────────┬────┬──────┬──────────┐ │
│ │SR. │ DESCRIPTION OF GOODS         │QTY │PRICE │ AMOUNT   │ │
│ ├────┼──────────────────────────────┼────┼──────┼──────────┤ │
│ │ 1  │ AC WATER SERVICE             │ 1  │1300  │ 1300     │ │
│ │ 2  │ ...                          │... │ ...  │ ...      │ │
│ └────┴──────────────────────────────┴────┴──────┴──────────┘ │
│                                                              │
│ Total                                                        │
│                                                              │
│ Amount In Words                       PARTS                  │
│ ONE THOUSAND THREE HUNDRED ONLY       LABOR                  │
│                                       TAX                    │
│ Bank Details                          TOTAL                  │
│ Account Name                          ₹...                   │
│ Account Number                                                │
│ Branch                                                       │
│ IFSC Code                     PAN NO - ...                    │
│                                                              │
│ SERVICE SUPERVISED BY                     SIGNED             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

The exact visual implementation may improve spacing and typography, but
the information hierarchy should remain recognizable.

------------------------------------------------------------------------

# 3. Invoice Sections

The final invoice consists of:

``` text
1. Business Header
2. Invoice Title
3. Customer / SOLD TO
4. Invoice Metadata
5. Line Items
6. Totals
7. Amount in Words
8. Bank Details
9. Tax / Parts / Labor Summary
10. PAN Information
11. Service Supervised By
12. Signature / Stamp Area
```

------------------------------------------------------------------------

# 4. Section 1 --- Business Header

The top of the invoice contains the fixed business identity.

### Current business

``` text
JAY RAMJI ENTERPRISE
```

### Current address

``` text
AT- Maruti Chhaya Complex,
Nr. Satkar Shopping,
St. Xevier School Road,
Baroi Road,
Mundra-370421
Mo:- 84693 26901
```

The exact address should come from Business Settings in the application.

Do NOT hard-code it into the invoice component.

------------------------------------------------------------------------

# 5. Business Header Display

Recommended structure:

``` text
┌──────────────────────────────────────────────────────────────┐
│ [LOGO]                                                       │
│                                                              │
│ JAY RAMJI ENTERPRISE                                         │
│ AT- Maruti Chhaya Complex, Nr. Satkar Shopping...           │
│ Mo:- 84693 26901                                             │
└──────────────────────────────────────────────────────────────┘
```

The uploaded business logo should be displayed according to the actual
business branding.

The logo must preserve its aspect ratio.

Do not stretch the logo.

------------------------------------------------------------------------

# 6. Invoice Title

The current workbook displays:

``` text
TAX INVOICE
```

This should be a configurable business setting.

Default:

``` text
TAX INVOICE
```

Display it prominently near the top-center/right area, matching the
existing template.

Example:

``` text
                         TAX INVOICE
```

The title should not be confused with the application name.

------------------------------------------------------------------------

# 7. Section 2 --- SOLD TO

The customer section contains:

``` text
SOLD TO:
```

followed by the customer information.

### Current workbook examples

``` text
RAVI JADEJA
RAMANIYA
```

``` text
NAGORI KADAR KHAN
SAMUNDRA TOWNSHIP A4/5
```

``` text
AON ENGINEERS AND CONSULTANTS PVT.LTD
```

The website must support:

-   customer name
-   multiple address lines
-   phone
-   GSTIN where applicable

Only the information configured for the invoice should be printed.

------------------------------------------------------------------------

# 8. Customer Layout

Recommended:

``` text
SOLD TO:

AON ENGINEERS AND CONSULTANTS PVT. LTD.
Customer Address Line 1
Customer Address Line 2
City, State - PIN
Phone: XXXXXXXX
GSTIN: XXXXXXXXXXXXXXX
```

If a field is empty, it should not leave an awkward blank label.

For example:

Do not print:

``` text
Phone:
```

if no phone exists.

------------------------------------------------------------------------

# 9. Section 3 --- Invoice Metadata

The existing bill contains:

``` text
Invoice No.
Invoice Date
Terms of Payment*
```

Example:

``` text
Invoice No.       Invoice Date          Terms of Payment*
252624            12 Aug 2026           Within 10 days clear payment
```

------------------------------------------------------------------------

# 10. Invoice Number

Invoice number is generated automatically by the application.

Example:

``` text
JRE20267
```

The shopkeeper should normally not type this manually.

The invoice number must come from the backend invoice sequence.

------------------------------------------------------------------------

# 11. Invoice Date

The invoice date is dynamic.

Example:

``` text
12 Aug 2026
```

The application should use the business timezone when determining the
default date.

Current business timezone:

``` text
Asia/Kolkata
```

The date can be changed by the user while the invoice is still a draft.

------------------------------------------------------------------------

# 12. Terms of Payment

The existing workbook uses:

``` text
Within 10 days clear payment
```

This is dynamic business/invoice data.

The application should support:

``` text
Within 10 days clear payment
Within 15 days clear payment
Within 30 days clear payment
Due on receipt
Custom
```

The default should come from Business Settings.

The user can override it for a particular invoice if allowed.

------------------------------------------------------------------------

# 13. Section 4 --- Item Table

This is the main variable section of the invoice.

The current Excel structure contains:

``` text
SR. NO.
DESCRIPTION OF GOODS
QTY
PRICE
AMOUNT
```

The description column occupies most of the table width.

------------------------------------------------------------------------

# 14. Item Table Structure

Recommended final layout:

``` text
┌────────┬──────────────────────────────────────┬──────┬──────────┬──────────┐
│ SR. NO │ DESCRIPTION OF GOODS                │ QTY  │ PRICE    │ AMOUNT   │
├────────┼──────────────────────────────────────┼──────┼──────────┼──────────┤
│   1    │ AC WATER SERVICE                    │  1   │ ₹1,300   │ ₹1,300   │
│   2    │ AC SYSTEM VACUUM AND GAS RELIESES   │  6   │ ₹280     │ ₹1,680   │
│   3    │ INDOOR OUTDOOR SERVICE              │  6   │ ₹120     │ ₹720     │
└────────┴──────────────────────────────────────┴──────┴──────────┴──────────┘
```

------------------------------------------------------------------------

# 15. Item Fields

Each item contains:

``` text
Serial Number
Description
UOM
Quantity
Unit Price
Amount
```

The current printed template does not prominently display UOM, but the
system should retain it in the database.

Whether UOM is printed should be controlled by the invoice template.

------------------------------------------------------------------------

# 16. Serial Number

Serial number is automatically generated:

``` text
1
2
3
4
5
...
```

The shopkeeper should not manually type it.

If an item is removed:

``` text
1
2
3
```

the displayed sequence should remain continuous.

------------------------------------------------------------------------

# 17. Description

Description is dynamic.

Examples from the workbook:

``` text
AC WATER SERVICE

AC FOULT IDENTYFY AND PCB REMOVE AND INSTALATION

AC SYSTEM VACUME AND GAS RELISES

INDOOR OUTDOOR SERVICE

INDOOR UNLOCKING

WATER LEAKEG INDOOR

AC DEALY TIME PANEL PROGRAMING

AC EROOR SOLVED
```

The website should select descriptions from the product/service
catalogue whenever possible.

The user should still be able to edit the description for a specific
invoice if required.

------------------------------------------------------------------------

# 18. Quantity

Quantity is dynamic.

Examples:

``` text
1
6
2
0.5
```

Quantity must be calculated/stored independently from price.

------------------------------------------------------------------------

# 19. Price

Price means the **unit price**.

Example:

``` text
Qty: 6
Price: ₹280
Amount: ₹1,680
```

Formula:

``` text
Amount = Quantity × Unit Price
```

The price may be prefilled from the service catalogue.

The shopkeeper can override it for the current invoice.

Changing the service catalogue price later must not change an existing
invoice.

------------------------------------------------------------------------

# 20. Amount

Amount is automatically calculated.

``` text
Amount = Qty × Price
```

Example:

``` text
6 × ₹280 = ₹1,680
```

The amount must not be manually entered by the shopkeeper.

The backend recalculates it before finalization.

------------------------------------------------------------------------

# 21. Number of Item Rows

The current Excel template has multiple blank item rows.

The web application should NOT permanently restrict the user to a fixed
number of rows.

Instead:

``` text
[ + Add Item ]
```

should dynamically add another line.

The invoice renderer should support multiple items while maintaining the
same visual structure.

------------------------------------------------------------------------

# 22. Empty Item Rows

Do not print unnecessary empty item rows in the final digital invoice
unless required to preserve the original visual height.

Recommended:

``` text
Few items
→ compact table
```

For strict template matching, the renderer may reserve a minimum table
height.

The decision should be based on the final PDF visual comparison.

------------------------------------------------------------------------

# 23. Section 5 --- Total

The current workbook has:

``` text
Total
```

at the bottom of the item table.

The application should calculate the subtotal from all line items.

Example:

``` text
Item 1     ₹1,300
Item 2     ₹1,680
Item 3       ₹720
────────────────
Subtotal   ₹3,700
```

If the current business uses the word `Total` rather than `Subtotal`,
the rendered label should follow the business template unless
tax/discount rules require a clearer breakdown.

------------------------------------------------------------------------

# 24. Section 6 --- Amount in Words

The invoice contains:

``` text
Amount In Words:-
```

Example:

``` text
FOUR THOUSAND FOUR HUNDRED FIFTY ONLY
```

The application generates this automatically.

Recommended modern output:

``` text
Four Thousand Four Hundred Fifty Rupees Only
```

The exact capitalization can be configured to match the existing
invoice.

The shopkeeper must never manually type this.

------------------------------------------------------------------------

# 25. Amount-in-Words Rule

Source:

``` text
final grand total
```

Example:

``` text
₹4,450
↓
FOUR THOUSAND FOUR HUNDRED FIFTY ONLY
```

If taxes or rounding are introduced, amount-in-words must be generated
from the final amount after all calculations.

------------------------------------------------------------------------

# 26. Section 7 --- Bank Details

The existing invoice contains:

``` text
Bank Details:-
AC Name:- Mavani Jaykumar Kamleshbhai
AC No:- 36960100002893
Branch:- Bank of Baroda - Gadhasisa
IFSC Code:- BARB0GADHSH
```

It also displays:

``` text
PAN NO - GMKPM3060C
```

These are business-level settings.

They must not be hard-coded into the frontend.

------------------------------------------------------------------------

# 27. Bank Details Layout

Recommended:

``` text
Bank Details:-

AC Name:- Mavani Jaykumar Kamleshbhai
AC No:- XXXXXXXXXXXXX
Branch:- Bank of Baroda - Gadhasisa
IFSC Code:- BARB0GADHSH
PAN NO:- GMKPM3060C
```

The exact account number masking depends on the business's document
requirements.

For the official invoice, the configured full account number may be
printed.

------------------------------------------------------------------------

# 28. Section 8 --- Parts / Labor / Tax / Total

The existing workbook contains a right-side summary:

``` text
PARTS
LABOR
TAX
TOTAL
```

This is important because it exists in the current business template.

However, the current workbook does not consistently populate all of
these fields.

Therefore the application should model them explicitly rather than
assuming they always have values.

------------------------------------------------------------------------

# 29. Summary Structure

Recommended:

``` text
                    PARTS       ₹0
                    LABOR       ₹3,700
                    TAX         ₹0
                    TOTAL       ₹3,700
```

Or, if the invoice does not use parts/labor classification:

``` text
                    SUBTOTAL    ₹3,700
                    TAX         ₹0
                    TOTAL       ₹3,700
```

The exact mode should be controlled by the business/invoice
configuration.

Do not invent a Parts/Labor split when the user has not provided one.

------------------------------------------------------------------------

# 30. Parts and Labor

If enabled, invoice items can have:

``` text
type: PART
type: LABOR
```

Then the renderer can calculate:

``` text
Parts Total
Labor Total
Tax
Grand Total
```

If the business does not use classification:

``` text
Parts = hidden
Labor = hidden
```

This keeps the template flexible without corrupting the bill.

------------------------------------------------------------------------

# 31. Tax

The current workbook has a `TAX` line.

The system should support:

``` text
Taxable invoice
Non-tax invoice
CGST
SGST
IGST
```

But the MVP should only display tax components that are actually
configured.

Do not show:

``` text
CGST ₹0
SGST ₹0
IGST ₹0
```

if the business does not use tax.

Keep the invoice clean.

------------------------------------------------------------------------

# 32. Section 9 --- Service Supervised By

The bottom of the existing invoice contains:

``` text
SERVICE SUPERVISED BY
```

This is part of the business's operational sign-off area.

Recommended layout:

``` text
SERVICE SUPERVISED BY

____________________________
Name / Signature
```

The exact wording should remain configurable.

------------------------------------------------------------------------

# 33. Section 10 --- Signature / Stamp

The workbook contains:

``` text
SIGNED
```

and image assets near the lower portion of the invoice.

The application should support:

-   signature image
-   business stamp
-   optional supervisor signature

The assets must be stored in Cloudinary and referenced by the invoice's
`assetSnapshot`.

------------------------------------------------------------------------

# 34. Stamp Position

The stamp should appear exactly where the business expects it.

Do not treat the stamp as a generic UI image.

It is an official invoice asset.

The final PDF and PNG must preserve:

-   aspect ratio
-   position
-   size
-   transparency

------------------------------------------------------------------------

# 35. Signature Position

The signature area should be near the bottom-right portion of the bill,
matching the existing document.

Example:

``` text
                         SIGNED

                         [SIGNATURE]

                         [STAMP]
```

The exact placement should be adjusted after visual comparison with the
original Excel output.

------------------------------------------------------------------------

# 36. Fixed vs Dynamic Fields

## Fixed / Business Settings

``` text
Business Name
Business Address
Phone
Logo
Bank Name
Account Name
Account Number
IFSC
Branch
PAN
Invoice Title
Default Payment Terms
Stamp
Signature
```

## Dynamic / Invoice

``` text
Invoice Number
Invoice Date
Customer
Customer Address
Customer Phone
Customer GSTIN
Payment Terms override
Description
Quantity
Unit Price
Amount
Discount
Tax
Parts Total
Labor Total
Subtotal
Grand Total
Amount in Words
Payment Status
```

------------------------------------------------------------------------

# 37. Data Source Mapping

The invoice renderer should receive a structured invoice object.

Conceptually:

``` js
{
  invoiceNumber: "JRE20267",

  invoiceDate: "2026-08-12",

  business: {
    name: "JAY RAMJI ENTERPRISE",
    address: {},
    contact: {},
    bankDetails: {},
    taxProfile: {}
  },

  customer: {
    name: "AON ENGINEERS AND CONSULTANTS PVT. LTD.",
    address: {},
    contact: {},
    taxProfile: {}
  },

  items: [
    {
      serialNumber: 1,
      description: "AC SYSTEM VACUME AND GAS RELISES",
      quantity: 6,
      unitPrice: 280,
      amount: 1680
    }
  ],

  totals: {
    parts: 0,
    labor: 4450,
    tax: 0,
    grandTotal: 4450
  },

  amountInWords:
    "FOUR THOUSAND FOUR HUNDRED FIFTY ONLY",

  paymentTerms:
    "Within 10 days clear payment",

  assets: {
    logo: "...",
    stamp: "...",
    signature: "..."
  }
}
```

The actual implementation should use the database model defined in
`MODELS.md`.

------------------------------------------------------------------------

# 38. Rendering Rule

The invoice template must be a **pure presentation layer**.

It should not:

-   query MongoDB
-   calculate business totals
-   generate invoice numbers
-   decide tax rules
-   fetch current customer information

Instead:

``` text
Backend
  ↓
Validated Invoice DTO
  ↓
Invoice Template
  ↓
HTML/CSS
  ↓
PNG / PDF
```

------------------------------------------------------------------------

# 39. Invoice Rendering Components

Recommended React component structure:

``` text
InvoiceDocument
│
├── InvoiceHeader
│   ├── BusinessLogo
│   ├── BusinessIdentity
│   └── InvoiceTitle
│
├── CustomerSection
│   └── SoldTo
│
├── InvoiceMeta
│   ├── InvoiceNumber
│   ├── InvoiceDate
│   └── PaymentTerms
│
├── InvoiceItemsTable
│   └── InvoiceItemRow
│
├── InvoiceTotals
│   ├── PartsTotal
│   ├── LaborTotal
│   ├── TaxTotal
│   └── GrandTotal
│
├── AmountInWords
│
├── BankDetails
│
└── InvoiceFooter
    ├── SupervisedBy
    ├── Signature
    └── Stamp
```

------------------------------------------------------------------------

# 40. Desktop / PDF Layout

The invoice document itself should remain fixed-format.

Recommended page:

``` text
A4 Portrait

210mm × 297mm
```

Use CSS physical units where practical:

``` css
width: 210mm;
min-height: 297mm;
```

Margins should be tuned against the original Excel bill.

------------------------------------------------------------------------

# 41. Invoice Page Zones

Approximate structure:

``` text
A4
┌─────────────────────────────────────┐
│                                     │
│ HEADER                              │
│                                     │
│ TAX INVOICE                         │
│                                     │
│ SOLD TO                             │
│                                     │
│ INVOICE META                        │
│                                     │
│ ITEM TABLE                          │
│                                     │
│                                     │
│ TOTAL                               │
│                                     │
│ AMOUNT IN WORDS                     │
│                                     │
│ BANK DETAILS        TOTAL SUMMARY   │
│                                     │
│                                     │
│ SUPERVISED BY       SIGNATURE       │
│                                     │
└─────────────────────────────────────┘
```

The footer should remain near the bottom when there are few items.

------------------------------------------------------------------------

# 42. Long Customer Names

The invoice must support long customer names.

Example:

``` text
AON ENGINEERS AND CONSULTANTS
PRIVATE LIMITED
```

The customer name may wrap to a second line.

It must not overlap:

-   invoice metadata
-   item table
-   other sections

------------------------------------------------------------------------

# 43. Long Descriptions

Service descriptions may be long.

Example:

``` text
Inspection / Complaint Charge
(Checking & Fault Identification Only)
```

The description cell must wrap naturally.

Do not shrink the entire invoice font because one description is long.

The row height should expand.

------------------------------------------------------------------------

# 44. Multiple Items

If the invoice contains several items:

``` text
1
2
3
4
5
6
...
```

the table expands vertically.

The footer must move down while preserving the document's page
structure.

------------------------------------------------------------------------

# 45. Very Large Invoices

If an invoice becomes too long for one A4 page:

``` text
Page 1
Item table continues

Page 2
Remaining items
Totals
Bank details
Signature
```

The invoice renderer must support page breaks.

Do not allow:

-   totals to overlap items
-   signature to overlap text
-   table rows to split awkwardly

The final document must remain printable.

------------------------------------------------------------------------

# 46. Print Rules

The invoice must be printable on A4.

Use:

``` css
@media print
```

and appropriate:

``` css
@page {
  size: A4;
  margin: 0;
}
```

Exact margins should be tuned during implementation.

------------------------------------------------------------------------

# 47. PDF Rules

PDF output must visually match the invoice preview.

The PDF should contain:

-   logo
-   business details
-   customer
-   invoice number/date
-   item table
-   totals
-   bank details
-   amount in words
-   stamp
-   signature
-   footer

No dashboard/navigation elements should appear.

------------------------------------------------------------------------

# 48. PNG Snapshot Rules

The PNG snapshot must represent the **finalized invoice document**.

It should be:

-   A4 proportion
-   high resolution
-   readable on mobile
-   suitable for archival
-   suitable for quick preview

Recommended conceptual dimensions:

``` text
2480 × 3508 px
```

This is approximately A4 at 300 DPI.

The exact rendering resolution can be optimized during implementation.

------------------------------------------------------------------------

# 49. Snapshot Timing

The PNG snapshot must be created after the invoice is finalized.

Flow:

``` text
Draft
 ↓
Review
 ↓
Finalize
 ↓
Freeze invoice
 ↓
Render invoice
 ↓
PNG snapshot
 ↓
Cloudinary
```

Do not create the permanent snapshot for every draft edit.

------------------------------------------------------------------------

# 50. Original Bill Concept

The finalized PNG should be treated as:

``` text
Original visual bill
```

The database record is:

``` text
Original structured financial record
```

The PDF is:

``` text
Official printable/shareable representation
```

All three refer to the same finalized invoice.

------------------------------------------------------------------------

# 51. Invoice History Display

When the shopkeeper opens invoice history:

``` text
┌──────────────────────────────────────────────┐
│ JRE20267                                     │
│ AON ENGINEERS                                │
│ 12 Aug 2026                                  │
│ ₹4,450                                       │
│                                              │
│ [ View Original ] [ PDF ] [ Share ]          │
└──────────────────────────────────────────────┘
```

`View Original` should load the archived PNG snapshot.

Do not regenerate the invoice just to show the history preview.

------------------------------------------------------------------------

# 52. Public Invoice Display

A customer-facing public link should show the invoice itself, not the
admin dashboard.

Example:

``` text
https://yourapp.com/i/7F82KX91...
```

The page contains:

``` text
Business Header
↓
Customer
↓
Invoice Details
↓
Items
↓
Total
↓
Bank / payment information if configured
↓
Download PDF
```

Do not expose:

-   admin navigation
-   internal IDs
-   analytics
-   audit data
-   other invoices

------------------------------------------------------------------------

# 53. Invoice Status Display

If the invoice is cancelled:

``` text
CANCELLED
```

should be visually obvious on the original invoice view.

Example:

``` text
┌───────────────────────────┐
│       CANCELLED           │
│                           │
│     TAX INVOICE           │
│     JRE20267              │
└───────────────────────────┘
```

Do not delete the original snapshot.

------------------------------------------------------------------------

# 54. Payment Status

Payment status is not necessarily printed on the original bill.

The application can display:

``` text
UNPAID
PARTIALLY PAID
PAID
```

in the dashboard/history.

If the business wants payment status on the invoice itself, it should be
configurable.

------------------------------------------------------------------------

# 55. Currency Display

The current business uses INR.

The invoice should display:

``` text
₹
```

for amounts.

Example:

``` text
₹4,450
```

Use Indian number formatting where applicable:

``` text
₹1,24,500
```

The database remains the financial source of truth using minor units.

------------------------------------------------------------------------

# 56. Number Formatting

Recommended:

``` text
₹1,300
₹3,550
₹4,450
₹1,24,500
```

Do not show excessive decimals when the amount has no fractional paise.

If fractional amounts are required:

``` text
₹1,600.50
```

------------------------------------------------------------------------

# 57. Typography for Invoice

The application dashboard uses Inter.

The invoice can use:

``` text
Inter
```

unless the original business template requires a different font for
visual matching.

Invoice typography should prioritize:

-   readability
-   print clarity
-   consistent alignment
-   clear financial numbers

Recommended:

``` text
Business Name: 18–22px bold
Invoice Title: 16–18px bold
Section Labels: 10–12px bold
Body: 9–11px
Table: 9–10px
Footer: 8–10px
```

Exact sizes should be adjusted through PDF visual testing.

------------------------------------------------------------------------

# 58. Invoice Color

The existing invoice should remain mostly neutral.

Recommended:

``` text
Background: White
Text: Near-black
Borders: Gray
Headings: Dark blue / black
```

Do not use the dashboard's dark blue sidebar or colorful cards inside
the invoice.

The invoice should look like a professional physical bill.

------------------------------------------------------------------------

# 59. Border Rules

Use thin borders for:

-   item table
-   totals
-   metadata where necessary

Avoid heavy borders around every section.

The original Excel template uses a structured grid, so table boundaries
should remain clear.

------------------------------------------------------------------------

# 60. Invoice Template Does Not Equal Dashboard Theme

Important separation:

``` text
APPLICATION UI
Ledger Blue
Inter
Cards
Sidebar
Buttons
Dashboard charts

        ≠

INVOICE DOCUMENT
White paper
Professional typography
Business logo
Thin table borders
Stamp
Signature
Bank details
```

The invoice is a business document, not a website screen.

------------------------------------------------------------------------

# 61. Data Mapping Table

  Bill Section       Source                              Type
  ------------------ ----------------------------------- ------------------
  Business Name      `businessSnapshot.name`             Fixed snapshot
  Business Address   `businessSnapshot.address`          Fixed snapshot
  Phone              `businessSnapshot.contact.phone`    Fixed snapshot
  Logo               `assetSnapshot.logo`                Fixed snapshot
  Invoice Title      `businessSnapshot.invoiceTitle`     Fixed snapshot
  SOLD TO            Customer snapshot                   Dynamic snapshot
  Invoice Number     `invoiceNumber`                     Dynamic
  Invoice Date       `invoiceDate`                       Dynamic
  Payment Terms      `paymentTerms`                      Dynamic
  Serial Number      Renderer                            Generated
  Description        `items[].description`               Dynamic snapshot
  UOM                `items[].uom`                       Dynamic snapshot
  Qty                `items[].quantity`                  Dynamic
  Price              `items[].unitPriceMinor`            Dynamic
  Amount             `items[].lineTotalMinor`            Calculated
  Parts              Invoice totals/classification       Calculated
  Labor              Invoice totals/classification       Calculated
  Tax                `totals.taxes`                      Calculated
  Total              `totals.grandTotalMinor`            Calculated
  Amount in Words    `amountInWords`                     Generated
  Bank Details       `businessSnapshot.bankDetails`      Fixed snapshot
  PAN                `businessSnapshot.taxProfile.pan`   Fixed snapshot
  Stamp              `assetSnapshot.stamp`               Fixed snapshot
  Signature          `assetSnapshot.signature`           Fixed snapshot
  Supervised By      Business/invoice setting            Configurable

------------------------------------------------------------------------

# 62. Template Configuration

The renderer should support configuration for:

``` text
showParts
showLabor
showTax
showUOM
showGSTIN
showPhone
showPAN
showBankDetails
showPaymentTerms
showStamp
showSignature
showSupervisor
```

This prevents the invoice component from being rewritten when business
requirements change.

------------------------------------------------------------------------

# 63. Recommended Template Modes

Use a template configuration such as:

``` js
{
  layout: "JAY_RAMJI_CLASSIC",

  showPartsLabor: true,

  showTax: true,

  showUOM: false,

  showCustomerGSTIN: true,

  showBusinessGSTIN: true,

  showBankDetails: true,

  showStamp: true,

  showSignature: true,

  showSupervisor: true
}
```

The actual configuration should be stored in business/template settings,
not hard-coded throughout React components.

------------------------------------------------------------------------

# 64. Template Versioning

This is important for historical invoices.

When the invoice is finalized, store:

``` text
templateVersion
```

Example:

``` text
templateVersion: "jay-ramji-v1"
```

The invoice snapshot is the primary historical visual record.

The template version additionally documents which rendering design was
used.

If the invoice template changes:

``` text
jay-ramji-v1
↓
jay-ramji-v2
```

new invoices use v2.

Old invoices remain v1/snapshot-based.

------------------------------------------------------------------------

# 65. Template Rendering Contract

The renderer must accept:

``` text
InvoiceDocumentData
+
InvoiceTemplateConfig
```

and return:

``` text
HTML document
```

Then:

``` text
HTML
 ↓
PNG renderer
 ↓
Cloudinary snapshot

HTML
 ↓
PDF renderer
 ↓
PDF storage
```

This keeps PDF and PNG visually synchronized.

------------------------------------------------------------------------

# 66. No Business Logic in Template

The template should not perform:

``` text
tax calculations
payment calculations
invoice numbering
customer lookup
product lookup
```

The renderer only displays already validated values.

For example:

``` text
Backend:
6 × ₹280 = ₹1,680

Template:
Displays ₹1,680
```

------------------------------------------------------------------------

# 67. Final Invoice Rendering Pipeline

``` text
Shopkeeper
   ↓
Invoice Builder
   ↓
Draft Invoice
   ↓
Review
   ↓
Finalize API
   ↓
Backend Validation
   ↓
Financial Calculation
   ↓
Customer Snapshot
   ↓
Business Snapshot
   ↓
Asset Snapshot
   ↓
Invoice Number
   ↓
Finalized Invoice
   ↓
Invoice DTO
   ↓
Invoice React Template
   ↓
HTML/CSS
   ├───────────────┐
   ↓               ↓
PNG Snapshot      PDF
   ↓               ↓
Cloudinary       Storage
   │
   └───────┬───────┘
           ↓
      Invoice History
```

------------------------------------------------------------------------

# 68. Final Bill Contract

Every finalized bill must contain enough information to answer:

``` text
Who issued the bill?
Who received the bill?
When was it issued?
What was sold?
How much was sold?
At what price?
What was the total?
What payment terms applied?
What business bank information was displayed?
What branding was displayed?
What tax information applied?
What exact visual bill was issued?
```

If the application can answer all of these from the finalized invoice
record and archived document snapshot, the bill is considered complete.

------------------------------------------------------------------------

# 69. Final Example

A finalized invoice should conceptually render as:

``` text
┌─────────────────────────────────────────────────────────────┐
│ [LOGO]                                                      │
│                                                             │
│ JAY RAMJI ENTERPRISE                                        │
│ AT- Maruti Chhaya Complex, Nr. Satkar Shopping...           │
│ Mo:- 84693 26901                                            │
│                                                             │
│                    TAX INVOICE                              │
│                                                             │
│ SOLD TO:                                                    │
│ AON ENGINEERS AND CONSULTANTS PVT. LTD.                     │
│ Customer Address                                            │
│                                                             │
│ Invoice No. : JRE20267        Invoice Date : 12 Aug 2026   │
│ Terms of Payment : Within 10 days clear payment             │
│                                                             │
│ ┌─────┬──────────────────────────────┬────┬──────┬────────┐ │
│ │ SR. │ DESCRIPTION OF GOODS         │QTY │PRICE │ AMOUNT │ │
│ ├─────┼──────────────────────────────┼────┼──────┼────────┤ │
│ │  1  │ AC WATER SERVICE             │  1 │ 1300 │  1300  │ │
│ │  2  │ AC SYSTEM SERVICE             │  2 │ 1500 │  3000  │ │
│ └─────┴──────────────────────────────┴────┴──────┴────────┘ │
│                                                             │
│                                     TOTAL       ₹4,300       │
│                                                             │
│ Amount In Words:-                                           │
│ FOUR THOUSAND THREE HUNDRED ONLY                             │
│                                                             │
│ Bank Details:-                         PARTS      ₹0         │
│ AC Name:- Mavani Jaykumar...           LABOR   ₹4,300       │
│ AC No:- XXXXXXXX                        TAX        ₹0         │
│ Branch:- Bank of Baroda - Gadhasisa     TOTAL   ₹4,300       │
│ IFSC Code:- BARB0GADHSH                                    │
│ PAN NO:- GMKPM3060C                                         │
│                                                             │
│ SERVICE SUPERVISED BY                         SIGNED         │
│                                                             │
│                                             [STAMP]          │
│                                           [SIGNATURE]        │
└─────────────────────────────────────────────────────────────┘
```

The exact values above are illustrative; the actual invoice must use the
finalized invoice data.

------------------------------------------------------------------------

# 70. Final Design Principle

The website is not supposed to create a new type of bill.

It should make the existing bill **automatic**.

The transformation is:

``` text
OLD

Excel Template
    ↓
Manually edit customer
    ↓
Manually enter services
    ↓
Manually calculate
    ↓
Fix formatting
    ↓
Export PDF
    ↓
Share


NEW

Create Invoice
    ↓
Select Customer
    ↓
Select Services
    ↓
Quantity + Price
    ↓
Automatic Calculation
    ↓
Preview Existing Bill Design
    ↓
Finalize
    ↓
PNG Historical Snapshot
    ↓
PDF
    ↓
Share
```

The final generated invoice should therefore remain visually familiar to
the shopkeeper while removing the manual Excel work completely.
