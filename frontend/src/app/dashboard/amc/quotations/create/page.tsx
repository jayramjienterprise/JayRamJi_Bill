'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDashboard } from '../../../layout';
import { apiClient } from '../../../../../lib/api/client';
import { Customer, Product } from '../../../../../lib/api/types';
import { convertNumberToWords } from '../../../../../lib/utils/numberToWords';
import AmcQuotationPaper, { AmcQuotationPaperItem } from '../../components/AmcQuotationPaper';
import {
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  Minimize2,
  FileText,
  Search,
  ShieldCheck,
  Building2,
  Calendar,
  X,
  Clock,
  Check,
} from 'lucide-react';

export default function CreateAmcQuotationPage() {
  const router = useRouter();
  const { activeBusinessId } = useDashboard();

  // Master Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [business, setBusiness] = useState<any>(null);
  const [activeAssets, setActiveAssets] = useState<{ logo: any; stamp: any; signature: any }>({
    logo: null,
    stamp: null,
    signature: null,
  });

  // UI States
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [expandPreview, setExpandPreview] = useState(false);
  const [scale, setScale] = useState(1);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Search filters
  const [productSearch, setProductSearch] = useState('');

  // Form Inputs
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [quotationDate, setQuotationDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [quotationNumber, setQuotationNumber] = useState('');
  const [amcType, setAmcType] = useState<'NON_COMPREHENSIVE' | 'COMPREHENSIVE'>('NON_COMPREHENSIVE');
  const [paymentTerms, setPaymentTerms] = useState('10 Days from the Invoice date');
  const [validityDays, setValidityDays] = useState('30 Days');
  const [taxOption, setTaxOption] = useState<'NONE' | 'GST_18'>('NONE');

  // Edit Mode state
  const [editId, setEditId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [existingQuotation, setExistingQuotation] = useState<any | null>(null);

  // Read edit query param
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const editParam = params.get('edit');
      if (editParam) {
        setEditId(editParam);
        setIsEditing(true);
      }
    }
  }, []);

  // Terms & Conditions list
  const [termsList, setTermsList] = useState<string[]>([
    'This AMC quotation is valid for 1 Year from issuance date.',
    'Non-Comprehensive AMC: Only scheduled routine maintenance & inspection labour are included. Spare parts & gas are chargeable.',
    'Payment Terms: 10 Days from Invoice date.',
    'Emergency breakdown calls will be attended to within 24 to 48 hours.',
    'AC installation or relocation charges include up to 10 feet of standard piping.',
  ]);

  // Line items
  const [items, setItems] = useState<AmcQuotationPaperItem[]>([
    {
      serialNumber: 1,
      description: 'Split AC Routine Maintenance Servicing',
      period: 'Quarterly',
      quantity: 4,
      unitPrice: 1200,
      amount: 4800,
    },
  ]);

  // Load quotation details if in edit mode
  useEffect(() => {
    if (!editId) return;
    async function loadQuotationForEditing() {
      try {
        setLoading(true);
        const res: any = await apiClient.get(`/amc/quotations/${editId}`);
        const quote = res?.data || res;
        if (quote) {
          setExistingQuotation(quote);
          setQuotationNumber(quote.quotationNumber || '');
          const custId = quote.customerId?._id || quote.customerId?.id || quote.customerId;
          if (custId) setSelectedCustomerId(custId);
          if (quote.quotationDate) {
            setQuotationDate(new Date(quote.quotationDate).toISOString().split('T')[0]);
          }
          if (quote.quotationType) {
            setAmcType(quote.quotationType);
          }
          if (quote.paymentTerms) {
            setPaymentTerms(quote.paymentTerms);
          }
          if (quote.taxRateBps && quote.taxRateBps > 0) {
            setTaxOption('GST_18');
          } else {
            setTaxOption('NONE');
          }
          if (Array.isArray(quote.termsAndConditions) && quote.termsAndConditions.length > 0) {
            setTermsList(quote.termsAndConditions);
          }
          if (Array.isArray(quote.items) && quote.items.length > 0) {
            setItems(
              quote.items.map((it: any, idx: number) => ({
                serialNumber: it.serialNumber || idx + 1,
                description: it.description,
                period: it.period || '',
                quantity: Number(it.quantity) || 1,
                unitPrice: Number(it.unitPrice) || 0,
                amount: Number(it.amount) || 0,
              }))
            );
          }
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to load quotation for editing');
      } finally {
        setLoading(false);
      }
    }
    loadQuotationForEditing();
  }, [editId]);

  // Inline Customer Modal state
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [customerSubmitLoading, setCustomerSubmitLoading] = useState(false);
  const [customerErrorMsg, setCustomerErrorMsg] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
    line1: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    gstin: '',
  });

  // Load Initial Master Data
  useEffect(() => {
    async function initData() {
      try {
        setLoading(true);

        // Load Customers properly resolving array payload
        const custRes = await apiClient.listCustomers({ active: true, limit: 100 });
        const loadedCustomers = custRes.customers || (custRes as any).data?.customers || [];
        setCustomers(loadedCustomers);

        // Load Products
        const prodRes = await apiClient.listProducts({ active: true, limit: 100 });
        const loadedProducts = prodRes.products || (prodRes as any).data?.products || [];
        setProducts(loadedProducts);

        // Load Business & Assets for Live Preview
        const bizRes: any = await apiClient.get('/business');
        setBusiness(bizRes.business || bizRes.data?.business);

        const assetsList = await apiClient.listAssets();
        const logo = assetsList.find((a) => a.type === 'LOGO' && a.active);
        const stamp = assetsList.find((a) => a.type === 'STAMP' && a.active);
        const signature = assetsList.find((a) => a.type === 'SIGNATURE' && a.active);
        setActiveAssets({ logo, stamp, signature });

        // Generate next quotation number only for new quotation
        if (!editId) {
          const randomNum = Math.floor(1000 + Math.random() * 9000);
          setQuotationNumber((prev) => prev || `JRE-Q-2526-${randomNum}`);
        }
      } catch (err: any) {
        console.error('Failed loading initial master data:', err);
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, [activeBusinessId, editId]);

  // Sync selected customer
  useEffect(() => {
    if (!selectedCustomerId) {
      setSelectedCustomer(null);
      return;
    }
    const found = customers.find(
      (c) => c.id === selectedCustomerId || (c as any)._id === selectedCustomerId
    );
    setSelectedCustomer(found || null);
  }, [selectedCustomerId, customers]);

  // Adjust terms when toggling AMC Type
  useEffect(() => {
    if (amcType === 'COMPREHENSIVE') {
      setTermsList([
        'This AMC quotation is valid for 30 days from issuance date.',
        'Comprehensive AMC: Scheduled periodic maintenance and eligible functional components are covered.',
        'Routine emergency breakdown calls included at zero technician labour fee.',
        'Payment Terms: ' + paymentTerms,
        'External accidental damages or piping ruptures are excluded from standard coverage.',
      ]);
    } else {
      setTermsList([
        'This AMC quotation is valid for 30 days from issuance date.',
        'Non-Comprehensive AMC: Only scheduled routine maintenance & inspection labour are included. Spare parts & gas are chargeable.',
        'Payment Terms: ' + paymentTerms,
        'Emergency breakdown calls will be attended to within 24 to 48 hours.',
        'AC installation or relocation charges include up to 10 feet of standard piping.',
      ]);
    }
  }, [amcType]);

  // Auto-fit Live A4 Paper scaling
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const containerWidth = entry.contentRect.width;
        const canonicalWidth = 794; // Standard A4 canonical pixel width at 96dpi
        const newScale = Math.min(1, containerWidth / canonicalWidth);
        setScale(newScale);
      }
    });
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [expandPreview]);

  // Calculations
  const subtotal = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const taxAmount = taxOption === 'GST_18' ? Math.round(subtotal * 0.18 * 100) / 100 : 0;
  const grandTotal = Math.round((subtotal + taxAmount) * 100) / 100;
  const amountInWords = convertNumberToWords(grandTotal);

  // Line item modifiers
  function handleAddItemFromProduct(p: Product) {
    const unitPrice = p.defaultPriceMinor ? p.defaultPriceMinor / 100 : ((p as any).price || 0);
    const newItem: AmcQuotationPaperItem = {
      serialNumber: items.length + 1,
      description: p.name,
      period: 'Quarterly',
      quantity: 1,
      unitPrice,
      amount: unitPrice,
    };
    setItems([...items, newItem]);
  }

  function handleAddCustomItem() {
    setItems([
      ...items,
      {
        serialNumber: items.length + 1,
        description: '',
        period: 'Monthly',
        quantity: 1,
        unitPrice: 0,
        amount: 0,
      },
    ]);
  }

  function handleUpdateItem(index: number, field: keyof AmcQuotationPaperItem, val: any) {
    const updated = [...items];
    const target = { ...updated[index], [field]: val };
    if (field === 'quantity' || field === 'unitPrice') {
      const q = Number(field === 'quantity' ? val : target.quantity) || 0;
      const p = Number(field === 'unitPrice' ? val : target.unitPrice) || 0;
      target.amount = Math.round(q * p * 100) / 100;
    }
    updated[index] = target;
    setItems(updated);
  }

  function handleRemoveItem(index: number) {
    if (items.length <= 1) return;
    const filtered = items.filter((_, i) => i !== index);
    setItems(filtered.map((it, idx) => ({ ...it, serialNumber: idx + 1 })));
  }

  // Handle Inline Customer Submit
  async function handleCreateInlineCustomer(e: React.FormEvent) {
    e.preventDefault();
    setCustomerErrorMsg(null);
    setCustomerSubmitLoading(true);
    try {
      const payload = {
        name: customerForm.name.trim(),
        contact: {
          phone: customerForm.phone.trim() || undefined,
          email: customerForm.email.trim() || undefined,
        },
        address: {
          line1: customerForm.line1.trim() || undefined,
          city: customerForm.city.trim() || undefined,
          state: customerForm.state.trim() || undefined,
          postalCode: customerForm.postalCode.trim() || undefined,
          country: customerForm.country || 'India',
        },
        taxProfile: {
          gstin: customerForm.gstin.trim() || undefined,
        },
      };

      const res: any = await apiClient.post('/customers', payload);
      const newCust = res.customer || res.data?.customer || res.data;
      if (newCust) {
        setCustomers((prev) => [newCust, ...prev]);
        setSelectedCustomerId(newCust.id || newCust._id);
        setSelectedCustomer(newCust);
      }
      setAddCustomerOpen(false);
      setCustomerForm({
        name: '',
        phone: '',
        email: '',
        line1: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'India',
        gstin: '',
      });
    } catch (err: any) {
      setCustomerErrorMsg(err.message || 'Failed to create customer');
    } finally {
      setCustomerSubmitLoading(false);
    }
  }

  // Handle Save / Submit Quotation
  async function handleSaveQuotation(status: 'DRAFT' | 'SENT') {
    if (!selectedCustomerId) {
      setErrorMsg('Please select or create a customer.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (items.length === 0 || !items[0].description.trim()) {
      setErrorMsg('Please add at least one valid AMC service item.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitLoading(true);
    setErrorMsg(null);

    try {
      const payload = {
        customerId: selectedCustomerId,
        quotationNumber: quotationNumber.trim() || undefined,
        quotationDate,
        paymentTerms,
        quotationType: amcType,
        items: items.map((it, idx) => ({
          serialNumber: idx + 1,
          description: it.description.trim(),
          period: it.period?.trim() || undefined,
          quantity: Number(it.quantity) || 1,
          unitPrice: Number(it.unitPrice) || 0,
          amount: Number(it.amount) || 0,
        })),
        taxRateBps: taxOption === 'GST_18' ? 1800 : 0,
        termsAndConditions: termsList,
        status,
      };

      let savedQuotation: any;
      if (editId) {
        if (existingQuotation && existingQuotation.status !== 'DRAFT') {
          setErrorMsg('Only draft quotations can be edited. This quotation is locked.');
          return;
        }
        savedQuotation = await apiClient.patch(`/amc/quotations/${editId}`, payload);
        setSuccessMsg(
          status === 'DRAFT'
            ? 'Draft quotation updated successfully!'
            : 'AMC Quotation finalized! Opening preview & sharing...'
        );
      } else {
        savedQuotation = await apiClient.post('/amc/quotations', payload);
        setSuccessMsg(
          status === 'DRAFT'
            ? 'Quotation saved as Draft!'
            : 'AMC Quotation created & finalized! Opening preview & sharing...'
        );
      }

      const qId =
        editId ||
        savedQuotation?._id ||
        savedQuotation?.id ||
        savedQuotation?.data?._id ||
        savedQuotation?.data?.id;

      if (status === 'SENT' && qId) {
        setTimeout(() => {
          router.push(`/dashboard/amc/quotations/${qId}`);
        }, 700);
      } else {
        setTimeout(() => {
          router.push('/dashboard/amc?tab=quotations');
        }, 1000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save quotation');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitLoading(false);
    }
  }

  const isReadOnly = existingQuotation && existingQuotation.status !== 'DRAFT';

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-app border border-border-app p-4 sm:p-5 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/amc?tab=quotations"
              className="p-2 bg-surface-2-app hover:bg-border-app rounded-xl text-text-secondary transition"
              title="Back to AMC Quotations"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-700" />
                <h1 className="text-xl font-black tracking-tight text-text-primary">
                  {isEditing ? `Edit AMC Quotation: ${quotationNumber}` : 'Create AMC Quotation'}
                </h1>
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                {isEditing
                  ? 'Update service descriptions, periodic visits, pricing, and terms for this draft quotation.'
                  : 'Compile an official AMC quotation, add AC maintenance services, and preview live in real-time.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/amc?tab=quotations"
            className="px-4 py-2.5 bg-surface-2-app hover:bg-border-app text-text-secondary rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Cancel
          </Link>
          <button
            onClick={() => handleSaveQuotation('DRAFT')}
            disabled={submitLoading || isReadOnly}
            className="px-4 py-2.5 bg-surface-2-app hover:bg-border-app border border-border-app text-text-primary rounded-xl text-xs font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
          >
            {isEditing ? 'Save Changes (Draft)' : 'Save as Draft'}
          </button>
          <button
            onClick={() => handleSaveQuotation('SENT')}
            disabled={submitLoading || isReadOnly}
            className="px-5 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitLoading ? 'Saving...' : 'Finalize & Issue Quotation'}</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="p-4 bg-danger-soft border border-danger-app/20 text-danger-app text-xs rounded-xl flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-success-soft border border-success-app/20 text-success-app text-xs rounded-xl flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {isReadOnly && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 text-amber-800 text-xs rounded-xl flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              <strong>Read-Only Notice:</strong> This quotation is marked as <strong>{existingQuotation.status}</strong>. Only <strong>Draft</strong> quotations can be edited.
            </span>
          </div>
          <Link
            href={`/dashboard/amc/quotations/${editId}`}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition shrink-0"
          >
            View Document
          </Link>
        </div>
      )}

      {/* Main 2-Column Responsive Layout (Like Create Bill) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Builder Form */}
        <div
          className={`${
            expandPreview ? 'hidden lg:block lg:col-span-5' : 'lg:col-span-7'
          } space-y-5`}
        >
          {/* 1. Customer & Metadata Card */}
          <div className="bg-surface-app border border-border-app p-5 rounded-2xl shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-text-secondary">
                    CUSTOMER *
                  </label>
                  <button
                    type="button"
                    onClick={() => setAddCustomerOpen(true)}
                    className="text-primary-700 hover:text-primary-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Customer</span>
                  </button>
                </div>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-medium focus:outline-none"
                  required
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c) => (
                    <option key={c.id || (c as any)._id} value={c.id || (c as any)._id}>
                      {c.name} {c.contact?.phone ? `(${c.contact.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  QUOTATION DATE *
                </label>
                <input
                  type="date"
                  value={quotationDate}
                  onChange={(e) => setQuotationDate(e.target.value)}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-medium focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  QUOTATION NUMBER *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={quotationNumber}
                    onChange={(e) => setQuotationNumber(e.target.value)}
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-black focus:outline-none"
                    placeholder="JRE-Q-2526-0001"
                    required
                  />
                  <span className="absolute right-3 top-2.5 text-[10px] text-emerald-600 font-bold">
                    ✓ Available
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  AMC CONTRACT TYPE *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAmcType('NON_COMPREHENSIVE')}
                    className={`p-2 rounded-xl text-xs font-bold text-center border transition cursor-pointer ${
                      amcType === 'NON_COMPREHENSIVE'
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-surface-2-app border-border-app text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Non-Comprehensive
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmcType('COMPREHENSIVE')}
                    className={`p-2 rounded-xl text-xs font-bold text-center border transition cursor-pointer ${
                      amcType === 'COMPREHENSIVE'
                        ? 'bg-purple-50 border-purple-500 text-purple-700'
                        : 'bg-surface-2-app border-border-app text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    Comprehensive
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Add Items From Catalogue */}
          <div className="bg-surface-app border border-border-app p-5 rounded-2xl shadow-xs space-y-3">
            <h3 className="text-xs font-black text-text-primary uppercase tracking-wider">
              Add Items From Catalogue
            </h3>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-text-secondary absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search catalogue services or parts..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-surface-2-app border border-border-app rounded-xl text-xs text-text-primary placeholder:text-text-secondary focus:outline-none"
              />
            </div>

            <div className="max-h-36 overflow-y-auto space-y-1.5 divide-y divide-border-app/40 pr-1">
              {products
                .filter((p) =>
                  productSearch ? p.name.toLowerCase().includes(productSearch.toLowerCase()) : true
                )
                .slice(0, 6)
                .map((p) => (
                  <div
                    key={p.id || (p as any)._id}
                    className="pt-2 first:pt-0 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-text-primary">{p.name}</span>
                      <span className="ml-2 text-text-secondary font-medium">
                        ₹{(p.defaultPriceMinor ? p.defaultPriceMinor / 100 : ((p as any).price || 0)).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddItemFromProduct(p)}
                      className="px-2.5 py-1 bg-surface-2-app hover:bg-border-app rounded-lg text-[11px] font-bold text-primary-700 border border-border-app transition cursor-pointer"
                    >
                      + Add Item
                    </button>
                  </div>
                ))}
            </div>
          </div>

          {/* 3. AMC Services & Line Items Table */}
          <div className="bg-surface-app border border-border-app p-5 rounded-2xl shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-text-primary uppercase tracking-wider">
                AMC Services & Items
              </h3>
              <button
                type="button"
                onClick={handleAddCustomItem}
                className="text-primary-700 hover:text-primary-800 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Custom Item</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-surface-2-app border border-border-app p-3 rounded-xl space-y-2"
                >
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Service Description (e.g. AC Water Servicing)"
                      value={item.description}
                      onChange={(e) => handleUpdateItem(idx, 'description', e.target.value)}
                      className="flex-1 bg-surface-app border border-border-app rounded-lg p-2 text-xs font-medium focus:outline-none"
                      required
                    />

                    <select
                      value={item.period || 'Quarterly'}
                      onChange={(e) => handleUpdateItem(idx, 'period', e.target.value)}
                      className="w-28 bg-surface-app border border-border-app rounded-lg p-2 text-xs font-medium focus:outline-none"
                    >
                      <option value="Monthly">Monthly</option>
                      <option value="Quarterly">Quarterly</option>
                      <option value="Bi-Monthly">Bi-Monthly</option>
                      <option value="Half-Yearly">Half-Yearly</option>
                      <option value="Annual">Annual</option>
                      <option value="On-Demand">On-Demand</option>
                    </select>

                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                      className="w-14 bg-surface-app border border-border-app rounded-lg p-2 text-xs text-center font-bold focus:outline-none"
                      required
                    />

                    <input
                      type="number"
                      min="0"
                      placeholder="Rate"
                      value={item.unitPrice}
                      onChange={(e) => handleUpdateItem(idx, 'unitPrice', e.target.value)}
                      className="w-20 bg-surface-app border border-border-app rounded-lg p-2 text-xs text-right font-medium focus:outline-none"
                      required
                    />

                    <div className="w-20 text-right font-black text-xs text-text-primary px-1">
                      ₹{item.amount.toLocaleString('en-IN')}
                    </div>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1.5 text-danger-app hover:bg-danger-soft rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Tax Selection */}
          <div className="bg-surface-app border border-border-app p-5 rounded-2xl shadow-xs space-y-2">
            <label className="block text-xs font-bold text-text-secondary">TAX SPECIFICATION</label>
            <select
              value={taxOption}
              onChange={(e) => setTaxOption(e.target.value as any)}
              className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-medium focus:outline-none"
            >
              <option value="NONE">No Tax (0%)</option>
              <option value="GST_18">18% GST (CGST 9% + SGST 9%)</option>
            </select>
          </div>

          {/* 5. Terms & Conditions (Replacing Payment Details as requested) */}
          <div className="bg-surface-app border border-border-app p-5 rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary-700" />
              <h3 className="text-xs font-black text-text-primary uppercase tracking-wider">
                Terms & Conditions (Replacing Payment Details)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  TERMS OF PAYMENT
                </label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-medium focus:outline-none"
                  placeholder="10 Days from the Invoice date"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  QUOTATION VALIDITY
                </label>
                <input
                  type="text"
                  value={validityDays}
                  onChange={(e) => setValidityDays(e.target.value)}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-medium focus:outline-none"
                  placeholder="30 Days from issuance"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-text-secondary">
                  CONTRACT TERMS & EXCLUSIONS
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setTermsList([...termsList, 'Additional mutually agreed term.'])
                  }
                  className="text-primary-700 hover:text-primary-800 text-[11px] font-bold cursor-pointer"
                >
                  + Add Term
                </button>
              </div>

              <div className="space-y-2">
                {termsList.map((term, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={term}
                      onChange={(e) => {
                        const updated = [...termsList];
                        updated[i] = e.target.value;
                        setTermsList(updated);
                      }}
                      className="flex-1 bg-surface-2-app border border-border-app rounded-xl p-2 text-xs text-text-primary focus:outline-none"
                    />
                    {termsList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setTermsList(termsList.filter((_, idx) => idx !== i))}
                        className="p-1 text-danger-app hover:bg-danger-soft rounded"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 6. Calculations Summary */}
          <div className="bg-surface-app border border-border-app p-5 rounded-2xl shadow-xs space-y-3">
            <div className="flex justify-between text-xs font-semibold text-text-secondary">
              <span>Subtotal:</span>
              <span className="text-text-primary font-bold">
                ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {taxAmount > 0 && (
              <div className="flex justify-between text-xs font-semibold text-text-secondary">
                <span>GST (18%):</span>
                <span className="text-text-primary font-bold">
                  ₹{taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <div className="flex justify-between text-base font-black text-text-primary border-t border-border-app pt-2">
              <span>Grand Total:</span>
              <span className="text-primary-700">
                ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <p className="text-[11px] text-text-secondary italic">
              Amount in words: <span className="font-bold text-text-primary">{amountInWords}</span>
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleSaveQuotation('DRAFT')}
                disabled={submitLoading}
                className="px-4 py-2.5 bg-surface-2-app hover:bg-border-app border border-border-app text-text-secondary rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => handleSaveQuotation('SENT')}
                disabled={submitLoading}
                className="px-5 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitLoading ? 'Saving...' : 'Finalize & Issue Quotation'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Quotation Preview (Matching Live Bill Preview) */}
        <div
          className={`${
            expandPreview ? 'col-span-12' : 'lg:col-span-5'
          } sticky top-6 space-y-3`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black tracking-wider text-text-secondary uppercase">
              LIVE QUOTATION PREVIEW
            </span>
            <button
              type="button"
              onClick={() => setExpandPreview(!expandPreview)}
              className="text-primary-700 hover:underline text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              {expandPreview ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span>Collapse Preview</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Expand A4</span>
                </>
              )}
            </button>
          </div>

          {/* Scaled A4 Sheet Container */}
          <div
            ref={previewContainerRef}
            className="w-full bg-surface-2-app/50 border border-border-app rounded-2xl p-2 sm:p-4 overflow-hidden flex justify-center shadow-inner"
          >
            <div
              style={{
                width: '794px',
                minHeight: '1123px',
                transform: `scale(${scale})`,
                transformOrigin: 'top center',
                marginBottom: `${-(1123 * (1 - scale))}px`,
              }}
              className="shadow-xl rounded bg-white shrink-0"
            >
              <AmcQuotationPaper
                quotation={{
                  quotationNumber: quotationNumber || 'DRAFT',
                  quotationDate,
                  paymentTerms,
                  validUntil: null,
                  quotationType: amcType,
                  amountInWords,
                  termsAndConditions: termsList,
                }}
                business={
                  business || {
                    name: 'JAY RAMJI ENTERPRISE',
                    address: { line1: 'Mundra Highway Road', city: 'Mundra', state: 'Gujarat' },
                    contact: { phone: '', email: '' },
                  }
                }
                customer={selectedCustomer}
                items={items}
                totals={{
                  subtotal,
                  taxTotal: taxAmount,
                  grandTotal,
                }}
                assets={activeAssets}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Inline Customer Modal */}
      {addCustomerOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-app border border-border-app rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border-app pb-3">
              <h3 className="text-sm font-black text-text-primary flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary-700" />
                <span>Quick Add Customer</span>
              </h3>
              <button
                type="button"
                onClick={() => setAddCustomerOpen(false)}
                className="text-text-secondary hover:text-text-primary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {customerErrorMsg && (
              <div className="p-3 bg-danger-soft text-danger-app text-xs rounded-xl font-medium">
                {customerErrorMsg}
              </div>
            )}

            <form onSubmit={handleCreateInlineCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Customer / Company Name *
                </label>
                <input
                  type="text"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2 text-xs text-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-secondary mb-1">
                    GSTIN (Optional)
                  </label>
                  <input
                    type="text"
                    value={customerForm.gstin}
                    onChange={(e) => setCustomerForm({ ...customerForm, gstin: e.target.value })}
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2 text-xs text-text-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-secondary mb-1">
                  Address Line
                </label>
                <input
                  type="text"
                  value={customerForm.line1}
                  onChange={(e) => setCustomerForm({ ...customerForm, line1: e.target.value })}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2 text-xs text-text-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddCustomerOpen(false)}
                  className="px-4 py-2 bg-surface-2-app hover:bg-border-app rounded-xl text-xs font-bold text-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={customerSubmitLoading}
                  className="px-5 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  {customerSubmitLoading ? 'Saving...' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
