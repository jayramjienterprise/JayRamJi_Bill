'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDashboard } from '../../layout';
import { apiClient } from '../../../../lib/api/client';
import { Customer, Product, PaymentAccount, PaymentMethod, PaymentProof } from '../../../../lib/api/types';
import InvoicePaper from '../components/InvoicePaper';
import PaymentProofUploader from '../components/PaymentProofUploader';

interface ItemInput {
  productId: string | null;
  type: 'SERVICE' | 'PRODUCT';
  description: string;
  uom: string;
  quantity: number;
  unitPriceMinor: number;
  priceFloat: string; // user input representation
  section: 'ITEM' | 'LABOUR' | 'PART';
}

export default function CreateInvoicePage() {
  const router = useRouter();
  const { activeBusinessId } = useDashboard();

  // Master Data lists
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandPreview, setExpandPreview] = useState(false);
  const [scale, setScale] = useState(1);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Form Inputs
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [invoiceDate, setInvoiceDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [items, setItems] = useState<ItemInput[]>([]);
  const [taxOption, setTaxOption] = useState<'NONE' | 'EXCLUSIVE_18' | 'INCLUSIVE_18'>('NONE');

  // Payment Details states
  const [paymentStatus, setPaymentStatus] = useState<'UNPAID' | 'PAID' | 'PARTIAL'>('UNPAID');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [chequeNumber, setChequeNumber] = useState<string>('');
  const [chequeDate, setChequeDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [chequeBankName, setChequeBankName] = useState<string>('');
  const [paymentProof, setPaymentProof] = useState<PaymentProof | null>(null);
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  // Finalize Confirmation Modal
  const [confirmFinalizeOpen, setConfirmFinalizeOpen] = useState(false);

  // Calculated Totals from Server Preview API
  const [previewTotals, setPreviewTotals] = useState<any>(null);
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [amountInWords, setAmountInWords] = useState('');

  // Business & Assets metadata for Live Preview
  const [business, setBusiness] = useState<any>(null);
  const [activeAssets, setActiveAssets] = useState<{ logo: any; stamp: any; signature: any }>({
    logo: null,
    stamp: null,
    signature: null,
  });

  // Inline Customer Modal state
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [customerSubmitLoading, setCustomerSubmitLoading] = useState(false);
  const [customerErrorMsg, setCustomerErrorMsg] = useState<string | null>(null);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    gstin: '',
    pan: '',
  });

  // Load customer lists
  async function loadCustomers(search = '') {
    if (!activeBusinessId) return;
    try {
      const data = await apiClient.listCustomers({ active: true, search });
      setCustomers(data.customers);
      if (selectedCustomerId) {
        const found = data.customers.find((c) => c.id === selectedCustomerId || (c as any)._id === selectedCustomerId);
        if (found) setSelectedCustomer(found);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Load services catalogue
  async function loadProducts(search = '') {
    if (!activeBusinessId) return;
    try {
      const data = await apiClient.listProducts({ active: true, search });
      setProducts(data.products);
    } catch (err) {
      console.error(err);
    }
  }

  // Load active payment accounts
  async function loadPaymentAccounts() {
    if (!activeBusinessId) return;
    try {
      const accs = await apiClient.listPaymentAccounts({ active: true });
      setPaymentAccounts(accs || []);
    } catch (err) {
      console.error('Failed to load payment accounts:', err);
    }
  }

  // Load active business settings and branding assets for layout preview
  async function loadBusinessAndAssets() {
    if (!activeBusinessId) return;
    try {
      const bizRes: any = await apiClient.get('/business');
      setBusiness(bizRes.business);

      const assetsList = await apiClient.listAssets();
      const logo = assetsList.find((a) => a.type === 'LOGO' && a.active);
      const stamp = assetsList.find((a) => a.type === 'STAMP' && a.active);
      const signature = assetsList.find((a) => a.type === 'SIGNATURE' && a.active);
      setActiveAssets({ logo, stamp, signature });
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadCustomers();
    loadProducts();
    loadPaymentAccounts();
    loadBusinessAndAssets();
  }, [activeBusinessId]);

  // Sync grand total with payment amount when in PAID mode
  const currentGrandTotal = previewTotals ? (previewTotals.grandTotalMinor / 100) : 0;
  useEffect(() => {
    if (paymentStatus === 'PAID') {
      setPaymentAmount(currentGrandTotal > 0 ? currentGrandTotal.toFixed(2) : '');
    } else if (paymentStatus === 'UNPAID') {
      setPaymentAmount('');
    }
  }, [paymentStatus, currentGrandTotal]);

  // Auto-fit live A4 Paper scaling
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const containerWidth = entry.contentRect.width;
        const canonicalWidth = 794;
        const newScale = Math.min(1, containerWidth / canonicalWidth);
        setScale(newScale);
      }
    });
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, []);

  function handleAddItemFromProduct(product: Product, section: 'ITEM' | 'LABOUR' | 'PART' = 'ITEM') {
    const prodId = product.id || (product as any)._id;
    setItems((prev) => {
      const existingIdx = prev.findIndex(
        (it) =>
          (it.productId && prodId && it.productId === prodId && it.section === section) ||
          (it.description === product.name && it.section === section)
      );

      if (existingIdx !== -1) {
        const next = [...prev];
        const currentQty = Number(next[existingIdx].quantity) || 1;
        next[existingIdx] = {
          ...next[existingIdx],
          quantity: currentQty + 1,
        };
        return next;
      }

      const priceFloat = (product.defaultPriceMinor / 100).toFixed(2);
      return [
        ...prev,
        {
          productId: prodId,
          type: product.type || (section === 'LABOUR' ? 'SERVICE' : 'PRODUCT'),
          description: product.name,
          uom: product.uom || 'JOB',
          quantity: 1,
          unitPriceMinor: product.defaultPriceMinor,
          priceFloat,
          section,
        },
      ];
    });
  }

  function handleAddCustomItem(section: 'ITEM' | 'LABOUR' | 'PART' = 'ITEM') {
    setItems((prev) => [
      ...prev,
      {
        productId: null,
        type: section === 'LABOUR' ? 'SERVICE' : 'PRODUCT',
        description: '',
        uom: 'JOB',
        quantity: 1,
        unitPriceMinor: 0,
        priceFloat: '',
        section,
      },
    ]);
  }

  function handleUpdateItem(index: number, fields: Partial<ItemInput>) {
    setItems((prev) => {
      const next = [...prev];
      const current = { ...next[index], ...fields };

      if (fields.priceFloat !== undefined) {
        const parsed = parseFloat(fields.priceFloat);
        current.unitPriceMinor = isNaN(parsed) ? 0 : Math.round(parsed * 100);
      }

      next[index] = current;
      return next;
    });
  }

  function handleRemoveItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  // Real-time recalculation preview API trigger
  useEffect(() => {
    if (items.length === 0) {
      setPreviewTotals(null);
      setPreviewItems([]);
      setAmountInWords('');
      return;
    }

    let mappedTaxMode: 'NONE' | 'EXCLUSIVE' | 'INCLUSIVE' = 'NONE';
    let mappedTaxRateBps = 0;
    if (taxOption === 'EXCLUSIVE_18') {
      mappedTaxMode = 'EXCLUSIVE';
      mappedTaxRateBps = 1800;
    } else if (taxOption === 'INCLUSIVE_18') {
      mappedTaxMode = 'INCLUSIVE';
      mappedTaxRateBps = 1800;
    }

    const payload = {
      customerId: selectedCustomerId || null,
      invoiceDate,
      items: items.map((it) => ({
        productId: it.productId || null,
        type: it.type || 'PRODUCT',
        description: (it.description || '').trim() || 'Item',
        uom: (it.uom || 'JOB').trim(),
        quantity: Number(it.quantity) || 0,
        unitPriceMinor: Number(it.unitPriceMinor) || 0,
        section: it.section,
      })),
      taxMode: mappedTaxMode,
      defaultTaxRateBps: mappedTaxRateBps,
      discount: { type: 'NONE', value: 0 },
    };

    const timer = setTimeout(async () => {
      try {
        const calc = await apiClient.calculatePreview(payload);
        setPreviewTotals(calc.totals);
        setPreviewItems(calc.items);
        setAmountInWords(calc.amountInWords);
      } catch (err) {
        console.error('Real-time calculation error', err);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [items, taxOption, selectedCustomerId, invoiceDate]);

  function handleCustomerChange(customerId: string) {
    setSelectedCustomerId(customerId);
    const c = customers.find((cust) => cust.id === customerId || (cust as any)._id === customerId);
    setSelectedCustomer(c || null);
  }

  function openAddCustomerModal() {
    setCustomerForm({
      name: '',
      phone: '',
      email: '',
      line1: '',
      line2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
      gstin: '',
      pan: '',
    });
    setCustomerErrorMsg(null);
    setAddCustomerOpen(true);
  }

  async function handleCreateCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!activeBusinessId) return;
    setCustomerSubmitLoading(true);
    setCustomerErrorMsg(null);

    const payload = {
      name: customerForm.name.trim(),
      contact: {
        phone: customerForm.phone.trim() || null,
        email: customerForm.email.trim() || null,
      },
      address: {
        line1: customerForm.line1.trim() || null,
        line2: customerForm.line2.trim() || null,
        city: customerForm.city.trim() || null,
        state: customerForm.state.trim() || null,
        postalCode: customerForm.postalCode.trim() || null,
        country: customerForm.country,
      },
      taxProfile: {
        gstin: customerForm.gstin.trim() || null,
        pan: customerForm.pan.trim() || null,
      },
      notes: null,
    };

    try {
      const created = await apiClient.createCustomer(payload);
      await loadCustomers();
      setSelectedCustomerId(created.id || (created as any)._id);
      setSelectedCustomer(created);
      setAddCustomerOpen(false);
    } catch (err: any) {
      setCustomerErrorMsg(err.message || 'Failed creating customer');
    } finally {
      setCustomerSubmitLoading(false);
    }
  }

  // Filter accounts for selected payment method
  const matchingAccounts = paymentAccounts.filter((a) => {
    if (paymentMethod === 'UPI' || paymentMethod === 'QR_CODE') return a.type === 'UPI';
    if (paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'CHEQUE') return a.type === 'BANK';
    if (paymentMethod === 'CASH') return a.type === 'CASH';
    return false;
  });

  const selectedAccount = paymentAccounts.find((a) => a.id === selectedAccountId || (a as any)._id === selectedAccountId);

  // Compute live Payment Summary
  const invoiceTotalRupees = currentGrandTotal;
  const paymentNowRupees = paymentStatus === 'PAID'
    ? invoiceTotalRupees
    : paymentStatus === 'PARTIAL'
    ? (parseFloat(paymentAmount) || 0)
    : 0;
  const outstandingRupees = Math.max(0, invoiceTotalRupees - paymentNowRupees);

  // Validate and submit invoice (Draft or Finalize)
  async function handleSubmit(e?: React.FormEvent, shouldFinalize: boolean = false) {
    if (e) e.preventDefault();
    if (!activeBusinessId) return;
    if (!selectedCustomerId) {
      setErrorMsg('Please select a customer for this invoice');
      return;
    }
    if (items.length === 0) {
      setErrorMsg('Please add at least one item, labour, or part to the invoice');
      return;
    }

    // Payment validation if Paid or Partial
    if (paymentStatus === 'PARTIAL') {
      const pAmount = parseFloat(paymentAmount);
      if (isNaN(pAmount) || pAmount <= 0) {
        setErrorMsg('Please enter a valid partial payment amount greater than ₹0');
        return;
      }
      if (pAmount >= invoiceTotalRupees) {
        setErrorMsg(`Partial payment amount ₹${pAmount.toFixed(2)} must be less than invoice total ₹${invoiceTotalRupees.toFixed(2)}. For full payment, select 'Paid'.`);
        return;
      }
    }

    if (paymentStatus === 'PAID' || paymentStatus === 'PARTIAL') {
      if ((paymentMethod === 'UPI' || paymentMethod === 'QR_CODE') && !selectedAccountId) {
        setErrorMsg('Please select a receiving UPI account');
        return;
      }
      if ((paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'CHEQUE') && !selectedAccountId) {
        setErrorMsg('Please select a receiving / deposit bank account');
        return;
      }
      if (paymentMethod === 'CHEQUE' && !chequeNumber.trim()) {
        setErrorMsg('Please enter the cheque number');
        return;
      }
    }

    setSubmitLoading(true);
    setErrorMsg(null);

    let mappedTaxMode: 'NONE' | 'EXCLUSIVE' | 'INCLUSIVE' = 'NONE';
    let mappedTaxRateBps = 0;
    if (taxOption === 'EXCLUSIVE_18') {
      mappedTaxMode = 'EXCLUSIVE';
      mappedTaxRateBps = 1800;
    } else if (taxOption === 'INCLUSIVE_18') {
      mappedTaxMode = 'INCLUSIVE';
      mappedTaxRateBps = 1800;
    }

    // Structure payment payload
    let paymentPayload: any = null;
    if (paymentStatus === 'PAID' || paymentStatus === 'PARTIAL') {
      paymentPayload = {
        status: paymentStatus,
        amount: paymentNowRupees,
        amountMinor: Math.round(paymentNowRupees * 100),
        method: paymentMethod,
        paymentAccountId: selectedAccountId || null,
        paymentDate,
        paidAt: paymentDate ? new Date(paymentDate).toISOString() : undefined,
        referenceNumber: referenceNumber.trim() || undefined,
        chequeDetails: paymentMethod === 'CHEQUE' ? {
          chequeNumber: chequeNumber.trim(),
          chequeDate: chequeDate ? new Date(chequeDate).toISOString() : undefined,
          bankName: chequeBankName.trim() || undefined,
        } : undefined,
        proof: paymentProof || undefined,
        notes: paymentNotes.trim() || undefined,
      };
    }

    const payload = {
      customerId: selectedCustomerId,
      invoiceDate,
      items: items.map((it) => ({
        productId: it.productId || null,
        type: it.type || 'PRODUCT',
        description: (it.description || '').trim(),
        uom: (it.uom || 'JOB').trim(),
        quantity: Number(it.quantity) || 0,
        unitPriceMinor: Number(it.unitPriceMinor) || 0,
        section: it.section,
      })),
      taxMode: mappedTaxMode,
      defaultTaxRateBps: mappedTaxRateBps,
      discount: { type: 'NONE', value: 0 },
      paymentTerms: undefined,
      notes: undefined,
      paymentStatus,
      payment: paymentPayload,
    };

    try {
      const createdInvoice = await apiClient.createInvoiceDraft(payload);
      const invoiceId = createdInvoice.id || (createdInvoice as any)._id;

      if (shouldFinalize) {
        // Finalize invoice atomically with the initial payment payload!
        await apiClient.finalizeInvoice(invoiceId, { payment: paymentPayload });
        router.push(`/dashboard/invoices/detail/${invoiceId}`);
      } else {
        router.push(`/dashboard/invoices/preview/${invoiceId}`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process invoice');
      setSubmitLoading(false);
      setConfirmFinalizeOpen(false);
    }
  }

  function renderInvoicePaper() {
    const formattedPreviewItems = previewItems.map((it: any) => ({
      description: it.description,
      quantity: it.quantity,
      unitPrice: (it.unitPriceMinor || 0) / 100,
      amount: ((it.quantity || 0) * (it.unitPriceMinor || 0)) / 100,
      type: it.type,
    }));

    const partsTotal = formattedPreviewItems.filter((it: any) => it.type === 'PRODUCT').reduce((sum: number, it: any) => sum + it.amount, 0);
    const laborTotal = formattedPreviewItems.filter((it: any) => it.type === 'SERVICE').reduce((sum: number, it: any) => sum + it.amount, 0);
    const taxTotal = (previewTotals ? previewTotals.taxTotalMinor / 100 : 0);
    const grandTotal = (previewTotals ? previewTotals.grandTotalMinor / 100 : (partsTotal + laborTotal + taxTotal));
    const rounding = grandTotal - (partsTotal + laborTotal + taxTotal);

    return (
      <InvoicePaper
        invoice={{
          invoiceNumber: 'DRAFT',
          invoiceDate: invoiceDate || new Date(),
          paymentTerms: business?.invoiceSettings?.defaultPaymentTerms || 'Within 15 days clear payment',
          amountInWords: amountInWords || 'Zero Rupees Only',
        }}
        business={business as any}
        customer={selectedCustomer || { name: 'Customer Name', address: { line1: 'Customer Address' } }}
        items={formattedPreviewItems}
        totals={{
          partsTotal,
          laborTotal,
          discount: 0,
          taxTotal,
          rounding,
          grandTotal,
          subtotal: partsTotal + laborTotal,
        }}
        assets={activeAssets}
        isDraft={true}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Create Bill</h1>
        <p className="text-xs text-text-secondary mt-1">
          Compile a new shopkeeper invoice, add line items/parts/labour, choose tax, and specify payment details.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-danger-soft border border-danger-app/20 text-danger-app text-sm rounded-lg font-medium">
          {errorMsg}
        </div>
      )}

      {/* Responsive layout: left column for inputs, right column for live preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Inputs */}
        <div className="xl:col-span-7 space-y-6">
          <div className="space-y-6">
            
            {/* Customer & Date */}
            <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-text-secondary uppercase">
                      Customer *
                    </label>
                    <button
                      type="button"
                      onClick={openAddCustomerModal}
                      className="text-primary-700 hover:text-primary-800 text-xs font-bold cursor-pointer"
                    >
                      + Add Customer
                    </button>
                  </div>
                  <div className="relative">
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => handleCustomerChange(e.target.value)}
                      required
                      className="w-full pl-3 pr-8 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none appearance-none cursor-pointer font-semibold"
                    >
                      <option value="">-- Choose Customer --</option>
                      {customers.map((c) => (
                        <option key={c.id || (c as any)._id} value={c.id || (c as any)._id}>
                          {c.name} {c.contact?.phone ? `(${c.contact.phone})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">
                    Invoice Date *
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Quick Product Search / Catalogue Selector */}
            <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide border-b border-border-light pb-2">
                Add Items from Catalogue
              </h3>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search catalogue items or service jobs..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none"
                />
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1 divide-y divide-border-light">
                {products
                  .filter((p) => p.name.toLowerCase().includes(productSearch.toLowerCase()))
                  .map((p) => (
                    <div key={p.id || (p as any)._id} className="pt-1.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-text-primary">{p.name}</span>
                        <span className="text-text-secondary ml-2">₹{(p.defaultPriceMinor / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          type="button"
                          onClick={() => handleAddItemFromProduct(p, 'ITEM')}
                          className="px-2 py-1 bg-surface-2-app hover:bg-surface-app border border-border-app rounded text-[10px] font-bold text-text-primary cursor-pointer"
                        >
                          + Item
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddItemFromProduct(p, 'LABOUR')}
                          className="px-2 py-1 bg-surface-2-app hover:bg-surface-app border border-border-app rounded text-[10px] font-bold text-text-primary cursor-pointer"
                        >
                          + Labour
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddItemFromProduct(p, 'PART')}
                          className="px-2 py-1 bg-surface-2-app hover:bg-surface-app border border-border-app rounded text-[10px] font-bold text-text-primary cursor-pointer"
                        >
                          + Part
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Section 1: Main Items */}
            <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border-light pb-2">
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">
                  Items / Products
                </h3>
                <button
                  type="button"
                  onClick={() => handleAddCustomItem('ITEM')}
                  className="text-primary-700 hover:text-primary-800 text-xs font-bold cursor-pointer"
                >
                  + Add Custom Item
                </button>
              </div>

              {items.filter(it => it.section === 'ITEM').length === 0 ? (
                <p className="text-xs text-text-muted italic py-2">No main items added.</p>
              ) : (
                <div className="space-y-3">
                  {items.map((it, idx) => {
                    if (it.section !== 'ITEM') return null;
                    return (
                      <div key={idx} className="grid grid-cols-12 gap-3 items-center bg-surface-2-app/20 p-3 rounded-lg border border-border-app">
                        <div className="col-span-6">
                          <input
                            type="text"
                            placeholder="Description"
                            value={it.description}
                            onChange={(e) => handleUpdateItem(idx, { description: e.target.value })}
                            className="w-full px-2 py-1 bg-surface-app border border-border-app rounded text-sm font-semibold"
                            required
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            placeholder="Qty"
                            value={it.quantity || ''}
                            onChange={(e) => handleUpdateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1 bg-surface-app border border-border-app rounded text-sm text-center font-semibold"
                            required
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number"
                            placeholder="Price"
                            value={it.priceFloat || ''}
                            onChange={(e) => handleUpdateItem(idx, { priceFloat: e.target.value })}
                            className="w-full px-2 py-1 bg-surface-app border border-border-app rounded text-sm text-right font-semibold"
                            required
                          />
                        </div>
                        <div className="col-span-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-danger-app hover:text-danger-app/80 font-bold text-base cursor-pointer"
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 2: LABOUR */}
            <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border-light pb-2">
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">
                  Labour / Service
                </h3>
                <button
                  type="button"
                  onClick={() => handleAddCustomItem('LABOUR')}
                  className="text-primary-700 hover:text-primary-800 text-xs font-bold cursor-pointer"
                >
                  + Add Labour
                </button>
              </div>

              {items.filter(it => it.section === 'LABOUR').length > 0 && (
                <div className="space-y-3">
                  {items.map((it, idx) => {
                    if (it.section !== 'LABOUR') return null;
                    return (
                      <div key={idx} className="grid grid-cols-12 gap-3 items-center bg-surface-2-app/20 p-3 rounded-lg border border-border-app">
                        <div className="col-span-8">
                          <input
                            type="text"
                            placeholder="Labour description (e.g. AC Service Labour)"
                            value={it.description}
                            onChange={(e) => handleUpdateItem(idx, { description: e.target.value })}
                            className="w-full px-2 py-1 bg-surface-app border border-border-app rounded text-sm font-semibold"
                            required
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number"
                            placeholder="Amount"
                            value={it.priceFloat || ''}
                            onChange={(e) => handleUpdateItem(idx, { priceFloat: e.target.value })}
                            className="w-full px-2 py-1 bg-surface-app border border-border-app rounded text-sm text-right font-semibold"
                            required
                          />
                        </div>
                        <div className="col-span-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-danger-app hover:text-danger-app/80 font-bold text-base cursor-pointer"
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 3: PARTS */}
            <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border-light pb-2">
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">
                  Parts
                </h3>
                <button
                  type="button"
                  onClick={() => handleAddCustomItem('PART')}
                  className="text-primary-700 hover:text-primary-800 text-xs font-bold cursor-pointer"
                >
                  + Add Part
                </button>
              </div>

              {items.filter(it => it.section === 'PART').length > 0 && (
                <div className="space-y-3">
                  {items.map((it, idx) => {
                    if (it.section !== 'PART') return null;
                    return (
                      <div key={idx} className="grid grid-cols-12 gap-3 items-center bg-surface-2-app/20 p-3 rounded-lg border border-border-app">
                        <div className="col-span-6">
                          <input
                            type="text"
                            placeholder="Part description (e.g. Copper Pipe 1/2 inch)"
                            value={it.description}
                            onChange={(e) => handleUpdateItem(idx, { description: e.target.value })}
                            className="w-full px-2 py-1 bg-surface-app border border-border-app rounded text-sm font-semibold"
                            required
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            placeholder="Qty"
                            value={it.quantity || ''}
                            onChange={(e) => handleUpdateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1 bg-surface-app border border-border-app rounded text-sm text-center font-semibold"
                            required
                          />
                        </div>
                        <div className="col-span-3">
                          <input
                            type="number"
                            placeholder="Price"
                            value={it.priceFloat || ''}
                            onChange={(e) => handleUpdateItem(idx, { priceFloat: e.target.value })}
                            className="w-full px-2 py-1 bg-surface-app border border-border-app rounded text-sm text-right font-semibold"
                            required
                          />
                        </div>
                        <div className="col-span-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-danger-app hover:text-danger-app/80 font-bold text-base cursor-pointer"
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 4: TAX */}
            <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide border-b border-border-light pb-2">
                Tax
              </h3>
              <div className="max-w-xs">
                <select
                  value={taxOption}
                  onChange={(e) => setTaxOption(e.target.value as any)}
                  className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none cursor-pointer font-semibold"
                >
                  <option value="NONE">No Tax</option>
                  <option value="EXCLUSIVE_18">GST 18% (Exclusive)</option>
                  <option value="INCLUSIVE_18">GST 18% (Inclusive)</option>
                </select>
              </div>
            </div>

            {/* Section 5: PAYMENT DETAILS (New Extended Design) */}
            <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm space-y-5">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide border-b border-border-light pb-2">
                Payment Details
              </h3>

              {/* 1. Payment Status Selector (Unpaid / Paid / Partial) */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase mb-2">
                  Payment Status
                </label>
                <div className="flex space-x-6">
                  <label className="inline-flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentStatusRadio"
                      checked={paymentStatus === 'UNPAID'}
                      onChange={() => setPaymentStatus('UNPAID')}
                      className="h-4 w-4 text-primary-700 focus:ring-primary-600 cursor-pointer"
                    />
                    <span className="text-sm font-bold text-text-primary">○ Unpaid</span>
                  </label>
                  <label className="inline-flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentStatusRadio"
                      checked={paymentStatus === 'PAID'}
                      onChange={() => setPaymentStatus('PAID')}
                      className="h-4 w-4 text-primary-700 focus:ring-primary-600 cursor-pointer"
                    />
                    <span className="text-sm font-bold text-text-primary">● Paid</span>
                  </label>
                  <label className="inline-flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentStatusRadio"
                      checked={paymentStatus === 'PARTIAL'}
                      onChange={() => setPaymentStatus('PARTIAL')}
                      className="h-4 w-4 text-primary-700 focus:ring-primary-600 cursor-pointer"
                    />
                    <span className="text-sm font-bold text-text-primary">◐ Partial</span>
                  </label>
                </div>
              </div>

              {/* Conditional Rendering: Only show payment fields if Paid or Partial */}
              {(paymentStatus === 'PAID' || paymentStatus === 'PARTIAL') && (
                <div className="space-y-4 pt-3 border-t border-border-light text-xs">
                  
                  {/* Payment Amount & Method */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-text-secondary font-bold uppercase tracking-wider mb-1">
                        Payment Amount (₹) <span className="text-danger-app">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={paymentStatus === 'PARTIAL' ? invoiceTotalRupees - 0.01 : invoiceTotalRupees}
                        required
                        disabled={paymentStatus === 'PAID'}
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder={paymentStatus === 'PAID' ? `₹${invoiceTotalRupees.toFixed(2)}` : 'Enter amount'}
                        className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-lg text-sm font-bold text-text-primary focus:outline-none focus:border-primary-700"
                      />
                      {paymentStatus === 'PARTIAL' && (
                        <p className="text-[10px] text-text-muted mt-1">
                          Must be greater than ₹0 and less than ₹{invoiceTotalRupees.toFixed(2)}.
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-text-secondary font-bold uppercase tracking-wider mb-1">
                        Payment Method <span className="text-danger-app">*</span>
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => {
                          const m = e.target.value as PaymentMethod;
                          setPaymentMethod(m);
                          const matching = paymentAccounts.filter((a) => {
                            if (m === 'UPI' || m === 'QR_CODE') return a.type === 'UPI';
                            if (m === 'BANK_TRANSFER' || m === 'CHEQUE') return a.type === 'BANK';
                            if (m === 'CASH') return a.type === 'CASH';
                            return false;
                          });
                          setSelectedAccountId(matching.length > 0 ? (matching[0].id || (matching[0] as any)._id) : '');
                        }}
                        className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-lg text-sm font-bold text-text-primary focus:outline-none cursor-pointer"
                      >
                        <option value="CASH">CASH</option>
                        <option value="UPI">UPI</option>
                        <option value="QR_CODE">QR CODE</option>
                        <option value="BANK_TRANSFER">BANK TRANSFER</option>
                        <option value="CHEQUE">CHEQUE</option>
                      </select>
                    </div>
                  </div>

                  {/* Dynamic Receiving Account */}
                  {(paymentMethod === 'UPI' || paymentMethod === 'QR_CODE' || paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'CHEQUE') && (
                    <div className="bg-surface-2-app/40 p-3.5 rounded-xl border border-border-app space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="block text-text-secondary font-bold uppercase text-[10.5px]">
                          {paymentMethod === 'CHEQUE' ? 'Deposit Bank Account' : 'Receiving Account'}{' '}
                          <span className="text-danger-app">*</span>
                        </label>
                        <Link
                          href="/dashboard/settings/payment-accounts"
                          target="_blank"
                          className="text-[10px] text-primary-700 hover:underline font-bold"
                        >
                          + Manage Accounts
                        </Link>
                      </div>

                      {matchingAccounts.length === 0 ? (
                        <div className="p-2.5 bg-warning-soft border border-warning-app/20 text-warning-app text-xs rounded-lg font-medium">
                          No active {paymentMethod === 'UPI' || paymentMethod === 'QR_CODE' ? 'UPI' : 'Bank'} accounts found. Please add one in{' '}
                          <Link href="/dashboard/settings/payment-accounts" target="_blank" className="underline font-bold">
                            Settings → Payment Accounts
                          </Link>.
                        </div>
                      ) : (
                        <select
                          required
                          value={selectedAccountId}
                          onChange={(e) => setSelectedAccountId(e.target.value)}
                          className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-lg text-xs font-bold text-text-primary focus:outline-none cursor-pointer"
                        >
                          <option value="">-- Select Receiving Account --</option>
                          {matchingAccounts.map((acc) => (
                            <option key={acc.id || (acc as any)._id} value={acc.id || (acc as any)._id}>
                              {acc.displayName || acc.name}
                            </option>
                          ))}
                        </select>
                      )}

                      {/* Small QR preview if QR_CODE selected */}
                      {paymentMethod === 'QR_CODE' && selectedAccount?.qrAssetUrl && (
                        <div className="p-2.5 bg-white rounded-lg border border-border-app flex items-center space-x-3 mt-2">
                          <img src={selectedAccount.qrAssetUrl} alt="UPI QR" className="w-16 h-16 object-contain rounded border border-gray-200 shadow-xs" />
                          <div>
                            <p className="text-[10px] font-bold text-gray-800 uppercase">Customer Scan QR</p>
                            <p className="text-[11px] font-mono font-bold text-gray-700">{selectedAccount.upiId}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Cheque Specific Fields */}
                  {paymentMethod === 'CHEQUE' && (
                    <div className="bg-surface-2-app/40 p-3.5 rounded-xl border border-border-app space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-text-secondary font-bold mb-1">
                            Cheque Number <span className="text-danger-app">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. 000123"
                            value={chequeNumber}
                            onChange={(e) => setChequeNumber(e.target.value)}
                            className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-xs font-mono font-bold text-text-primary focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-text-secondary font-bold mb-1">Cheque Date</label>
                          <input
                            type="date"
                            value={chequeDate}
                            onChange={(e) => setChequeDate(e.target.value)}
                            className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-xs text-text-primary focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-text-secondary font-bold mb-1">Issuing Bank Name (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. State Bank of India"
                          value={chequeBankName}
                          onChange={(e) => setChequeBankName(e.target.value)}
                          className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-xs text-text-primary focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Payment Date & Reference */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-text-secondary font-bold mb-1">
                        Payment Date <span className="text-danger-app">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-lg text-xs font-semibold text-text-primary focus:outline-none"
                      />
                    </div>

                    {(paymentMethod === 'UPI' || paymentMethod === 'QR_CODE' || paymentMethod === 'BANK_TRANSFER') && (
                      <div>
                        <label className="block text-text-secondary font-bold mb-1">
                          {paymentMethod === 'BANK_TRANSFER' ? 'Bank Ref / UTR #' : 'UPI / Transaction Reference'} (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 12-digit UTR or Reference ID"
                          value={referenceNumber}
                          onChange={(e) => setReferenceNumber(e.target.value)}
                          className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-lg text-xs font-mono text-text-primary focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Payment Proof Uploader (Device Upload + Phone QR Upload) */}
                  <PaymentProofUploader
                    proof={paymentProof}
                    onProofChange={setPaymentProof}
                    metadata={{
                      invoiceNumber: 'Draft Bill',
                      amountMinor: Math.round(paymentNowRupees * 100),
                      method: paymentMethod,
                      customerName: selectedCustomer?.name,
                    }}
                  />

                  {/* Notes */}
                  <div>
                    <label className="block text-text-secondary font-bold mb-1">Payment Notes (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Paid at counter upon vehicle handover"
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-2-app border border-border-app rounded-lg text-xs text-text-primary focus:outline-none"
                    />
                  </div>

                  {/* Live Payment Summary Card */}
                  <div className="bg-surface-2-app/60 border border-border-app rounded-xl p-4 space-y-2 mt-3">
                    <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      Payment Summary
                    </h4>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">Invoice Total:</span>
                      <span className="font-bold text-text-primary">
                        ₹{invoiceTotalRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-secondary">Payment Now:</span>
                      <span className="font-bold text-success-app">
                        ₹{paymentNowRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs border-t border-border-light pt-1.5 font-bold">
                      <span className="text-text-primary">Outstanding Due:</span>
                      <span className="text-danger-app font-black">
                        ₹{outstandingRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                </div>
              )}
            </div>

            {/* Calculations Summary & Save/Generate buttons */}
            <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide border-b border-border-light pb-2">
                Calculations Summary
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between font-semibold">
                  <span className="text-text-secondary">Subtotal (Items + Labour + Parts):</span>
                  <span className="text-text-primary">
                    ₹{(previewTotals ? previewTotals.subtotalMinor / 100 : 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {previewTotals && previewTotals.taxTotalMinor > 0 && (
                  <div className="flex justify-between font-semibold text-primary-700">
                    <span>Tax Total (GST 18%):</span>
                    <span>₹{(previewTotals.taxTotalMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                {previewTotals && previewTotals.roundingMinor !== 0 && (
                  <div className="flex justify-between text-text-muted">
                    <span>Rounding Offset:</span>
                    <span>₹{(previewTotals.roundingMinor / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black text-text-primary border-t border-border-light pt-2">
                  <span>Grand Total:</span>
                  <span>₹{invoiceTotalRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {amountInWords && (
                  <p className="text-[11px] text-text-muted italic pt-1 font-serif">
                    {amountInWords}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4 border-t border-border-light">
                <button
                  type="button"
                  disabled={submitLoading}
                  onClick={(e) => handleSubmit(e, false)}
                  className="flex-1 py-2.5 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-xl font-bold text-text-primary text-xs shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={submitLoading || items.length === 0 || !selectedCustomerId}
                  onClick={() => setConfirmFinalizeOpen(true)}
                  className="flex-1 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl font-bold text-xs shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  Finalize & Issue Bill
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Right Column: Live A4 Visual Preview */}
        <div className="xl:col-span-5 space-y-4">
          <div className="bg-surface-app border border-border-app p-4 rounded-xl shadow-sm flex items-center justify-between">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wide">
              Live Bill Preview
            </h3>
            <button
              type="button"
              onClick={() => setExpandPreview(!expandPreview)}
              className="text-xs text-primary-700 hover:underline font-bold cursor-pointer"
            >
              {expandPreview ? 'Collapse' : 'Expand A4'}
            </button>
          </div>

          <div
            ref={previewContainerRef}
            className="w-full relative overflow-hidden flex justify-center items-start bg-surface-2-app/10 p-4 border border-border-app rounded-2xl"
          >
            <div
              style={{
                transform: `scale(${scale})`,
                transformOrigin: 'top center',
                width: '794px',
                height: '1123px',
                minWidth: '794px',
                minHeight: '1123px',
                marginBottom: `${(scale - 1) * 1123}px`
              }}
              className="invoice-paper bg-white text-black border-[1.5px] border-black shadow-2xl w-[210mm] min-h-[297mm] h-[297mm] box-border relative flex flex-col justify-between select-none"
            >
              {renderInvoicePaper()}
            </div>
          </div>
        </div>
      </div>

      {/* Finalize Confirmation Modal */}
      {confirmFinalizeOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-app border border-border-app p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-light pb-2">
              <h3 className="text-base font-bold text-text-primary">Confirm Invoice Finalization</h3>
              <button
                type="button"
                onClick={() => setConfirmFinalizeOpen(false)}
                className="text-text-muted hover:text-text-primary font-bold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-text-primary font-semibold text-sm">
                {paymentStatus === 'PAID' && (
                  <>Record <strong>₹{invoiceTotalRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> full payment and finalize this invoice?</>
                )}
                {paymentStatus === 'PARTIAL' && (
                  <>Record <strong>₹{paymentNowRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> partial payment (Remaining: ₹{outstandingRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}) and finalize this invoice?</>
                )}
                {paymentStatus === 'UNPAID' && (
                  <>Finalize this invoice as <strong>UNPAID</strong> (Total Due: ₹{invoiceTotalRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })})?</>
                )}
              </p>
              <p className="text-text-muted text-[11px]">
                Once finalized, the invoice will receive an official consecutive invoice sequence number and become immutable.
              </p>
            </div>

            <div className="flex space-x-3 pt-3 border-t border-border-app">
              <button
                type="button"
                onClick={() => setConfirmFinalizeOpen(false)}
                className="flex-1 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-lg font-bold text-text-secondary cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitLoading}
                onClick={() => handleSubmit(undefined, true)}
                className="flex-1 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                {submitLoading ? 'Finalizing...' : 'Confirm & Finalize'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Add Customer Modal */}
      {addCustomerOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-app border border-border-app p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border-light pb-2">
              <h3 className="text-base font-bold text-text-primary">Add New Customer</h3>
              <button
                type="button"
                onClick={() => setAddCustomerOpen(false)}
                className="text-text-muted hover:text-text-primary font-bold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            {customerErrorMsg && (
              <div className="p-3 bg-danger-soft border border-danger-app/20 text-danger-app text-xs rounded-lg font-medium">
                {customerErrorMsg}
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block text-text-secondary font-semibold mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  className="w-full px-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-text-primary focus:outline-none font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-text-secondary font-semibold mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={customerForm.phone}
                    onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                    className="w-full px-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-text-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    value={customerForm.email}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                    className="w-full px-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-text-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-text-secondary font-semibold mb-1">Address Line 1</label>
                <input
                  type="text"
                  value={customerForm.line1}
                  onChange={(e) => setCustomerForm({ ...customerForm, line1: e.target.value })}
                  className="w-full px-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-text-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-text-secondary font-semibold mb-1">City</label>
                  <input
                    type="text"
                    value={customerForm.city}
                    onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })}
                    className="w-full px-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-text-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary font-semibold mb-1">State</label>
                  <input
                    type="text"
                    value={customerForm.state}
                    onChange={(e) => setCustomerForm({ ...customerForm, state: e.target.value })}
                    className="w-full px-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-text-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-text-secondary font-semibold mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={customerForm.gstin}
                    onChange={(e) => setCustomerForm({ ...customerForm, gstin: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-text-primary focus:outline-none uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary font-semibold mb-1">PAN</label>
                  <input
                    type="text"
                    value={customerForm.pan}
                    onChange={(e) => setCustomerForm({ ...customerForm, pan: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-text-primary focus:outline-none uppercase font-mono"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-3 border-t border-border-app">
                <button
                  type="button"
                  onClick={() => setAddCustomerOpen(false)}
                  className="flex-1 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-lg font-bold text-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={customerSubmitLoading}
                  className="flex-1 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {customerSubmitLoading ? 'Saving...' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
