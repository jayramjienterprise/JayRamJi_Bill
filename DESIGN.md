# Automated Billing & Invoice Management System --- Design System

**Version:** 1.0\
**Status:** Design Specification\
**Date:** 2026-08-12

------------------------------------------------------------------------

## 1. Design Direction

The product should feel like a **trusted business billing tool**, not a
flashy SaaS dashboard.

The primary user is a shopkeeper who wants to create a correct bill
quickly. The interface therefore prioritizes:

1.  Trust
2.  Readability
3.  Speed
4.  Familiarity
5.  Clear financial information
6.  Low cognitive load
7.  Excellent mobile usability

The design should feel closer to a modern banking/accounting application
than to a startup landing page.

### Design principle

> **The interface should disappear and let the shopkeeper focus on
> making the bill.**

Avoid excessive gradients, glassmorphism, animated backgrounds,
oversized cards, neon colors, and decorative UI that competes with
invoice information.

------------------------------------------------------------------------

# 2. Visual Personality

The product personality is:

-   Professional
-   Reliable
-   Clean
-   Practical
-   Calm
-   Established
-   Indian-business friendly
-   Modern without looking experimental

### What the product should NOT feel like

-   Cryptocurrency dashboard
-   Gaming interface
-   Social media app
-   AI experiment
-   Consumer shopping app
-   Luxury fashion website

------------------------------------------------------------------------

# 3. Primary Theme

## Theme Name: Ledger Blue

The primary visual identity uses a deep blue with warm neutral surfaces.

Blue is intentional because it communicates:

-   trust
-   reliability
-   financial/business context
-   stability
-   professionalism

Warm white backgrounds prevent the application from feeling cold or
overly corporate.

------------------------------------------------------------------------

# 4. Color System

## Primary

``` text
Primary 900: #17324D
Primary 800: #1E4668
Primary 700: #245A82
Primary 600: #2F6F9F
Primary 500: #3B82B8
```

Use `Primary 900` for the strongest brand elements and `Primary 700` for
interactive controls.

### Primary usage

-   Sidebar brand
-   Primary buttons
-   Active navigation
-   Links
-   Focus states
-   Selected controls

Do not use primary blue everywhere.

------------------------------------------------------------------------

## Background

``` text
Background: #F7F8FA
Surface:    #FFFFFF
Surface 2:  #F1F4F7
```

The main application background should be a very light neutral gray.

Cards and forms use white.

------------------------------------------------------------------------

## Text

``` text
Text Primary:   #17212B
Text Secondary: #52606D
Text Muted:     #7B8794
Text Disabled:  #A8B2BC
```

Primary text must have strong contrast.

Avoid light gray text for important information.

------------------------------------------------------------------------

## Borders

``` text
Border:       #D9E0E7
Border Light: #E8EDF2
Border Focus: #3B82B8
```

Borders should be subtle.

Avoid heavy black borders around every card.

------------------------------------------------------------------------

# 5. Semantic Colors

Semantic colors should communicate business status immediately.

## Success

``` text
Success:       #15803D
Success Soft:  #EAF7EF
```

Used for:

-   Paid
-   Invoice created
-   Successful save
-   Positive revenue states

## Warning

``` text
Warning:       #B45309
Warning Soft:  #FFF6E5
```

Used for:

-   Partially paid
-   Pending actions
-   Attention required

## Danger

``` text
Danger:       #B42318
Danger Soft:  #FDECEC
```

Used for:

-   Cancelled invoices
-   Delete actions
-   Validation errors
-   Failed operations

## Info

``` text
Info:       #2563EB
Info Soft:  #EFF6FF
```

Used for:

-   Informational messages
-   Public link status
-   Helpful system information

------------------------------------------------------------------------

# 6. Typography

## Primary Font

Use:

**Inter**

Inter is selected because it is highly readable for:

-   numbers
-   tables
-   forms
-   dashboards
-   invoices
-   dense business information

It also works well across desktop and mobile.

### Font stack

