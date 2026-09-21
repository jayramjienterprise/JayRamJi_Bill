'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Upload,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileText,
  Building2,
  Package,
  Calendar,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Save,
  Check,
  Search,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Trash2,
  Plus,
  HelpCircle,
  Info,
  Edit3,
  Paperclip,
  CreditCard,
} from 'lucide-react';
import {
  purchasesApi,
  IPurchaseDraft,
  IExtractedLineItem,
  Vendor,
  FieldStatus,
} from '../../../../lib/api/purchases';
import { Product, PaymentAccount } from '../../../../lib/api/types';
import { apiClient } from '../../../../lib/api/client';

interface PurchaseBillScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchaseConfirmed: (purchaseId: string) => void;
  vendors: Vendor[];
  products: Product[];
}

type ScanStage = 'IDLE' | 'UPLOADING' | 'PROCESSING' | 'REVIEW' | 'CONFIRMING' | 'SUCCESS';

export default function PurchaseBillScannerModal({
  isOpen,
  onClose,
  onPurchaseConfirmed,
  vendors,
  products,
}: PurchaseBillScannerModalProps) {
  // Navigation & Workflow state
  const [stage, setStage] = useState<ScanStage>('IDLE');
  const [processingStep, setProcessingStep] = useState(0);

  // Dynamic Catalog state (allows one-click created vendors/products without page reload)
  const [localVendors, setLocalVendors] = useState<Vendor[]>(vendors);
  const [localProducts, setLocalProducts] = useState<Product[]>(products);

  useEffect(() => {
    setLocalVendors(vendors);
  }, [vendors]);

  useEffect(() => {
    setLocalProducts(products);
  }, [products]);

  // Vendor Creation UX state
  const [vendorCreateConfirmOpen, setVendorCreateConfirmOpen] = useState(false);
  const [vendorEditModalOpen, setVendorEditModalOpen] = useState(false);
  const [isCreatingVendor, setIsCreatingVendor] = useState(false);
  const [vendorForm, setVendorForm] = useState({
    name: '',
    gstNumber: '',
    mobile: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
  });

  // Product Creation UX state
  const [activeProductLineIdx, setActiveProductLineIdx] = useState<number | null>(null);
  const [productCreateConfirmOpen, setProductCreateConfirmOpen] = useState(false);
  const [productEditModalOpen, setProductEditModalOpen] = useState(false);
  const [bulkProductModalOpen, setBulkProductModalOpen] = useState(false);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    barcode: '',
    hsnCode: '',
    uom: 'NOS',
    purchasePrice: 0,
    sellingPrice: 0,
    gstRate: 18,
  });
  const [bulkProducts, setBulkProducts] = useState<
    {
      index: number;
      name: string;
      hsnCode: string;
      uom: string;
      purchasePrice: number;
      gstRate: number;
      selected: boolean;
    }[]
  >([]);

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');

  // Draft state
  const [draft, setDraft] = useState<IPurchaseDraft | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Editable working state
  const [vendorId, setVendorId] = useState<string>('');
  const [vendorSearch, setVendorSearch] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [poNumber, setPoNumber] = useState<string>('');
  const [ewayBillNumber, setEwayBillNumber] = useState<string>('');
  const [items, setItems] = useState<IExtractedLineItem[]>([]);
  const [directReceivedFull, setDirectReceivedFull] = useState<boolean>(true);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paymentStatusChoice, setPaymentStatusChoice] = useState<'UNPAID' | 'PARTIALLY_PAID' | 'PAID'>('UNPAID');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paymentAccountId, setPaymentAccountId] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccount[]>([]);
  const [notes, setNotes] = useState<string>('');

  // Financial Edit & Manual Override State (Phase 5.6)
  const [manualOverride, setManualOverride] = useState(false);
  const [isEditingTotals, setIsEditingTotals] = useState(false);
  const [showCalculationDetails, setShowCalculationDetails] = useState(false);
  const [editSubtotal, setEditSubtotal] = useState<string>('');
  const [editCgstRate, setEditCgstRate] = useState<string>('');
  const [editCgstAmount, setEditCgstAmount] = useState<string>('');
  const [editSgstRate, setEditSgstRate] = useState<string>('');
  const [editSgstAmount, setEditSgstAmount] = useState<string>('');
  const [editIgstRate, setEditIgstRate] = useState<string>('');
  const [editIgstAmount, setEditIgstAmount] = useState<string>('');
  const [editTotalTax, setEditTotalTax] = useState<string>('');
  const [editGrandTotal, setEditGrandTotal] = useState<string>('');
  const [totalsEditError, setTotalsEditError] = useState<string | null>(null);

  // Document preview state
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Synchronous scan guard against duplicate submissions
  const isScanningRef = useRef(false);
  const [isScanning, setIsScanning] = useState(false);

  // Scan lifecycle tracking to prevent stale promises and allow clean cancellation
  const activeScanOperationIdRef = useRef<string | null>(null);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  // Product search in line items
  const [activeItemSearchIdx, setActiveItemSearchIdx] = useState<number | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');

  // Processing steps indicator
  const processingSteps = [
    'Uploading purchase bill document...',
    'Preprocessing & rasterizing document...',
    'NVIDIA Vision AI extraction...',
    'Deterministic financial reconciliation...',
    'Vendor & catalog product matching...',
    'Preparing interactive review draft...',
  ];

  // Reset state on open/close & fetch payment accounts
  useEffect(() => {
    if (!isOpen) {
      // Abort any in-flight scan
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
        activeAbortControllerRef.current = null;
      }
      activeScanOperationIdRef.current = null;
      isScanningRef.current = false;
      setIsScanning(false);
      setStage('IDLE');
      setSelectedFile(null);
      setFileError(null);
      setIdempotencyKey('');
      setDraft(null);
      setManualOverride(false);
      setIsEditingTotals(false);
      setShowCalculationDetails(false);
      setTotalsEditError(null);
      setErrorMessage(null);
      setShowConfirmDialog(false);
      setConfirmError(null);
      setPaymentStatusChoice('UNPAID');
      setAmountPaid(0);
      setPaymentMethod('CASH');
      setPaymentAccountId('');
      setPaymentReference('');
      setPaymentNotes('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
    } else {
      apiClient.listPaymentAccounts({ active: true })
        .then((accs) => setPaymentAccounts(accs || []))
        .catch(() => setPaymentAccounts([]));
    }
  }, [isOpen]);

  // Progressive processing steps timer
  useEffect(() => {
    let interval: any;
    if (stage === 'PROCESSING') {
      setProcessingStep(0);
      interval = setInterval(() => {
        setProcessingStep((prev) => {
          if (prev < processingSteps.length - 1) {
            return prev + 1;
          }
          return prev;
        });
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [stage]);

  // Sync draft data into working state when draft loads
  useEffect(() => {
    if (draft && draft.extraction) {
      const ext = draft.extraction;
      setInvoiceNumber(ext.invoice?.invoiceNumber?.value || '');
      setInvoiceDate(ext.invoice?.invoiceDate?.value ? ext.invoice.invoiceDate.value.split('T')[0] : '');
      setDueDate(ext.invoice?.dueDate?.value ? ext.invoice.dueDate.value.split('T')[0] : '');
      setPoNumber(ext.invoice?.poNumber?.value || '');
      setEwayBillNumber(ext.invoice?.ewayBillNumber?.value || '');
      setNotes(ext.additional?.notes?.value || '');
      setManualOverride(Boolean(draft.manualOverride));

      // Vendor matching sync
      if (draft.vendorMatch?.matchedVendorId) {
        setVendorId(draft.vendorMatch.matchedVendorId);
      } else {
        // Try finding vendor by extracted GSTIN or Name
        const extGstin = ext.supplier?.gstin?.value?.trim().toUpperCase();
        if (extGstin) {
          const match = vendors.find((v) => v.gstNumber?.trim().toUpperCase() === extGstin);
          if (match) setVendorId(match._id || match.id || '');
        }
      }

      // Line items sync
      if (ext.items && Array.isArray(ext.items)) {
        setItems(JSON.parse(JSON.stringify(ext.items)));
      } else {
        setItems([]);
      }
    }
  }, [draft, vendors]);

  if (!isOpen) return null;

  // Stable UUID Generator for Idempotency
  const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  // 1. File Selection & Validation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Invalidate previous in-flight scan or previous scan key
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    activeScanOperationIdRef.current = null;
    isScanningRef.current = false;
    setIsScanning(false);

    setFileError(null);
    setErrorMessage(null);
    setDraft(null);
    setIdempotencyKey('');

    // Validate size
    if (file.size === 0) {
      setFileError('The selected file is empty (0 bytes). Please select a valid purchase bill.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setFileError('File size exceeds the 25MB limit. Please upload a smaller document.');
      return;
    }

    // Validate type
    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!allowedExtensions.includes(ext)) {
      setFileError('Unsupported file type. Please upload a PDF, JPG, or PNG bill.');
      return;
    }

    setSelectedFile(file);
    // Reset file input value so user can re-select the same file if desired
    e.target.value = '';
  };

  // 2. Upload & Scanner execution with synchronous duplicate protection
  const handleStartScan = async () => {
    if (!selectedFile || isScanningRef.current) return;
    isScanningRef.current = true;
    setIsScanning(true);

    // Abort any prior in-flight request if present
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;

    // Generate unique scan operation identity (per scan operation)
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const scanOperationId = `SCAN_UPLOAD_${dateStr}_${generateUUID()}`;
    activeScanOperationIdRef.current = scanOperationId;
    setIdempotencyKey(scanOperationId);

    setStage('PROCESSING');
    setErrorMessage(null);

    try {
      const res = await purchasesApi.createScannerDraft(selectedFile, scanOperationId, {
        signal: abortController.signal,
      });

      // Stale response guard: check if this operation is still the active one
      if (activeScanOperationIdRef.current !== scanOperationId) {
        return;
      }

      if (res && res.draft) {
        setDraft(res.draft);
        setErrorMessage(null);
        setStage('REVIEW');
      } else {
        throw new Error('Scanner did not return a valid draft object.');
      }
    } catch (err: any) {
      // If user canceled or replaced this scan, ignore silently
      if (err?.name === 'AbortError' || abortController.signal.aborted) {
        return;
      }

      // Stale error guard: check if this operation is still the active one
      if (activeScanOperationIdRef.current !== scanOperationId) {
        return;
      }

      console.error('Scan error:', err);
      let userMsg = err.message || 'Failed to process purchase bill. Please verify server connection and document format.';
      if (
        err.code === 'NVIDIA_SERVER_ERROR' ||
        userMsg.includes('Inference connection error') ||
        userMsg.includes('NVIDIA NIM server error') ||
        userMsg.includes('internal-server-error')
      ) {
        userMsg = 'NVIDIA AI cloud connection dropped temporarily during document processing. Please click "Retry Scan" to try again.';
      }
      setErrorMessage(userMsg);
      setStage('IDLE');
    } finally {
      if (activeScanOperationIdRef.current === scanOperationId) {
        isScanningRef.current = false;
        setIsScanning(false);
        activeAbortControllerRef.current = null;
        activeScanOperationIdRef.current = null;
      }
    }
  };

  // Check draft expiration
  const isDraftExpired = Boolean(
    draft?.status === 'EXPIRED' ||
    (draft?.expiresAt && new Date(draft.expiresAt).getTime() < Date.now())
  );

  // 3. Save Draft Changes
  const handleSaveDraft = async () => {
    if (!draft || isDraftExpired) return;

    try {
      setSavingDraft(true);
      setErrorMessage(null);

      // Reconstruct working extraction
      const updatedExtraction = {
        ...draft.extraction,
        invoice: {
          ...draft.extraction.invoice,
          invoiceNumber: { ...draft.extraction.invoice.invoiceNumber, value: invoiceNumber },
          invoiceDate: { ...draft.extraction.invoice.invoiceDate, value: invoiceDate },
          dueDate: { ...draft.extraction.invoice.dueDate, value: dueDate },
          poNumber: { ...draft.extraction.invoice.poNumber, value: poNumber },
          ewayBillNumber: { ...draft.extraction.invoice.ewayBillNumber, value: ewayBillNumber },
        },
        items: items,
        additional: {
          ...draft.extraction.additional,
          notes: { ...draft.extraction.additional.notes, value: notes },
        },
      };

      const patchPayload = {
        vendorId: vendorId || null,
        vendorInvoiceNumber: invoiceNumber.trim() || undefined,
        invoiceDate: invoiceDate || undefined,
        dueDate: dueDate || undefined,
        poNumber: poNumber.trim() || undefined,
        ewayBillNumber: ewayBillNumber.trim() || undefined,
        placeOfSupply: draft.extraction.invoice?.placeOfSupply?.value || undefined,
        notes: notes.trim() || undefined,
        manualOverride: manualOverride || undefined,
        summary: manualOverride && draft.extraction?.summary ? {
          taxableAmount: draft.extraction.summary.taxableAmount?.value,
          cgstRate: draft.extraction.summary.cgstRate?.value,
          cgstAmount: draft.extraction.summary.cgstAmount?.value,
          sgstRate: draft.extraction.summary.sgstRate?.value,
          sgstAmount: draft.extraction.summary.sgstAmount?.value,
          igstRate: draft.extraction.summary.igstRate?.value,
          igstAmount: draft.extraction.summary.igstAmount?.value,
          totalTax: draft.extraction.summary.totalTax?.value,
          grandTotal: draft.extraction.summary.grandTotal?.value,
        } : undefined,
        items: items.map((it, idx) => ({
          id: it.id,
          lineNumber: it.lineNumber || idx + 1,
          productId: it.productMatch?.productId || null,
          description: it.description?.value || undefined,
          skuOrCode: it.skuOrCode?.value || null,
          hsnSac: it.hsnSac?.value || null,
          quantity: it.quantity?.value ?? undefined,
          unit: it.unit?.value || null,
          unitPrice: it.unitPrice?.value ?? undefined,
          discountPercent: it.discountPercent?.value ?? undefined,
          discountAmount: it.discountAmount?.value ?? undefined,
          taxRate: it.gstRate?.value ?? undefined,
        })),
      };

      const res = await purchasesApi.updateScannerDraft(draft._id, patchPayload);
      if (res && res.draft) {
        setDraft(res.draft);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (err: any) {
      console.error('Save draft error:', err);
      setErrorMessage(err.message || 'Failed to save draft changes.');
    } finally {
      setSavingDraft(false);
    }
  };

  // 4. Line Items Editing Handlers
  const handleUpdateItem = (index: number, field: string, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };

      if (field === 'description') {
        item.description = { ...item.description, value };
      } else if (field === 'quantity') {
        const qty = parseFloat(value) || 0;
        item.quantity = { ...item.quantity, value: qty };
        recalcLine(item);
      } else if (field === 'unitPrice') {
        const price = parseFloat(value) || 0;
        item.unitPrice = { ...item.unitPrice, value: price };
        recalcLine(item);
      } else if (field === 'discountPercent') {
        const disc = parseFloat(value) || 0;
        item.discountPercent = { ...item.discountPercent, value: disc };
        recalcLine(item);
      } else if (field === 'gstRate') {
        const rate = parseFloat(value) || 0;
        item.gstRate = { ...item.gstRate, value: rate };
        recalcLine(item);
      } else if (field === 'hsnSac') {
        item.hsnSac = { ...item.hsnSac, value };
      } else if (field === 'unit') {
        item.unit = { ...item.unit, value };
      }

      updated[index] = item;
      return updated;
    });
  };

  const recalcLine = (item: IExtractedLineItem) => {
    const qty = item.quantity?.value || 0;
    const price = item.unitPrice?.value || 0;
    const discPct = item.discountPercent?.value || 0;
    const gstRate = item.gstRate?.value || 0;

    const baseAmount = Math.round(qty * price * 100) / 100;
    const discountAmount = Math.round(((baseAmount * discPct) / 100) * 100) / 100;
    const taxableAmount = Math.max(0, Math.round((baseAmount - discountAmount) * 100) / 100);
    const taxAmount = Math.round(((taxableAmount * gstRate) / 100) * 100) / 100;
    const lineTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;

    item.discountAmount = { ...item.discountAmount, value: discountAmount };
    item.taxableAmount = { ...item.taxableAmount, value: taxableAmount };
    item.lineTotal = { ...item.lineTotal, value: lineTotal };
    if (!item.calculated) {
      item.calculated = {
        taxableAmount,
        cgstAmount: Math.round((taxAmount / 2) * 100) / 100,
        sgstAmount: Math.round((taxAmount / 2) * 100) / 100,
        igstAmount: 0,
        cessAmount: 0,
        lineTotal,
        discrepancy: 0,
      };
    } else {
      item.calculated.taxableAmount = taxableAmount;
      item.calculated.cgstAmount = Math.round((taxAmount / 2) * 100) / 100;
      item.calculated.sgstAmount = Math.round((taxAmount / 2) * 100) / 100;
      item.calculated.lineTotal = lineTotal;
    }
  };

  const handleSelectProductForLine = (index: number, product: Product) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      const prodId = product.id || (product as any)._id;

      item.productMatch = {
        productId: prodId,
        productName: product.name,
        sku: (product as any).sku || null,
        uom: (product as any).uom || 'UNIT',
        currentStock: (product as any).currentStock ?? null,
        lastPurchasePrice: (product as any).defaultPriceMinor ? (product as any).defaultPriceMinor / 100 : null,
        matchingMethod: 'USER_SELECTED',
        confidence: 1.0,
        isMatched: true,
        status: 'VERIFIED',
      };

      // Set SKU & UOM if empty
      if (!item.skuOrCode?.value && (product as any).sku) {
        item.skuOrCode = { ...item.skuOrCode, value: (product as any).sku };
      }
      if (!item.unit?.value && (product as any).uom) {
        item.unit = { ...item.unit, value: (product as any).uom };
      }

      updated[index] = item;
      return updated;
    });
    setActiveItemSearchIdx(null);
    setProductSearchQuery('');

    if (draft?._id && product) {
      const prodId = (product as any).id || (product as any)._id;
      purchasesApi
        .updateScannerDraft(draft._id, {
          items: [{ id: items[index]?.id, productId: prodId }],
        })
        .catch((err) => console.error('Failed to auto-save product mapping to draft:', err));
    }
  };

  // --- Vendor Selection & Creation Handlers ---
  const handleSelectVendor = async (vId: string, vendorName?: string, gstNumber?: string) => {
    setVendorId(vId);
    setDraft((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        vendorMatch: {
          matchedVendorId: vId || null,
          matchedVendorName:
            vendorName || localVendors.find((v) => (v._id || v.id) === vId)?.name || null,
          matchedVendorGstin:
            gstNumber || localVendors.find((v) => (v._id || v.id) === vId)?.gstNumber || null,
          matchingMethod: 'MANUAL_SELECTION',
          confidence: 1.0,
          status: vId ? 'VERIFIED' : 'MISSING',
        },
      };
    });

    if (draft?._id && vId) {
      try {
        await purchasesApi.updateScannerDraft(draft._id, { vendorId: vId });
      } catch (err) {
        console.error('Failed to auto-save selected vendor to draft:', err);
      }
    }
  };

  const handleOpenCreateVendorConfirm = () => {
    setVendorCreateConfirmOpen(true);
  };

  const handleOpenEditVendorModal = () => {
    const s = draft?.extraction?.supplier;
    setVendorForm({
      name: s?.name?.value || '',
      gstNumber: s?.gstin?.value || '',
      mobile: s?.phone?.value || '',
      email: s?.email?.value || '',
      address: s?.address?.value || '',
      city: s?.city?.value || '',
      state: s?.state?.value || '',
      pincode: s?.pincode?.value || '',
    });
    setVendorEditModalOpen(true);
  };

  const handleCreateVendor = async (dataToSubmit?: typeof vendorForm) => {
    const form = dataToSubmit || {
      name: draft?.extraction?.supplier?.name?.value || '',
      gstNumber: draft?.extraction?.supplier?.gstin?.value || '',
      mobile: draft?.extraction?.supplier?.phone?.value || '',
      email: draft?.extraction?.supplier?.email?.value || '',
      address: draft?.extraction?.supplier?.address?.value || '',
      city: draft?.extraction?.supplier?.city?.value || '',
      state: draft?.extraction?.supplier?.state?.value || '',
      pincode: draft?.extraction?.supplier?.pincode?.value || '',
    };

    if (!form.name.trim()) {
      setErrorMessage('Vendor name is required');
      return;
    }

    setIsCreatingVendor(true);
    setErrorMessage(null);
    try {
      const payload: Partial<Vendor> = {
        name: form.name.trim(),
        gstNumber: form.gstNumber ? form.gstNumber.trim().toUpperCase() : undefined,
        mobile: form.mobile ? form.mobile.trim() : undefined,
        email: form.email ? form.email.trim() : undefined,
        address: form.address ? form.address.trim() : undefined,
        city: form.city ? form.city.trim() : undefined,
        state: form.state ? form.state.trim() : undefined,
        pincode: form.pincode ? form.pincode.trim() : undefined,
      };

      const res = await purchasesApi.createVendor(payload);
      const newVendor = res.vendor || (res as any).data?.vendor;
      if (newVendor) {
        const vId = newVendor.id || newVendor._id;
        setLocalVendors((prev) => [...prev.filter((v) => (v._id || v.id) !== vId), newVendor]);
        await handleSelectVendor(vId, newVendor.name, newVendor.gstNumber || undefined);
      }
      setVendorCreateConfirmOpen(false);
      setVendorEditModalOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create vendor');
    } finally {
      setIsCreatingVendor(false);
    }
  };

  // --- Product Creation Handlers ---
  const handleOpenCreateProductConfirm = (idx: number) => {
    setActiveProductLineIdx(idx);
    setProductCreateConfirmOpen(true);
  };

  const handleOpenEditProductModal = (idx: number) => {
    setActiveProductLineIdx(idx);
    const it = items[idx];
    const gstRate =
      it?.gstRate?.value ??
      (it?.cgstRate?.value && it?.sgstRate?.value
        ? it.cgstRate.value + it.sgstRate.value
        : 18);
    setProductForm({
      name: it?.description?.value || '',
      sku: it?.skuOrCode?.value || '',
      barcode: '',
      hsnCode: it?.hsnSac?.value || '',
      uom: it?.unit?.value || 'NOS',
      purchasePrice: it?.unitPrice?.value || 0,
      sellingPrice: it?.unitPrice?.value || 0,
      gstRate,
    });
    setProductEditModalOpen(true);
  };

  const handleCreateProduct = async () => {
    if (activeProductLineIdx === null) return;
    const it = items[activeProductLineIdx];
    if (!it?.description?.value) return;

    setIsCreatingProduct(true);
    setErrorMessage(null);
    try {
      const priceMinor = Math.round((it.unitPrice?.value || 0) * 100);
      const gstRate =
        it.gstRate?.value ??
        (it.cgstRate?.value && it.sgstRate?.value
          ? it.cgstRate.value + it.sgstRate.value
          : 18);

      const payload: Partial<Product> = {
        name: it.description.value,
        hsnCode: it.hsnSac?.value || undefined,
        sku: it.skuOrCode?.value || undefined,
        uom: it.unit?.value || 'NOS',
        defaultPriceMinor: priceMinor,
        lastPurchasePriceMinor: priceMinor,
        defaultTaxRateBps: Math.round(gstRate * 100),
        type: 'PRODUCT',
      };

      const newProd = await apiClient.createProduct(payload);
      const prodId = newProd.id || (newProd as any)._id;
      setLocalProducts((prev) => [...prev.filter((p) => (p.id || (p as any)._id) !== prodId), newProd]);
      handleSelectProductForLine(activeProductLineIdx, newProd);

      setProductCreateConfirmOpen(false);
      setActiveProductLineIdx(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to add product');
    } finally {
      setIsCreatingProduct(false);
    }
  };

  const handleSaveEditedProduct = async () => {
    if (activeProductLineIdx === null || !productForm.name.trim()) {
      setErrorMessage('Product name is required');
      return;
    }

    setIsCreatingProduct(true);
    setErrorMessage(null);
    try {
      const payload: Partial<Product> = {
        name: productForm.name.trim(),
        sku: productForm.sku.trim() || undefined,
        barcode: productForm.barcode.trim() || undefined,
        hsnCode: productForm.hsnCode.trim() || undefined,
        uom: productForm.uom.trim() || 'NOS',
        defaultPriceMinor: Math.round((productForm.sellingPrice || productForm.purchasePrice || 0) * 100),
        lastPurchasePriceMinor: Math.round((productForm.purchasePrice || 0) * 100),
        defaultTaxRateBps: Math.round((productForm.gstRate || 0) * 100),
        type: 'PRODUCT',
      };

      const newProd = await apiClient.createProduct(payload);
      const prodId = newProd.id || (newProd as any)._id;
      setLocalProducts((prev) => [...prev.filter((p) => (p.id || (p as any)._id) !== prodId), newProd]);
      handleSelectProductForLine(activeProductLineIdx, newProd);

      setProductEditModalOpen(false);
      setActiveProductLineIdx(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save product');
    } finally {
      setIsCreatingProduct(false);
    }
  };

  const handleOpenBulkProductModal = () => {
    const unmapped = items
      .map((it, idx) => {
        const gstRate =
          it.gstRate?.value ??
          (it.cgstRate?.value && it.sgstRate?.value
            ? it.cgstRate.value + it.sgstRate.value
            : 18);
        return {
          index: idx,
          name: it.description?.value || `Item ${idx + 1}`,
          hsnCode: it.hsnSac?.value || '',
          uom: it.unit?.value || 'NOS',
          purchasePrice: it.unitPrice?.value || 0,
          gstRate,
          selected: true,
        };
      })
      .filter((entry) => !items[entry.index].productMatch?.productId);

    setBulkProducts(unmapped);
    setBulkProductModalOpen(true);
  };

  const handleExecuteBulkCreateProducts = async () => {
    const toCreate = bulkProducts.filter((b) => b.selected);
    if (toCreate.length === 0) {
      setBulkProductModalOpen(false);
      return;
    }

    setIsCreatingProduct(true);
    setErrorMessage(null);
    try {
      for (const item of toCreate) {
        const payload: Partial<Product> = {
          name: item.name,
          hsnCode: item.hsnCode || undefined,
          uom: item.uom || 'NOS',
          defaultPriceMinor: Math.round(item.purchasePrice * 100),
          lastPurchasePriceMinor: Math.round(item.purchasePrice * 100),
          defaultTaxRateBps: Math.round(item.gstRate * 100),
          type: 'PRODUCT',
        };

        const newProd = await apiClient.createProduct(payload);
        const prodId = newProd.id || (newProd as any)._id;
        setLocalProducts((prev) => [...prev.filter((p) => (p.id || (p as any)._id) !== prodId), newProd]);
        handleSelectProductForLine(item.index, newProd);
      }
      setBulkProductModalOpen(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Bulk product creation failed');
    } finally {
      setIsCreatingProduct(false);
    }
  };

  const handleRemoveLineItem = (index: number) => {
    if (items.length <= 1) {
      alert('A purchase order must contain at least one line item.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddLineItem = () => {
    const newItem: IExtractedLineItem = {
      id: `manual_${Date.now()}`,
      lineNumber: items.length + 1,
      description: { value: '', confidence: 1, bbox: null, status: 'VERIFIED' },
      skuOrCode: { value: '', confidence: 1, bbox: null, status: 'MISSING' },
      hsnSac: { value: '', confidence: 1, bbox: null, status: 'MISSING' },
      quantity: { value: 1, confidence: 1, bbox: null, status: 'VERIFIED' },
      unit: { value: 'NOS', confidence: 1, bbox: null, status: 'VERIFIED' },
      unitPrice: { value: 0, confidence: 1, bbox: null, status: 'VERIFIED' },
      discountPercent: { value: 0, confidence: 1, bbox: null, status: 'VERIFIED' },
      discountAmount: { value: 0, confidence: 1, bbox: null, status: 'VERIFIED' },
      taxableAmount: { value: 0, confidence: 1, bbox: null, status: 'VERIFIED' },
      gstRate: { value: 18, confidence: 1, bbox: null, status: 'VERIFIED' },
      cgstRate: { value: 9, confidence: 1, bbox: null, status: 'VERIFIED' },
      cgstAmount: { value: 0, confidence: 1, bbox: null, status: 'VERIFIED' },
      sgstRate: { value: 9, confidence: 1, bbox: null, status: 'VERIFIED' },
      sgstAmount: { value: 0, confidence: 1, bbox: null, status: 'VERIFIED' },
      igstRate: { value: 0, confidence: 1, bbox: null, status: 'VERIFIED' },
      igstAmount: { value: 0, confidence: 1, bbox: null, status: 'VERIFIED' },
      cessRate: { value: 0, confidence: 1, bbox: null, status: 'VERIFIED' },
      cessAmount: { value: 0, confidence: 1, bbox: null, status: 'VERIFIED' },
      lineTotal: { value: 0, confidence: 1, bbox: null, status: 'VERIFIED' },
    };
    setItems((prev) => [...prev, newItem]);
  };

  // 5. Financial Totals Calculations
  const calculatedSubtotal = items.reduce((acc, it) => {
    const qty = it.quantity?.value || 0;
    const price = it.unitPrice?.value || 0;
    const disc = it.discountAmount?.value || 0;
    const taxable = it.taxableAmount?.value ?? Math.max(0, qty * price - disc);
    return acc + taxable;
  }, 0);

  const draftRecon = draft?.reconciliation;
  const isIntraState =
    draftRecon?.taxMode === 'INTRA_STATE' ||
    Boolean(draft?.extraction?.summary?.cgstAmount?.value && draft.extraction.summary.cgstAmount.value > 0) ||
    items.some((it) => (it.cgstRate?.value && it.cgstRate.value > 0) || (it.cgstAmount?.value && it.cgstAmount.value > 0));

  // CGST calculation
  const calculatedCgst = items.reduce((acc, it) => {
    const qty = it.quantity?.value || 0;
    const price = it.unitPrice?.value || 0;
    const disc = it.discountAmount?.value || 0;
    const taxable = it.taxableAmount?.value ?? Math.max(0, qty * price - disc);
    const rate = it.cgstRate?.value ?? (isIntraState ? (it.gstRate?.value ? it.gstRate.value / 2 : 9) : 0);
    return acc + Math.round(((taxable * rate) / 100) * 100) / 100;
  }, 0);

  // SGST calculation
  const calculatedSgst = items.reduce((acc, it) => {
    const qty = it.quantity?.value || 0;
    const price = it.unitPrice?.value || 0;
    const disc = it.discountAmount?.value || 0;
    const taxable = it.taxableAmount?.value ?? Math.max(0, qty * price - disc);
    const rate = it.sgstRate?.value ?? (isIntraState ? (it.gstRate?.value ? it.gstRate.value / 2 : 9) : 0);
    return acc + Math.round(((taxable * rate) / 100) * 100) / 100;
  }, 0);

  const calculatedTaxTotal = isIntraState
    ? Math.round((calculatedCgst + calculatedSgst) * 100) / 100
    : items.reduce((acc, it) => {
        const qty = it.quantity?.value || 0;
        const price = it.unitPrice?.value || 0;
        const disc = it.discountAmount?.value || 0;
        const taxable = it.taxableAmount?.value ?? Math.max(0, qty * price - disc);
        const rate = it.igstRate?.value ?? it.gstRate?.value ?? 18;
        return acc + Math.round(((taxable * rate) / 100) * 100) / 100;
      }, 0);

  const calculatedGrandTotal = Math.round((calculatedSubtotal + calculatedTaxTotal) * 100) / 100;

  const printedTaxable = draft?.extraction?.summary?.taxableAmount?.value ?? calculatedSubtotal;
  const printedCgst = draft?.extraction?.summary?.cgstAmount?.value ?? (isIntraState ? calculatedCgst : null);
  const printedSgst = draft?.extraction?.summary?.sgstAmount?.value ?? (isIntraState ? calculatedSgst : null);
  const printedTaxTotal = draft?.extraction?.summary?.totalTax?.value ?? calculatedTaxTotal;
  const printedGrandTotal = draft?.extraction?.summary?.grandTotal?.value ?? calculatedGrandTotal;

  const subtotalDiscrepancy = Math.abs(printedTaxable - calculatedSubtotal);
  const cgstDiscrepancy = printedCgst !== null ? Math.abs(printedCgst - calculatedCgst) : 0;
  const sgstDiscrepancy = printedSgst !== null ? Math.abs(printedSgst - calculatedSgst) : 0;
  const taxTotalDiscrepancy = Math.abs(printedTaxTotal - calculatedTaxTotal);
  const grandTotalDiscrepancy = Math.abs(printedGrandTotal - calculatedGrandTotal);

  const hasDiscrepancy = grandTotalDiscrepancy > 1.0 || subtotalDiscrepancy > 1.0 || taxTotalDiscrepancy > 1.0;

  // Active Totals for Display & Editing (Phase 5.6)
  const activeSubtotal = draft?.extraction?.summary?.taxableAmount?.value ?? calculatedSubtotal;
  const activeCgstRate = draft?.extraction?.summary?.cgstRate?.value ?? (isIntraState ? 9 : 0);
  const activeCgst = draft?.extraction?.summary?.cgstAmount?.value ?? (isIntraState ? calculatedCgst : 0);
  const activeSgstRate = draft?.extraction?.summary?.sgstRate?.value ?? (isIntraState ? 9 : 0);
  const activeSgst = draft?.extraction?.summary?.sgstAmount?.value ?? (isIntraState ? calculatedSgst : 0);
  const activeIgstRate = draft?.extraction?.summary?.igstRate?.value ?? (!isIntraState ? 18 : 0);
  const activeIgst = draft?.extraction?.summary?.igstAmount?.value ?? (!isIntraState ? calculatedTaxTotal : 0);
  const activeTaxTotal = draft?.extraction?.summary?.totalTax?.value ?? calculatedTaxTotal;
  const activeGrandTotal = draft?.extraction?.summary?.grandTotal?.value ?? calculatedGrandTotal;

  const handleOpenEditTotals = () => {
    setEditSubtotal(activeSubtotal.toFixed(2));
    setEditCgstRate(activeCgstRate.toString());
    setEditCgstAmount(activeCgst.toFixed(2));
    setEditSgstRate(activeSgstRate.toString());
    setEditSgstAmount(activeSgst.toFixed(2));
    setEditIgstRate(activeIgstRate.toString());
    setEditIgstAmount(activeIgst.toFixed(2));
    setEditTotalTax(activeTaxTotal.toFixed(2));
    setEditGrandTotal(activeGrandTotal.toFixed(2));
    setTotalsEditError(null);
    setIsEditingTotals(true);
  };

  const handleCancelEditTotals = () => {
    setIsEditingTotals(false);
    setTotalsEditError(null);
  };

  const handleSubtotalChangeInEdit = (val: string) => {
    setEditSubtotal(val);
    const sub = parseFloat(val);
    if (!isNaN(sub) && sub >= 0) {
      if (isIntraState) {
        const cRate = parseFloat(editCgstRate) || 0;
        const sRate = parseFloat(editSgstRate) || 0;
        const newCgst = Math.round(((sub * cRate) / 100) * 100) / 100;
        const newSgst = Math.round(((sub * sRate) / 100) * 100) / 100;
        const newTax = Math.round((newCgst + newSgst) * 100) / 100;
        setEditCgstAmount(newCgst.toFixed(2));
        setEditSgstAmount(newSgst.toFixed(2));
        setEditTotalTax(newTax.toFixed(2));
        setEditGrandTotal((Math.round((sub + newTax) * 100) / 100).toFixed(2));
      } else {
        const iRate = parseFloat(editIgstRate) || 0;
        const newIgst = Math.round(((sub * iRate) / 100) * 100) / 100;
        setEditIgstAmount(newIgst.toFixed(2));
        setEditTotalTax(newIgst.toFixed(2));
        setEditGrandTotal((Math.round((sub + newIgst) * 100) / 100).toFixed(2));
      }
    }
  };

  const handleCgstRateChangeInEdit = (val: string) => {
    setEditCgstRate(val);
    const rate = parseFloat(val) || 0;
    const sub = parseFloat(editSubtotal) || 0;
    const newCgst = Math.round(((sub * rate) / 100) * 100) / 100;
    const currentSgst = parseFloat(editSgstAmount) || 0;
    setEditCgstAmount(newCgst.toFixed(2));
    const newTax = Math.round((newCgst + currentSgst) * 100) / 100;
    setEditTotalTax(newTax.toFixed(2));
    setEditGrandTotal((Math.round((sub + newTax) * 100) / 100).toFixed(2));
  };

  const handleSgstRateChangeInEdit = (val: string) => {
    setEditSgstRate(val);
    const rate = parseFloat(val) || 0;
    const sub = parseFloat(editSubtotal) || 0;
    const currentCgst = parseFloat(editCgstAmount) || 0;
    const newSgst = Math.round(((sub * rate) / 100) * 100) / 100;
    setEditSgstAmount(newSgst.toFixed(2));
    const newTax = Math.round((currentCgst + newSgst) * 100) / 100;
    setEditTotalTax(newTax.toFixed(2));
    setEditGrandTotal((Math.round((sub + newTax) * 100) / 100).toFixed(2));
  };

  const handleIgstRateChangeInEdit = (val: string) => {
    setEditIgstRate(val);
    const rate = parseFloat(val) || 0;
    const sub = parseFloat(editSubtotal) || 0;
    const newIgst = Math.round(((sub * rate) / 100) * 100) / 100;
    setEditIgstAmount(newIgst.toFixed(2));
    setEditTotalTax(newIgst.toFixed(2));
    setEditGrandTotal((Math.round((sub + newIgst) * 100) / 100).toFixed(2));
  };

  const handleSaveEditedTotals = async () => {
    const sub = parseFloat(editSubtotal);
    const grand = parseFloat(editGrandTotal);
    const tax = parseFloat(editTotalTax);
    const cgst = parseFloat(editCgstAmount) || 0;
    const sgst = parseFloat(editSgstAmount) || 0;
    const igst = parseFloat(editIgstAmount) || 0;
    const cRate = parseFloat(editCgstRate) || 0;
    const sRate = parseFloat(editSgstRate) || 0;
    const iRate = parseFloat(editIgstRate) || 0;

    if (isNaN(sub) || sub < 0) {
      setTotalsEditError('Subtotal must be a valid non-negative number.');
      return;
    }
    if (isNaN(grand) || grand < 0) {
      setTotalsEditError('Grand Total must be a valid non-negative number.');
      return;
    }
    if (isNaN(tax) || tax < 0) {
      setTotalsEditError('Total GST must be a valid non-negative number.');
      return;
    }

    setManualOverride(true);
    setIsEditingTotals(false);
    setTotalsEditError(null);

    if (draft) {
      const updatedDraft: IPurchaseDraft = {
        ...draft,
        manualOverride: true,
        extraction: {
          ...draft.extraction,
          summary: {
            ...draft.extraction?.summary,
            taxableAmount: { value: sub, confidence: 1, bbox: null, status: 'VERIFIED' },
            cgstRate: { value: cRate, confidence: 1, bbox: null, status: 'VERIFIED' },
            cgstAmount: { value: cgst, confidence: 1, bbox: null, status: 'VERIFIED' },
            sgstRate: { value: sRate, confidence: 1, bbox: null, status: 'VERIFIED' },
            sgstAmount: { value: sgst, confidence: 1, bbox: null, status: 'VERIFIED' },
            igstRate: { value: iRate, confidence: 1, bbox: null, status: 'VERIFIED' },
            igstAmount: { value: igst, confidence: 1, bbox: null, status: 'VERIFIED' },
            totalTax: { value: tax, confidence: 1, bbox: null, status: 'VERIFIED' },
            grandTotal: { value: grand, confidence: 1, bbox: null, status: 'VERIFIED' },
          },
        },
      };
      setDraft(updatedDraft);

      try {
        await purchasesApi.updateScannerDraft(draft._id, {
          manualOverride: true,
          summary: {
            taxableAmount: sub,
            cgstRate: cRate,
            cgstAmount: cgst,
            sgstRate: sRate,
            sgstAmount: sgst,
            igstRate: iRate,
            igstAmount: igst,
            totalTax: tax,
            grandTotal: grand,
          },
        });
      } catch (err) {
        console.error('Failed to auto-save manual summary override:', err);
      }
    }
  };

  // 6. Confirmation Pre-check
  const runConfirmationPreCheck = (): string | null => {
    if (isDraftExpired) {
      return 'This draft has expired. Please scan the bill again.';
    }
    if (!vendorId) {
      return 'Please resolve and select a registered Vendor before confirming.';
    }
    if (!invoiceNumber.trim()) {
      return 'Invoice Number is required by Purchase rules.';
    }
    if (!invoiceDate) {
      return 'A valid Invoice Date is required.';
    }
    if (items.length === 0) {
      return 'At least one product line item is required.';
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.productMatch?.productId) {
        return `Line #${i + 1} ("${it.description?.value || 'Untitled'}") has not been mapped to a catalogue product.`;
      }
      if ((it.quantity?.value || 0) <= 0) {
        return `Line #${i + 1} has an invalid quantity. Must be greater than zero.`;
      }
      if ((it.unitPrice?.value || 0) < 0) {
        return `Line #${i + 1} has an invalid unit price.`;
      }
    }
    if (amountPaid > activeGrandTotal) {
      return `Amount paid (₹${amountPaid}) cannot exceed Grand Total (₹${activeGrandTotal}).`;
    }
    if (amountPaid > 0 && !paymentMethod) {
      return 'Please select a Payment Method for the recorded payment.';
    }
    if (amountPaid > 0 && !paymentDate) {
      return 'Please provide a valid Payment Date.';
    }
    return null;
  };

  const handleOpenConfirmDialog = () => {
    const validationError = runConfirmationPreCheck();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }
    setErrorMessage(null);
    setConfirmError(null);
    setShowConfirmDialog(true);
  };

  // 7. Explicit Final Confirmation Handler
  const handleExecuteConfirmation = async () => {
    if (!draft || stage === 'CONFIRMING') return;

    try {
      setStage('CONFIRMING');
      setConfirmError(null);

      // Prepare payload with explicit vendorId and mapped products
      const payload = {
        vendorId: vendorId || undefined,
        vendorInvoiceNumber: invoiceNumber.trim() || undefined,
        invoiceDate: invoiceDate || undefined,
        dueDate: dueDate || undefined,
        purchaseType: 'DIRECT_PURCHASE' as const,
        directReceivedFull,
        paymentMethod,
        paymentReference: paymentReference.trim() || undefined,
        notes: notes.trim() || undefined,
        payment: amountPaid > 0 ? {
          amount: amountPaid,
          paymentMethod,
          paymentAccountId: paymentAccountId || undefined,
          paymentDate: paymentDate || new Date().toISOString().split('T')[0],
          reference: paymentReference.trim() || undefined,
          notes: paymentNotes.trim() || undefined,
        } : undefined,
        manualOverride: manualOverride || undefined,
        summary: manualOverride && draft.extraction?.summary ? {
          taxableAmount: draft.extraction.summary.taxableAmount?.value,
          cgstRate: draft.extraction.summary.cgstRate?.value,
          cgstAmount: draft.extraction.summary.cgstAmount?.value,
          sgstRate: draft.extraction.summary.sgstRate?.value,
          sgstAmount: draft.extraction.summary.sgstAmount?.value,
          igstRate: draft.extraction.summary.igstRate?.value,
          igstAmount: draft.extraction.summary.igstAmount?.value,
          totalTax: draft.extraction.summary.totalTax?.value,
          grandTotal: draft.extraction.summary.grandTotal?.value,
        } : undefined,
        items: items.map((it, idx) => ({
          id: it.id,
          lineNumber: it.lineNumber || idx + 1,
          productId: it.productMatch?.productId || undefined,
          orderedQuantity: it.quantity?.value ?? undefined,
          unitPurchasePrice: it.unitPrice?.value ?? undefined,
          discountPercent: it.discountPercent?.value ?? undefined,
          discountAmount: it.discountAmount?.value ?? undefined,
          taxRate: it.gstRate?.value ?? undefined,
        })),
      };

      const res = await purchasesApi.confirmScannerDraft(draft._id, payload);

      if (res && res.success && res.purchaseId) {
        setShowConfirmDialog(false);
        setStage('SUCCESS');
        onPurchaseConfirmed(res.purchaseId);
      } else {
        throw new Error('Confirmation did not return a valid purchase record.');
      }
    } catch (err: any) {
      console.error('Confirmation error:', err);

      // Phase 4.1: If network error or timeout, verify draft status on server before showing error
      try {
        const checkRes = await purchasesApi.getScannerDraft(draft._id);
        if (checkRes?.draft?.status === 'CONVERTED' && checkRes.draft.confirmedPurchaseId) {
          setShowConfirmDialog(false);
          setStage('SUCCESS');
          onPurchaseConfirmed(checkRes.draft.confirmedPurchaseId);
          return;
        }
      } catch (checkErr) {
        // Fall through to display error
      }

      setConfirmError(
        err.message || 'Confirmation failed. Please review duplicate bill warnings or verify product catalog state.'
      );
      setStage('REVIEW');
    }
  };

  // Status Badge Helper Component
  const StatusBadge = ({ status, label }: { status?: FieldStatus; label?: string }) => {
    if (status === 'VERIFIED') {
      return (
        <span
          className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300"
          aria-label="Verified Status"
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
          {label || 'VERIFIED'}
        </span>
      );
    }
    if (status === 'REVIEW_REQUIRED') {
      return (
        <span
          className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-300"
          aria-label="Review Required Status"
        >
          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
          {label || 'REVIEW REQUIRED'}
        </span>
      );
    }
    if (status === 'MISSING') {
      return (
        <span
          className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-100/80 px-2 py-0.5 rounded-full border border-rose-300 border-dashed"
          aria-label="Missing Status"
        >
          <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
          {label || 'MISSING'}
        </span>
      );
    }
    return (
      <span
        className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-800 bg-blue-100/80 px-2 py-0.5 rounded-full border border-blue-200"
        aria-label="Extracted Status"
      >
        <Info className="w-3 h-3 text-blue-600 shrink-0" />
        {label || 'EXTRACTED'}
      </span>
    );
  };

  // Document preview helpers
  const previewImages = draft?.originalFile?.previewImages || [];
  const hasPreviewImages = previewImages.length > 0;
  const fileUrl = draft?.originalFile?.fileUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-7xl w-full h-[95vh] shadow-2xl overflow-hidden border border-gray-100 flex flex-col">
        {/* Modal Top Navigation Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-purple-100 text-purple-700 shadow-xs">
              <Sparkles className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-gray-900">
                  AI Purchase Bill Scanner
                </h2>
                {draft && (
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-lg bg-gray-200/80 text-gray-700 font-semibold">
                    {draft.draftNumber}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Automated document extraction with deterministic human review &amp; confirmation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {stage === 'REVIEW' && draft && (
              <div className="hidden sm:flex items-center gap-2 mr-2">
                <span className="text-xs text-gray-500 font-medium">
                  AI extraction confidence:{' '}
                  <strong className="text-gray-900 font-mono">
                    {Math.round(
                      (draft.extraction?.summary?.grandTotal?.confidence ?? 0.85) * 100
                    )}
                    %
                  </strong>
                </span>
                <span className="text-gray-300">|</span>
                <StatusBadge status={draft.status as any} label={draft.status} />
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              disabled={stage === 'CONFIRMING'}
              className="p-2 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition cursor-pointer disabled:opacity-50"
              title="Close scanner"
              aria-label="Close scanner dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="px-6 py-3 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {selectedFile && stage === 'IDLE' && (
                <button
                  type="button"
                  onClick={handleStartScan}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold shadow-xs transition-colors"
                >
                  Retry Scan
                </button>
              )}
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-600 hover:text-rose-900 text-xs font-bold px-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Expired Draft Notice */}
        {isDraftExpired && stage === 'REVIEW' && (
          <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>This draft has expired. Editing is disabled. Please scan the bill again.</span>
          </div>
        )}

        {/* Save Draft Success Toast */}
        {saveSuccess && (
          <div className="px-6 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shrink-0">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Draft changes saved successfully!</span>
          </div>
        )}

        {/* Main Body Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* STAGE 1: File Selection & Upload */}
          {stage === 'IDLE' && (
            <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 overflow-y-auto">
              <div className="max-w-xl w-full text-center space-y-6">
                <div className="p-4 rounded-3xl bg-purple-50 inline-block border border-purple-100">
                  <Upload className="w-12 h-12 text-purple-600 mx-auto" />
                </div>

                <div>
                  <h3 className="text-xl font-bold text-gray-900">Upload Supplier Purchase Bill</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Select a scanned invoice, receipt, or photo (PDF, JPG, PNG up to 25MB).
                  </p>
                </div>

                {fileError && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2 text-left">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{fileError}</span>
                  </div>
                )}

                <label className="border-2 border-dashed border-purple-200 hover:border-purple-500 rounded-3xl p-8 flex flex-col items-center justify-center cursor-pointer transition bg-purple-50/20 hover:bg-purple-50/50 block">
                  <span className="text-sm font-bold text-gray-800">
                    {selectedFile ? selectedFile.name : 'Click or Drag & Drop bill file here'}
                  </span>
                  <span className="text-xs text-gray-400 mt-1">
                    Supported formats: PDF, JPG, JPEG, PNG
                  </span>
                  {selectedFile && (
                    <span className="mt-2 text-xs font-semibold text-purple-700 bg-purple-100 px-3 py-1 rounded-full">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB ready
                    </span>
                  )}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/png,image/jpeg"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 text-xs font-semibold text-gray-600 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={!selectedFile || isScanning}
                    onClick={handleStartScan}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="w-4 h-4 text-purple-200" />
                    {isScanning ? 'Scanning...' : 'Scan & Extract Bill'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 2: Processing Progress */}
          {stage === 'PROCESSING' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-6 text-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-purple-100 border-t-purple-600 animate-spin flex items-center justify-center" />
                <Sparkles className="w-8 h-8 text-purple-600 absolute inset-0 m-auto animate-pulse" />
              </div>

              <div className="space-y-2 max-w-md">
                <h3 className="text-lg font-bold text-gray-900">
                  {processingSteps[processingStep]}
                </h3>
                <p className="text-xs text-gray-500">
                  Our secure backend vision pipeline is reading your purchase invoice, validating financial totals, and matching inventory catalog.
                </p>
              </div>

              <div className="w-64 bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-purple-600 h-full transition-all duration-500 rounded-full"
                  style={{
                    width: `${Math.round(((processingStep + 1) / processingSteps.length) * 100)}%`,
                  }}
                />
              </div>

              <p className="text-[11px] text-gray-400 font-mono">
                Step {processingStep + 1} of {processingSteps.length}
              </p>
            </div>
          )}

          {/* STAGE 3: Review Split View */}
          {stage === 'REVIEW' && draft && (
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              {/* LEFT PANE: Document Preview */}
              <div className="w-full lg:w-5/12 border-b lg:border-b-0 lg:border-r border-gray-200 bg-gray-900 flex flex-col h-64 lg:h-full shrink-0">
                {/* Preview Toolbar */}
                <div className="px-4 py-2 bg-gray-800 text-gray-300 text-xs flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-400" />
                    <span className="font-medium truncate max-w-[150px]">
                      {draft.originalFile?.fileName || 'Document'}
                    </span>
                  </div>

                  {hasPreviewImages && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={currentPage <= 0}
                        onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                        className="p-1 hover:bg-gray-700 rounded disabled:opacity-30 cursor-pointer"
                        title="Previous page"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="font-mono text-[11px]">
                        Page {currentPage + 1} of {previewImages.length}
                      </span>
                      <button
                        type="button"
                        disabled={currentPage >= previewImages.length - 1}
                        onClick={() => setCurrentPage((p) => Math.min(previewImages.length - 1, p + 1))}
                        className="p-1 hover:bg-gray-700 rounded disabled:opacity-30 cursor-pointer"
                        title="Next page"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {fileUrl && (
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                {/* Preview Viewport */}
                <div className="flex-1 overflow-auto flex items-center justify-center p-2 bg-gray-950">
                  {hasPreviewImages ? (
                    <img
                      src={previewImages[currentPage]}
                      alt={`Page ${currentPage + 1}`}
                      className="max-h-full max-w-full object-contain shadow-lg rounded"
                    />
                  ) : fileUrl && fileUrl.endsWith('.pdf') ? (
                    <iframe
                      src={`${fileUrl}#toolbar=0`}
                      className="w-full h-full border-0"
                      title="Document PDF Preview"
                    />
                  ) : fileUrl ? (
                    <img
                      src={fileUrl}
                      alt="Scanned Document"
                      className="max-h-full max-w-full object-contain shadow-lg rounded"
                    />
                  ) : (
                    <div className="text-gray-500 text-xs flex flex-col items-center">
                      <FileText className="w-8 h-8 mb-1 opacity-50" />
                      Document preview unavailable
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT PANE: Extracted Form Fields & Verification */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-gray-50/50">
                {/* Section 1: Vendor Review */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-purple-600" />
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                        Supplier / Vendor Information
                      </h3>
                    </div>

                    <StatusBadge
                      status={
                        vendorId
                          ? 'VERIFIED'
                          : draft.vendorMatch?.status === 'VERIFIED'
                          ? 'VERIFIED'
                          : 'MISSING'
                      }
                      label={
                        vendorId
                          ? 'VENDOR RESOLVED'
                          : draft.vendorMatch?.status === 'VERIFIED'
                          ? 'VERIFIED MATCH'
                          : 'NEW VENDOR / NOT IN CATALOG'
                      }
                    />
                  </div>

                  {/* Extracted Bill Supplier vs Matched Vendor */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                    <div>
                      <span className="text-gray-400 font-medium">Printed on Bill:</span>
                      <div className="font-bold text-gray-900 mt-0.5">
                        {draft.extraction?.supplier?.name?.value || '(Not extracted)'}
                      </div>
                      {draft.extraction?.supplier?.gstin?.value && (
                        <div className="font-mono text-[11px] text-gray-600 mt-0.5">
                          GSTIN: {draft.extraction.supplier.gstin.value}
                        </div>
                      )}
                      {draft.extraction?.supplier?.address?.value && (
                        <div className="text-gray-500 text-[11px] mt-0.5 line-clamp-2">
                          {draft.extraction.supplier.address.value}
                        </div>
                      )}
                    </div>

                    <div>
                      <span className="text-gray-400 font-medium">Matching Status:</span>
                      <div className="mt-0.5 font-semibold text-gray-700">
                        {draft.vendorMatch?.matchingMethod || 'MANUAL_SELECTION'}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        AI confidence: {Math.round((draft.vendorMatch?.confidence || 0) * 100)}%
                      </div>
                    </div>
                  </div>

                  {/* New Vendor Creation Action Banner (When vendor not yet resolved) */}
                  {!vendorId && (
                    <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                            New Vendor / Not in Catalog
                          </span>
                          <div className="font-bold text-gray-900 text-sm mt-1">
                            {draft.extraction?.supplier?.name?.value || '(Supplier Name Not Found)'}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isDraftExpired}
                            onClick={handleOpenCreateVendorConfirm}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Create Vendor
                          </button>
                          <button
                            type="button"
                            disabled={isDraftExpired}
                            onClick={handleOpenEditVendorModal}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                          >
                            Edit &amp; Create Vendor
                          </button>
                        </div>
                      </div>

                      {/* Extracted Details Pill */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-gray-600 bg-white/70 p-2.5 rounded-lg border border-amber-100">
                        <div>
                          <span className="text-gray-400 block">GSTIN:</span>
                          <span className="font-mono font-semibold text-gray-800">{draft.extraction?.supplier?.gstin?.value || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block">Phone:</span>
                          <span className="font-semibold text-gray-800">{draft.extraction?.supplier?.phone?.value || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block">Email:</span>
                          <span className="font-semibold text-gray-800 truncate block">{draft.extraction?.supplier?.email?.value || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block">City/State:</span>
                          <span className="font-semibold text-gray-800">{[draft.extraction?.supplier?.city?.value, draft.extraction?.supplier?.state?.value].filter(Boolean).join(', ') || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Registered Vendor Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 flex items-center justify-between">
                      <span>Select Registered Business Vendor *</span>
                      {!vendorId && (
                        <span className="text-rose-600 text-[11px] font-semibold">
                          ⚠️ Required to create Purchase
                        </span>
                      )}
                    </label>
                    <select
                      value={vendorId}
                      disabled={isDraftExpired}
                      onChange={(e) => handleSelectVendor(e.target.value)}
                      className={`w-full text-xs font-medium rounded-xl p-2.5 border transition ${
                        !vendorId
                          ? 'border-rose-300 bg-rose-50/20 focus:ring-rose-500'
                          : 'border-gray-200 focus:ring-purple-500'
                      }`}
                    >
                      <option value="">-- Choose Vendor from Catalog --</option>
                      {localVendors.map((v) => (
                        <option key={v._id || v.id} value={v._id || v.id}>
                          {v.name} {v.gstNumber ? `(GST: ${v.gstNumber})` : ''} - {v.vendorCode}
                        </option>
                      ))}
                    </select>

                    {/* Alternatives from matcher */}
                    {draft.vendorMatch?.alternatives && draft.vendorMatch.alternatives.length > 0 && !vendorId && (
                      <div className="pt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-gray-400">Did you mean:</span>
                        {draft.vendorMatch.alternatives.map((alt) => (
                          <button
                            key={alt.vendorId}
                            type="button"
                            onClick={() => handleSelectVendor(alt.vendorId, alt.name)}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 cursor-pointer"
                          >
                            {alt.name} ({Math.round(alt.similarity * 100)}%)
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 2: Invoice Details */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-purple-600" />
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                        Invoice Header Details
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                    <div>
                      <label className="text-[11px] font-bold text-gray-700 block mb-1">
                        Invoice Number *
                      </label>
                      <input
                        type="text"
                        value={invoiceNumber}
                        disabled={isDraftExpired}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        placeholder="e.g. INV-2024-001"
                        className="w-full text-xs font-semibold rounded-xl border border-gray-200 p-2.5 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gray-700 block mb-1">
                        Invoice Date *
                      </label>
                      <input
                        type="date"
                        value={invoiceDate}
                        disabled={isDraftExpired}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        className="w-full text-xs font-semibold rounded-xl border border-gray-200 p-2.5 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gray-700 block mb-1">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={dueDate}
                        disabled={isDraftExpired}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full text-xs font-semibold rounded-xl border border-gray-200 p-2.5 focus:ring-purple-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gray-700 block mb-1">
                        PO Number
                      </label>
                      <input
                        type="text"
                        value={poNumber}
                        disabled={isDraftExpired}
                        onChange={(e) => setPoNumber(e.target.value)}
                        placeholder="Optional PO#"
                        className="w-full text-xs font-semibold rounded-xl border border-gray-200 p-2.5 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Extracted Products & Line Items */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Package className="w-5 h-5 text-purple-600" />
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                        Extracted Products &amp; Line Items ({items.length})
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      {items.filter((it) => !it.productMatch?.productId).length > 0 && (
                        <button
                          type="button"
                          disabled={isDraftExpired}
                          onClick={handleOpenBulkProductModal}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl border border-purple-200 cursor-pointer disabled:opacity-50 transition"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Add All New Products ({items.filter((it) => !it.productMatch?.productId).length})
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isDraftExpired}
                        onClick={handleAddLineItem}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 rounded-xl border border-gray-200 cursor-pointer disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Line Item
                      </button>
                    </div>
                  </div>

                  {/* Line Items Container */}
                  <div className="space-y-3">
                    {items.map((it, idx) => {
                      const isMatched = it.productMatch?.productId;
                      const hasConflict = it.productMatch?.matchingMethod === 'SPECIFICATION_CONFLICT';
                      const hasFuzzyCandidate =
                        !isMatched &&
                        it.productMatch?.alternatives &&
                        it.productMatch.alternatives.length > 0;

                      return (
                        <div
                          key={it.id || idx}
                          className={`p-4 rounded-2xl border transition space-y-3 ${
                            !isMatched
                              ? 'border-amber-200 bg-amber-50/20'
                              : hasConflict
                              ? 'border-rose-200 bg-rose-50/20'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                        >
                          {/* Item Header & Status */}
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <span className="text-xs font-bold text-gray-800">
                                {it.description?.value || 'Untitled Bill Item'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <StatusBadge
                                status={
                                  it.productMatch?.productId
                                    ? 'VERIFIED'
                                    : hasFuzzyCandidate
                                    ? 'REVIEW_REQUIRED'
                                    : 'MISSING'
                                }
                                label={
                                  it.productMatch?.productId
                                    ? `MATCHED: ${it.productMatch.productName}`
                                    : hasFuzzyCandidate
                                    ? 'SUGGESTED MATCH'
                                    : 'NEW PRODUCT / NOT IN CATALOG'
                                }
                              />

                              <button
                                type="button"
                                disabled={isDraftExpired}
                                onClick={() => handleRemoveLineItem(idx)}
                                className="text-gray-400 hover:text-rose-600 p-1 rounded-lg"
                                title="Remove line item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Specification Conflict Warning */}
                          {hasConflict && (
                            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold flex items-center gap-2">
                              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                              <span>
                                Specification Conflict: Bill item specs conflict with candidate catalog item. Please verify or re-select.
                              </span>
                            </div>
                          )}

                          {/* Fuzzy Candidate Suggestion Banner */}
                          {hasFuzzyCandidate && (
                            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
                              <div className="space-y-0.5">
                                <span className="text-purple-600 font-bold text-[10px] uppercase tracking-wider block">
                                  Suggested Catalog Product
                                </span>
                                <div className="font-bold text-gray-900">
                                  {it.productMatch!.alternatives![0].productName}
                                  <span className="ml-2 font-normal text-purple-700 text-[11px]">
                                    (Similarity: {Math.round(it.productMatch!.alternatives![0].score * 100)}%)
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={isDraftExpired}
                                  onClick={() => {
                                    const candidate = it.productMatch!.alternatives![0];
                                    const prod =
                                      localProducts.find((p) => (p.id || (p as any)._id) === candidate.productId) ||
                                      ({
                                        id: candidate.productId,
                                        name: candidate.productName,
                                        sku: candidate.sku,
                                        defaultPriceMinor: 0,
                                      } as any);
                                    handleSelectProductForLine(idx, prod);
                                  }}
                                  className="px-2.5 py-1 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg cursor-pointer disabled:opacity-50"
                                >
                                  Use This Product
                                </button>
                                <button
                                  type="button"
                                  disabled={isDraftExpired}
                                  onClick={() => handleOpenCreateProductConfirm(idx)}
                                  className="px-2.5 py-1 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg cursor-pointer disabled:opacity-50"
                                >
                                  Add New Product
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Unmapped Product Creation Action Banner */}
                          {!it.productMatch?.productId && !hasFuzzyCandidate && (
                            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
                              <div className="space-y-0.5">
                                <span className="text-amber-800 font-bold text-[10px] uppercase tracking-wider block">
                                  New Product / Not in Catalog
                                </span>
                                <div className="font-semibold text-gray-800">
                                  {it.description?.value || 'Untitled Item'}
                                </div>
                                <div className="text-[11px] text-gray-500 flex items-center gap-2">
                                  <span>HSN: {it.hsnSac?.value || 'N/A'}</span>
                                  <span>•</span>
                                  <span>Qty: {it.quantity?.value ?? 1} {it.unit?.value || 'NOS'}</span>
                                  <span>•</span>
                                  <span>Unit Price: ₹{it.unitPrice?.value ?? 0}</span>
                                  <span>•</span>
                                  <span>GST: {it.gstRate?.value ?? 18}%</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={isDraftExpired}
                                  onClick={() => handleOpenCreateProductConfirm(idx)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg cursor-pointer disabled:opacity-50 shadow-xs"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  Add Product
                                </button>
                                <button
                                  type="button"
                                  disabled={isDraftExpired}
                                  onClick={() => handleOpenEditProductModal(idx)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg cursor-pointer disabled:opacity-50"
                                >
                                  Edit &amp; Add Product
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Product Selection Dropdown / Search */}
                          <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-100 space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-[11px] font-bold text-gray-700">
                                Map to Catalog Product *
                              </label>
                              {it.productMatch?.sku && (
                                <span className="font-mono text-[10px] text-gray-500">
                                  SKU: {it.productMatch.sku}
                                </span>
                              )}
                            </div>

                            <select
                              value={it.productMatch?.productId || ''}
                              disabled={isDraftExpired}
                              onChange={(e) => {
                                const prod = localProducts.find(
                                  (p) => p.id === e.target.value || (p as any)._id === e.target.value
                                );
                                if (prod) handleSelectProductForLine(idx, prod);
                              }}
                              className="w-full text-xs font-semibold rounded-xl border border-gray-200 p-2 focus:ring-purple-500 bg-white"
                            >
                              <option value="">-- Select Catalog Product --</option>
                              {localProducts.map((p) => (
                                <option key={p.id || (p as any)._id} value={p.id || (p as any)._id}>
                                  {p.name} (SKU: {(p as any).sku || 'N/A'}) - ₹
                                  {(p as any).defaultPriceMinor ? (p as any).defaultPriceMinor / 100 : 0}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Editable Description & HSN Fields */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                            <div className="sm:col-span-2">
                              <label className="text-[10px] font-bold text-gray-500 block mb-0.5">
                                Item Description
                              </label>
                              <input
                                type="text"
                                value={it.description?.value || ''}
                                disabled={isDraftExpired}
                                onChange={(e) => handleUpdateItem(idx, 'description', e.target.value)}
                                className="w-full text-xs font-semibold rounded-lg border border-gray-200 p-1.5 focus:ring-purple-500"
                                placeholder="Product description"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-gray-500 block mb-0.5">
                                HSN / SAC
                              </label>
                              <input
                                type="text"
                                value={it.hsnSac?.value || ''}
                                disabled={isDraftExpired}
                                onChange={(e) => handleUpdateItem(idx, 'hsnSac', e.target.value)}
                                className="w-full text-xs font-semibold rounded-lg border border-gray-200 p-1.5 focus:ring-purple-500 font-mono"
                                placeholder="HSN code"
                              />
                            </div>
                          </div>

                          {/* Editable Numerical Fields */}
                          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                            <div>
                              <label className="text-[10px] font-bold text-gray-500 block mb-0.5">
                                Qty
                              </label>
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={it.quantity?.value ?? 1}
                                disabled={isDraftExpired}
                                onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                                className="w-full text-xs font-semibold rounded-lg border border-gray-200 p-1.5 text-center focus:ring-purple-500"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-gray-500 block mb-0.5">
                                Unit
                              </label>
                              <input
                                type="text"
                                value={it.unit?.value || 'NOS'}
                                disabled={isDraftExpired}
                                onChange={(e) => handleUpdateItem(idx, 'unit', e.target.value)}
                                className="w-full text-xs font-semibold rounded-lg border border-gray-200 p-1.5 text-center focus:ring-purple-500 uppercase"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-gray-500 block mb-0.5">
                                Unit Price (₹)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={it.unitPrice?.value ?? 0}
                                disabled={isDraftExpired}
                                onChange={(e) => handleUpdateItem(idx, 'unitPrice', e.target.value)}
                                className="w-full text-xs font-semibold rounded-lg border border-gray-200 p-1.5 text-right font-mono focus:ring-purple-500"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-gray-500 block mb-0.5">
                                Disc %
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="any"
                                value={it.discountPercent?.value ?? 0}
                                disabled={isDraftExpired}
                                onChange={(e) => handleUpdateItem(idx, 'discountPercent', e.target.value)}
                                className="w-full text-xs font-semibold rounded-lg border border-gray-200 p-1.5 text-right font-mono focus:ring-purple-500"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-gray-500 block mb-0.5">
                                GST %
                              </label>
                              <select
                                value={it.gstRate?.value ?? 18}
                                disabled={isDraftExpired}
                                onChange={(e) => handleUpdateItem(idx, 'gstRate', e.target.value)}
                                className="w-full text-xs font-semibold rounded-lg border border-gray-200 p-1.5 bg-white focus:ring-purple-500"
                              >
                                <option value="0">0%</option>
                                <option value="5">5%</option>
                                <option value="12">12%</option>
                                <option value="18">18%</option>
                                <option value="28">28%</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-gray-500 block mb-0.5">
                                Line Total (₹)
                              </label>
                              <div className="w-full text-xs font-mono font-bold text-gray-900 p-1.5 text-right bg-gray-50 rounded-lg border border-gray-100">
                                ₹{(it.lineTotal?.value || 0).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section: Bill Attachment (Requirement 18, 32) */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Paperclip className="w-5 h-5 text-purple-600" />
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                        Bill Attachment
                      </h3>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                      Will be attached to Purchase
                    </span>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="w-12 h-12 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
                      {previewImages.length > 0 ? (
                        <img src={previewImages[0]} alt="Bill thumbnail" className="w-full h-full object-cover" />
                      ) : fileUrl && !fileUrl.endsWith('.pdf') ? (
                        <img src={fileUrl} alt="Bill thumbnail" className="w-full h-full object-cover" />
                      ) : (
                        <FileText className="w-6 h-6 text-purple-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-gray-900 truncate">
                        {draft.originalFile?.fileName || selectedFile?.name || 'Original Purchase Bill'}
                      </div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                        <span className="font-semibold">
                          {(draft.originalFile?.mimeType || selectedFile?.type || 'DOCUMENT').toUpperCase().replace('APPLICATION/', '').replace('IMAGE/', '')}
                        </span>
                        <span>•</span>
                        <span>
                          {draft.originalFile?.fileSize
                            ? `${(draft.originalFile.fileSize / (1024 * 1024)).toFixed(2)} MB`
                            : selectedFile
                            ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
                            : 'Original Upload'}
                        </span>
                      </div>
                    </div>

                    {(fileUrl || (draft.originalFile as any)?.fileUrl) && (
                      <a
                        href={fileUrl || (draft.originalFile as any)?.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-xl shadow-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View
                      </a>
                    )}
                  </div>
                </div>

                {/* Section 4: Purchase Totals & Financial Review */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-purple-600" />
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                        Purchase Totals
                      </h3>
                    </div>

                    {manualOverride ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/90 px-2.5 py-1 rounded-full border border-amber-300">
                        <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                        Total manually adjusted
                      </span>
                    ) : hasDiscrepancy ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/90 px-2.5 py-1 rounded-full border border-amber-300">
                        <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                        Amounts need review
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-full border border-emerald-300">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        Amounts verified
                      </span>
                    )}
                  </div>

                  {/* Warning banner when discrepancy exists without manual override */}
                  {!manualOverride && hasDiscrepancy && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Some invoice amounts could not be reconciled.</span>
                        <p className="text-[11px] text-amber-700 mt-0.5">
                          The extracted bill totals differ from line item calculations. You can verify line items, edit totals directly, or inspect calculation details below.
                        </p>
                      </div>
                    </div>
                  )}

                  {!isEditingTotals ? (
                    /* Clean Simplified Purchase Totals View */
                    <div className="space-y-3">
                      <div className="bg-gray-50/70 rounded-xl p-4 border border-gray-100 space-y-2.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-600 font-medium">Subtotal</span>
                          <span className="font-mono font-bold text-gray-900">
                            ₹{activeSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        {isIntraState ? (
                          <>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-600 font-medium">CGST @ {activeCgstRate}%</span>
                              <span className="font-mono font-semibold text-gray-800">
                                ₹{activeCgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-600 font-medium">SGST @ {activeSgstRate}%</span>
                              <span className="font-mono font-semibold text-gray-800">
                                ₹{activeSgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-600 font-medium">IGST @ {activeIgstRate}%</span>
                            <span className="font-mono font-semibold text-gray-800">
                              ₹{activeIgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between items-center text-xs border-t border-gray-200/80 pt-2">
                          <span className="text-gray-700 font-semibold">Total GST</span>
                          <span className="font-mono font-bold text-gray-900">
                            ₹{activeTaxTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-sm font-bold border-t border-gray-200 pt-2.5 text-gray-900">
                          <span>Grand Total</span>
                          <span className="font-mono text-purple-700 text-base">
                            ₹{activeGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-xs border-t border-gray-200/80 pt-2 text-emerald-700 font-semibold">
                          <span>Amount Paid</span>
                          <span className="font-mono font-bold">
                            ₹{amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-xs text-rose-700 font-semibold">
                          <span>Balance Due</span>
                          <span className="font-mono font-bold">
                            ₹{Math.max(0, Math.round((activeGrandTotal - amountPaid) * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-xs pt-1">
                          <span className="text-gray-600 font-medium">Payment Status</span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            amountPaid <= 0
                              ? 'bg-rose-100 text-rose-800'
                              : amountPaid >= activeGrandTotal
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {amountPaid <= 0 ? 'UNPAID' : amountPaid >= activeGrandTotal ? 'PAID' : 'PARTIALLY PAID'}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isDraftExpired}
                          onClick={handleOpenEditTotals}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 shadow-xs cursor-pointer transition disabled:opacity-50"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit Totals
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowCalculationDetails((prev) => !prev)}
                          className="text-xs font-semibold text-gray-500 hover:text-gray-700 cursor-pointer flex items-center gap-1"
                        >
                          {showCalculationDetails ? 'Hide Calculation Details ▴' : 'View Calculation Details ▾'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Editable Financial Totals Form */
                    <div className="space-y-4 p-4 bg-purple-50/40 rounded-xl border border-purple-100">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider">
                          Edit Purchase Totals
                        </h4>
                        <span className="text-[11px] text-gray-500">Manual corrections will be preserved</span>
                      </div>

                      {totalsEditError && (
                        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>{totalsEditError}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="text-[10px] font-bold text-gray-600 block mb-1">
                            Taxable Subtotal (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={editSubtotal}
                            onChange={(e) => handleSubtotalChangeInEdit(e.target.value)}
                            className="w-full text-xs font-mono font-bold rounded-lg border border-gray-300 p-2 bg-white focus:ring-purple-500"
                            placeholder="0.00"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-gray-600 block mb-1">
                            Total GST (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={editTotalTax}
                            onChange={(e) => setEditTotalTax(e.target.value)}
                            className="w-full text-xs font-mono font-bold rounded-lg border border-gray-300 p-2 bg-white focus:ring-purple-500"
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      {isIntraState ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div>
                            <label className="text-[10px] font-bold text-gray-600 block mb-1">
                              CGST Rate (%)
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="any"
                              value={editCgstRate}
                              onChange={(e) => handleCgstRateChangeInEdit(e.target.value)}
                              className="w-full text-xs font-mono rounded-lg border border-gray-300 p-1.5 bg-white focus:ring-purple-500 text-center"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-gray-600 block mb-1">
                              CGST Amount (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={editCgstAmount}
                              onChange={(e) => setEditCgstAmount(e.target.value)}
                              className="w-full text-xs font-mono font-semibold rounded-lg border border-gray-300 p-1.5 bg-white focus:ring-purple-500 text-right"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-gray-600 block mb-1">
                              SGST Rate (%)
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="any"
                              value={editSgstRate}
                              onChange={(e) => handleSgstRateChangeInEdit(e.target.value)}
                              className="w-full text-xs font-mono rounded-lg border border-gray-300 p-1.5 bg-white focus:ring-purple-500 text-center"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-gray-600 block mb-1">
                              SGST Amount (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={editSgstAmount}
                              onChange={(e) => setEditSgstAmount(e.target.value)}
                              className="w-full text-xs font-mono font-semibold rounded-lg border border-gray-300 p-1.5 bg-white focus:ring-purple-500 text-right"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="text-[10px] font-bold text-gray-600 block mb-1">
                              IGST Rate (%)
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="any"
                              value={editIgstRate}
                              onChange={(e) => handleIgstRateChangeInEdit(e.target.value)}
                              className="w-full text-xs font-mono rounded-lg border border-gray-300 p-1.5 bg-white focus:ring-purple-500 text-center"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-gray-600 block mb-1">
                              IGST Amount (₹)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={editIgstAmount}
                              onChange={(e) => setEditIgstAmount(e.target.value)}
                              className="w-full text-xs font-mono font-semibold rounded-lg border border-gray-300 p-1.5 bg-white focus:ring-purple-500 text-right"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="text-[10px] font-bold text-purple-900 block mb-1">
                          Grand Total (₹) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={editGrandTotal}
                          onChange={(e) => setEditGrandTotal(e.target.value)}
                          className="w-full text-sm font-mono font-bold text-purple-800 rounded-lg border-2 border-purple-300 p-2.5 bg-white focus:ring-purple-500 focus:border-purple-600"
                          placeholder="0.00"
                        />
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-purple-100">
                        <button
                          type="button"
                          onClick={handleCancelEditTotals}
                          className="px-3 py-1.5 text-xs font-semibold text-gray-600 rounded-lg border border-gray-300 hover:bg-gray-100 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEditedTotals}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-xs cursor-pointer transition"
                        >
                          <Save className="w-3.5 h-3.5" />
                          Save Changes
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Collapsible Detailed Financial Reconciliation Table (Requirement 11, 12) */}
                  {showCalculationDetails && (
                    <div className="space-y-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Advanced Validation Details
                        </span>
                        <StatusBadge
                          status={hasDiscrepancy ? 'REVIEW_REQUIRED' : 'VERIFIED'}
                          label={hasDiscrepancy ? 'DISCREPANCY DETECTED' : 'RECONCILED'}
                        />
                      </div>

                      <div className="border border-gray-200 rounded-xl overflow-hidden text-xs">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                            <tr>
                              <th className="py-2.5 px-3">Metric</th>
                              <th className="py-2.5 px-3 text-right">Printed on Bill</th>
                              <th className="py-2.5 px-3 text-right">Deterministic Calculated</th>
                              <th className="py-2.5 px-3 text-right">Variance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 font-mono">
                            <tr>
                              <td className="py-2.5 px-3 text-gray-700 font-sans font-medium">
                                Taxable Subtotal
                              </td>
                              <td className="py-2.5 px-3 text-right text-gray-600">
                                ₹{printedTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                                ₹{calculatedSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-3 text-right text-gray-500">
                                ₹{subtotalDiscrepancy.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>

                            {isIntraState && (
                              <>
                                <tr>
                                  <td className="py-2.5 px-3 text-gray-700 font-sans font-medium">
                                    CGST
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-gray-600">
                                    ₹{(printedCgst ?? calculatedCgst).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                                    ₹{calculatedCgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-gray-500">
                                    ₹{cgstDiscrepancy.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                </tr>

                                <tr>
                                  <td className="py-2.5 px-3 text-gray-700 font-sans font-medium">
                                    SGST
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-gray-600">
                                    ₹{(printedSgst ?? calculatedSgst).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                                    ₹{calculatedSgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-gray-500">
                                    ₹{sgstDiscrepancy.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              </>
                            )}

                            <tr>
                              <td className="py-2.5 px-3 text-gray-700 font-sans font-medium">
                                Total GST
                              </td>
                              <td className="py-2.5 px-3 text-right text-gray-600">
                                ₹{printedTaxTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                                ₹{calculatedTaxTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-3 text-right text-gray-500">
                                ₹{taxTotalDiscrepancy.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>

                            <tr className={hasDiscrepancy ? 'bg-amber-50/40 font-bold' : 'bg-gray-50/50 font-bold'}>
                              <td className="py-2.5 px-3 text-gray-900 font-sans">
                                Grand Total
                              </td>
                              <td className="py-2.5 px-3 text-right text-gray-900">
                                ₹{printedGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-3 text-right text-purple-700">
                                ₹{calculatedGrandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {hasDiscrepancy ? (
                                  <span className="text-amber-700">
                                    ₹{grandTotalDiscrepancy.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                ) : (
                                  <span className="text-emerald-600">₹0.00</span>
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {draft.reconciliation?.discrepancyNotes && draft.reconciliation.discrepancyNotes.length > 0 && (
                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 space-y-1">
                          <div className="font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            Reconciliation Notes:
                          </div>
                          <ul className="list-disc list-inside space-y-0.5">
                            {draft.reconciliation.discrepancyNotes.map((note, i) => (
                              <li key={i}>{note}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Section 5: Payment Details (Phase 5.7) */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-purple-600" />
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                        Payment Details
                      </h3>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      amountPaid <= 0
                        ? 'bg-gray-100 text-gray-700'
                        : amountPaid >= activeGrandTotal
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {amountPaid <= 0 ? 'UNPAID' : amountPaid >= activeGrandTotal ? 'PAID' : 'PARTIALLY PAID'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Payment Status Choice */}
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                        Payment Status
                      </label>
                      <div className="flex rounded-xl bg-gray-100 p-1 text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentStatusChoice('UNPAID');
                            setAmountPaid(0);
                          }}
                          className={`flex-1 py-1.5 rounded-lg text-center transition cursor-pointer ${
                            paymentStatusChoice === 'UNPAID'
                              ? 'bg-white text-gray-900 shadow-xs font-bold'
                              : 'text-gray-500 hover:text-gray-900'
                          }`}
                        >
                          Unpaid
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentStatusChoice('PARTIALLY_PAID');
                            if (amountPaid <= 0 || amountPaid >= activeGrandTotal) {
                              setAmountPaid(Math.round((activeGrandTotal / 2) * 100) / 100);
                            }
                          }}
                          className={`flex-1 py-1.5 rounded-lg text-center transition cursor-pointer ${
                            paymentStatusChoice === 'PARTIALLY_PAID'
                              ? 'bg-white text-amber-800 shadow-xs font-bold'
                              : 'text-gray-500 hover:text-gray-900'
                          }`}
                        >
                          Partially Paid
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentStatusChoice('PAID');
                            setAmountPaid(activeGrandTotal);
                          }}
                          className={`flex-1 py-1.5 rounded-lg text-center transition cursor-pointer ${
                            paymentStatusChoice === 'PAID'
                              ? 'bg-white text-emerald-800 shadow-xs font-bold'
                              : 'text-gray-500 hover:text-gray-900'
                          }`}
                        >
                          Fully Paid
                        </button>
                      </div>
                    </div>

                    {/* Amount Paid */}
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                        Amount Paid (₹)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={activeGrandTotal}
                        step="any"
                        value={amountPaid === 0 ? '' : amountPaid}
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          setAmountPaid(val);
                          if (val <= 0) setPaymentStatusChoice('UNPAID');
                          else if (val >= activeGrandTotal) setPaymentStatusChoice('PAID');
                          else setPaymentStatusChoice('PARTIALLY_PAID');
                        }}
                        placeholder="₹0.00"
                        className="w-full text-xs font-mono font-bold rounded-xl border border-gray-200 p-2 focus:ring-purple-500 bg-white"
                      />
                    </div>

                    {/* Payment Method */}
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                        Payment Method {amountPaid > 0 && <span className="text-rose-500">*</span>}
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full text-xs font-semibold rounded-xl border border-gray-200 p-2 focus:ring-purple-500 bg-white"
                      >
                        <option value="CASH">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="BANK_TRANSFER">Bank Transfer</option>
                        <option value="CHEQUE">Cheque</option>
                        <option value="CARD">Card</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>
                  </div>

                  {amountPaid > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
                      {paymentAccounts.length > 0 && (
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                            Payment Account
                          </label>
                          <select
                            value={paymentAccountId}
                            onChange={(e) => setPaymentAccountId(e.target.value)}
                            className="w-full text-xs font-semibold rounded-xl border border-gray-200 p-2 focus:ring-purple-500 bg-white"
                          >
                            <option value="">-- Direct / Primary Cash --</option>
                            {paymentAccounts.map((acc) => (
                              <option key={acc.id} value={acc.id}>
                                {acc.name} ({acc.type})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                          Payment Date <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                          className="w-full text-xs font-semibold rounded-xl border border-gray-200 p-2 focus:ring-purple-500 bg-white"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                          Reference / Txn ID
                        </label>
                        <input
                          type="text"
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          placeholder="Optional transaction ref"
                          className="w-full text-xs font-semibold rounded-xl border border-gray-200 p-2 focus:ring-purple-500 bg-white font-mono"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Section 6: Receiving & Inventory Workflow */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                    Receiving &amp; Inventory Workflow
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label
                      className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex items-start gap-2.5 ${
                        directReceivedFull
                          ? 'border-purple-600 bg-purple-50/30'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="scannerReceiving"
                        checked={directReceivedFull}
                        onChange={() => setDirectReceivedFull(true)}
                        className="mt-1 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-gray-900">
                          Direct Full Receipt (Immediate Stock Update)
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Products have already arrived at counter. Existing purchase engine will increase warehouse stock automatically.
                        </p>
                      </div>
                    </label>

                    <label
                      className={`p-3.5 rounded-xl border-2 cursor-pointer transition flex items-start gap-2.5 ${
                        !directReceivedFull
                          ? 'border-purple-600 bg-purple-50/30'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="scannerReceiving"
                        checked={!directReceivedFull}
                        onChange={() => setDirectReceivedFull(false)}
                        className="mt-1 text-purple-600 focus:ring-purple-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-gray-900">
                          Ordered / Awaiting Delivery
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Purchase order created. Inventory will be updated later when warehouse logs inward stock receipt.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Action Bar */}
        {stage === 'REVIEW' && draft && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50/80 flex items-center justify-between gap-3 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 rounded-xl border border-gray-200 hover:bg-gray-100 cursor-pointer"
            >
              Close &amp; Exit
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={savingDraft || isDraftExpired}
                onClick={handleSaveDraft}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {savingDraft ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save Draft Changes
              </button>

              <button
                type="button"
                disabled={isDraftExpired}
                onClick={handleOpenConfirmDialog}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-98 transition"
              >
                <ShieldCheck className="w-4 h-4 text-purple-200" />
                Confirm Purchase
              </button>
            </div>
          </div>
        )}

        {/* Explicit Confirmation Dialog (Mandatory Rule) */}
        {showConfirmDialog && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 border border-gray-100 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-purple-100 text-purple-700">
                  <ShieldCheck className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Confirm Purchase?</h3>
                  <p className="text-xs text-gray-500">Explicit human confirmation required</p>
                </div>
              </div>

              {confirmError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{confirmError}</span>
                </div>
              )}

              <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                After confirmation, this purchase will be created using the existing purchase workflow.
                Inventory may be updated according to the selected receiving option:
                <strong className="block mt-1 text-gray-900">
                  {directReceivedFull
                    ? '✓ Direct Full Receipt (Stock will be updated immediately)'
                    : '⏳ Ordered Purchase (Stock updated later upon receipt)'}
                </strong>
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={stage === 'CONFIRMING'}
                  onClick={() => setShowConfirmDialog(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={stage === 'CONFIRMING'}
                  onClick={handleExecuteConfirmation}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-50 active:scale-98 transition"
                >
                  {stage === 'CONFIRMING' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating Purchase...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Confirm Purchase
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 1. Fast One-Click Create Vendor Confirmation Modal */}
        {vendorCreateConfirmOpen && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 border border-gray-100 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-purple-100 text-purple-700">
                  <Building2 className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Create New Vendor?</h3>
                  <p className="text-xs text-gray-500">Extracted from invoice header</p>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-2 text-xs">
                <div>
                  <span className="text-gray-400 block text-[11px]">Vendor Name:</span>
                  <span className="font-bold text-gray-900 text-sm">{draft?.extraction?.supplier?.name?.value || 'N/A'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-gray-400 block text-[11px]">GSTIN:</span>
                    <span className="font-mono font-semibold text-gray-800">{draft?.extraction?.supplier?.gstin?.value || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[11px]">Phone:</span>
                    <span className="font-semibold text-gray-800">{draft?.extraction?.supplier?.phone?.value || 'N/A'}</span>
                  </div>
                </div>
                <div className="pt-1">
                  <span className="text-gray-400 block text-[11px]">Email:</span>
                  <span className="font-semibold text-gray-800">{draft?.extraction?.supplier?.email?.value || 'N/A'}</span>
                </div>
                <div className="pt-1">
                  <span className="text-gray-400 block text-[11px]">Address:</span>
                  <span className="text-gray-700">{draft?.extraction?.supplier?.address?.value || 'N/A'}</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isCreatingVendor}
                  onClick={() => setVendorCreateConfirmOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isCreatingVendor}
                  onClick={() => handleCreateVendor()}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-50 active:scale-98 transition"
                >
                  {isCreatingVendor ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Create Vendor
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. Edit & Create Vendor Modal */}
        {vendorEditModalOpen && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl p-6 border border-gray-100 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-purple-100 text-purple-700">
                    <Building2 className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Edit &amp; Create Vendor</h3>
                    <p className="text-xs text-gray-500">Prefilled from bill extraction</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setVendorEditModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Vendor Name *</label>
                  <input
                    type="text"
                    value={vendorForm.name}
                    onChange={(e) => setVendorForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 p-2.5 font-semibold focus:ring-purple-500"
                    placeholder="e.g. RAJ ELECTRONICS"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">GSTIN</label>
                    <input
                      type="text"
                      value={vendorForm.gstNumber}
                      onChange={(e) => setVendorForm((f) => ({ ...f, gstNumber: e.target.value.toUpperCase() }))}
                      className="w-full rounded-xl border border-gray-200 p-2.5 font-mono focus:ring-purple-500"
                      placeholder="e.g. 27AAEFR1234H1Z8"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Phone / Mobile</label>
                    <input
                      type="text"
                      value={vendorForm.mobile}
                      onChange={(e) => setVendorForm((f) => ({ ...f, mobile: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 p-2.5 focus:ring-purple-500"
                      placeholder="e.g. 020-26123456"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Email</label>
                  <input
                    type="email"
                    value={vendorForm.email}
                    onChange={(e) => setVendorForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 p-2.5 focus:ring-purple-500"
                    placeholder="e.g. sales@rajelectronics.in"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Address</label>
                  <textarea
                    rows={2}
                    value={vendorForm.address}
                    onChange={(e) => setVendorForm((f) => ({ ...f, address: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 p-2.5 focus:ring-purple-500"
                    placeholder="e.g. 15, M.G. Road, Pune"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">City</label>
                    <input
                      type="text"
                      value={vendorForm.city}
                      onChange={(e) => setVendorForm((f) => ({ ...f, city: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 p-2.5 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">State</label>
                    <input
                      type="text"
                      value={vendorForm.state}
                      onChange={(e) => setVendorForm((f) => ({ ...f, state: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 p-2.5 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Pincode</label>
                    <input
                      type="text"
                      value={vendorForm.pincode}
                      onChange={(e) => setVendorForm((f) => ({ ...f, pincode: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 p-2.5 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isCreatingVendor}
                  onClick={() => setVendorEditModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isCreatingVendor}
                  onClick={() => handleCreateVendor(vendorForm)}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-50 active:scale-98 transition"
                >
                  {isCreatingVendor ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save &amp; Link Vendor
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. Fast One-Click Add Product Confirmation Modal */}
        {productCreateConfirmOpen && activeProductLineIdx !== null && items[activeProductLineIdx] && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 border border-gray-100 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-purple-100 text-purple-700">
                  <Package className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Add Product to Catalog?</h3>
                  <p className="text-xs text-gray-500">Will be linked to line {activeProductLineIdx + 1}</p>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-2 text-xs">
                <div>
                  <span className="text-gray-400 block text-[11px]">Product Name:</span>
                  <span className="font-bold text-gray-900 text-sm">
                    {items[activeProductLineIdx].description?.value || 'Untitled Product'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-gray-400 block text-[11px]">HSN / SAC:</span>
                    <span className="font-mono font-semibold text-gray-800">
                      {items[activeProductLineIdx].hsnSac?.value || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[11px]">UOM:</span>
                    <span className="font-semibold text-gray-800">
                      {items[activeProductLineIdx].unit?.value || 'NOS'}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-gray-400 block text-[11px]">Purchase Price:</span>
                    <span className="font-bold text-purple-700 text-sm">
                      ₹{items[activeProductLineIdx].unitPrice?.value ?? 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[11px]">GST Rate:</span>
                    <span className="font-semibold text-gray-800">
                      {items[activeProductLineIdx].gstRate?.value ?? 18}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isCreatingProduct}
                  onClick={() => {
                    setProductCreateConfirmOpen(false);
                    setActiveProductLineIdx(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isCreatingProduct}
                  onClick={handleCreateProduct}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-50 active:scale-98 transition"
                >
                  {isCreatingProduct ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Add Product
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. Edit & Add Product Modal */}
        {productEditModalOpen && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl p-6 border border-gray-100 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-purple-100 text-purple-700">
                    <Package className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Edit &amp; Add Product</h3>
                    <p className="text-xs text-gray-500">Configure catalog product attributes</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProductEditModalOpen(false);
                    setActiveProductLineIdx(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Product Name *</label>
                  <input
                    type="text"
                    value={productForm.name}
                    onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 p-2.5 font-semibold focus:ring-purple-500"
                    placeholder="e.g. Logitech Wireless Mouse"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">HSN / SAC Code</label>
                    <input
                      type="text"
                      value={productForm.hsnCode}
                      onChange={(e) => setProductForm((f) => ({ ...f, hsnCode: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 p-2.5 font-mono focus:ring-purple-500"
                      placeholder="e.g. 8471"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">SKU / Code</label>
                    <input
                      type="text"
                      value={productForm.sku}
                      onChange={(e) => setProductForm((f) => ({ ...f, sku: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 p-2.5 font-mono focus:ring-purple-500"
                      placeholder="Optional SKU"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Purchase Rate (₹)</label>
                    <input
                      type="number"
                      step="any"
                      value={productForm.purchasePrice}
                      onChange={(e) =>
                        setProductForm((f) => ({
                          ...f,
                          purchasePrice: parseFloat(e.target.value) || 0,
                          sellingPrice: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-full rounded-xl border border-gray-200 p-2.5 font-bold text-purple-700 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Default Selling Price (₹)</label>
                    <input
                      type="number"
                      step="any"
                      value={productForm.sellingPrice}
                      onChange={(e) => setProductForm((f) => ({ ...f, sellingPrice: parseFloat(e.target.value) || 0 }))}
                      className="w-full rounded-xl border border-gray-200 p-2.5 font-bold focus:ring-purple-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Unit of Measure (UOM)</label>
                    <input
                      type="text"
                      value={productForm.uom}
                      onChange={(e) => setProductForm((f) => ({ ...f, uom: e.target.value.toUpperCase() }))}
                      className="w-full rounded-xl border border-gray-200 p-2.5 font-semibold focus:ring-purple-500"
                      placeholder="e.g. NOS, PCS, KG"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">GST Rate (%)</label>
                    <input
                      type="number"
                      step="any"
                      value={productForm.gstRate}
                      onChange={(e) => setProductForm((f) => ({ ...f, gstRate: parseFloat(e.target.value) || 0 }))}
                      className="w-full rounded-xl border border-gray-200 p-2.5 font-semibold focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isCreatingProduct}
                  onClick={() => {
                    setProductEditModalOpen(false);
                    setActiveProductLineIdx(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isCreatingProduct}
                  onClick={handleSaveEditedProduct}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-50 active:scale-98 transition"
                >
                  {isCreatingProduct ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save &amp; Link Product
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5. Add All New Products (Bulk Review Modal) */}
        {bulkProductModalOpen && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl p-6 border border-gray-100 space-y-4 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-purple-100 text-purple-700">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Add All New Products</h3>
                    <p className="text-xs text-gray-500">Review and confirm bulk product catalog creation</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBulkProductModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 border border-gray-200 rounded-2xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={bulkProducts.length > 0 && bulkProducts.every((b) => b.selected)}
                          onChange={(e) =>
                            setBulkProducts((prev) => prev.map((p) => ({ ...p, selected: e.target.checked })))
                          }
                          className="rounded text-purple-600 focus:ring-purple-500"
                        />
                      </th>
                      <th className="p-3 font-bold">Product Name</th>
                      <th className="p-3 font-bold">HSN</th>
                      <th className="p-3 font-bold">Rate</th>
                      <th className="p-3 font-bold">GST %</th>
                      <th className="p-3 font-bold">UOM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {bulkProducts.map((entry, idx) => (
                      <tr key={idx} className={`hover:bg-purple-50/20 ${!entry.selected ? 'opacity-40' : ''}`}>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={entry.selected}
                            onChange={(e) =>
                              setBulkProducts((prev) => {
                                const updated = [...prev];
                                updated[idx] = { ...updated[idx], selected: e.target.checked };
                                return updated;
                              })
                            }
                            className="rounded text-purple-600 focus:ring-purple-500"
                          />
                        </td>
                        <td className="p-3 font-semibold text-gray-900">{entry.name}</td>
                        <td className="p-3 font-mono text-gray-600">{entry.hsnCode || '-'}</td>
                        <td className="p-3 font-bold text-purple-700">₹{entry.purchasePrice}</td>
                        <td className="p-3 font-semibold text-gray-800">{entry.gstRate}%</td>
                        <td className="p-3 font-semibold text-gray-600">{entry.uom}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between shrink-0 pt-2">
                <span className="text-xs text-gray-500">
                  {bulkProducts.filter((b) => b.selected).length} of {bulkProducts.length} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isCreatingProduct}
                    onClick={() => setBulkProductModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-600 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isCreatingProduct || bulkProducts.filter((b) => b.selected).length === 0}
                    onClick={handleExecuteBulkCreateProducts}
                    className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs cursor-pointer disabled:opacity-50 active:scale-98 transition"
                  >
                    {isCreatingProduct ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating Products...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Add Selected ({bulkProducts.filter((b) => b.selected).length})
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
