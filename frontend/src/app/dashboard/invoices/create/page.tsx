'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '../../layout';
import { apiClient } from '../../../../lib/api/client';
import { Customer, Product } from '../../../../lib/api/types';
import InvoicePaper from '../components/InvoicePaper';


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
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'UNPAID'>('UNPAID');

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
      console.error('Error loading business profile or assets:', err);
    }
  }

  useEffect(() => {
    loadCustomers();
    loadProducts();
    loadBusinessAndAssets();
  }, [activeBusinessId]);

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

  // Debounced search trigger for customers
  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers(customerSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  // Debounced search trigger for services
  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts(productSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  // Append a product to line items list (defaults to section: ITEM unless p.type === 'SERVICE')
  function handleAddProduct(p: Product) {
    const section = p.type === 'SERVICE' ? 'LABOUR' : 'ITEM';
    const newItem: ItemInput = {
      productId: p.id || (p as any)._id,
      type: p.type,
      description: p.name,
      uom: p.uom || 'JOB',
      quantity: 1,
      unitPriceMinor: p.defaultPriceMinor,
      priceFloat: (p.defaultPriceMinor / 100).toFixed(2),
      section,
    };
    setItems((prev) => [...prev, newItem]);
    setProductSearch('');
  }

  // Add custom item under specific section
  const handleAddSectionItem = (section: 'ITEM' | 'LABOUR' | 'PART') => {
    const newItem: ItemInput = {
      productId: null,
      type: section === 'LABOUR' ? 'SERVICE' : 'PRODUCT',
      description: '',
      uom: 'JOB',
      quantity: 1,
      unitPriceMinor: 0,
      priceFloat: '0.00',
      section,
    };
    setItems((prev) => [...prev, newItem]);
  };

  // Update field of an item by its index in the main list
  function handleUpdateItem(index: number, updates: Partial<ItemInput>) {
    setItems((prev) => {
      const nextItems = [...prev];
      const target = nextItems[index];

      let unitPriceMinor = target.unitPriceMinor;
      if (updates.priceFloat !== undefined) {
        const parsed = parseFloat(updates.priceFloat);
        unitPriceMinor = isNaN(parsed) ? 0 : Math.round(parsed * 100);
      }

      nextItems[index] = {
        ...target,
        ...updates,
        unitPriceMinor,
      };
      return nextItems;
    });
  }

  function handleRemoveItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  // Query Server calculation preview on input adjustments
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
      customerId: selectedCustomerId || '600000000000000000000001',
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
      const newCustomer = await apiClient.createCustomer(payload);
      setCustomers((prev) => [newCustomer, ...prev]);
      const custId = newCustomer.id || (newCustomer as any)._id;
      setSelectedCustomerId(custId);
      setSelectedCustomer(newCustomer);
      setAddCustomerOpen(false);
    } catch (err: any) {
      setCustomerErrorMsg(err.message || 'Failed to create customer');
    } finally {
      setCustomerSubmitLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent, shouldFinalize: boolean) {
    e.preventDefault();
    if (!activeBusinessId) return;
    if (!selectedCustomerId) {
      setErrorMsg('Please select a customer for this invoice');
      return;
    }
    if (items.length === 0) {
      setErrorMsg('Please add at least one item, labour, or part to the invoice');
      return;
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
    };

    try {
      const createdInvoice = await apiClient.createInvoiceDraft(payload);
      const invoiceId = createdInvoice.id || (createdInvoice as any)._id;

      if (shouldFinalize) {
        router.push(`/dashboard/invoices/preview/${invoiceId}`);
      } else {
        router.push('/dashboard/invoices');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process invoice');
      setSubmitLoading(false);
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
          paymentTerms: 'IMMEDIATE BILLING',
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
          Quickly compile a new shopkeeper invoice, add line items/parts/labour, choose tax, and generate.
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
          <form className="space-y-6">
            
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
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <span className="absolute right-3.5 top-3 text-[8px] pointer-events-none">▼</span>
                  </div>
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search/filter customers..."
                    className="w-full mt-2 px-3 py-1 bg-surface-2-app border border-border-app rounded-md text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">
                    Invoice Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Section 1: ITEMS / SERVICES */}
            <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border-light pb-2">
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">
                  Items / Services
                </h3>
                <button
                  type="button"
                  onClick={() => handleAddSectionItem('ITEM')}
                  className="text-primary-700 hover:text-primary-800 text-xs font-bold cursor-pointer"
                >
                  + Add Item
                </button>
              </div>

              {/* Catalogue Search Selector */}
              <div className="relative">
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Quick search/select catalog products..."
                  className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary"
                />
                {productSearch.trim() && products.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-surface-app border border-border-app rounded-lg shadow-lg max-h-48 overflow-y-auto z-50 p-2">
                    {products.map((p) => (
                      <div
                        key={p.id || (p as any)._id}
                        onClick={() => handleAddProduct(p)}
                        className="p-2 hover:bg-surface-2-app text-xs flex justify-between cursor-pointer rounded-md text-text-primary"
                      >
                        <span className="font-semibold">{p.name}</span>
                        <span className="text-text-muted">₹{(p.defaultPriceMinor / 100).toFixed(2)} ({p.uom})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {items.filter(it => it.section === 'ITEM').length > 0 && (
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

            {/* Section 2: LABOUR (Optional) */}
            <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border-light pb-2">
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">
                  Labour
                </h3>
                <button
                  type="button"
                  onClick={() => handleAddSectionItem('LABOUR')}
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
                            placeholder="Labour description (e.g. Service Labour)"
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

            {/* Section 3: PARTS (Optional) */}
            <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border-light pb-2">
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">
                  Parts
                </h3>
                <button
                  type="button"
                  onClick={() => handleAddSectionItem('PART')}
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
                            placeholder="Part description"
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

            {/* Section 5: PAYMENT STATUS */}
            <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide border-b border-border-light pb-2">
                Payment Status
              </h3>
              <div className="flex space-x-4">
                <label className="inline-flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={paymentStatus === 'PAID'}
                    onChange={() => setPaymentStatus('PAID')}
                    className="h-4 w-4 text-primary-700 focus:ring-primary-600 cursor-pointer"
                  />
                  <span className="text-sm font-bold text-text-primary">Paid</span>
                </label>
                <label className="inline-flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={paymentStatus === 'UNPAID'}
                    onChange={() => setPaymentStatus('UNPAID')}
                    className="h-4 w-4 text-primary-700 focus:ring-primary-600 cursor-pointer"
                  />
                  <span className="text-sm font-bold text-text-primary">Unpaid</span>
                </label>
              </div>
            </div>

            {/* Calculations Summary & Save/Generate buttons */}
            <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide border-b border-border-light pb-2">
                Calculations Summary
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between font-semibold">
                  <span className="text-text-secondary">Items / Parts:</span>
                  <span className="text-text-primary">
                    ₹{items.filter((it: any) => it.section === 'ITEM' || it.section === 'PART').reduce((sum: number, it: any) => sum + (it.quantity * (parseFloat(it.priceFloat) || 0)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-text-secondary">Labour:</span>
                  <span className="text-text-primary">
                    ₹{items.filter((it: any) => it.section === 'LABOUR').reduce((sum: number, it: any) => sum + (it.quantity * (parseFloat(it.priceFloat) || 0)), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-text-secondary">Tax:</span>
                  <span className="text-text-primary">
                    ₹{(previewTotals ? previewTotals.taxTotalMinor / 100 : 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="border-t border-border-light pt-2 flex justify-between font-black text-sm text-text-primary">
                  <span>TOTAL:</span>
                  <span>
                    ₹{(previewTotals ? previewTotals.grandTotalMinor / 100 : items.reduce((sum: number, it: any) => sum + (it.quantity * (parseFloat(it.priceFloat) || 0)), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-border-light">
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, false)}
                  disabled={submitLoading || items.length === 0}
                  className="flex-1 text-center py-2.5 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-xl text-xs font-bold text-text-secondary cursor-pointer transition disabled:opacity-50"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, true)}
                  disabled={submitLoading || items.length === 0}
                  className="flex-1 text-center py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {submitLoading ? 'Saving...' : 'Preview & Finalize'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Right Column: Live A4 Bill Preview */}
        <div className="xl:col-span-5 space-y-6 xl:sticky xl:top-6">
          <div className="bg-surface-app border border-border-app p-4 rounded-xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border-light pb-2">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">
                  Live Bill Preview
                </h3>
                <span className="text-[10px] bg-primary-900/10 text-primary-700 px-2 py-0.5 rounded font-bold uppercase">
                  Draft Mode
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExpandPreview(true)}
                className="px-3 py-1 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-[10px] font-bold shadow-sm transition cursor-pointer"
              >
                Expand Preview
              </button>
            </div>

            <div ref={previewContainerRef} className="w-full relative overflow-hidden bg-surface-2-app/20 border border-border-app rounded-xl p-4 flex justify-center items-center">
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
                className="invoice-paper bg-white text-black border-[1.5px] border-black shadow-lg w-[210mm] min-h-[297mm] h-[297mm] box-border relative flex flex-col justify-between select-none"
              >
                {renderInvoicePaper()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Customer Modal Drawer */}
      {addCustomerOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-app border border-border-app p-6 rounded-2xl max-w-lg w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border-light pb-2">
              <h3 className="text-base font-bold text-text-primary">Create New Customer</h3>
              <button
                type="button"
                onClick={() => setAddCustomerOpen(false)}
                className="text-text-muted hover:text-text-primary font-bold text-xl cursor-pointer"
              >
                &times;
              </button>
            </div>

            {customerErrorMsg && (
              <div className="p-3 bg-danger-soft border border-danger-app/20 text-danger-app text-xs rounded-lg font-semibold">
                {customerErrorMsg}
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerForm.name}
                    onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                    placeholder="e.g. AON Engineers"
                    className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={customerForm.phone}
                      onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                      placeholder="e.g. +91 9876543210"
                      className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={customerForm.email}
                      onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                      placeholder="email@example.com"
                      className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none focus:border-border-focus"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wide border-b border-border-light pb-1">
                  Billing Address
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs text-text-secondary mb-1">Address Line 1</label>
                    <input
                      type="text"
                      value={customerForm.line1}
                      onChange={(e) => setCustomerForm({ ...customerForm, line1: e.target.value })}
                      placeholder="Street, Complex name, etc."
                      className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-text-secondary mb-1">Address Line 2</label>
                    <input
                      type="text"
                      value={customerForm.line2}
                      onChange={(e) => setCustomerForm({ ...customerForm, line2: e.target.value })}
                      placeholder="Floor, suite, building details"
                      className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">City</label>
                    <input
                      type="text"
                      value={customerForm.city}
                      onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })}
                      placeholder="City"
                      className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">State</label>
                    <input
                      type="text"
                      value={customerForm.state}
                      onChange={(e) => setCustomerForm({ ...customerForm, state: e.target.value })}
                      placeholder="State"
                      className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">Postal Code</label>
                    <input
                      type="text"
                      value={customerForm.postalCode}
                      onChange={(e) => setCustomerForm({ ...customerForm, postalCode: e.target.value })}
                      placeholder="PIN Code"
                      className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">GSTIN</label>
                    <input
                      type="text"
                      value={customerForm.gstin}
                      onChange={(e) => setCustomerForm({ ...customerForm, gstin: e.target.value })}
                      placeholder="15-character GSTIN"
                      className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-secondary mb-1">PAN</label>
                    <input
                      type="text"
                      value={customerForm.pan}
                      onChange={(e) => setCustomerForm({ ...customerForm, pan: e.target.value })}
                      placeholder="10-character PAN"
                      className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 border-t border-border-app pt-4">
                <button
                  type="button"
                  onClick={() => setAddCustomerOpen(false)}
                  className="px-4 py-2 bg-surface-2-app hover:bg-surface-app border border-border-app text-text-secondary rounded-lg text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={customerSubmitLoading}
                  className="px-5 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-sm font-semibold shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {customerSubmitLoading ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expand Preview Modal Overlay */}
      {expandPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 md:p-8 backdrop-blur-sm overflow-y-auto">
          <div className="bg-surface-app border border-border-app rounded-2xl w-full max-w-4xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between border-b border-border-light pb-3 mb-4 flex-wrap gap-2">
              <h3 className="text-base font-bold text-text-primary uppercase tracking-wider">
                Full Bill Preview
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-xs font-bold cursor-pointer transition"
                >
                  Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setExpandPreview(false)}
                  className="px-3 py-1.5 bg-surface-2-app hover:bg-surface-app border border-border-app text-text-secondary rounded-lg text-xs font-bold cursor-pointer transition"
                >
                  Close
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-4 flex justify-center bg-surface-2-app/30 border border-border-light rounded-xl">
              <div className="invoice-paper bg-white text-black border-[1.5px] border-black shadow-lg w-[210mm] min-h-[297mm] h-[297mm] box-border relative flex flex-col justify-between select-none">
                {renderInvoicePaper()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