``` css
font-family:
  Inter,
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

------------------------------------------------------------------------

# 7. Typography Scale

Use a restrained scale.

``` text
Display:     32px / 40px / 700
Page Title:  24px / 32px / 700
Section:     18px / 26px / 600
Card Title:  16px / 24px / 600
Body:        14px / 21px / 400
Small:       13px / 19px / 400
Caption:     12px / 18px / 500
```

### Dashboard numbers

Revenue figures may use:

``` text
24px–28px
Weight: 700
```

Do not make dashboard numbers enormous.

The user needs to scan several metrics at once.

------------------------------------------------------------------------

# 8. Numbers and Currency

Financial numbers are among the most important elements.

Use:

-   tabular numerals where possible
-   consistent decimal formatting
-   `₹` for Indian currency
-   right alignment inside financial tables

Examples:

``` text
₹12,450
₹84,500
₹1,24,500
```

For invoice tables:

``` text
Qty      Price        Amount
 2       ₹1,600       ₹3,200
```

Amounts should visually align vertically.

------------------------------------------------------------------------

# 9. Spacing System

Use a 4px base spacing system.

``` text
4px
8px
12px
16px
20px
24px
32px
40px
48px
64px
```

Default spacing:

``` text
Form field gap:       16px
Card padding:         20px
Section gap:          24px
Page section gap:     32px
Desktop page padding: 32px
Mobile page padding: 16px
```

Avoid unnecessarily large empty spaces.

This is a utility application, not a marketing website.

------------------------------------------------------------------------

# 10. Border Radius

Use moderate rounding.

``` text
Small:  6px
Medium: 8px
Large:  12px
```

Recommended:

-   Inputs: 8px
-   Buttons: 8px
-   Cards: 12px
-   Dialogs: 12px
-   Badges: 9999px

Avoid extremely rounded cards.

------------------------------------------------------------------------

# 11. Shadows

Use shadows sparingly.

``` text
Card:
0 1px 3px rgba(23, 33, 43, 0.06)

Dialog:
0 12px 32px rgba(23, 33, 43, 0.14)
```

Most cards should rely primarily on:

-   white surface
-   subtle border

The interface should not look like a collection of floating boxes.

------------------------------------------------------------------------

# 12. Layout

## Desktop

Recommended application structure:

``` text
┌─────────────────────────────────────────────────────────┐
│ Sidebar │ Top Bar                                       │
│         ├───────────────────────────────────────────────┤
│         │                                               │
│         │ Main Content                                  │
│         │                                               │
│         │                                               │
│         │                                               │
└─────────────────────────────────────────────────────────┘
```

### Sidebar

Width:

``` text
240px
```

Collapsed:

``` text
72px
```

Use a dark blue sidebar.

------------------------------------------------------------------------

# 13. Sidebar Design

``` text
┌──────────────────────────┐
│  [LOGO]                  │
│  Jay Ramji Enterprise    │
├──────────────────────────┤
│                          │
│  ▣ Dashboard             │
│  ▤ Invoices              │
│  ◎ Customers             │
│  ◇ Services              │
│  ◷ Reports               │
│                          │
├──────────────────────────┤
│  ⚙ Settings              │
│                          │
│  👤 Profile              │
└──────────────────────────┘
```

The active navigation item gets:

-   slightly lighter blue background
-   white text
-   subtle left indicator

Do not use bright accent blocks.

------------------------------------------------------------------------

# 14. Top Bar

Desktop top bar:

``` text
┌─────────────────────────────────────────────────────────┐
│ Search...                         + Create Invoice  👤   │
└─────────────────────────────────────────────────────────┘
```

Important actions should be visible.

The primary action:

``` text
+ Create Invoice
```

should be consistently accessible.

------------------------------------------------------------------------

# 15. Dashboard Design

The dashboard should immediately answer:

> How much did we sell, what is pending, and what happened recently?

### Layout

``` text
Good evening

Here's your billing overview.

┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Today's Sales│ │ This Month   │ │ Pending      │
│ ₹12,450      │ │ ₹84,500      │ │ ₹18,200      │
│ +12%         │ │ 42 invoices  │ │ 7 invoices   │
└──────────────┘ └──────────────┘ └──────────────┘

┌──────────────────────────────────────────────────┐
│ Revenue                                          │
│                                                  │
│                  chart                           │
│                                                  │
└──────────────────────────────────────────────────┘

