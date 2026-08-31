'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  FilePlus,
  Users,
  CreditCard,
  BarChart3,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Wallet,
  AlertCircle,
  Building2,
  Smartphone,
  Banknote,
  CheckSquare,
  Printer,
  ChevronDown,
  Menu,
  X,
  ReceiptText,
} from 'lucide-react';

export default function PublicLandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What can I use Jay Ramji Enterprise Billing for?',
      a: 'You can use the platform to generate professional GST and non-tax invoices, manage your customer directory, record payments across multiple methods (UPI, Bank, Cash, Cheque), attach payment proof, and track business sales analytics.',
    },
    {
      q: 'Can I create and download invoice documents?',
      a: 'Yes. Once an invoice is finalized, the system automatically generates high-resolution vector PDF invoices and PNG snapshot previews that you can download or share via public links.',
    },
    {
      q: 'How does payment tracking work?',
      a: 'Invoices can be marked as Paid, Unpaid, or Partial. You can record payments against specific invoices, record the payment account used, and view total outstanding receivables on your dashboard.',
    },
    {
      q: 'Can I upload payment proof from my mobile phone?',
      a: 'Yes. The system includes a QR-assisted upload session. You can scan a QR code from your screen with your smartphone camera to upload payment screenshots or bank deposit slips directly to the bill.',
    },
    {
      q: 'Can I track business analytics and payment methods?',
      a: 'Yes. The analytics section provides turnover trends, money received vs outstanding dues, payment channel distribution, and customer purchase histories.',
    },
  ];

  return (
    <div className="min-h-screen bg-background-app text-text-primary flex flex-col justify-between font-sans selection:bg-primary-700 selection:text-white">
      {/* ---------------------------------------------------- */}
      {/* 1. PUBLIC NAVIGATION HEADER */}
      {/* ---------------------------------------------------- */}
      <header className="bg-primary-900 text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Left: Brand Identity */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="bg-primary-700 text-white w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm group-hover:scale-105 transition">
              J
            </div>
            <div>
              <span className="font-bold text-base sm:text-lg tracking-tight block leading-tight">
                Jay Ramji Enterprise
              </span>
              <span className="text-[11px] text-primary-300 font-medium block">
                Billing & Invoice Management System
              </span>
            </div>
          </Link>

          {/* Center: Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-primary-200">
            <a href="#features" className="hover:text-white transition">Features</a>
            <a href="#how-it-works" className="hover:text-white transition">How It Works</a>
            <a href="#benefits" className="hover:text-white transition">Benefits</a>
            <a href="#faq" className="hover:text-white transition">FAQ</a>
          </nav>

          {/* Right: Auth Action */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-xs font-bold text-primary-200 hover:text-white transition"
            >
              Login
            </Link>
            <Link
              href="/login"
              className="px-4 py-2 bg-primary-700 hover:bg-primary-600 text-white rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-primary-200 hover:text-white hover:bg-primary-800 transition"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-primary-950 border-t border-primary-800 px-4 pt-3 pb-5 space-y-3">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-semibold text-primary-200 py-1.5 hover:text-white"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-semibold text-primary-200 py-1.5 hover:text-white"
            >
              How It Works
            </a>
            <a
              href="#benefits"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-semibold text-primary-200 py-1.5 hover:text-white"
            >
              Benefits
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-semibold text-primary-200 py-1.5 hover:text-white"
            >
              FAQ
            </a>
            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/login"
                className="w-full py-2 text-center text-xs font-bold text-primary-200 bg-primary-900 rounded-lg"
              >
                Login
              </Link>
              <Link
                href="/login"
                className="w-full py-2 text-center text-xs font-bold text-white bg-primary-700 rounded-lg"
              >
                Get Started
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ---------------------------------------------------- */}
      {/* 2. HERO SECTION */}
      {/* ---------------------------------------------------- */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-700/10 text-primary-700 border border-primary-700/20 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Reliable Business Billing</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-text-primary tracking-tight leading-tight">
            Billing Made Simple.
          </h1>

          <p className="text-sm sm:text-base text-text-secondary max-w-2xl mx-auto leading-relaxed">
            Create invoices, manage customers, record payments and keep track of your business finances — all from one place.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-3 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-sm font-bold transition shadow-md shadow-primary-700/20 flex items-center justify-center gap-2"
            >
              <FilePlus className="w-4 h-4" />
              <span>Create Your First Invoice</span>
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto px-6 py-3 bg-surface-app hover:bg-surface-2-app border border-border-app text-text-primary rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 shadow-xs"
            >
              <span>Explore Features</span>
            </a>
          </div>
        </div>

        {/* Hero Visual Mockup Preview */}
        <div className="mt-12 max-w-5xl mx-auto bg-surface-app border border-border-app rounded-2xl shadow-lg overflow-hidden">
          {/* Mock Window Topbar */}
          <div className="bg-primary-900 text-white px-4 py-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              </div>
              <span className="font-semibold text-primary-200 ml-2">Jay Ramji Enterprise — Billing Dashboard</span>
            </div>
            <span className="text-[10px] bg-primary-800 px-2 py-0.5 rounded text-primary-200 font-mono">
              Live Preview
            </span>
          </div>

          {/* Mock Dashboard Body */}
          <div className="p-4 sm:p-6 bg-background-app space-y-4">
            {/* KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-surface-app border border-border-app rounded-xl p-3.5">
                <span className="text-[10px] font-bold text-text-muted uppercase">Total Sales</span>
                <p className="text-lg font-black text-text-primary mt-0.5">₹3,42,800.00</p>
                <span className="text-[10px] text-text-muted">Billed turnover</span>
              </div>
              <div className="bg-surface-app border border-border-app rounded-xl p-3.5">
                <span className="text-[10px] font-bold text-emerald-600 uppercase">Paid Amount</span>
                <p className="text-lg font-black text-emerald-600 mt-0.5">₹2,95,000.00</p>
                <span className="text-[10px] text-text-muted">Collected revenue</span>
              </div>
              <div className="bg-surface-app border border-border-app rounded-xl p-3.5">
                <span className="text-[10px] font-bold text-amber-600 uppercase">Outstanding</span>
                <p className="text-lg font-black text-amber-600 mt-0.5">₹47,800.00</p>
                <span className="text-[10px] text-text-muted">Pending balance</span>
              </div>
              <div className="bg-surface-app border border-border-app rounded-xl p-3.5">
                <span className="text-[10px] font-bold text-blue-600 uppercase">Invoices</span>
                <p className="text-lg font-black text-text-primary mt-0.5">64</p>
                <span className="text-[10px] text-text-muted">Finalized bills</span>
              </div>
            </div>

            {/* Mock Invoice Row */}
            <div className="bg-surface-app border border-border-app rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary-700/10 text-primary-700">
                  <ReceiptText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-text-primary">#JRE-2026-0089</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-700">
                      PAID
                    </span>
                  </div>
                  <span className="text-text-secondary text-[11px]">Rajesh Auto Works • 28 Aug 2026</span>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-4">
                <div className="text-right">
                  <span className="font-black text-text-primary block text-sm">₹18,450.00</span>
                  <span className="text-[10px] text-text-muted font-medium">via UPI (GPay)</span>
                </div>
                <span className="px-3 py-1 bg-surface-2-app rounded-lg font-bold text-primary-700 text-xs">
                  View Bill
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* 3. TRUST / VALUE STRIP */}
      {/* ---------------------------------------------------- */}
      <section className="py-8 bg-surface-app border-y border-border-app">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary-700/10 text-primary-700 shrink-0 mt-0.5">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wide">Professional Invoices</h3>
              <p className="text-xs text-text-secondary mt-0.5">Clean, GST-compliant, business-ready invoices.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0 mt-0.5">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wide">Payment Tracking</h3>
              <p className="text-xs text-text-secondary mt-0.5">Track paid, unpaid and partial outstanding amounts.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 shrink-0 mt-0.5">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wide">Customer Directory</h3>
              <p className="text-xs text-text-secondary mt-0.5">Keep billing information & GSTINs organized.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 shrink-0 mt-0.5">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-text-primary uppercase tracking-wide">Business Analytics</h3>
              <p className="text-xs text-text-secondary mt-0.5">Understand sales trends & collection channels.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* 4. FEATURES SECTION */}
      {/* ---------------------------------------------------- */}
      <section id="features" className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold text-primary-700 uppercase tracking-wider">Features</span>
          <h2 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight mt-1">
            Everything You Need to Manage Billing
          </h2>
          <p className="text-xs sm:text-sm text-text-secondary mt-1.5">
            Designed for practical shop floor operations and day-to-day business accounting.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="bg-surface-app border border-border-app rounded-2xl p-6 shadow-xs space-y-3">
            <div className="p-3 rounded-xl bg-primary-700/10 text-primary-700 w-fit">
              <FilePlus className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-text-primary">1. Invoice Management</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Create drafts, add items and labour charges, automatically calculate CGST/SGST/IGST, apply discounts, finalize bills, and generate professional PDF & PNG documents.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-surface-app border border-border-app rounded-2xl p-6 shadow-xs space-y-3">
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 w-fit">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-text-primary">2. Customer Management</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Maintain full customer records with phone numbers, emails, addresses, GSTIN/PAN tax profiles, and view individual customer transaction histories.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-surface-app border border-border-app rounded-2xl p-6 shadow-xs space-y-3">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 w-fit">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-text-primary">3. Payment Management</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Record payments against invoices with payment methods (UPI, Bank, Cash, Cheque). Manage receiving accounts and track partial vs fully paid invoices.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-surface-app border border-border-app rounded-2xl p-6 shadow-xs space-y-3">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-600 w-fit">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-text-primary">4. QR-Assisted Proof Upload</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Scan a dynamic QR code on screen using your mobile phone camera to upload bank deposit slips or UPI payment screenshots directly to the bill without logging in on mobile.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="bg-surface-app border border-border-app rounded-2xl p-6 shadow-xs space-y-3">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 w-fit">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-text-primary">5. Real-Time Analytics</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Visual sales vs payment trends, collection rates, payment method breakdowns, outstanding dues analysis, and top revenue-generating customers.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="bg-surface-app border border-border-app rounded-2xl p-6 shadow-xs space-y-3">
            <div className="p-3 rounded-xl bg-violet-500/10 text-violet-600 w-fit">
              <Printer className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-text-primary">6. Document Generation</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              Generate pixel-perfect A4 vector PDFs, high-resolution PNG snapshots, and public bill share links with your company logo, official stamp, and signature.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* 5. HOW IT WORKS */}
      {/* ---------------------------------------------------- */}
      <section id="how-it-works" className="py-16 bg-surface-app border-y border-border-app">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-primary-700 uppercase tracking-wider">Workflow</span>
            <h2 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight mt-1">
              How It Works
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary mt-1.5">
              Four simple steps from bill generation to payment collection.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <div className="bg-background-app border border-border-app rounded-2xl p-5 shadow-xs space-y-2">
              <span className="text-2xl font-black text-primary-700 font-mono">01</span>
              <h3 className="text-sm font-bold text-text-primary">Create Invoice</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Add customer, select items/services, apply quantities, pricing, and tax rules.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-background-app border border-border-app rounded-2xl p-5 shadow-xs space-y-2">
              <span className="text-2xl font-black text-primary-700 font-mono">02</span>
              <h3 className="text-sm font-bold text-text-primary">Finalize & Share</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Lock the bill sequence, generate vector PDFs, and share via direct link.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-background-app border border-border-app rounded-2xl p-5 shadow-xs space-y-2">
              <span className="text-2xl font-black text-primary-700 font-mono">03</span>
              <h3 className="text-sm font-bold text-text-primary">Record Payment</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Log UPI, Bank, Cash, or Cheque payments and attach payment verification proof.
              </p>
            </div>

            {/* Step 4 */}
            <div className="bg-background-app border border-border-app rounded-2xl p-5 shadow-xs space-y-2">
              <span className="text-2xl font-black text-primary-700 font-mono">04</span>
              <h3 className="text-sm font-bold text-text-primary">Track Your Business</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Monitor receivables, cash flow, outstanding customer dues, and sales growth.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* 6. SUPPORTED PAYMENT METHODS */}
      {/* ---------------------------------------------------- */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-xl mx-auto mb-8">
          <span className="text-xs font-bold text-primary-700 uppercase tracking-wider">Multi-Channel</span>
          <h2 className="text-xl sm:text-2xl font-black text-text-primary tracking-tight mt-1">
            Supported Payment Methods
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Track and reconcile transactions across all standard channels.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5 max-w-4xl mx-auto">
          <div className="bg-surface-app border border-border-app rounded-xl p-4 flex flex-col items-center text-center shadow-xs">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 mb-2">
              <Smartphone className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-text-primary">UPI</span>
            <span className="text-[10px] text-text-muted">GPay, PhonePe, Paytm</span>
          </div>

          <div className="bg-surface-app border border-border-app rounded-xl p-4 flex flex-col items-center text-center shadow-xs">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 mb-2">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-text-primary">Bank Transfer</span>
            <span className="text-[10px] text-text-muted">NEFT, RTGS, IMPS</span>
          </div>

          <div className="bg-surface-app border border-border-app rounded-xl p-4 flex flex-col items-center text-center shadow-xs">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 mb-2">
              <Banknote className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-text-primary">Cash</span>
            <span className="text-[10px] text-text-muted">Immediate receipt</span>
          </div>

          <div className="bg-surface-app border border-border-app rounded-xl p-4 flex flex-col items-center text-center shadow-xs">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 mb-2">
              <CheckSquare className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-text-primary">Cheque</span>
            <span className="text-[10px] text-text-muted">Cheque No & clearing</span>
          </div>

          <div className="bg-surface-app border border-border-app rounded-xl p-4 flex flex-col items-center text-center shadow-xs col-span-2 sm:col-span-1">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600 mb-2">
              <QrCode className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-text-primary">QR Code</span>
            <span className="text-[10px] text-text-muted">Dynamic scanning</span>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* 7. BUSINESS BENEFITS */}
      {/* ---------------------------------------------------- */}
      <section id="benefits" className="py-16 bg-surface-app border-y border-border-app">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-primary-700 uppercase tracking-wider">Benefits</span>
            <h2 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight mt-1">
              Built for Practical Business Operations
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary mt-1.5">
              Clear financial control without accounting complexity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="flex items-start gap-3.5 bg-background-app border border-border-app p-5 rounded-2xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-text-primary">Spend less time managing bills</h3>
                <p className="text-xs text-text-secondary mt-1">
                  Speed up invoice creation with saved customers, standard products, and automatic tax math.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 bg-background-app border border-border-app p-5 rounded-2xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-text-primary">Know who has paid</h3>
                <p className="text-xs text-text-secondary mt-1">
                  Instant visibility into paid, partially paid, and unpaid invoices with transaction records.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 bg-background-app border border-border-app p-5 rounded-2xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-text-primary">Know what is still outstanding</h3>
                <p className="text-xs text-text-secondary mt-1">
                  Filter pending receivables by customer so you never lose track of money owed to your business.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 bg-background-app border border-border-app p-5 rounded-2xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-text-primary">Keep billing records organized</h3>
                <p className="text-xs text-text-secondary mt-1">
                  Centralized customer contacts, GSTIN numbers, and full invoice transaction histories.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 bg-background-app border border-border-app p-5 rounded-2xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-text-primary">Access invoice documents anytime</h3>
                <p className="text-xs text-text-secondary mt-1">
                  Download crisp vector PDFs or PNG previews with your branding whenever needed.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 bg-background-app border border-border-app p-5 rounded-2xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-text-primary">Understand payment channels</h3>
                <p className="text-xs text-text-secondary mt-1">
                  Clear visual charts showing whether money was collected via UPI, Cash, Bank, or Cheque.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* 8. FAQ SECTION */}
      {/* ---------------------------------------------------- */}
      <section id="faq" className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        <div className="text-center mb-10">
          <span className="text-xs font-bold text-primary-700 uppercase tracking-wider">FAQ</span>
          <h2 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight mt-1">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="bg-surface-app border border-border-app rounded-xl overflow-hidden shadow-xs transition"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 font-bold text-xs sm:text-sm text-text-primary hover:bg-surface-2-app/50 transition cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-text-muted shrink-0 transition-transform ${
                      isOpen ? 'rotate-180 text-primary-700' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 pt-1 text-xs text-text-secondary leading-relaxed border-t border-border-app/50">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* 9. FINAL CALL TO ACTION */}
      {/* ---------------------------------------------------- */}
      <section className="py-14 sm:py-16 bg-primary-900 text-white text-center px-4 sm:px-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight">
            Ready to simplify your billing?
          </h2>
          <p className="text-xs sm:text-sm text-primary-200 leading-relaxed max-w-lg mx-auto">
            Create professional invoices, manage customer profiles, and keep your business billing organized.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white hover:bg-primary-50 text-primary-900 rounded-xl text-sm font-bold transition shadow-md"
            >
              <span>Login to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* 10. FOOTER */}
      {/* ---------------------------------------------------- */}
      <footer className="bg-surface-app border-t border-border-app py-8 px-4 sm:px-6 lg:px-8 text-xs text-text-secondary">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary-700 text-white w-7 h-7 rounded-lg flex items-center justify-center font-bold text-sm">
              J
            </div>
            <div>
              <p className="font-bold text-text-primary">Jay Ramji Enterprise</p>
              <p className="text-[11px] text-text-muted">Billing & Invoice Management System</p>
            </div>
          </div>

          <div className="flex items-center gap-6 font-semibold">
            <a href="#features" className="hover:text-text-primary transition">Features</a>
            <a href="#how-it-works" className="hover:text-text-primary transition">How It Works</a>
            <a href="#benefits" className="hover:text-text-primary transition">Benefits</a>
            <a href="#faq" className="hover:text-text-primary transition">FAQ</a>
            <Link href="/login" className="text-primary-700 hover:underline">Login</Link>
          </div>

          <div className="text-[11px] text-text-muted">
            © 2026 Jay Ramji Enterprise. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
