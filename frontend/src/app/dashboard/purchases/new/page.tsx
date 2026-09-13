'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ShoppingBag,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Building2,
  FileText,
  Info,
  Loader2,
  DollarSign,
  Package,
  Sparkles,
  Upload,
  FileSpreadsheet,
  Download,
  X,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import {
  purchasesApi,
  Vendor,
  PurchaseType,
  ParseCsvResult,
  ExtractedBillDraft,
} from '../../../../lib/api/purchases';
import { apiClient } from '../../../../lib/api/client';
import { Product } from '../../../../lib/api/types';

interface LineItemInput {
  productId: string;
  productName: string;
  sku: string;
  orderedQuantity: number;
  unitPurchasePrice: number;
  discountPercent: number;
  taxRate: number;
  matchNotice?: string;
}

const COMMON_UOMS = ['JOB', 'NOS', 'PCS', 'HOUR', 'DAY', 'KG', 'SET', 'UNIT'];

export default function NewPurchasePage() {
  const router = useRouter();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [purchaseType, setPurchaseType] = useState<PurchaseType>('DIRECT_PURCHASE');
  const [vendorId, setVendorId] = useState('');
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceDate, setInvoiceDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [directReceivedFull, setDirectReceivedFull] = useState(true);
  const [notes, setNotes] = useState('');

  // Duplicate bill warning state
  const [isDuplicateBill, setIsDuplicateBill] = useState(false);
  const [duplicatePurchaseInfo, setDuplicatePurchaseInfo] = useState<any>(null);

  // Line items state
  const [items, setItems] = useState<LineItemInput[]>([
    {
      productId: '',
      productName: '',
      sku: '',
      orderedQuantity: 1,
      unitPurchasePrice: 0,
      discountPercent: 0,
      taxRate: 18,
    },
  ]);

  // Full Add Vendor modal state
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [savingVendor, setSavingVendor] = useState(false);
  const [vendorError, setVendorError] = useState<string | null>(null);
  const [vendorFormData, setVendorFormData] = useState({
    name: '',
    vendorCode: '',
    gstNumber: '',
    contactPerson: '',
    mobile: '',
    alternateMobile: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    paymentTerms: 'Net 30',
    notes: '',
  });

  // Add Brand New Product Modal state
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [targetProductLineIndex, setTargetProductLineIndex] = useState<number | null>(null);
  const [productFormData, setProductFormData] = useState({
    type: 'SERVICE' as 'SERVICE' | 'PRODUCT',
    name: '',
    description: '',
    uom: 'JOB',
    customUom: '',
    priceFloat: '0.00',
    defaultTaxRateBps: '0',
  });

  // AI Bill Scanner State
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrSuccessNotice, setOcrSuccessNotice] = useState<string | null>(null);

  // CSV Import State
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvParsing, setCsvParsing] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvResult, setCsvResult] = useState<ParseCsvResult | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoadingInitial(true);
        const [vendorsRes, productsRes] = await Promise.all([
          purchasesApi.listVendors({ isActive: true }),
          apiClient.listProducts({ active: true }),
        ]);
        setVendors(vendorsRes.vendors || []);
        // Only physical products or products marked for inventory
        setProducts(productsRes.products || []);
      } catch (err: any) {
        console.error('Failed to load initial data:', err);
        setFormError('Failed to load vendors and product catalog');
      } finally {
        setLoadingInitial(false);
      }
    }
    loadData();
  }, []);

  // Check duplicate vendor invoice number
  useEffect(() => {
    if (!vendorId || !vendorInvoiceNumber.trim()) {
      setIsDuplicateBill(false);
      setDuplicatePurchaseInfo(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await purchasesApi.checkDuplicateInvoice(vendorId, vendorInvoiceNumber.trim());
        setIsDuplicateBill(res.isDuplicate);
        setDuplicatePurchaseInfo(res.existingPurchase || null);
      } catch (err) {
        console.error('Duplicate check error:', err);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [vendorId, vendorInvoiceNumber]);

  const selectedVendorObj = vendors.find((v) => v._id === vendorId);

  // AI Bill Scanner File Handler
  const handleOcrFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setOcrScanning(true);
      setOcrError(null);
      const res = await purchasesApi.extractBillDraft(file);
      const ext = res.extraction;

      if (ext.suggestedVendor?.id) {
        setVendorId(ext.suggestedVendor.id);
      }
      if (ext.vendorInvoiceNumber) {
        setVendorInvoiceNumber(ext.vendorInvoiceNumber);
      }
      if (ext.invoiceDate) {
        setInvoiceDate(ext.invoiceDate);
      }
      if (ext.dueDate) {
        setDueDate(ext.dueDate);
      }
      if (ext.notes) {
        setNotes((prev) => (prev ? `${prev}\n${ext.notes}` : ext.notes || ''));
      }

      if (ext.items && ext.items.length > 0) {
        const mappedItems: LineItemInput[] = ext.items.map((it) => {
          let pId = it.matchedProductId || '';
          // If matched product ID was found, verify it exists in local products
          if (pId && !products.some((p) => p.id === pId || (p as any)._id === pId)) {
            const bySku = products.find((p) => (p as any).sku === it.matchedSku);
            if (bySku) pId = bySku.id || (bySku as any)._id;
          }

          return {
            productId: pId,
            productName: it.matchedProductName || it.rawDescription,
            sku: it.matchedSku || '',
            orderedQuantity: it.rawQuantity || 1,
            unitPurchasePrice: it.rawUnitPrice || 0,
            discountPercent: it.rawDiscountPercent || 0,
            taxRate: it.rawTaxRate || 18,
            matchNotice: it.isMatched
              ? `✓ Auto-matched (${Math.round(it.matchConfidence * 100)}%)`
              : '⚠️ Unmatched item: please select inventory product',
          };
        });
        setItems(mappedItems);
      }

      setOcrSuccessNotice(`Successfully extracted bill draft from ${file.name}`);
      setShowOcrModal(false);
    } catch (err: any) {
      console.error('OCR Extraction error:', err);
      setOcrError(err.message || 'Failed to scan bill');
    } finally {
      setOcrScanning(false);
    }
  };

  // CSV Import Handlers
  const handleCsvFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCsvParsing(true);
      setCsvError(null);
      const result = await purchasesApi.parseCsvItems({ file });
      setCsvResult(result);
    } catch (err: any) {
      console.error('CSV Parsing error:', err);
      setCsvError(err.message || 'Failed to parse CSV file');
    } finally {
      setCsvParsing(false);
    }
  };

  const applyCsvRows = (replace: boolean) => {
    if (!csvResult || csvResult.rows.length === 0) return;

    const validRows = csvResult.rows.filter((r) => r.isValid);
    if (validRows.length === 0) return;

    const newItems: LineItemInput[] = validRows.map((r) => {
      let pId = r.matchedProductId || '';
      if (pId && !products.some((p) => p.id === pId || (p as any)._id === pId)) {
        const bySku = products.find((p) => (p as any).sku === r.sku);
        if (bySku) pId = bySku.id || (bySku as any)._id;
      }

      return {
        productId: pId,
        productName: r.matchedProductName || r.productName,
        sku: r.sku || '',
        orderedQuantity: r.quantity,
        unitPurchasePrice: r.unitPurchasePrice,
        discountPercent: r.discountPercent,
        taxRate: r.taxRate,
      };
    });

    if (replace) {
      setItems(newItems);
    } else {
      setItems((prev) => [...prev.filter((it) => it.productId || it.productName), ...newItems]);
    }

    setShowCsvModal(false);
    setCsvResult(null);
  };

  const downloadCsvTemplate = () => {
    const templateContent = `Product Name,SKU,Quantity,Unit Price,Discount %,Tax %\nCapacitor 35µF,CAP-35UF,10,180,0,18\nCopper Pipe 1/2 Inch,COPPER-PIPE-12,5,2400,0,18\nRotary Compressor 1.5 Ton,COMP-ROT-1.5T,2,6500,5,18\n`;
    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'purchase_items_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Line item handlers
  const handleProductChange = (index: number, pId: string) => {
    const prod = products.find((p) => p.id === pId || (p as any)._id === pId);
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        productId: pId,
        productName: prod?.name || '',
        sku: (prod as any)?.sku || '',
        // Use lastPurchasePrice if available, or defaultPriceMinor / 100 as guide
        unitPurchasePrice: (prod as any)?.lastPurchasePriceMinor
          ? (prod as any).lastPurchasePriceMinor / 100
          : prod?.defaultPriceMinor
          ? prod.defaultPriceMinor / 100
          : 0,
        taxRate: prod?.defaultTaxRateBps ? prod.defaultTaxRateBps / 100 : 18,
      };
      return updated;
    });
  };

  const openNewProductModal = (targetIndex: number | null = null) => {
    setTargetProductLineIndex(targetIndex);
    setProductError(null);
    setProductFormData({
      type: 'SERVICE',
      name: '',
      description: '',
      uom: 'JOB',
      customUom: '',
      priceFloat: '0.00',
      defaultTaxRateBps: '0',
    });
    setShowAddProductModal(true);
  };

  const applyProductToLine = (p: Product, targetIndex?: number | null) => {
    const pId = p.id || (p as any)._id;
    const price = (p as any)?.lastPurchasePriceMinor
      ? (p as any).lastPurchasePriceMinor / 100
      : p.defaultPriceMinor
      ? p.defaultPriceMinor / 100
      : 0;
    const taxRate = p.defaultTaxRateBps ? p.defaultTaxRateBps / 100 : 18;

    setItems((prev) => {
      let idx = targetIndex;
      if (idx === undefined || idx === null || idx < 0) {
        const emptyIdx = prev.findIndex((it) => !it.productId);
        if (emptyIdx !== -1) {
          idx = emptyIdx;
        } else {
          return [
            ...prev,
            {
              productId: pId,
              productName: p.name,
              sku: (p as any).sku || '',
              orderedQuantity: 1,
              unitPurchasePrice: price,
              discountPercent: 0,
              taxRate,
            },
          ];
        }
      }

      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        productId: pId,
        productName: p.name,
        sku: (p as any).sku || '',
        unitPurchasePrice: price,
        taxRate,
      };
      return updated;
    });
  };

  // Brand New Product Creation Handler
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setProductError(null);

    if (!productFormData.name.trim()) {
      setProductError('Catalogue Item Name is required');
      return;
    }

    const uomVal =
      productFormData.uom === 'CUSTOM'
        ? productFormData.customUom.trim().toUpperCase() || 'UNIT'
        : productFormData.uom;

    const floatVal = parseFloat(productFormData.priceFloat);
    if (isNaN(floatVal) || floatVal < 0) {
      setProductError('Please specify a valid non-negative default price');
      return;
    }
    const defaultPriceMinor = Math.round(floatVal * 100);

    try {
      setSavingProduct(true);
      const payload = {
        type: productFormData.type,
        name: productFormData.name.trim(),
        description: productFormData.description.trim() || undefined,
        uom: uomVal,
        defaultPriceMinor,
        currency: 'INR' as const,
        defaultTaxRateBps: parseInt(productFormData.defaultTaxRateBps) || 0,
      };

      const newProduct = await apiClient.createProduct(payload);

      // Add to local product catalog state so it is immediately selectable everywhere
      setProducts((prev) => [newProduct, ...prev]);

      // Immediately select in the targeted purchase item line
      applyProductToLine(newProduct, targetProductLineIndex);

      setShowAddProductModal(false);
      setProductFormData({
        type: 'SERVICE',
        name: '',
        description: '',
        uom: 'JOB',
        customUom: '',
        priceFloat: '0.00',
        defaultTaxRateBps: '0',
      });
      setTargetProductLineIndex(null);
    } catch (err: any) {
      console.error('Failed to create product:', err);
      setProductError(err.message || 'Failed to create product/service');
    } finally {
      setSavingProduct(false);
    }
  };

  // Full Add Vendor Handler
  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    setVendorError(null);

    if (!vendorFormData.name.trim()) {
      setVendorError('Vendor / Company Name is required');
      return;
    }

    try {
      setSavingVendor(true);
      const payload = {
        name: vendorFormData.name.trim(),
        vendorCode: vendorFormData.vendorCode.trim() || undefined,
        gstNumber: vendorFormData.gstNumber.trim().toUpperCase() || undefined,
        contactPerson: vendorFormData.contactPerson.trim() || undefined,
        mobile: vendorFormData.mobile.trim() || undefined,
        alternateMobile: vendorFormData.alternateMobile.trim() || undefined,
        email: vendorFormData.email.trim() || undefined,
        address: vendorFormData.address.trim() || undefined,
        city: vendorFormData.city.trim() || undefined,
        state: vendorFormData.state.trim() || undefined,
        pincode: vendorFormData.pincode.trim() || undefined,
        paymentTerms: vendorFormData.paymentTerms.trim() || undefined,
        notes: vendorFormData.notes.trim() || undefined,
      };

      const res = await purchasesApi.createVendor(payload);

      setVendors((prev) => [...prev, res.vendor]);
      setVendorId(res.vendor._id);
      setShowAddVendorModal(false);

      setVendorFormData({
        name: '',
        vendorCode: '',
        gstNumber: '',
        contactPerson: '',
        mobile: '',
        alternateMobile: '',
        email: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        paymentTerms: 'Net 30',
        notes: '',
      });
    } catch (err: any) {
      console.error('Failed to add vendor:', err);
      setVendorError(err.message || 'Failed to add vendor');
    } finally {
      setSavingVendor(false);
    }
  };

  const handleItemFieldChange = (index: number, field: keyof LineItemInput, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
  };

  const addLineItem = () => {
    setItems((prev) => [
      ...prev,
      {
        productId: '',
        productName: '',
        sku: '',
        orderedQuantity: 1,
        unitPurchasePrice: 0,
        discountPercent: 0,
        taxRate: 18,
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const calculateLineTotal = (it: LineItemInput) => {
    const gross = (it.orderedQuantity || 0) * (it.unitPurchasePrice || 0);
    const discount = (gross * (it.discountPercent || 0)) / 100;
    const taxable = Math.max(0, gross - discount);
    const tax = (taxable * (it.taxRate || 0)) / 100;
    return Math.round((taxable + tax) * 100) / 100;
  };

  const subtotal = items.reduce(
    (sum, it) => sum + (it.orderedQuantity || 0) * (it.unitPurchasePrice || 0),
    0
  );
  const totalDiscount = items.reduce(
    (sum, it) =>
      sum + ((it.orderedQuantity || 0) * (it.unitPurchasePrice || 0) * (it.discountPercent || 0)) / 100,
    0
  );
  const totalTax = items.reduce((sum, it) => {
    const gross = (it.orderedQuantity || 0) * (it.unitPurchasePrice || 0);
    const discount = (gross * (it.discountPercent || 0)) / 100;
    const taxable = Math.max(0, gross - discount);
    return sum + (taxable * (it.taxRate || 0)) / 100;
  }, 0);
  const grandTotal = Math.round((subtotal - totalDiscount + totalTax) * 100) / 100;

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!vendorId) {
      setFormError('Please select a supplier / vendor');
      return;
    }

    const invalidItem = items.find((it) => !it.productId || it.orderedQuantity <= 0);
    if (invalidItem) {
      setFormError('All line items must have a valid product selected and quantity > 0');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        purchaseType,
        vendorId,
        vendorInvoiceNumber: vendorInvoiceNumber.trim() || undefined,
        purchaseDate,
        invoiceDate: invoiceDate || undefined,
        dueDate: dueDate || undefined,
        directReceivedFull: purchaseType === 'DIRECT_PURCHASE' ? directReceivedFull : false,
        notes: notes.trim() || undefined,
        allowDuplicateInvoice: isDuplicateBill, // user confirmed if they still proceed
        items: items.map((it) => ({
          productId: it.productId,
          orderedQuantity: Number(it.orderedQuantity),
          unitPurchasePrice: Number(it.unitPurchasePrice),
          discountPercent: Number(it.discountPercent || 0),
          taxRate: Number(it.taxRate || 0),
        })),
      };

      const res = await purchasesApi.createPurchase(payload);
      router.push(`/dashboard/purchases/${res.purchase._id}`);
    } catch (err: any) {
      console.error('Failed to create purchase:', err);
      setFormError(err.message || 'Failed to create purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-2" />
        <p className="text-sm">Loading purchase setup...</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Top Breadcrumb & Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-sm text-gray-500 mb-1">
            <Link href="/dashboard/purchases" className="hover:text-primary-600 flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              Purchases
            </Link>
            <span>/</span>
            <span className="font-semibold text-gray-700">New Purchase</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-7 h-7 text-primary-600" />
            Create Purchase Bill / Order
          </h1>
          <p className="text-sm text-gray-500">
            Record supplier orders or direct store purchases with product snapshots.
          </p>
        </div>

        {/* Phase 4 Automation Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* <button
            type="button"
            onClick={() => setShowOcrModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold transition shadow-xs cursor-pointer active:scale-98"
          >
            <Sparkles className="w-4 h-4 text-purple-600" />
            AI Bill Scanner
          </button>

          <button
            type="button"
            onClick={() => setShowCsvModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition shadow-xs cursor-pointer active:scale-98"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Import CSV
          </button>

          <button
            type="button"
            onClick={downloadCsvTemplate}
            title="Download standard CSV items template"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 text-xs font-medium transition shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-gray-400" />
            Template
          </button> */}
        </div>
      </div>

      {ocrSuccessNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{ocrSuccessNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setOcrSuccessNotice(null)}
            className="text-emerald-600 hover:text-emerald-800 font-bold text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {formError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Purchase Type Selector */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">
              1
            </span>
            Purchase Type
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label
              className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${
                purchaseType === 'DIRECT_PURCHASE'
                  ? 'border-primary-600 bg-primary-50/30 ring-1 ring-primary-600'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="purchaseType"
                  value="DIRECT_PURCHASE"
                  checked={purchaseType === 'DIRECT_PURCHASE'}
                  onChange={() => {
                    setPurchaseType('DIRECT_PURCHASE');
                    setDirectReceivedFull(true);
                  }}
                  className="mt-1 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <div className="font-bold text-sm text-gray-900">Direct Purchase (Cash / Counter)</div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    You went to the vendor or received the products immediately. Stock can be marked as received right now.
                  </p>
                </div>
              </div>
            </label>

            <label
              className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${
                purchaseType === 'ORDERED_PURCHASE'
                  ? 'border-primary-600 bg-primary-50/30 ring-1 ring-primary-600'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="purchaseType"
                  value="ORDERED_PURCHASE"
                  checked={purchaseType === 'ORDERED_PURCHASE'}
                  onChange={() => {
                    setPurchaseType('ORDERED_PURCHASE');
                    setDirectReceivedFull(false);
                  }}
                  className="mt-1 text-primary-600 focus:ring-primary-500"
                />
                <div>
                  <div className="font-bold text-sm text-gray-900">Ordered Purchase (Purchase Order)</div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Order placed today; delivery arrives later. Stock will <strong>not</strong> increase until physically received.
                  </p>
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Step 2: Vendor & Invoice Details */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">
                2
              </span>
              Vendor & Invoice Details
            </h2>

            <button
              type="button"
              onClick={() => {
                setVendorError(null);
                setShowAddVendorModal(true);
              }}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add New Vendor
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Vendor Selector */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Select Vendor *
              </label>
              <select
                required
                value={vendorId}
                onChange={(e) => {
                  if (e.target.value === '__NEW_VENDOR__') {
                    setVendorError(null);
                    setShowAddVendorModal(true);
                  } else {
                    setVendorId(e.target.value);
                  }
                }}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500 bg-white"
              >
                <option value="">-- Choose Supplier --</option>
                <option value="__NEW_VENDOR__" className="font-semibold text-primary-600 bg-primary-50">
                  + Add New Vendor...
                </option>
                {vendors.map((v) => (
                  <option key={v._id} value={v._id}>
                    {v.name} ({v.vendorCode}) {v.city ? `— ${v.city}` : ''}
                  </option>
                ))}
              </select>

              {selectedVendorObj && (
                <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2.5 rounded-xl flex items-center justify-between">
                  <span>
                    GSTIN: <strong>{selectedVendorObj.gstNumber || 'Unregistered'}</strong>
                  </span>
                  <span>
                    Phone: <strong>{selectedVendorObj.mobile || 'N/A'}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Vendor Invoice Number */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Vendor Invoice / Bill #
              </label>
              <input
                type="text"
                value={vendorInvoiceNumber}
                onChange={(e) => setVendorInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-2026-8971"
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500 font-mono"
              />

              {isDuplicateBill && (
                <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Warning: Bill #{vendorInvoiceNumber} was already recorded under{' '}
                    <strong>{duplicatePurchaseInfo?.purchaseNumber}</strong> on{' '}
                    {new Date(duplicatePurchaseInfo?.purchaseDate).toLocaleDateString('en-IN')}.
                  </span>
                </div>
              )}
            </div>

            {/* Purchase Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Purchase Date *
              </label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Invoice Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Bill / Invoice Date
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Payment Due Date */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Payment Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Step 3: Product Line Items */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">
                3
              </span>
              Product Line Items
            </h2>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => openNewProductModal(null)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition cursor-pointer active:scale-98"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Brand New Product
              </button>

            
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3 min-w-[240px]">Product *</th>
                  <th className="py-2.5 px-3 w-28 text-center">Qty *</th>
                  <th className="py-2.5 px-3 w-32 text-right">Unit Price (₹) *</th>
                  <th className="py-2.5 px-3 w-24 text-right">Disc %</th>
                  <th className="py-2.5 px-3 w-28 text-right">GST %</th>
                  <th className="py-2.5 px-3 w-32 text-right">Line Total (₹)</th>
                  <th className="py-2.5 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, index) => {
                  const lineTotal = calculateLineTotal(item);

                  return (
                    <tr key={index} className="hover:bg-gray-50/40">
                      <td className="py-3 px-3">
                        <select
                          required
                          value={item.productId}
                          onChange={(e) => {
                            if (e.target.value === '__NEW_PRODUCT__') {
                              openNewProductModal(index);
                            } else {
                              handleProductChange(index, e.target.value);
                            }
                          }}
                          className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-300 focus:outline-hidden focus:ring-1 focus:ring-primary-500 bg-white"
                        >
                          <option value="">-- Choose Product --</option>
                          <option value="__NEW_PRODUCT__" className="font-semibold text-emerald-700 bg-emerald-50">
                            Add Brand New Product...
                          </option>
                          {products.map((p) => (
                            <option key={p.id || (p as any)._id} value={p.id || (p as any)._id}>
                              {p.name} {((p as any).sku ? `[${(p as any).sku}]` : '')} ({p.type || 'PRODUCT'})
                            </option>
                          ))}
                        </select>
                        {item.sku && (
                          <span className="text-[11px] font-mono text-gray-400 block mt-0.5">
                            SKU: {item.sku}
                          </span>
                        )}
                        {item.matchNotice && (
                          <span
                            className={`text-[11px] font-medium block mt-0.5 ${
                              item.productId ? 'text-emerald-600' : 'text-amber-600'
                            }`}
                          >
                            {item.matchNotice}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <input
                          type="number"
                          min="1"
                          required
                          value={item.orderedQuantity}
                          onChange={(e) =>
                            handleItemFieldChange(index, 'orderedQuantity', Math.max(1, Number(e.target.value)))
                          }
                          className="w-full text-center text-sm px-2 py-1.5 rounded-lg border border-gray-300 focus:outline-hidden focus:ring-1 focus:ring-primary-500"
                        />
                      </td>

                      <td className="py-3 px-3">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          required
                          value={item.unitPurchasePrice}
                          onChange={(e) =>
                            handleItemFieldChange(index, 'unitPurchasePrice', Math.max(0, Number(e.target.value)))
                          }
                          className="w-full text-right text-sm px-2 py-1.5 rounded-lg border border-gray-300 focus:outline-hidden focus:ring-1 focus:ring-primary-500"
                        />
                      </td>

                      <td className="py-3 px-3">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discountPercent}
                          onChange={(e) =>
                            handleItemFieldChange(index, 'discountPercent', Math.min(100, Math.max(0, Number(e.target.value))))
                          }
                          className="w-full text-right text-sm px-2 py-1.5 rounded-lg border border-gray-300 focus:outline-hidden focus:ring-1 focus:ring-primary-500"
                        />
                      </td>

                      <td className="py-3 px-3">
                        <select
                          value={item.taxRate}
                          onChange={(e) => handleItemFieldChange(index, 'taxRate', Number(e.target.value))}
                          className="w-full text-right text-sm px-2 py-1.5 rounded-lg border border-gray-300 focus:outline-hidden focus:ring-1 focus:ring-primary-500 bg-white"
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </td>

                      <td className="py-3 px-3 text-right font-semibold text-gray-900">
                        ₹{lineTotal.toLocaleString('en-IN')}
                      </td>

                      <td className="py-3 px-2 text-center">
                        <button
                          type="button"
                          disabled={items.length <= 1}
                          onClick={() => removeLineItem(index)}
                          className="text-gray-400 hover:text-rose-600 disabled:opacity-30 transition p-1 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={addLineItem}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Another Line
            </button>

              
          </div>
        </div>

        {/* Step 4: Receiving & Commercial Settlement */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Notes & Receiving Options */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">
                4
              </span>
              Receiving Options & Notes
            </h2>

            {purchaseType === 'DIRECT_PURCHASE' ? (
              <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={directReceivedFull}
                    onChange={(e) => setDirectReceivedFull(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span className="text-sm font-bold text-emerald-900">
                    Mark products as physically received right now
                  </span>
                </label>
                <p className="text-xs text-emerald-700 pl-6.5">
                  If checked, receiving status will be marked as <strong>RECEIVED</strong>. (Stock update integration will execute seamlessly).
                </p>
              </div>
            ) : (
              <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-xl space-y-1">
                <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                  <Info className="w-4 h-4 text-blue-600 shrink-0" />
                  Ordered Purchase Receiving Notice
                </div>
                <p className="text-xs text-blue-700">
                  Stock will <strong>not</strong> increase now. When the shipment arrives at your shop, click "Receive Products" on the purchase detail page to record partial or full delivery.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Purchase Notes / Remarks
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Mention payment agreements, delivery instructions, or bill references..."
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Sticky Financial Summary Box */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 h-fit">
            <h3 className="font-bold text-gray-900 text-sm border-b border-gray-100 pb-3">
              Financial Summary
            </h3>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Gross Subtotal:</span>
                <span>₹{subtotal.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex justify-between text-gray-600">
                <span>Total Discount:</span>
                <span className="text-emerald-600">- ₹{totalDiscount.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex justify-between text-gray-600">
                <span>Total GST Tax:</span>
                <span>+ ₹{totalTax.toLocaleString('en-IN')}</span>
              </div>

              <div className="border-t border-gray-200 pt-3 flex justify-between font-bold text-base text-gray-900">
                <span>Net Payable:</span>
                <span className="text-primary-700 font-mono">₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="pt-2 text-[11px] text-gray-500 leading-relaxed bg-gray-50 p-2.5 rounded-xl">
              💡 <strong>Payment is recorded independently.</strong> This purchase will start with status <strong>UNPAID</strong>. You can record payments (UPI, Bank, Cash) from the purchase page.
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Purchase...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm & Create Purchase
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Add Brand New Product Modal */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-emerald-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Add Brand New Product</h3>
                  <p className="text-xs text-gray-500">Configure item details for catalogue & purchases</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1.5 hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              {productError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{productError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Type
                </label>
                <select
                  value={productFormData.type}
                  onChange={(e) =>
                    setProductFormData({ ...productFormData, type: e.target.value as 'SERVICE' | 'PRODUCT' })
                  }
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="SERVICE">SERVICE (Default)</option>
                  <option value="PRODUCT">PRODUCT</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Catalogue Item Name *
                </label>
                <input
                  type="text"
                  required
                  value={productFormData.name}
                  onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })}
                  placeholder="e.g. AC WATER SERVICE"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Item Description
                </label>
                <input
                  type="text"
                  value={productFormData.description}
                  onChange={(e) => setProductFormData({ ...productFormData, description: e.target.value })}
                  placeholder="e.g. AC water service for split unit"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    UOM (Unit) *
                  </label>
                  <select
                    value={productFormData.uom}
                    onChange={(e) => setProductFormData({ ...productFormData, uom: e.target.value })}
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    {COMMON_UOMS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                    <option value="CUSTOM">CUSTOM...</option>
                  </select>
                </div>

                {productFormData.uom === 'CUSTOM' ? (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Custom UOM Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={productFormData.customUom}
                      onChange={(e) => setProductFormData({ ...productFormData, customUom: e.target.value })}
                      placeholder="e.g. BOX, CAN"
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500 uppercase font-mono"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Default Price (INR) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={productFormData.priceFloat}
                      onChange={(e) => setProductFormData({ ...productFormData, priceFloat: e.target.value })}
                      placeholder="0.00"
                      className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500 font-mono"
                    />
                  </div>
                )}
              </div>

              {productFormData.uom === 'CUSTOM' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Default Price (INR) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productFormData.priceFloat}
                    onChange={(e) => setProductFormData({ ...productFormData, priceFloat: e.target.value })}
                    placeholder="0.00"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500 font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Tax Rate (Bps)
                </label>
                <input
                  type="number"
                  value={productFormData.defaultTaxRateBps}
                  onChange={(e) => setProductFormData({ ...productFormData, defaultTaxRateBps: e.target.value })}
                  placeholder="0"
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500 font-mono"
                />
                <span className="text-[10px] text-gray-500 mt-1 block">1800 = 18%</span>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-gray-600 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-5 py-2.5 text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-xl shadow-xs transition disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
                >
                  {savingProduct && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {productFormData.type === 'SERVICE' ? 'Save Service' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add New Vendor Modal */}
      {showAddVendorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary-100 text-primary-700">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Add New Vendor</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Enter supplier credentials and commercial terms.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddVendorModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVendor} className="p-6 space-y-4">
              {vendorError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{vendorError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Vendor / Company Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={vendorFormData.name}
                    onChange={(e) => setVendorFormData({ ...vendorFormData, name: e.target.value })}
                    placeholder="e.g. Subzero Refrigeration Spares"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Vendor Code
                  </label>
                  <input
                    type="text"
                    value={vendorFormData.vendorCode}
                    onChange={(e) => setVendorFormData({ ...vendorFormData, vendorCode: e.target.value })}
                    placeholder="Auto-generated if blank (e.g. VEN-001)"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    GSTIN Number
                  </label>
                  <input
                    type="text"
                    value={vendorFormData.gstNumber}
                    onChange={(e) => setVendorFormData({ ...vendorFormData, gstNumber: e.target.value.toUpperCase() })}
                    placeholder="e.g. 24AAAAA0000A1Z5"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    value={vendorFormData.contactPerson}
                    onChange={(e) => setVendorFormData({ ...vendorFormData, contactPerson: e.target.value })}
                    placeholder="e.g. Ramesh Patel"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    value={vendorFormData.mobile}
                    onChange={(e) => setVendorFormData({ ...vendorFormData, mobile: e.target.value })}
                    placeholder="e.g. 9876543210"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Alternate Phone
                  </label>
                  <input
                    type="text"
                    value={vendorFormData.alternateMobile}
                    onChange={(e) => setVendorFormData({ ...vendorFormData, alternateMobile: e.target.value })}
                    placeholder="Optional phone / landline"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={vendorFormData.email}
                    onChange={(e) => setVendorFormData({ ...vendorFormData, email: e.target.value })}
                    placeholder="sales@vendor.com"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Street Address
                  </label>
                  <input
                    type="text"
                    value={vendorFormData.address}
                    onChange={(e) => setVendorFormData({ ...vendorFormData, address: e.target.value })}
                    placeholder="Shop / Unit, Complex, Area"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={vendorFormData.city}
                    onChange={(e) => setVendorFormData({ ...vendorFormData, city: e.target.value })}
                    placeholder="e.g. Mundra"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={vendorFormData.state}
                    onChange={(e) => setVendorFormData({ ...vendorFormData, state: e.target.value })}
                    placeholder="e.g. Gujarat"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    value={vendorFormData.pincode}
                    onChange={(e) => setVendorFormData({ ...vendorFormData, pincode: e.target.value })}
                    placeholder="e.g. 370421"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Payment Terms
                  </label>
                  <input
                    type="text"
                    value={vendorFormData.paymentTerms}
                    onChange={(e) => setVendorFormData({ ...vendorFormData, paymentTerms: e.target.value })}
                    placeholder="Net 30"
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    rows={2}
                    value={vendorFormData.notes}
                    onChange={(e) => setVendorFormData({ ...vendorFormData, notes: e.target.value })}
                    placeholder="Additional notes about products supplied or special discounts..."
                    className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddVendorModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingVendor}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {savingVendor && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Bill Scanner Modal */}
      {showOcrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-purple-50/60">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">AI Bill Scanner & OCR</h3>
                  <p className="text-xs text-gray-500">
                    Upload purchase bill to auto-populate draft & match items
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOcrModal(false)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              {ocrError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{ocrError}</span>
                </div>
              )}

              {ocrScanning ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <div className="relative">
                    <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
                    <Sparkles className="w-4 h-4 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-sm text-gray-900">Scanning Bill with OCR Engine...</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Extracting supplier, invoice numbers, prices, and matching inventory catalog
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="border-2 border-dashed border-purple-200 hover:border-purple-400 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition bg-purple-50/30 hover:bg-purple-50/60">
                    <Upload className="w-8 h-8 text-purple-600 mb-2" />
                    <span className="text-sm font-bold text-gray-800">
                      Choose PDF, PNG, or JPG Invoice Bill
                    </span>
                    <span className="text-xs text-gray-400 mt-1">
                      Max file size: 10MB • Clear legible invoices give best results
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={handleOcrFileSelect}
                      className="hidden"
                    />
                  </label>

                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600 space-y-1">
                    <div className="font-semibold text-gray-700 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-primary-600" />
                      How AI Bill OCR Works:
                    </div>
                    <ul className="list-disc pl-4 space-y-0.5 text-gray-500 text-[11px]">
                      <li>Extracts Vendor, Invoice #, Bill Date, and Line items automatically.</li>
                      <li>Matches line item names against your store inventory.</li>
                      <li>
                        <strong>Draft state only:</strong> You can review, adjust, or change any item before saving.
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  disabled={ocrScanning}
                  onClick={() => setShowOcrModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-emerald-50/60 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Import Purchase Items from CSV</h3>
                  <p className="text-xs text-gray-500">
                    Upload spreadsheet to bulk-load ordered products
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCsvModal(false);
                  setCsvResult(null);
                }}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {csvError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{csvError}</span>
                </div>
              )}

              {!csvResult ? (
                <div className="space-y-4">
                  <label className="border-2 border-dashed border-emerald-200 hover:border-emerald-400 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition bg-emerald-50/30 hover:bg-emerald-50/60">
                    {csvParsing ? (
                      <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-2" />
                    ) : (
                      <Upload className="w-8 h-8 text-emerald-600 mb-2" />
                    )}
                    <span className="text-sm font-bold text-gray-800">
                      {csvParsing ? 'Parsing CSV Rows...' : 'Choose CSV File to Import'}
                    </span>
                    <span className="text-xs text-gray-400 mt-1">
                      Expected columns: Product Name, SKU, Quantity, Unit Price, Discount %, Tax %
                    </span>
                    <input
                      type="file"
                      accept=".csv"
                      disabled={csvParsing}
                      onChange={handleCsvFileSelect}
                      className="hidden"
                    />
                  </label>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs">
                    <span className="text-gray-600">Need a sample format template?</span>
                    <button
                      type="button"
                      onClick={downloadCsvTemplate}
                      className="text-emerald-700 font-bold hover:text-emerald-800 inline-flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Sample Template
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-gray-900">CSV Live Preview</h4>
                      <p className="text-xs text-gray-500">
                        {csvResult.validRowsCount} valid rows ready • {csvResult.invalidRowsCount} invalid
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setCsvResult(null)}
                      className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                    >
                      Choose Different File
                    </button>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-gray-50 sticky top-0 border-b border-gray-200 text-gray-500 font-semibold uppercase">
                        <tr>
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 px-3">Product / SKU</th>
                          <th className="py-2 px-3 text-center">Qty</th>
                          <th className="py-2 px-3 text-right">Price</th>
                          <th className="py-2 px-3 text-right">Total</th>
                          <th className="py-2 px-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {csvResult.rows.map((row) => (
                          <tr key={row.rowNumber} className={row.isValid ? 'hover:bg-gray-50/50' : 'bg-rose-50/30'}>
                            <td className="py-2 px-3 text-gray-400 font-mono">{row.rowNumber}</td>
                            <td className="py-2 px-3">
                              <div className="font-semibold text-gray-900">{row.productName}</div>
                              {row.sku && <div className="font-mono text-gray-400 text-[10px]">{row.sku}</div>}
                              {row.matchedProductName && row.matchedProductName !== row.productName && (
                                <div className="text-[10px] text-emerald-600 font-medium">
                                  Matched: {row.matchedProductName}
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center font-bold">{row.quantity}</td>
                            <td className="py-2 px-3 text-right font-mono">₹{row.unitPurchasePrice}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-gray-900">
                              ₹{row.totalAmount}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {row.isValid ? (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                  Valid
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200"
                                  title={row.errors.join('; ')}
                                >
                                  Error
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => applyCsvRows(false)}
                      disabled={csvResult.validRowsCount === 0}
                      className="px-3.5 py-2 text-xs font-semibold text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                    >
                      Append {csvResult.validRowsCount} Rows
                    </button>

                    <button
                      type="button"
                      onClick={() => applyCsvRows(true)}
                      disabled={csvResult.validRowsCount === 0}
                      className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      Replace All with {csvResult.validRowsCount} Rows
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