┌────────────────────────┐ ┌───────────────────────┐
│ Recent Invoices        │ │ Top Services         │
│                        │ │                       │
│ JRE20267 ₹4,450        │ │ AC Water ₹24,500     │
│ JRE20266 ₹3,200        │ │ Installation ₹18,200 │
└────────────────────────┘ └───────────────────────┘
```

------------------------------------------------------------------------

# 16. Summary Cards

Cards should be simple.

Example:

``` text
Today's Sales

₹12,450

12 invoices today
```

Use a small icon, not a huge illustration.

Avoid making every card a different color.

Primary metric cards should mostly remain white.

------------------------------------------------------------------------

# 17. Create Invoice Experience

This is the most important screen.

The design should optimize for speed.

## Desktop

``` text
┌──────────────────────────────────────────────────────────────┐
│ Create Invoice                                               │
├───────────────────────────────┬──────────────────────────────┤
│ Invoice Details               │ Live Preview                 │
│                               │                              │
│ Customer                      │ ┌──────────────────────────┐ │
│ [ Search customer... ]        │ │ JAY RAMJI ENTERPRISE     │ │
│                               │ │                          │ │
│ Invoice No   Invoice Date     │ │ TAX INVOICE              │ │
│ JRE20267     12 Aug 2026      │ │                          │ │
│                               │ │ SOLD TO                   │ │
│ Items                         │ │ AON Engineers             │ │
│                               │ │                          │ │
│ [ + Add Item ]                │ │ Items                    │ │
│                               │ │                          │ │
│ AC Water Service              │ │ Total ₹4,450             │ │
│ Qty [2] Price [1600]          │ │                          │ │
│                               │ └──────────────────────────┘ │
│ Total: ₹3,200                 │                              │
│                               │                              │
│ [Save Draft] [Generate]       │                              │
└───────────────────────────────┴──────────────────────────────┘
```

Desktop should use a two-column workflow.

------------------------------------------------------------------------

# 18. Mobile Invoice Creation

Mobile should become a single-column flow.

``` text
┌───────────────────────────┐
│ ← Create Invoice          │
├───────────────────────────┤
│                           │
│ Customer                  │
│ [ Select customer      ]  │
│                           │
│ Invoice                   │
│ JRE20267     12 Aug 2026  │
│                           │
│ Items                     │
│                           │
│ AC Water Service          │
│ Qty  2      ₹1,600        │
│ Amount        ₹3,200      │
│                           │
│ [+ Add Item]              │
│                           │
│───────────────────────────│
│ Total              ₹3,200 │
│                           │
│ [ Generate Invoice ]      │
└───────────────────────────┘
```

The total should remain visible while scrolling where practical.

------------------------------------------------------------------------

# 19. Customer Selector

Do not use a giant traditional dropdown.

Use a searchable command-style selector.

``` text
Select Customer

[ 🔍 Search customer... ]

AON ENGINEERS
Ahmedabad

WEST COASTCORROTECH
Ahmedabad

RAVI JADEJA
Ahmedabad

────────────────
+ Create New Customer
```

On mobile, this should open as a full-screen/bottom-sheet selector.

------------------------------------------------------------------------

# 20. Item Selector

Use the same interaction pattern.

``` text
Add Item

[ 🔍 Search service... ]

AC Water Service        ₹1,600
AC Dry Service          ₹1,200
Gas Charging            ₹...
Visit Charge            ₹...
Installation            ₹...

+ Create New Service
```

Selecting a service automatically fills its default price.

The price remains editable.

------------------------------------------------------------------------

# 21. Invoice Item Row

Desktop:

``` text
┌────────────────────────────────────────────────────┐
│ Service             Qty       Price       Amount   │
├────────────────────────────────────────────────────┤
│ AC Water Service     2       ₹1,600      ₹3,200   │
│ AC Installation      1       ₹2,500      ₹2,500   │
└────────────────────────────────────────────────────┘
```

Mobile:

``` text
AC Water Service                         ⋮

Qty
[ − ] 2 [ + ]

Price
₹1,600

