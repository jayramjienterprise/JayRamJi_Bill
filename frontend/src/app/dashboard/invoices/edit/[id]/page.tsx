'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboard } from '../../../layout';
import { apiClient } from '../../../../../lib/api/client';
import { Customer, Product, Invoice } from '../../../../../lib/api/types';

interface ItemInput {
  productId: string | null;
  type: 'SERVICE' | 'PRODUCT';
  description: string;
  uom: string;
  quantity: number;
  unitPriceMinor: number;
  priceFloat: string;
}

export default function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { activeBusinessId } = useDashboard();
  const { id } = use(params);

  // Master Data lists
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [editable, setEditable] = useState(true);

  // Form Inputs
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [items, setItems] = useState<ItemInput[]>([]);
  const [taxMode, setTaxMode] = useState<'NONE' | 'EXCLUSIVE' | 'INCLUSIVE'>('NONE');
  const [taxRateBps, setTaxRateBps] = useState(0);
  const [discountType, setDiscountType] = useState<'NONE' | 'FIXED' | 'PERCENTAGE'>('NONE');
  const [discountVal, setDiscountVal] = useState('0');
  const [notes, setNotes] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');

  // Calculated Totals from Server Preview API
  const [previewTotals, setPreviewTotals] = useState<any>(null);
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [amountInWords, setAmountInWords] = useState('');

  // Fetch invoice details on load
  async function loadInvoiceData() {
    if (!id || !activeBusinessId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const inv = await apiClient.getInvoice(id);
      if (inv.status !== 'DRAFT') {
        setEditable(false);
        setErrorMsg('This invoice is FINALIZED or CANCELLED and cannot be modified.');
      }

      setSelectedCustomerId(inv.customerId || '');
      setInvoiceDate(new Date(inv.invoiceDate).toISOString().split('T')[0]);
      setTaxMode(inv.taxMode || 'NONE');
      setTaxRateBps(inv.defaultTaxRateBps || 0);
      setDiscountType(inv.discount?.type || 'NONE');
      setDiscountVal(inv.discount?.type === 'PERCENTAGE' ? (inv.discount.value / 100).toString() : (inv.discount?.value / 100 || 0).toString());
      setNotes(inv.notes || '');
      setPaymentTerms(inv.paymentTerms || '');

      // Load items
      const loadedItems: ItemInput[] = inv.items.map((it) => ({
        productId: it.productId,
        type: it.type,
        description: it.description,
        uom: it.uom,
        quantity: it.quantity,
        unitPriceMinor: it.unitPriceMinor,
        priceFloat: (it.unitPriceMinor / 100).toFixed(2),
      }));
      setItems(loadedItems);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load invoice draft details');
    } finally {
      setLoading(false);
    }
  }

  // Load customer lists
  async function loadCustomers(search = '') {
    if (!activeBusinessId) return;
    try {
      const data = await apiClient.listCustomers({ active: true, search });
      setCustomers(data.customers);
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

  useEffect(() => {
    loadInvoiceData();
    loadCustomers();
    loadProducts();
  }, [id, activeBusinessId]);

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

  // Append a product to line items list
  function handleAddProduct(p: Product) {
    if (!editable) return;
    const newItem: ItemInput = {
      productId: p.id,
      type: p.type,
      description: p.name,
      uom: p.uom,
      quantity: 1,
      unitPriceMinor: p.defaultPriceMinor,
      priceFloat: (p.defaultPriceMinor / 100).toFixed(2),
    };
    setItems((prev) => [...prev, newItem]);
    setProductSearch('');
  }

  // Add a blank custom item
  function handleAddCustomItem() {
    if (!editable) return;
    const newItem: ItemInput = {
      productId: null,
      type: 'SERVICE',
      description: 'Custom Service',
      uom: 'JOB',
      quantity: 1,
      unitPriceMinor: 0,
      priceFloat: '0.00',
    };
    setItems((prev) => [...prev, newItem]);
  }

  // Update a single field inside an item
  function handleUpdateItem(index: number, updates: Partial<ItemInput>) {
    if (!editable) return;
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
    if (!editable) return;
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

    const payload = {
      customerId: selectedCustomerId || '600000000000000000000001',
      invoiceDate,
      items: items.map((it) => ({
        productId: it.productId,
        type: it.type,
        description: it.description,
        uom: it.uom,
        quantity: Number(it.quantity) || 0,
        unitPriceMinor: it.unitPriceMinor || 0,
      })),
      taxMode,
      defaultTaxRateBps: Number(taxRateBps) || 0,
      discount: {
        type: discountType,
        value: discountType === 'PERCENTAGE' ? Math.round(parseFloat(discountVal) * 100) || 0 : Math.round(parseFloat(discountVal) * 100) || 0,
      },
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
  }, [items, taxMode, taxRateBps, discountType, discountVal, selectedCustomerId, invoiceDate]);

  async function handleSaveDraft(e: React.FormEvent) {
    e.preventDefault();
    if (!activeBusinessId || !editable) return;
    if (!selectedCustomerId) {
      setErrorMsg('Please select a customer for this invoice');
      return;
    }
    if (items.length === 0) {
      setErrorMsg('Please add at least one product or service to the invoice');
      return;
    }

    setSubmitLoading(true);
    setErrorMsg(null);

    const payload = {
      customerId: selectedCustomerId,
      invoiceDate,
      items: items.map((it) => ({
        productId: it.productId,
        type: it.type,
        description: it.description.trim(),
        uom: it.uom.trim(),
        quantity: Number(it.quantity) || 0,
        unitPriceMinor: it.unitPriceMinor || 0,
      })),
      taxMode,
      defaultTaxRateBps: Number(taxRateBps) || 0,
      discount: {
        type: discountType,
        value: discountType === 'PERCENTAGE' ? Math.round(parseFloat(discountVal) * 100) || 0 : Math.round(parseFloat(discountVal) * 100) || 0,
      },
      paymentTerms: paymentTerms.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    try {
      await apiClient.updateInvoiceDraft(id, payload);
      router.push('/dashboard/invoices');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update draft invoice');
    } finally {
      setSubmitLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700 mx-auto mb-4"></div>
        <p className="text-sm text-text-secondary">Loading draft invoice...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Edit Draft Invoice</h1>
          <p className="text-sm text-text-secondary mt-1">
            Editing Draft ID: #{id.slice(-6).toUpperCase()}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className={`p-4 text-sm rounded-lg font-medium border ${editable ? 'bg-danger-soft border-danger-app/20 text-danger-app' : 'bg-surface-2-app border-border-app text-text-secondary'}`}>
          {errorMsg}
        </div>
      )}

      {editable && (
        <form onSubmit={handleSaveDraft} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Core Inputs (Left 2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide border-b border-border-light pb-2">
                Invoice Header
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">
                    Customer *
                  </label>
                  <div className="relative">
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      required
                      className="w-full pl-3 pr-8 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none appearance-none cursor-pointer"
                    >
                      <option value="">-- Choose Customer --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
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
                    placeholder="Filter customer list..."
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
                    className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Line Items builder */}
            <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border-light pb-2">
                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide">
                  Billing items
                </h3>
                <button
                  type="button"
                  onClick={handleAddCustomItem}
                  className="text-primary-700 hover:text-primary-800 text-xs font-bold cursor-pointer"
                >
                  + Add Custom Item
                </button>
              </div>

              {/* Catalog search selection */}
              <div className="relative">
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search services catalogue..."
                  className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary"
                />
                {productSearch.trim() && products.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-surface-app border border-border-app rounded-lg shadow-lg max-h-48 overflow-y-auto z-10 p-2">
                    {products.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleAddProduct(p)}
                        className="p-2 hover:bg-surface-2-app text-xs flex justify-between cursor-pointer rounded-md"
                      >
                        <span className="font-semibold text-text-primary">{p.name}</span>
                        <span className="text-text-muted">₹{(p.defaultPriceMinor / 100).toFixed(2)} ({p.uom})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Items display */}
              {items.length === 0 ? (
                <div className="text-center py-8 text-text-muted text-xs italic">
                  No items added. Select a service from the catalogue search above or add a custom item.
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((it, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-surface-2-app/50 border border-border-app rounded-lg space-y-3 relative"
                    >
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="absolute right-3 top-3 text-text-muted hover:text-danger-app font-bold text-base cursor-pointer"
                      >
                        &times;
                      </button>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold text-text-secondary uppercase mb-0.5">
                            Description
                          </label>
                          <input
                            type="text"
                            required
                            value={it.description}
                            onChange={(e) => handleUpdateItem(idx, { description: e.target.value })}
                            className="w-full px-2 py-1 bg-surface-app border border-border-app rounded text-sm text-text-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-text-secondary uppercase mb-0.5">
                            Unit (UOM)
                          </label>
                          <input
                            type="text"
                            required
                            value={it.uom}
                            onChange={(e) => handleUpdateItem(idx, { uom: e.target.value })}
                            className="w-full px-2 py-1 bg-surface-app border border-border-app rounded text-sm text-text-primary"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-text-secondary uppercase mb-0.5">
                            Quantity
                          </label>
                          <input
                            type="number"
                            step="0.001"
                            required
                            value={it.quantity}
                            onChange={(e) => handleUpdateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1 bg-surface-app border border-border-app rounded text-sm text-text-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-text-secondary uppercase mb-0.5">
                            Unit Price (₹)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={it.priceFloat}
                            onChange={(e) => handleUpdateItem(idx, { priceFloat: e.target.value })}
                            className="w-full px-2 py-1 bg-surface-app border border-border-app rounded text-sm text-text-primary"
                          />
                        </div>
                        <div className="flex flex-col justify-end text-right">
                          <span className="text-[10px] text-text-secondary uppercase font-bold">Subtotal</span>
                          <span className="font-semibold text-text-primary text-sm mt-1">
                            ₹{((it.quantity * (parseFloat(it.priceFloat) || 0))).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Calculation Settings & Totals Preview (Right 1 col) */}
          <div className="space-y-6">
            <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide border-b border-border-light pb-2">
                Tax & Discount Settings
              </h3>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">
                  Tax Mode
                </label>
                <select
                  value={taxMode}
                  onChange={(e) => setTaxMode(e.target.value as any)}
                  className="w-full px-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-xs font-semibold text-text-primary focus:outline-none"
                >
                  <option value="NONE">NONE (No Tax)</option>
                  <option value="EXCLUSIVE">EXCLUSIVE (Tax added to prices)</option>
                  <option value="INCLUSIVE">INCLUSIVE (Prices include tax)</option>
                </select>
              </div>

              {taxMode !== 'NONE' && (
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">
                    Tax Rate (Basis Points)
                  </label>
                  <input
                    type="number"
                    value={taxRateBps}
                    onChange={(e) => setTaxRateBps(parseInt(e.target.value) || 0)}
                    placeholder="e.g. 18% is 1800"
                    className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary"
                  />
                  <span className="text-[9px] text-text-muted mt-1 block">1800 Bps = 18.0% GST (CGST 9% + SGST 9%)</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">
                    Discount
                  </label>
                  <select
                    value={discountType}
                    onChange={(e) => {
                      setDiscountType(e.target.value as any);
                      setDiscountVal('0');
                    }}
                    className="w-full px-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-xs font-semibold"
                  >
                    <option value="NONE">NONE</option>
                    <option value="FIXED">FIXED (₹)</option>
                    <option value="PERCENTAGE">PERCENT (%)</option>
                  </select>
                </div>
                {discountType !== 'NONE' && (
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">
                      Value
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={discountVal}
                      onChange={(e) => setDiscountVal(e.target.value)}
                      className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Preview Totals Summary panel */}
            <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide border-b border-border-light pb-2">
                Authoritative Preview
              </h3>

              {previewTotals ? (
                <div className="space-y-2.5 text-sm text-text-secondary">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="text-text-primary font-medium">₹{(previewTotals.subtotalMinor / 100).toFixed(2)}</span>
                  </div>
                  {previewTotals.discountMinor > 0 && (
                    <div className="flex justify-between text-danger-app">
                      <span>Discount:</span>
                      <span>-₹{(previewTotals.discountMinor / 100).toFixed(2)}</span>
                    </div>
                  )}
                  {previewTotals.taxes?.map((t: any, i: number) => (
                    <div key={i} className="flex justify-between">
                      <span>{t.type} ({(t.rateBps / 100).toFixed(1)}%):</span>
                      <span className="text-text-primary">₹{(t.amountMinor / 100).toFixed(2)}</span>
                    </div>
                  ))}
                  {Math.abs(previewTotals.roundingMinor) > 0 && (
                    <div className="flex justify-between text-text-muted text-xs">
                      <span>Rounding Offset:</span>
                      <span>{previewTotals.roundingMinor > 0 ? '+' : ''}₹{(previewTotals.roundingMinor / 100).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-border-light pt-2 flex justify-between font-bold text-text-primary text-base">
                    <span>Grand Total:</span>
                    <span>₹{(previewTotals.grandTotalMinor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {amountInWords && (
                    <div className="mt-3 text-[10px] leading-relaxed text-text-muted italic bg-surface-2-app p-2 rounded">
                      Amount in Words: {amountInWords}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-text-muted text-xs italic">
                  Add items to see preview summary calculations.
                </div>
              )}
            </div>

            <div className="bg-surface-app border border-border-app p-6 rounded-xl shadow-sm space-y-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">
                  Payment Terms (Override)
                </label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full px-3 py-1.5 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase mb-1">
                  Invoice Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-app border border-border-app rounded-lg text-sm text-text-primary"
                  rows={3}
                />
              </div>

              <div className="flex space-x-2 pt-3 border-t border-border-light">
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/invoices')}
                  className="flex-1 text-center py-2 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-lg text-xs font-bold text-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading || items.length === 0}
                  className="flex-1 text-center py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-xs font-bold disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {submitLoading ? 'Saving...' : 'Save Draft'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