Amount
₹3,200
```

Do not force a wide desktop table onto mobile.

------------------------------------------------------------------------

# 22. Buttons

## Primary Button

``` text
Background: Primary 700
Text: White
Height: 40px desktop
Height: 44px mobile
Radius: 8px
```

Example:

``` text
[ Generate Invoice ]
```

## Secondary Button

White background with border.

``` text
[ Save Draft ]
```

## Destructive Button

Use only for destructive actions.

``` text
[ Delete Invoice ]
```

## Icon Button

Use for:

-   More
-   Edit
-   Delete
-   Download
-   Copy

Every icon-only button must have an accessible tooltip/label.

------------------------------------------------------------------------

# 23. Invoice Status Badges

Use compact pills.

``` text
PAID
background: Success Soft
text: Success
```

``` text
PENDING
background: Warning Soft
text: Warning
```

``` text
CANCELLED
background: Danger Soft
text: Danger
```

Do not rely only on color. Include the text label.

------------------------------------------------------------------------

# 24. Invoice Preview

The preview should look like a real printed document.

``` text
┌──────────────────────────────────────────┐
│                                          │
│        JAY RAMJI ENTERPRISE              │
│        Address / Phone                   │
│                                          │
│                 TAX INVOICE              │
│                                          │
│ Invoice No: JRE20267    Date: 12/08/26   │
│                                          │
│ SOLD TO                                  │
│ AON ENGINEERS                            │
│ Address                                  │
│                                          │
│ ──────────────────────────────────────── │
│ Description       Qty   Price    Amount  │
│ ──────────────────────────────────────── │
│ AC Water Service   2   1600     3200    │
│                                          │
│                              Total 3200   │
│                                          │
│ Bank Details                             │
│                                          │
│                         [STAMP]           │
│                                          │
└──────────────────────────────────────────┘
```

The invoice preview itself should remain visually neutral.

Do not apply the application dashboard's dark sidebar or blue cards to
the invoice document.

------------------------------------------------------------------------

# 25. Invoice Document Theme

The actual invoice should use:

-   White background
-   Black/dark text
-   Thin gray borders
-   Brand blue for headings where appropriate
-   Original business logo
-   Original stamp
-   Original signature
-   Clear table structure

The printed invoice must prioritize readability over decoration.

------------------------------------------------------------------------

# 26. Tables

Tables are central to billing.

Rules:

-   Header background: very light blue/gray
-   Header text: dark
-   Body background: white
-   Borders: subtle
-   Amount columns right-aligned
-   Description left-aligned
-   Quantity centered
-   No excessive row shading

Example:

``` text
Description                 Qty     Price      Amount
────────────────────────────────────────────────────
AC Water Service             2      ₹1,600     ₹3,200
AC Installation              1      ₹2,500     ₹2,500
```

------------------------------------------------------------------------

# 27. Forms

Inputs should feel familiar and dependable.

``` text
Customer Name
[ AON ENGINEERS                         ]

Invoice Date
[ 12 Aug 2026                          ]

Payment Terms
[ 30 Days                              ]
```

Label must appear above the field.

Do not rely on placeholders as labels.

------------------------------------------------------------------------

# 28. Input States

Every input should have:

### Default

White background + subtle border.

### Focus

Primary blue border + subtle focus ring.

### Error

Red border + error message.

### Disabled

Muted background and text.

### Success

Use sparingly.

------------------------------------------------------------------------

# 29. Search

Search should be fast and forgiving.

Support:

-   customer name
-   invoice number
-   phone
-   service name

Use a visible search icon.

Desktop:

``` text
[ 🔍 Search invoices... ]
```

Mobile:

``` text
[ 🔍 Search... ]
```

------------------------------------------------------------------------

# 30. Empty States

Empty states should tell the user what to do.

Example:

``` text
No invoices yet

Create your first invoice and it will appear here.

[ Create Invoice ]
```

Customers:

``` text
No customers yet

Add a customer to create invoices faster.

[ Add Customer ]
```

Avoid decorative illustrations unless they genuinely help.

------------------------------------------------------------------------

# 31. Loading States

Use skeletons for dashboard/table content.

For invoice generation:

``` text
Generating invoice...

Please wait.
```

Do not leave the user wondering whether the button worked.

Disable duplicate submission while processing.

------------------------------------------------------------------------

# 32. Toast Notifications

Use short notifications.

Examples:

``` text
Invoice created successfully.
```

``` text
Invoice link copied.
```

``` text
Customer saved.
```

``` text
PDF generated successfully.
```

Errors:

``` text
Could not generate PDF. Please try again.
```

Avoid long notification messages.

------------------------------------------------------------------------

# 33. Dialogs

Use dialogs for:

-   Delete confirmation
-   Cancel invoice
-   Payment update
-   Important confirmation

Example:

``` text
Delete Customer?

This will remove the customer from your active customer list.

Existing invoices will not be deleted.

[Cancel] [Delete]
```

For complex forms, use a dedicated page or sheet rather than an
oversized dialog.

------------------------------------------------------------------------

# 34. Mobile Navigation

Use a compact bottom navigation for the most important actions.

Recommended:

``` text
┌────────────────────────────────────┐
│ Home │ Invoices │ + │ Customers │ More │
└────────────────────────────────────┘
```

The center `+` should be the primary Create Invoice action.

Settings and reports can live under More.

------------------------------------------------------------------------

# 35. Responsive Breakpoints

Use standard responsive breakpoints:

``` text
Mobile:  < 640px
Tablet:  640px–1023px
Desktop: ≥ 1024px
Large:   ≥ 1280px
```

The application should be designed mobile-first and enhanced for
desktop.

------------------------------------------------------------------------

# 36. Accessibility

Minimum requirements:

-   WCAG-aware contrast
-   Keyboard navigation
-   Visible focus states
-   Proper labels
-   Accessible buttons
-   Screen-reader labels for icons
-   Do not communicate status using color alone
-   Minimum comfortable touch target around 44px on mobile

------------------------------------------------------------------------

# 37. Iconography

Use a consistent icon library such as:

**Lucide React**

Icons should be:

-   simple
-   outlined
-   consistent stroke width
-   familiar

Recommended:

``` text
Dashboard     LayoutDashboard
Invoices      Receipt
Customers     Users
Services      Package
Reports       BarChart3
Settings      Settings
Search        Search
Add           Plus
Download      Download
Share         Share2
Print         Printer
```

Do not mix multiple icon styles.

------------------------------------------------------------------------

# 38. Logo Usage

The business logo is part of the invoice identity.

In the application:

-   show the logo in the sidebar/header
-   maintain correct aspect ratio
-   never stretch
-   provide a fallback if no logo is uploaded

In the invoice:

-   use the original uploaded logo
-   preserve proportions
-   position according to the existing invoice template

------------------------------------------------------------------------

# 39. Stamp and Signature

The stamp and signature should be treated as official business assets.

Rules:

-   Preserve aspect ratio
-   Do not apply UI styling to them
-   Do not crop automatically in a way that changes appearance
-   Allow replacement from Business Settings
-   Show them in the invoice preview exactly as they will appear in the
    PDF

------------------------------------------------------------------------

# 40. Dashboard Chart Style

Charts should be restrained.

Use:

-   one primary brand color
-   neutral gridlines
-   clear axis labels
-   tooltips
-   readable currency formatting

Avoid:

-   rainbow charts
-   3D charts
-   excessive gradients
-   decorative chart animations

Example:

``` text
Revenue

₹100k ┤                 ╭──
 ₹75k ┤          ╭──────╯
 ₹50k ┤     ╭────╯
 ₹25k ┤─────╯
       └────────────────────
        1    5    10    15
```

------------------------------------------------------------------------

# 41. Reports

Reports should use the same visual language as the dashboard.

Top controls:

``` text
[ This Month ▼ ]       [ Export ▼ ]
```

Then:

-   Revenue
-   Invoice count
-   Payment collection
-   Top services
-   Top customers

Keep reports actionable.

------------------------------------------------------------------------

# 42. Settings Design

Settings should not be a huge form.

Use sections:

``` text
Business
Invoice
Bank Details
Assets
Payment
```

Example:

``` text
Business Settings

Business Information
──────────────────────

Business Name
[ JAY RAMJI ENTERPRISE ]

Address
[ ... ]

Phone
[ ... ]

[ Save Changes ]
```

------------------------------------------------------------------------

# 43. Login Screen

The login page should communicate trust.

``` text
┌────────────────────────────────────────────┐
│                                            │
│             [BUSINESS LOGO]               │
│                                            │
│         Billing Management                │
│                                            │
│         Sign in to continue               │
│                                            │
│ Email                                      │
│ [____________________________]              │
│                                            │
│ Password                                   │
│ [____________________________]              │
│                                            │
│ [            Sign In           ]           │
│                                            │
└────────────────────────────────────────────┘
```

No unnecessary marketing copy.

------------------------------------------------------------------------

# 44. Design Tokens

Recommended CSS variables:

``` css
:root {
  --color-primary-900: #17324D;
  --color-primary-800: #1E4668;
  --color-primary-700: #245A82;
  --color-primary-600: #2F6F9F;
  --color-primary-500: #3B82B8;

  --color-background: #F7F8FA;
  --color-surface: #FFFFFF;
  --color-surface-2: #F1F4F7;

  --color-text-primary: #17212B;
  --color-text-secondary: #52606D;
  --color-text-muted: #7B8794;
  --color-text-disabled: #A8B2BC;

  --color-border: #D9E0E7;
  --color-border-light: #E8EDF2;

  --color-success: #15803D;
  --color-success-soft: #EAF7EF;

  --color-warning: #B45309;
  --color-warning-soft: #FFF6E5;

  --color-danger: #B42318;
  --color-danger-soft: #FDECEC;

  --color-info: #2563EB;
  --color-info-soft: #EFF6FF;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}
```

------------------------------------------------------------------------

# 45. Tailwind Theme Mapping

If Tailwind CSS v4 is used, expose the design tokens through `@theme`.

Example:

``` css
@theme {
  --color-primary-900: #17324D;
  --color-primary-800: #1E4668;
  --color-primary-700: #245A82;
  --color-primary-600: #2F6F9F;
  --color-primary-500: #3B82B8;

  --color-app-background: #F7F8FA;
  --color-surface: #FFFFFF;
  --color-surface-muted: #F1F4F7;

  --color-text-primary: #17212B;
  --color-text-secondary: #52606D;
  --color-text-muted: #7B8794;

  --color-border: #D9E0E7;

  --color-success: #15803D;
  --color-warning: #B45309;
  --color-danger: #B42318;
}
```

------------------------------------------------------------------------

# 46. Design Do / Don't

## Do

-   Use white surfaces.
-   Use dark blue for trusted navigation/brand elements.
-   Keep financial data highly readable.
-   Use clear labels.
-   Keep invoice creation fast.
-   Use consistent spacing.
-   Make mobile controls large enough.
-   Make the primary action obvious.
-   Keep the invoice itself print-oriented.
-   Use subtle visual hierarchy.

## Don't

-   Don't use neon colors.
-   Don't use glassmorphism.
-   Don't use huge gradients.
-   Don't use excessive rounded cards.
-   Don't animate every interaction.
-   Don't hide important financial information.
-   Don't make the shopkeeper navigate through multiple pages to create
    a bill.
-   Don't make the invoice look like a SaaS dashboard.
-   Don't use tiny text for tables.
-   Don't rely on color alone for payment status.

------------------------------------------------------------------------

# 47. Design Priority

When there is a conflict between visual beauty and operational
usability, use this priority:

``` text
Correctness
   ↓
Readability
   ↓
Speed
   ↓
Trust
   ↓
Consistency
   ↓
Visual polish
```

A shopkeeper should never struggle to complete a task because the
interface looks more sophisticated.

------------------------------------------------------------------------

# 48. Final Visual Identity

The finished application should feel like:

> **A reliable digital ledger and billing desk for a real Indian
> business.**

Visual summary:

``` text
Theme:
Ledger Blue

Primary:
Deep professional blue

Background:
Warm light gray

Surface:
White

Font:
Inter

Style:
Clean + practical + trustworthy

Density:
Moderate

Corners:
8–12px

Shadows:
Subtle

Icons:
Lucide

Invoice:
Traditional professional document

Dashboard:
Modern but restrained

Mobile:
Fast and touch-friendly
```

The design system should remain consistent across the dashboard, invoice
builder, customer management, service catalogue, reports, settings, and
public invoice page.
