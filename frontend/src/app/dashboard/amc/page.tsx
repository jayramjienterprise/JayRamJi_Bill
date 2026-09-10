'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiClient } from '../../../lib/api/client';
import {
  ShieldCheck,
  FileText,
  Wrench,
  Layers,
  Plus,
  Search,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  Building2,
  Calendar,
  History,
  Tag,
  ChevronRight,
  X,
  Eye,
  Check,
  Pencil,
  Trash2,
  Filter,
  Share2,
  MessageCircle,
  Power,
  AlertTriangle,
} from 'lucide-react';
import VisitsTab from './components/VisitsTab';
import EntitlementModal from './components/EntitlementModal';

export default function AmcManagementPage() {
  const [activeTab, setActiveTab] = useState<'contracts' | 'visits' | 'quotations' | 'equipment' | 'plans'>('contracts');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data lists
  const [contracts, setContracts] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [quotations, setQuotations] = useState<any[]>([]);
  const [equipmentList, setEquipmentList] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // Filters
  const [contractStatusFilter, setContractStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expiringOnly, setExpiringOnly] = useState(false);

  // Tab-specific search & filter states
  const [quotationSearchQuery, setQuotationSearchQuery] = useState('');
  const [quotationStatusFilter, setQuotationStatusFilter] = useState('ALL');
  const [quotationTypeFilter, setQuotationTypeFilter] = useState('ALL');

  const [equipmentSearchQuery, setEquipmentSearchQuery] = useState('');
  const [equipmentTypeFilter, setEquipmentTypeFilter] = useState('ALL');
  const [equipmentStatusFilter, setEquipmentStatusFilter] = useState('ALL');

  const [planSearchQuery, setPlanSearchQuery] = useState('');
  const [planTypeFilter, setPlanTypeFilter] = useState('ALL');

  // Modals
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<any | null>(null);
  const [selectedHistoryEquipment, setSelectedHistoryEquipment] = useState<any | null>(null);
  const [equipmentHistoryList, setEquipmentHistoryList] = useState<any[]>([]);
  const [entitlementModalData, setEntitlementModalData] = useState<any | null>(null);

  // Edit Equipment Modal state
  const [editingEquipment, setEditingEquipment] = useState<any | null>(null);
  const [editEquipmentForm, setEditEquipmentForm] = useState({
    customerId: '',
    brand: '',
    modelNumber: '',
    serialNumber: '',
    tonnage: '1.5',
    acType: 'SPLIT',
    installationLocation: '',
    refrigerantType: 'R32',
    status: 'OPERATIONAL',
    notes: '',
  });

  // Convert Quotation Modal
  const [convertingQuotation, setConvertingQuotation] = useState<any | null>(null);

  // Contract Details & Payment Modal state
  const [selectedContractDetails, setSelectedContractDetails] = useState<any | null>(null);
  const [contractPaymentForm, setContractPaymentForm] = useState({
    paymentStatus: 'UNPAID',
    paidAmount: 0,
  });

  // Plan Details & Active/Inactive Modal state
  const [viewingPlan, setViewingPlan] = useState<any | null>(null);
  const [planDeactivatePrompt, setPlanDeactivatePrompt] = useState<{ plan: any; message: string } | null>(null);

  // Form states
  const [contractForm, setContractForm] = useState({
    customerId: '',
    planId: '',
    contractType: 'NON_COMPREHENSIVE',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    selectedEquipmentIds: [] as string[],
    contractAmount: 0,
    paidAmount: 0,
    activationTrigger: 'ADMIN_APPROVAL',
  });

  const [equipmentForm, setEquipmentForm] = useState({
    customerId: '',
    acType: 'SPLIT',
    tonnage: '1.5',
    brand: 'Daikin',
    modelNumber: '',
    serialNumber: '',
    installationLocation: '',
    refrigerantType: 'R32',
  });

  const [planForm, setPlanForm] = useState({
    name: '',
    planType: 'COMPREHENSIVE',
    durationMonths: 12,
    basePrice: 10000,
    dryVisits: 12,
    waterVisits: 4,
    breakdownVisits: 2,
    selectedProductCoverages: [] as { productId: string; coverageType: string; quantityLimitPerYear: number }[],
    gasIncluded: false,
    gasLimitKg: 5,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && ['contracts', 'visits', 'quotations', 'equipment', 'plans'].includes(tabParam)) {
        setActiveTab(tabParam as any);
      }
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [activeTab, contractStatusFilter, expiringOnly]);

  function extractArray(res: any): any[] {
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.data)) return res.data;
    return [];
  }

  async function fetchInitialData() {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (activeTab === 'contracts') {
        let url = `/amc/contracts?status=${contractStatusFilter}`;
        if (expiringOnly) url += '&expiringDays=30';
        const res: any = await apiClient.get(url);
        setContracts(extractArray(res));
      } else if (activeTab === 'visits') {
        const res: any = await apiClient.get('/amc/visits');
        setVisits(extractArray(res));
      } else if (activeTab === 'quotations') {
        const res: any = await apiClient.get('/amc/quotations');
        setQuotations(extractArray(res));
      } else if (activeTab === 'equipment') {
        const res: any = await apiClient.get('/amc/equipment');
        setEquipmentList(extractArray(res));
      } else if (activeTab === 'plans') {
        const res: any = await apiClient.get('/amc/plans');
        setPlans(extractArray(res));
      }

      // Preload auxiliary data
      const [custRes, prodRes, planRes, eqRes, techRes, visitRes, quoteRes, contractRes]: any = await Promise.all([
        apiClient.get('/customers').catch(() => []),
        apiClient.get('/products').catch(() => []),
        apiClient.get('/amc/plans').catch(() => []),
        apiClient.get('/amc/equipment').catch(() => []),
        apiClient.get('/amc/technicians').catch(() => []),
        apiClient.get('/amc/visits').catch(() => []),
        apiClient.get('/amc/quotations').catch(() => []),
        apiClient.get('/amc/contracts').catch(() => []),
      ]);
      const custList = custRes?.customers || custRes?.data?.customers || extractArray(custRes);
      const prodList = prodRes?.products || prodRes?.data?.products || extractArray(prodRes);
      setCustomers(custList);
      setProducts(prodList);
      setPlans(extractArray(planRes));
      setEquipmentList(extractArray(eqRes));
      setTechnicians(extractArray(techRes));
      setVisits(extractArray(visitRes));
      setQuotations(extractArray(quoteRes));
      if (activeTab === 'contracts') {
        setContracts(extractArray(contractRes));
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load AMC module data');
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateVisits(contractId: string, contractNumber: string) {
    if (!confirm(`Generate all periodic dry and water service visit tickets for Contract #${contractNumber} for the year?`)) return;
    try {
      const res: any = await apiClient.post(`/amc/contracts/${contractId}/generate-visits`, {});
      setSuccessMsg(res.message || 'Periodic service visits generated successfully!');
      fetchInitialData();
      setActiveTab('visits');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate visits');
    }
  }

  async function handleViewEntitlements(contractId: string) {
    try {
      const res: any = await apiClient.get(`/amc/contracts/${contractId}/entitlements`);
      setEntitlementModalData(res.data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load entitlement audit');
    }
  }

  // Contract Actions
  async function handleCreateContract(e: React.FormEvent) {
    e.preventDefault();
    if (!contractForm.customerId) return setErrorMsg('Please select a customer');
    if (contractForm.selectedEquipmentIds.length === 0) return setErrorMsg('Please select at least one covered AC unit');

    try {
      await apiClient.post('/amc/contracts', {
        customerId: contractForm.customerId,
        planId: contractForm.planId || undefined,
        contractType: contractForm.contractType,
        startDate: contractForm.startDate,
        endDate: contractForm.endDate,
        coveredUnits: contractForm.selectedEquipmentIds.map((id) => ({ acEquipmentId: id })),
        financials: {
          contractAmount: Number(contractForm.contractAmount),
          finalAmount: Number(contractForm.contractAmount),
          paidAmount: Number(contractForm.paidAmount),
        },
        activationTrigger: contractForm.activationTrigger,
      });

      setSuccessMsg('AMC Contract created successfully!');
      setIsContractModalOpen(false);
      fetchInitialData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating AMC Contract');
    }
  }

  async function handleRenewContract(contractId: string, contractNumber: string) {
    if (!confirm(`Are you sure you want to renew contract #${contractNumber}? A linked successor contract will be generated.`)) return;
    try {
      const res: any = await apiClient.post(`/amc/contracts/${contractId}/renew`, {});
      setSuccessMsg(res.message || 'Contract renewed successfully!');
      fetchInitialData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error renewing contract');
    }
  }



  function downloadQuotationPdf(quotationId: string) {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    const token = typeof window !== 'undefined' ? localStorage.getItem('jre_token') || '' : '';
    const businessId = typeof window !== 'undefined' ? localStorage.getItem('x-business-id') || '' : '';
    window.open(`${apiBase}/amc/quotations/${quotationId}/pdf?token=${token}&b=${businessId}`, '_blank');
  }

  async function handleConvertQuotation(e: React.FormEvent) {
    e.preventDefault();
    if (!convertingQuotation) return;
    try {
      await apiClient.post(`/amc/quotations/${convertingQuotation._id}/convert`, {
        planId: contractForm.planId || undefined,
        activationTrigger: 'ADMIN_APPROVAL',
      });
      setSuccessMsg(`Quotation #${convertingQuotation.quotationNumber} successfully converted to AMC Contract!`);
      setConvertingQuotation(null);
      setActiveTab('contracts');
      fetchInitialData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to convert quotation to contract');
    }
  }

  // Equipment Actions
  async function handleCreateEquipment(e: React.FormEvent) {
    e.preventDefault();
    if (!equipmentForm.customerId) return setErrorMsg('Please select a customer');
    if (!equipmentForm.installationLocation) return setErrorMsg('Installation location is required');

    try {
      await apiClient.post('/amc/equipment', equipmentForm);
      setSuccessMsg('AC unit registered successfully!');
      setIsEquipmentModalOpen(false);
      fetchInitialData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error registering AC equipment');
    }
  }

  async function viewEquipmentHistory(eq: any) {
    setSelectedHistoryEquipment(eq);
    try {
      const res: any = await apiClient.get(`/amc/equipment/${eq._id}/history`);
      setEquipmentHistoryList(res.data || []);
    } catch (err: any) {
      setErrorMsg('Failed to load equipment assignment history');
    }
  }

  // Plan Actions
  async function handleCreatePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!planForm.name) return setErrorMsg('Plan name is required');

    try {
      await apiClient.post('/amc/plans', {
        name: planForm.name,
        planType: planForm.planType,
        durationMonths: Number(planForm.durationMonths),
        basePrice: Number(planForm.basePrice),
        entitlements: [
          { serviceType: 'DRY_SERVICE', scheduling: 'MONTHLY', quantity: Number(planForm.dryVisits), entitlementScope: 'PER_EQUIPMENT' },
          { serviceType: 'WATER_SERVICE', scheduling: 'QUARTERLY', quantity: Number(planForm.waterVisits), entitlementScope: 'PER_EQUIPMENT' },
          { serviceType: 'BREAKDOWN_REPAIR', scheduling: 'ON_DEMAND', quantity: Number(planForm.breakdownVisits), entitlementScope: 'PER_CONTRACT' },
        ],
        partCoverages: planForm.selectedProductCoverages,
        gasCoverage: {
          included: planForm.gasIncluded,
          refrigerantTypes: ['R32', 'R410A'],
          quantityLimitKg: planForm.gasIncluded ? Number(planForm.gasLimitKg) : null,
          limitScope: 'PER_CONTRACT',
          excludeDamagePipingLeaks: true,
        },
      });

      setSuccessMsg('AMC Plan created successfully!');
      setIsPlanModalOpen(false);
      fetchInitialData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error creating AMC Plan');
    }
  }

  function startEditEquipment(eq: any) {
    setEditingEquipment(eq);
    setEditEquipmentForm({
      customerId: eq.customerId?._id || eq.customerId || '',
      brand: eq.brand || '',
      modelNumber: eq.modelNumber || '',
      serialNumber: eq.serialNumber || '',
      tonnage: eq.tonnage || '1.5',
      acType: eq.acType || 'SPLIT',
      installationLocation: eq.installationLocation || '',
      refrigerantType: eq.refrigerantType || 'R32',
      status: eq.status || 'OPERATIONAL',
      notes: eq.notes || '',
    });
  }

  async function handleUpdateEquipment(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEquipment) return;
    try {
      await apiClient.patch(`/amc/equipment/${editingEquipment._id}`, editEquipmentForm);
      setSuccessMsg(`Equipment "${editEquipmentForm.brand}" updated successfully!`);
      setEditingEquipment(null);
      fetchInitialData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error updating AC equipment');
    }
  }

  async function handleDeleteEquipment(eq: any) {
    const brandName = eq.brand || 'AC unit';
    const loc = eq.installationLocation ? ` at ${eq.installationLocation}` : '';
    if (!confirm(`Are you sure you want to delete ${brandName}${loc}? This action cannot be undone.`)) {
      return;
    }
    try {
      await apiClient.delete(`/amc/equipment/${eq._id}`);
      setSuccessMsg(`AC unit (${brandName}) removed from registry!`);
      fetchInitialData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error deleting AC equipment');
    }
  }

  // Contract Action Handlers
  function openContractDetails(c: any) {
    setSelectedContractDetails(c);
    setContractPaymentForm({
      paymentStatus: c.paymentStatus || 'UNPAID',
      paidAmount: c.financials?.paidAmount || 0,
    });
  }

  async function handleUpdateContractPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedContractDetails) return;
    try {
      const res: any = await apiClient.patch(`/amc/contracts/${selectedContractDetails._id}/payment`, contractPaymentForm);
      setSuccessMsg(`Payment updated for Contract #${selectedContractDetails.contractNumber}!`);
      setSelectedContractDetails(res.data || {
        ...selectedContractDetails,
        paymentStatus: contractPaymentForm.paymentStatus,
        financials: { ...selectedContractDetails.financials, paidAmount: contractPaymentForm.paidAmount },
      });
      fetchInitialData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update contract payment');
    }
  }

  async function handleDeleteContract(contractId: string, contractNumber: string) {
    if (
      !confirm(
        `Are you sure you want to permanently delete Contract #${contractNumber}?\n\nWARNING: Deleting this contract will automatically cancel and delete ALL associated Service Visits & Job-Cards for this contract. This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const res: any = await apiClient.delete(`/amc/contracts/${contractId}`);
      setSuccessMsg(res.message || `Contract #${contractNumber} deleted successfully.`);
      setSelectedContractDetails(null);
      fetchInitialData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete contract');
    }
  }

  function handleShareContractWhatsApp(c: any) {
    const text = `*AMC Contract Details - Jay Ramji Enterprise*\n\nContract No: *${c.contractNumber}*\nCustomer: *${c.customerId?.name || 'Valued Client'}*\nContract Type: *${c.contractType}*\nPeriod: ${new Date(c.startDate).toLocaleDateString()} to ${new Date(c.endDate).toLocaleDateString()}\nCovered Units: ${c.coveredUnits?.length || 0} AC Units\nTotal Contract Amount: Rs. ${(c.financials?.finalAmount || 0).toLocaleString('en-IN')}\nPayment Status: ${c.paymentStatus}\nContract Status: ${c.status}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  }

  // Plan Management Handlers
  async function handleTogglePlanStatus(plan: any) {
    const newActiveState = !plan.active;
    try {
      await apiClient.patch(`/amc/plans/${plan._id}`, { active: newActiveState });
      setSuccessMsg(`Plan "${plan.name}" is now ${newActiveState ? 'ACTIVE' : 'INACTIVE'}.`);
      if (viewingPlan && viewingPlan._id === plan._id) {
        setViewingPlan({ ...viewingPlan, active: newActiveState });
      }
      fetchInitialData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to toggle plan status');
    }
  }

  async function handleDeletePlan(plan: any) {
    if (!confirm(`Are you sure you want to delete plan "${plan.name}"?`)) return;

    try {
      await apiClient.delete(`/amc/plans/${plan._id}`);
      setSuccessMsg(`Plan "${plan.name}" deleted successfully.`);
      setViewingPlan(null);
      fetchInitialData();
    } catch (err: any) {
      if (err.code === 'PLAN_LINKED_TO_ACTIVE_CONTRACTS' || err.message?.includes('active contract')) {
        setPlanDeactivatePrompt({
          plan,
          message: err.message || 'This plan is currently in use by active contract(s). You cannot permanently delete it, but you can set it to Inactive.',
        });
      } else {
        setErrorMsg(err.message || 'Failed to delete plan');
      }
    }
  }

  // Filtered lists
  const filteredQuotations = quotations.filter((q) => {
    if (quotationStatusFilter !== 'ALL' && q.status !== quotationStatusFilter) return false;
    if (quotationTypeFilter !== 'ALL' && q.quotationType !== quotationTypeFilter) return false;
    if (quotationSearchQuery.trim()) {
      const query = quotationSearchQuery.toLowerCase();
      const numMatch = q.quotationNumber?.toLowerCase().includes(query);
      const custMatch = q.customerId?.name?.toLowerCase().includes(query);
      const compMatch = q.customerId?.companyName?.toLowerCase().includes(query);
      return numMatch || custMatch || compMatch;
    }
    return true;
  });

  const filteredEquipment = equipmentList.filter((eq) => {
    if (equipmentTypeFilter !== 'ALL' && eq.acType !== equipmentTypeFilter) return false;
    if (equipmentStatusFilter !== 'ALL' && eq.status !== equipmentStatusFilter) return false;
    if (equipmentSearchQuery.trim()) {
      const query = equipmentSearchQuery.toLowerCase();
      const brandMatch = eq.brand?.toLowerCase().includes(query);
      const modelMatch = eq.modelNumber?.toLowerCase().includes(query);
      const serialMatch = eq.serialNumber?.toLowerCase().includes(query);
      const locMatch = eq.installationLocation?.toLowerCase().includes(query);
      const custMatch = eq.customerId?.name?.toLowerCase().includes(query);
      const compMatch = eq.customerId?.companyName?.toLowerCase().includes(query);
      return brandMatch || modelMatch || serialMatch || locMatch || custMatch || compMatch;
    }
    return true;
  });

  const filteredPlans = plans.filter((p) => {
    if (planTypeFilter !== 'ALL' && p.planType !== planTypeFilter) return false;
    if (planSearchQuery.trim()) {
      const query = planSearchQuery.toLowerCase();
      const nameMatch = p.name?.toLowerCase().includes(query);
      const typeMatch = p.planType?.toLowerCase().includes(query);
      return nameMatch || typeMatch;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-app border border-border-app p-5 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary-900/10 text-primary-700 rounded-xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-text-primary">
              AMC Contract Management
            </h1>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Annual Maintenance Contracts, Rate-Card Quotations, Customer Fleet Registry & Plan Snapshots
          </p>
        </div>

        {/* Top Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/dashboard/amc/quotations/create"
            className="px-4 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
            title="Create AMC Quotation"
          >
            <Plus className="w-4 h-4" />
            <span>+ New Quotation</span>
          </Link>

          {activeTab === 'contracts' && (
            <button
              onClick={() => setIsContractModalOpen(true)}
              className="px-4 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Contract</span>
            </button>
          )}
          {activeTab === 'equipment' && (
            <button
              onClick={() => setIsEquipmentModalOpen(true)}
              className="px-4 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Register AC Unit</span>
            </button>
          )}
          {activeTab === 'plans' && (
            <button
              onClick={() => setIsPlanModalOpen(true)}
              className="px-4 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create AMC Plan</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 bg-danger-soft border border-danger-app/20 text-danger-app text-xs rounded-xl flex items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="cursor-pointer">
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
          <button onClick={() => setSuccessMsg(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-border-app space-x-2">
        <button
          onClick={() => setActiveTab('contracts')}
          className={`pb-3 px-4 text-xs font-bold transition border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'contracts'
              ? 'border-primary-700 text-primary-700'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Contracts</span>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-surface-2-app text-[10px] font-bold">
            {contracts.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('visits')}
          className={`pb-3 px-4 text-xs font-bold transition border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'visits'
              ? 'border-primary-700 text-primary-700'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Service Visits & Job-Cards</span>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-surface-2-app text-[10px] font-bold">
            {visits.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('quotations')}
          className={`pb-3 px-4 text-xs font-bold transition border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'quotations'
              ? 'border-primary-700 text-primary-700'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Quotations</span>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-surface-2-app text-[10px] font-bold">
            {quotations.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('equipment')}
          className={`pb-3 px-4 text-xs font-bold transition border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'equipment'
              ? 'border-primary-700 text-primary-700'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>AC Equipment Registry</span>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-surface-2-app text-[10px] font-bold">
            {equipmentList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('plans')}
          className={`pb-3 px-4 text-xs font-bold transition border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'plans'
              ? 'border-primary-700 text-primary-700'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Plan Templates</span>
          <span className="ml-1 px-2 py-0.5 rounded-full bg-surface-2-app text-[10px] font-bold">
            {plans.length}
          </span>
        </button>
      </div>

      {/* ---------------------------------------------------- */}
      {/* TAB 1: CONTRACTS */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'contracts' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-app border border-border-app p-3.5 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-text-secondary">Status:</span>
              <select
                value={contractStatusFilter}
                onChange={(e) => setContractStatusFilter(e.target.value)}
                className="bg-surface-2-app border border-border-app rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-primary"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="PENDING_PAYMENT">Pending Payment</option>
                <option value="EXPIRED">Expired</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <button
                type="button"
                onClick={() => setExpiringOnly(!expiringOnly)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  expiringOnly
                    ? 'bg-amber-500 text-white'
                    : 'bg-surface-2-app border border-border-app text-text-secondary hover:text-text-primary'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Expiring Soon (30d)</span>
              </button>
            </div>

            <button
              type="button"
              onClick={fetchInitialData}
              className="p-1.5 hover:bg-surface-2-app rounded-lg text-text-secondary cursor-pointer"
              title="Refresh Contracts"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Contracts Table */}
          <div className="bg-surface-app border border-border-app rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2-app border-b border-border-app text-text-secondary uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-3 px-4">Contract No.</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Coverage Period</th>
                    <th className="py-3 px-4">Covered Units</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-app">
                  {contracts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-text-secondary">
                        No AMC contracts found. Create one or convert from an accepted Quotation.
                      </td>
                    </tr>
                  ) : (
                    contracts.map((c) => {
                      const isExpiring =
                        new Date(c.endDate).getTime() - new Date().getTime() <= 30 * 24 * 60 * 60 * 1000 &&
                        c.status === 'ACTIVE';

                      return (
                        <tr key={c._id} className="hover:bg-surface-2-app/50 transition">
                          <td className="py-3.5 px-4 font-black text-primary-700">
                            {c.contractNumber}
                            {c.previousContractId && (
                              <span className="block text-[10px] text-text-secondary font-normal">
                                Renewed from #{c.previousContractId.contractNumber}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-text-primary">
                            {c.customerId?.name || 'Unknown Client'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[10.5px] ${
                                c.contractType === 'COMPREHENSIVE'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {c.contractType === 'COMPREHENSIVE' ? 'Comprehensive' : 'Non-Comp'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-text-secondary">
                            {new Date(c.startDate).toLocaleDateString()} &rarr;{' '}
                            <span className={isExpiring ? 'text-amber-600 font-bold' : ''}>
                              {new Date(c.endDate).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold">
                            {c.coveredUnits?.length || 0} AC Units
                          </td>
                          <td className="py-3.5 px-4 font-bold text-text-primary">
                            ₹ {(c.financials?.finalAmount || 0).toLocaleString('en-IN')}
                            <span
                              className={`block text-[10px] font-bold ${
                                c.paymentStatus === 'PAID'
                                  ? 'text-emerald-600'
                                  : c.paymentStatus === 'PARTIALLY_PAID'
                                  ? 'text-amber-600'
                                  : 'text-red-500'
                              }`}
                            >
                              {c.paymentStatus}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                c.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : c.status === 'EXPIRED'
                                  ? 'bg-neutral-200 text-neutral-700'
                                  : c.status === 'PENDING_PAYMENT'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => openContractDetails(c)}
                              className="px-2.5 py-1 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-[11px] font-bold transition cursor-pointer shadow-xs inline-flex items-center gap-1"
                              title="Open Contract & Manage Payment / Details"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Open</span>
                            </button>

                            <button
                              onClick={() => setSelectedSnapshot(c)}
                              className="px-2.5 py-1 bg-surface-2-app hover:bg-border-app rounded-lg text-text-secondary text-[11px] font-semibold transition cursor-pointer"
                              title="View Plan Snapshot"
                            >
                              Snapshot
                            </button>

                            <button
                              onClick={() => handleViewEntitlements(c._id)}
                              className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 rounded-lg text-[11px] font-bold transition cursor-pointer"
                              title="View Authoritative Entitlements & DB Completed Count"
                            >
                              Entitlements
                            </button>

                            {c.status === 'ACTIVE' && (
                              <button
                                onClick={() => handleGenerateVisits(c._id, c.contractNumber)}
                                className="px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 rounded-lg text-[11px] font-bold transition cursor-pointer"
                                title="Auto-Generate Periodic Service Visits for Covered Fleet"
                              >
                                Generate Visits
                              </button>
                            )}

                            {!c.renewedByContractId && (
                              <button
                                onClick={() => handleRenewContract(c._id, c.contractNumber)}
                                className="px-2.5 py-1 bg-primary-900/10 hover:bg-primary-900/20 text-primary-700 rounded-lg text-[11px] font-bold transition cursor-pointer"
                                title="1-Click Non-Destructive Renewal"
                              >
                                Renew
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 2: SERVICE VISITS & JOB CARDS */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'visits' && (
        <VisitsTab
          visits={visits}
          technicians={technicians}
          products={products}
          onRefresh={fetchInitialData}
          apiClient={apiClient}
          setSuccessMsg={setSuccessMsg}
          setErrorMsg={setErrorMsg}
        />
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 3: QUOTATIONS */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'quotations' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-surface-app border border-border-app p-4 rounded-2xl shadow-xs">
            <div>
              <h3 className="text-sm font-black text-text-primary">AMC Quotations</h3>
              <p className="text-xs text-text-secondary">
                Client inquiries & proposals before finalizing active AMC maintenance contracts
              </p>
            </div>
            <Link
              href="/dashboard/amc/quotations/create"
              className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Quotation</span>
            </Link>
          </div>

          {/* Quotations Search & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-app border border-border-app p-3 rounded-xl shadow-xs text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-text-secondary" />
                <span className="font-bold text-text-secondary">Filters:</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-text-secondary">Status:</span>
                <select
                  value={quotationStatusFilter}
                  onChange={(e) => setQuotationStatusFilter(e.target.value)}
                  className="bg-surface-2-app border border-border-app rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-primary focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="SENT">Finalized</option>
                  <option value="CONVERTED_TO_CONTRACT">Active Contract</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-text-secondary">Type:</span>
                <select
                  value={quotationTypeFilter}
                  onChange={(e) => setQuotationTypeFilter(e.target.value)}
                  className="bg-surface-2-app border border-border-app rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-primary focus:outline-none"
                >
                  <option value="ALL">All Types</option>
                  <option value="COMPREHENSIVE">Comprehensive AMC</option>
                  <option value="NON_COMPREHENSIVE">Non-Comprehensive AMC</option>
                </select>
              </div>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-text-secondary absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search quotation #, customer..."
                value={quotationSearchQuery}
                onChange={(e) => setQuotationSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-xs text-text-primary placeholder:text-text-secondary focus:outline-none"
              />
            </div>
          </div>

          <div className="bg-surface-app border border-border-app rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-2-app border-b border-border-app text-xs font-semibold text-text-muted uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-6">Quotation No.</th>
                    <th className="py-3 px-6">Customer</th>
                    <th className="py-3 px-6">Type</th>
                    <th className="py-3 px-6">Date</th>
                    <th className="py-3 px-6">Items</th>
                    <th className="py-3 px-6">Total Amount</th>
                    <th className="py-3 px-6">Status</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-app text-sm">
                  {filteredQuotations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-text-secondary">
                        <p className="text-base font-medium text-text-primary mb-1">No AMC quotations found</p>
                        <p className="text-xs text-text-secondary">
                          {quotationSearchQuery || quotationStatusFilter !== 'ALL' || quotationTypeFilter !== 'ALL'
                            ? 'Try clearing the filters or search term.'
                            : 'Click "Create Quotation" to compile your first quotation.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredQuotations.map((q) => (
                      <tr key={q._id} className="hover:bg-surface-2-app/30 transition">
                        <td className="py-4 px-6">
                          <Link
                            href={q.status === 'DRAFT' ? `/dashboard/amc/quotations/create?edit=${q._id}` : `/dashboard/amc/quotations/${q._id}`}
                            className="font-bold text-primary-700 hover:underline cursor-pointer"
                            title="Open Quotation"
                          >
                            {q.quotationNumber}
                          </Link>
                        </td>
                        <td className="py-4 px-6 text-text-primary font-medium">
                          {q.customerId?.name || 'Unknown Client'}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`px-2.5 py-0.5 rounded-md font-bold text-[10px] ${
                              q.quotationType === 'COMPREHENSIVE'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {q.quotationType === 'COMPREHENSIVE'
                              ? 'Comprehensive AMC'
                              : 'Non-Comprehensive AMC'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-text-secondary text-xs">
                          {new Date(q.quotationDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="py-4 px-6 text-text-secondary font-medium text-xs">
                          {q.items?.length || 0} line items
                        </td>
                        <td className="py-4 px-6 text-text-primary font-bold">
                          ₹{(q.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                            {q.status === 'DRAFT' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-2-app text-text-secondary border border-border-app">
                                Draft
                              </span>
                            ) : q.status === 'CONVERTED_TO_CONTRACT' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                Active Contract
                              </span>
                            ) : q.status === 'SENT' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-success-soft/60 text-success-app border border-success-app/20">
                                Finalized
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                {q.status}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <Link
                              href={q.status === 'DRAFT' ? `/dashboard/amc/quotations/create?edit=${q._id}` : `/dashboard/amc/quotations/${q._id}`}
                              className="px-3 py-1 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-lg text-xs font-bold text-text-primary cursor-pointer transition inline-flex items-center gap-1"
                              title="Open Quotation"
                            >
                              Open
                            </Link>

                            <button
                              onClick={() => downloadQuotationPdf(q._id)}
                              className="px-2.5 py-1 bg-surface-2-app hover:bg-surface-app border border-border-app rounded-lg text-xs font-semibold text-text-secondary cursor-pointer transition inline-flex items-center gap-1"
                              title="Download PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>PDF</span>
                            </button>

                            {q.status !== 'CONVERTED_TO_CONTRACT' && (
                              <button
                                onClick={() => setConvertingQuotation(q)}
                                className="px-3 py-1 bg-primary-700 hover:bg-primary-800 text-white rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center gap-1 shadow-xs"
                              >
                                <span>Convert to AMC</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 3: AC EQUIPMENT REGISTRY */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'equipment' && (
        <div className="space-y-4">
          {/* Equipment Search & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-app border border-border-app p-3 rounded-xl shadow-xs text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-text-secondary" />
                <span className="font-bold text-text-secondary">Filters:</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-text-secondary">Type:</span>
                <select
                  value={equipmentTypeFilter}
                  onChange={(e) => setEquipmentTypeFilter(e.target.value)}
                  className="bg-surface-2-app border border-border-app rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-primary focus:outline-none"
                >
                  <option value="ALL">All Types</option>
                  <option value="SPLIT">Split AC</option>
                  <option value="WINDOW">Window AC</option>
                  <option value="CASSETTE">Cassette AC</option>
                  <option value="DUCTABLE">Ductable AC</option>
                  <option value="TOWER">Tower AC</option>
                  <option value="PACKAGE">Package AC</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-text-secondary">Status:</span>
                <select
                  value={equipmentStatusFilter}
                  onChange={(e) => setEquipmentStatusFilter(e.target.value)}
                  className="bg-surface-2-app border border-border-app rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-primary focus:outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="OPERATIONAL">Operational</option>
                  <option value="NEEDS_SERVICE">Needs Service</option>
                  <option value="UNDER_REPAIR">Under Repair</option>
                  <option value="DECOMMISSIONED">Decommissioned</option>
                </select>
              </div>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-text-secondary absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search brand, model, serial #, location..."
                value={equipmentSearchQuery}
                onChange={(e) => setEquipmentSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-xs text-text-primary placeholder:text-text-secondary focus:outline-none"
              />
            </div>
          </div>

          <div className="bg-surface-app border border-border-app rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2-app border-b border-border-app text-text-secondary uppercase tracking-wider font-bold">
                  <tr>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Brand & Model</th>
                    <th className="py-3 px-4">Tonnage</th>
                    <th className="py-3 px-4">AC Type</th>
                    <th className="py-3 px-4">Serial No.</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-app">
                  {filteredEquipment.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-text-secondary">
                        {equipmentSearchQuery || equipmentTypeFilter !== 'ALL' || equipmentStatusFilter !== 'ALL'
                          ? 'No customer AC equipment matches the active filters.'
                          : 'No customer AC equipment registered yet.'}
                      </td>
                    </tr>
                  ) : (
                    filteredEquipment.map((eq) => (
                      <tr key={eq._id} className="hover:bg-surface-2-app/50 transition">
                        <td className="py-3.5 px-4 font-bold text-text-primary">
                          {eq.customerId?.name || 'Unassigned'}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-text-primary">
                          {eq.brand} {eq.modelNumber && `(${eq.modelNumber})`}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-primary-700">
                          {eq.tonnage} Ton
                        </td>
                        <td className="py-3.5 px-4 text-text-secondary">
                          {eq.acType}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-text-secondary">
                          {eq.serialNumber || 'N/A'}
                        </td>
                        <td className="py-3.5 px-4 text-text-primary font-medium">
                          {eq.installationLocation}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              eq.status === 'OPERATIONAL'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {eq.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => startEditEquipment(eq)}
                              className="px-2 py-1 bg-surface-2-app hover:bg-border-app rounded-lg text-text-primary text-[11px] font-semibold transition cursor-pointer inline-flex items-center gap-1"
                              title="Edit AC unit details"
                            >
                              <Pencil className="w-3 h-3 text-primary-700" />
                              <span>Edit</span>
                            </button>

                            <button
                              onClick={() => handleDeleteEquipment(eq)}
                              className="px-2 py-1 bg-surface-2-app hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-lg text-rose-600 text-[11px] font-semibold transition cursor-pointer inline-flex items-center gap-1"
                              title="Delete this AC unit"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>

                            <button
                              onClick={() => viewEquipmentHistory(eq)}
                              className="px-2 py-1 bg-surface-2-app hover:bg-border-app rounded-lg text-text-secondary text-[11px] font-semibold transition cursor-pointer inline-flex items-center gap-1"
                              title="View ownership history"
                            >
                              <History className="w-3 h-3" />
                              <span>History</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 4: PLAN TEMPLATES */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'plans' && (
        <div className="space-y-4">
          {/* Plans Search & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-app border border-border-app p-3 rounded-xl shadow-xs text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-text-secondary" />
                <span className="font-bold text-text-secondary">Filters:</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-text-secondary">Plan Type:</span>
                <select
                  value={planTypeFilter}
                  onChange={(e) => setPlanTypeFilter(e.target.value)}
                  className="bg-surface-2-app border border-border-app rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-primary focus:outline-none"
                >
                  <option value="ALL">All Types</option>
                  <option value="COMPREHENSIVE">Comprehensive (Parts + Service)</option>
                  <option value="NON_COMPREHENSIVE">Non-Comprehensive (Service Only)</option>
                </select>
              </div>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-text-secondary absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search plan template name..."
                value={planSearchQuery}
                onChange={(e) => setPlanSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-surface-2-app border border-border-app rounded-lg text-xs text-text-primary placeholder:text-text-secondary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPlans.length === 0 ? (
              <div className="col-span-full py-12 text-center text-text-secondary bg-surface-app border border-border-app rounded-2xl">
                {planSearchQuery || planTypeFilter !== 'ALL'
                  ? 'No AMC plan templates found matching your filters.'
                  : 'No AMC plan templates created yet. Click "Create AMC Plan" above to create one.'}
              </div>
            ) : (
              filteredPlans.map((p) => (
              <div
                key={p._id}
                className="bg-surface-app border border-border-app rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-primary-700/50 transition"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black tracking-wider uppercase ${
                        p.planType === 'COMPREHENSIVE'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {p.planType === 'COMPREHENSIVE' ? 'Comprehensive' : 'Non-Comprehensive'}
                    </span>
                    <span className="text-sm font-black text-text-primary">
                      ₹ {(p.basePrice || 0).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <h3 className="text-base font-black text-text-primary mb-1">
                    {p.name}
                  </h3>
                  <p className="text-xs text-text-secondary mb-4">
                    Valid for {p.durationMonths} Months • Fleet Maintenance
                  </p>

                  {/* Entitlements preview */}
                  <div className="space-y-1.5 border-t border-border-app pt-3 text-xs">
                    <p className="font-bold text-text-secondary text-[11px] uppercase tracking-wider mb-1">
                      Included Entitlements:
                    </p>
                    {p.entitlements?.map((e: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-text-primary">
                        <span>{e.serviceType.replace(/_/g, ' ')}:</span>
                        <span className="font-bold">
                          {e.quantity} ({e.scheduling} / {e.entitlementScope})
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Gas & Parts Info */}
                  <div className="mt-4 pt-3 border-t border-border-app text-xs space-y-1 text-text-secondary">
                    <div className="flex justify-between">
                      <span>Gas Refilling:</span>
                      <span className="font-semibold text-text-primary">
                        {p.gasCoverage?.included ? `Yes (${p.gasCoverage.quantityLimitKg || 'Limit'} kg)` : 'Excluded'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Covered Spare Parts:</span>
                      <span className="font-semibold text-text-primary">
                        {p.partCoverages?.length || 0} product SKUs
                      </span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span>Status:</span>
                      <span
                        className={`font-bold text-[10.5px] px-2 py-0.5 rounded-md ${
                          p.active !== false
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {p.active !== false ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Controls */}
                <div className="mt-4 pt-3 border-t border-border-app flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleTogglePlanStatus(p)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                      p.active !== false
                        ? 'bg-surface-2-app hover:bg-rose-500/10 text-rose-600'
                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700'
                    }`}
                    title={p.active !== false ? 'Deactivate this plan' : 'Activate this plan'}
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>{p.active !== false ? 'Deactivate' : 'Activate'}</span>
                  </button>

                  <button
                    onClick={() => setViewingPlan(p)}
                    className="px-3.5 py-1.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs inline-flex items-center gap-1"
                    title="Open Plan Details"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Open Plan</span>
                  </button>
                </div>
              </div>
            ))
          )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: CONTRACT PLAN SNAPSHOT VIEWER */}
      {/* ---------------------------------------------------- */}
      {selectedSnapshot && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-app border border-border-app rounded-2xl max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto space-y-5">
            <div className="flex justify-between items-center border-b border-border-app pb-4">
              <div>
                <h3 className="text-lg font-black text-text-primary">
                  Contract #{selectedSnapshot.contractNumber} Plan Snapshot
                </h3>
                <p className="text-xs text-text-secondary">
                  Immutable rules captured at contract execution
                </p>
              </div>
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-surface-2-app p-4 rounded-xl">
                <div>
                  <span className="text-text-secondary block">Plan Template:</span>
                  <span className="font-bold text-text-primary text-sm">
                    {selectedSnapshot.planSnapshot?.planName}
                  </span>
                </div>
                <div>
                  <span className="text-text-secondary block">Contract Type:</span>
                  <span className="font-bold text-text-primary text-sm">
                    {selectedSnapshot.planSnapshot?.planType}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-text-primary mb-2 uppercase tracking-wider text-[11px]">
                  Service Entitlements:
                </h4>
                <div className="border border-border-app rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-surface-2-app text-text-secondary font-bold">
                      <tr>
                        <th className="p-2.5">Service Type</th>
                        <th className="p-2.5">Scheduling</th>
                        <th className="p-2.5">Quantity</th>
                        <th className="p-2.5">Scope</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-app">
                      {selectedSnapshot.planSnapshot?.entitlements?.map((e: any, i: number) => (
                        <tr key={i}>
                          <td className="p-2.5 font-semibold">{e.serviceType}</td>
                          <td className="p-2.5">{e.scheduling}</td>
                          <td className="p-2.5 font-bold">{e.quantity}</td>
                          <td className="p-2.5">{e.entitlementScope}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-text-primary mb-2 uppercase tracking-wider text-[11px]">
                  Product-Level Spare Parts Coverage:
                </h4>
                {selectedSnapshot.planSnapshot?.partCoverages?.length === 0 ? (
                  <p className="text-text-secondary italic">No spare parts covered under this contract.</p>
                ) : (
                  <div className="border border-border-app rounded-xl overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-surface-2-app text-text-secondary font-bold">
                        <tr>
                          <th className="p-2.5">Part Name</th>
                          <th className="p-2.5">Coverage Type</th>
                          <th className="p-2.5">Qty Limit/Year</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-app">
                        {selectedSnapshot.planSnapshot?.partCoverages?.map((p: any, i: number) => (
                          <tr key={i}>
                            <td className="p-2.5 font-semibold">{p.productName || p.productId}</td>
                            <td className="p-2.5 font-bold text-emerald-600">{p.coverageType}</td>
                            <td className="p-2.5">{p.quantityLimitPerYear || 'Unlimited'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="px-4 py-2 bg-surface-2-app hover:bg-border-app text-text-primary font-bold rounded-xl text-xs cursor-pointer"
              >
                Close Snapshot
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: EQUIPMENT HISTORY VIEWER */}
      {/* ---------------------------------------------------- */}
      {selectedHistoryEquipment && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-app border border-border-app rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-border-app pb-3">
              <div>
                <h3 className="text-base font-black text-text-primary">
                  Equipment Ownership History
                </h3>
                <p className="text-xs text-text-secondary">
                  {selectedHistoryEquipment.brand} ({selectedHistoryEquipment.tonnage} Ton) - Serial #{selectedHistoryEquipment.serialNumber || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setSelectedHistoryEquipment(null)}
                className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {equipmentHistoryList.length === 0 ? (
                <p className="text-xs text-text-secondary text-center py-6">No historical transfer logs found.</p>
              ) : (
                equipmentHistoryList.map((hist, idx) => (
                  <div key={idx} className="p-3 bg-surface-2-app rounded-xl text-xs space-y-1">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-primary-700">{hist.reason}</span>
                      <span className="text-text-secondary font-normal text-[11px]">
                        {new Date(hist.transferredAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-text-primary">
                      Owner: <strong className="text-text-primary">{hist.toCustomerId?.name || 'Customer'}</strong>
                      {hist.fromCustomerId && ` (From: ${hist.fromCustomerId.name})`}
                    </div>
                    {hist.performedBy && (
                      <div className="text-[10.5px] text-text-secondary">
                        Logged by: {hist.performedBy.name}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setSelectedHistoryEquipment(null)}
                className="px-4 py-2 bg-surface-2-app hover:bg-border-app text-text-primary font-bold rounded-xl text-xs cursor-pointer"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: CONVERT QUOTATION TO AMC CONTRACT */}
      {/* ---------------------------------------------------- */}
      {convertingQuotation && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-app border border-border-app rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-border-app pb-3">
              <div>
                <h3 className="text-base font-black text-text-primary">
                  Convert Quotation to AMC Contract
                </h3>
                <p className="text-xs text-text-secondary">
                  Quotation #{convertingQuotation.quotationNumber} • ₹ {convertingQuotation.grandTotal?.toLocaleString('en-IN')}
                </p>
              </div>
              <button
                onClick={() => setConvertingQuotation(null)}
                className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConvertQuotation} className="space-y-4 text-xs">
              <div>
                <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                  Client:
                </label>
                <p className="font-black text-sm text-text-primary">
                  {convertingQuotation.customerId?.name}
                </p>
              </div>

              <div>
                <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                  Select AMC Plan Template (Optional):
                </label>
                <select
                  value={contractForm.planId}
                  onChange={(e) => setContractForm({ ...contractForm, planId: e.target.value })}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                >
                  <option value="">Default Standard Plan</option>
                  {plans.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.planType})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-surface-2-app rounded-xl text-[11px] text-text-secondary leading-relaxed">
                Notice: All customer AC units registered for this customer will automatically be assigned to this contract. You can edit covered units later in the Contract details.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConvertingQuotation(null)}
                  className="px-4 py-2.5 bg-surface-2-app hover:bg-border-app rounded-xl text-xs font-bold text-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Confirm &amp; Create Contract
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: CREATE CONTRACT */}
      {/* ---------------------------------------------------- */}
      {isContractModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-app border border-border-app rounded-2xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex justify-between items-center border-b border-border-app pb-3">
              <h3 className="text-base font-black text-text-primary">Create New AMC Contract</h3>
              <button
                onClick={() => setIsContractModalOpen(false)}
                className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateContract} className="space-y-4 text-xs">
              <div>
                <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                  Customer *
                </label>
                <select
                  value={contractForm.customerId}
                  onChange={(e) => setContractForm({ ...contractForm, customerId: e.target.value })}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-medium"
                  required
                >
                  <option value="">Select Customer</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                    Plan Template
                  </label>
                  <select
                    value={contractForm.planId}
                    onChange={(e) => setContractForm({ ...contractForm, planId: e.target.value })}
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                  >
                    <option value="">Standard Agreement</option>
                    {plans.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                    Contract Type *
                  </label>
                  <select
                    value={contractForm.contractType}
                    onChange={(e) => setContractForm({ ...contractForm, contractType: e.target.value })}
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-bold"
                  >
                    <option value="NON_COMPREHENSIVE">Non-Comprehensive (Labour Only)</option>
                    <option value="COMPREHENSIVE">Comprehensive (Eligible Spares)</option>
                  </select>
                </div>
              </div>

              {/* Multi-AC Unit Selector */}
              <div>
                <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                  Select Covered AC Units (Customer Fleet) *
                </label>
                <div className="border border-border-app rounded-xl p-3 max-h-36 overflow-y-auto space-y-2 bg-surface-2-app/40">
                  {equipmentList.filter((eq) => eq.customerId?._id === contractForm.customerId || eq.customerId === contractForm.customerId).length === 0 ? (
                    <p className="text-text-secondary italic">
                      {contractForm.customerId
                        ? 'No AC units registered for this customer yet. Register AC units first.'
                        : 'Select a customer above to view their AC units.'}
                    </p>
                  ) : (
                    equipmentList
                      .filter((eq) => eq.customerId?._id === contractForm.customerId || eq.customerId === contractForm.customerId)
                      .map((eq) => {
                        const checked = contractForm.selectedEquipmentIds.includes(eq._id);
                        return (
                          <label key={eq._id} className="flex items-center gap-2 cursor-pointer text-text-primary font-medium">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setContractForm({
                                    ...contractForm,
                                    selectedEquipmentIds: [...contractForm.selectedEquipmentIds, eq._id],
                                  });
                                } else {
                                  setContractForm({
                                    ...contractForm,
                                    selectedEquipmentIds: contractForm.selectedEquipmentIds.filter((id) => id !== eq._id),
                                  });
                                }
                              }}
                              className="rounded text-primary-700"
                            />
                            <span>
                              {eq.brand} ({eq.tonnage} Ton) - {eq.installationLocation} [{eq.serialNumber || 'No S/N'}]
                            </span>
                          </label>
                        );
                      })
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={contractForm.startDate}
                    onChange={(e) => setContractForm({ ...contractForm, startDate: e.target.value })}
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={contractForm.endDate}
                    onChange={(e) => setContractForm({ ...contractForm, endDate: e.target.value })}
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                    Total Contract Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={contractForm.contractAmount}
                    onChange={(e) => setContractForm({ ...contractForm, contractAmount: Number(e.target.value) })}
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                    Advance / Paid Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={contractForm.paidAmount}
                    onChange={(e) => setContractForm({ ...contractForm, paidAmount: Number(e.target.value) })}
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsContractModalOpen(false)}
                  className="px-4 py-2.5 bg-surface-2-app hover:bg-border-app rounded-xl text-xs font-bold text-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Create Contract
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: REGISTER AC UNIT */}
      {/* ---------------------------------------------------- */}
      {isEquipmentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-app border border-border-app rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-border-app pb-3">
              <h3 className="text-base font-black text-text-primary">Register Customer AC Unit</h3>
              <button
                onClick={() => setIsEquipmentModalOpen(false)}
                className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEquipment} className="space-y-4 text-xs">
              <div>
                <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                  Customer *
                </label>
                <select
                  value={equipmentForm.customerId}
                  onChange={(e) => setEquipmentForm({ ...equipmentForm, customerId: e.target.value })}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-medium"
                  required
                >
                  <option value="">Select Customer</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                    AC Type *
                  </label>
                  <select
                    value={equipmentForm.acType}
                    onChange={(e) => setEquipmentForm({ ...equipmentForm, acType: e.target.value })}
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                  >
                    <option value="SPLIT">Split AC</option>
                    <option value="WINDOW">Window AC</option>
                    <option value="CASSETTE">Cassette AC</option>
                    <option value="DUCTABLE">Ductable AC</option>
                    <option value="TOWER">Tower AC</option>
                    <option value="PACKAGE">Package AC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                    Tonnage *
                  </label>
                  <input
                    type="text"
                    value={equipmentForm.tonnage}
                    onChange={(e) => setEquipmentForm({ ...equipmentForm, tonnage: e.target.value })}
                    placeholder="e.g. 1.5 or Up to 5 Ton"
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                    Brand *
                  </label>
                  <input
                    type="text"
                    value={equipmentForm.brand}
                    onChange={(e) => setEquipmentForm({ ...equipmentForm, brand: e.target.value })}
                    placeholder="Daikin, Voltas, Blue Star..."
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                    Installation Location *
                  </label>
                  <input
                    type="text"
                    value={equipmentForm.installationLocation}
                    onChange={(e) => setEquipmentForm({ ...equipmentForm, installationLocation: e.target.value })}
                    placeholder="e.g. Server Room 1"
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    value={equipmentForm.serialNumber}
                    onChange={(e) => setEquipmentForm({ ...equipmentForm, serialNumber: e.target.value })}
                    placeholder="Serial No."
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                    Refrigerant Gas
                  </label>
                  <input
                    type="text"
                    value={equipmentForm.refrigerantType}
                    onChange={(e) => setEquipmentForm({ ...equipmentForm, refrigerantType: e.target.value })}
                    placeholder="R32, R410A, R22"
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEquipmentModalOpen(false)}
                  className="px-4 py-2.5 bg-surface-2-app hover:bg-border-app rounded-xl text-xs font-bold text-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Register Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: EDIT AC UNIT */}
      {/* ---------------------------------------------------- */}
      {editingEquipment && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-app border border-border-app rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-border-app pb-3">
              <div>
                <h3 className="text-base font-black text-text-primary">
                  Edit AC Equipment Details
                </h3>
                <p className="text-xs text-text-secondary">
                  Update unit specifications, location, or operational status
                </p>
              </div>
              <button
                onClick={() => setEditingEquipment(null)}
                className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateEquipment} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                  Customer
                </label>
                <select
                  value={editEquipmentForm.customerId}
                  onChange={(e) => setEditEquipmentForm({ ...editEquipmentForm, customerId: e.target.value })}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-medium"
                  required
                >
                  <option value="">Select Customer</option>
                  {customers.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                    AC Type *
                  </label>
                  <select
                    value={editEquipmentForm.acType}
                    onChange={(e) => setEditEquipmentForm({ ...editEquipmentForm, acType: e.target.value })}
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-bold"
                  >
                    <option value="SPLIT">Split AC</option>
                    <option value="WINDOW">Window AC</option>
                    <option value="CASSETTE">Cassette AC</option>
                    <option value="DUCTABLE">Ductable AC</option>
                    <option value="TOWER">Tower AC</option>
                    <option value="PACKAGE">Package AC</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                    Tonnage *
                  </label>
                  <input
                    type="text"
                    value={editEquipmentForm.tonnage}
                    onChange={(e) => setEditEquipmentForm({ ...editEquipmentForm, tonnage: e.target.value })}
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                    Brand *
                  </label>
                  <input
                    type="text"
                    value={editEquipmentForm.brand}
                    onChange={(e) => setEditEquipmentForm({ ...editEquipmentForm, brand: e.target.value })}
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                    Model Number
                  </label>
                  <input
                    type="text"
                    value={editEquipmentForm.modelNumber}
                    onChange={(e) => setEditEquipmentForm({ ...editEquipmentForm, modelNumber: e.target.value })}
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                    Serial Number
                  </label>
                  <input
                    type="text"
                    value={editEquipmentForm.serialNumber}
                    onChange={(e) => setEditEquipmentForm({ ...editEquipmentForm, serialNumber: e.target.value })}
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                    Refrigerant Gas
                  </label>
                  <input
                    type="text"
                    value={editEquipmentForm.refrigerantType}
                    onChange={(e) => setEditEquipmentForm({ ...editEquipmentForm, refrigerantType: e.target.value })}
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                    Installation Location *
                  </label>
                  <input
                    type="text"
                    value={editEquipmentForm.installationLocation}
                    onChange={(e) => setEditEquipmentForm({ ...editEquipmentForm, installationLocation: e.target.value })}
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                    Operational Status
                  </label>
                  <select
                    value={editEquipmentForm.status}
                    onChange={(e) => setEditEquipmentForm({ ...editEquipmentForm, status: e.target.value })}
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-bold"
                  >
                    <option value="OPERATIONAL">Operational</option>
                    <option value="NEEDS_SERVICE">Needs Service</option>
                    <option value="UNDER_REPAIR">Under Repair</option>
                    <option value="DECOMMISSIONED">Decommissioned</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={editEquipmentForm.notes}
                  onChange={(e) => setEditEquipmentForm({ ...editEquipmentForm, notes: e.target.value })}
                  placeholder="Additional unit remarks..."
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border-app">
                <button
                  type="button"
                  onClick={() => setEditingEquipment(null)}
                  className="px-4 py-2.5 bg-surface-2-app hover:bg-border-app rounded-xl text-xs font-bold text-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: CREATE AMC PLAN */}
      {/* ---------------------------------------------------- */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-app border border-border-app rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-border-app pb-3">
              <div>
                <h3 className="text-base font-black text-text-primary">
                  Create AMC Plan Template
                </h3>
                <p className="text-xs text-text-secondary">
                  Configure default service visits, gas policy, and coverage rules
                </p>
              </div>
              <button
                onClick={() => setIsPlanModalOpen(false)}
                className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePlan} className="space-y-4 text-xs">
              <div>
                <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                  Plan Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Standard 1-Year Comprehensive Fleet"
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                    Plan Type *
                  </label>
                  <select
                    value={planForm.planType}
                    onChange={(e) => setPlanForm({ ...planForm, planType: e.target.value })}
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-bold"
                  >
                    <option value="COMPREHENSIVE">Comprehensive (Parts &amp; Labor)</option>
                    <option value="NON_COMPREHENSIVE">Non-Comprehensive (Labor Only)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                    Duration (Months) *
                  </label>
                  <input
                    type="number"
                    value={planForm.durationMonths}
                    onChange={(e) => setPlanForm({ ...planForm, durationMonths: Number(e.target.value) })}
                    className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-text-secondary font-bold mb-1 uppercase tracking-wider">
                  Base Price / Benchmark Rate (₹) *
                </label>
                <input
                  type="number"
                  value={planForm.basePrice}
                  onChange={(e) => setPlanForm({ ...planForm, basePrice: Number(e.target.value) })}
                  className="w-full bg-surface-2-app border border-border-app rounded-xl p-2.5 text-xs text-text-primary font-black"
                  required
                />
              </div>

              {/* Service Entitlements */}
              <div className="bg-surface-2-app/50 border border-border-app p-3 rounded-xl space-y-2.5">
                <h4 className="font-bold text-text-primary uppercase tracking-wider text-[11px]">
                  Included Service Entitlements:
                </h4>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="block text-text-secondary text-[11px] font-semibold mb-1">
                      Dry Visits (Year)
                    </label>
                    <input
                      type="number"
                      value={planForm.dryVisits}
                      onChange={(e) => setPlanForm({ ...planForm, dryVisits: Number(e.target.value) })}
                      className="w-full bg-surface-app border border-border-app rounded-lg p-2 text-xs font-bold text-text-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary text-[11px] font-semibold mb-1">
                      Water Visits (Year)
                    </label>
                    <input
                      type="number"
                      value={planForm.waterVisits}
                      onChange={(e) => setPlanForm({ ...planForm, waterVisits: Number(e.target.value) })}
                      className="w-full bg-surface-app border border-border-app rounded-lg p-2 text-xs font-bold text-text-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-text-secondary text-[11px] font-semibold mb-1">
                      Breakdown Calls
                    </label>
                    <input
                      type="number"
                      value={planForm.breakdownVisits}
                      onChange={(e) => setPlanForm({ ...planForm, breakdownVisits: Number(e.target.value) })}
                      className="w-full bg-surface-app border border-border-app rounded-lg p-2 text-xs font-bold text-text-primary"
                    />
                  </div>
                </div>
              </div>

              {/* Gas Refill Coverage */}
              <div className="bg-surface-2-app/50 border border-border-app p-3 rounded-xl space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-text-primary">
                  <input
                    type="checkbox"
                    checked={planForm.gasIncluded}
                    onChange={(e) => setPlanForm({ ...planForm, gasIncluded: e.target.checked })}
                    className="rounded text-primary-700"
                  />
                  <span>Include Refrigerant Gas Top-Up</span>
                </label>

                {planForm.gasIncluded && (
                  <div className="pt-2">
                    <label className="block text-text-secondary text-[11px] font-semibold mb-1">
                      Gas Refill Limit (Kg per Contract)
                    </label>
                    <input
                      type="number"
                      value={planForm.gasLimitKg}
                      onChange={(e) => setPlanForm({ ...planForm, gasLimitKg: Number(e.target.value) })}
                      className="w-full bg-surface-app border border-border-app rounded-lg p-2 text-xs font-bold text-text-primary"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border-app">
                <button
                  type="button"
                  onClick={() => setIsPlanModalOpen(false)}
                  className="px-4 py-2.5 bg-surface-2-app hover:bg-border-app rounded-xl text-xs font-bold text-text-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-primary-700 hover:bg-primary-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Create Plan Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* ---------------------------------------------------- */}
      {/* MODAL: CONTRACT DETAILS & PAYMENT MANAGEMENT */}
      {/* ---------------------------------------------------- */}
      {selectedContractDetails && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-app border border-border-app rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-border-app pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-black text-primary-700">
                    Contract #{selectedContractDetails.contractNumber}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      selectedContractDetails.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedContractDetails.status === 'PENDING_PAYMENT'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {selectedContractDetails.status}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-surface-2-app text-text-primary">
                    {selectedContractDetails.contractType}
                  </span>
                </div>
                <p className="text-xs text-text-secondary mt-1 font-medium">
                  Client: <strong className="text-text-primary">{selectedContractDetails.customerId?.name || 'Customer'}</strong>
                  {selectedContractDetails.customerId?.contact?.phone && ` • ${selectedContractDetails.customerId.contact.phone}`}
                </p>
              </div>
              <button
                onClick={() => setSelectedContractDetails(null)}
                className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Coverage Period & Fleet Summary */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-surface-2-app/50 p-3.5 rounded-xl border border-border-app">
              <div>
                <span className="text-text-secondary block font-semibold">Coverage Period:</span>
                <span className="font-bold text-text-primary">
                  {new Date(selectedContractDetails.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} &rarr;{' '}
                  {new Date(selectedContractDetails.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div>
                <span className="text-text-secondary block font-semibold">Covered Fleet:</span>
                <span className="font-bold text-text-primary">
                  {selectedContractDetails.coveredUnits?.length || 0} Registered AC Units
                </span>
              </div>
            </div>

            {/* Covered AC Units List */}
            <div>
              <h4 className="text-xs font-black text-text-primary uppercase tracking-wider mb-2">
                Covered Equipment Fleet
              </h4>
              <div className="border border-border-app rounded-xl overflow-hidden max-h-36 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-2-app text-text-secondary font-bold">
                    <tr>
                      <th className="p-2.5">Brand &amp; Model</th>
                      <th className="p-2.5">Tonnage</th>
                      <th className="p-2.5">Location</th>
                      <th className="p-2.5">Serial No.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-app">
                    {selectedContractDetails.coveredUnits?.map((u: any, idx: number) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-semibold text-text-primary">
                          {u.acEquipmentId?.brand || u.unitBrand || 'AC Unit'} {u.acEquipmentId?.modelNumber || u.unitModel}
                        </td>
                        <td className="p-2.5 text-primary-700 font-bold">
                          {u.acEquipmentId?.tonnage || u.unitTonnage} Ton
                        </td>
                        <td className="p-2.5 text-text-secondary">
                          {u.acEquipmentId?.installationLocation || u.unitLocation || 'On-site'}
                        </td>
                        <td className="p-2.5 font-mono text-[11px] text-text-secondary">
                          {u.acEquipmentId?.serialNumber || u.unitSerial || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financials & Payment Editor */}
            <div className="bg-surface-2-app/60 border border-border-app p-4 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-black text-text-primary uppercase tracking-wider">
                  Financials &amp; Payment Status
                </h4>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                    selectedContractDetails.paymentStatus === 'PAID'
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedContractDetails.paymentStatus === 'PARTIALLY_PAID'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {selectedContractDetails.paymentStatus}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="bg-surface-app p-2.5 rounded-lg border border-border-app">
                  <span className="text-text-secondary block text-[11px]">Total Contract Value</span>
                  <span className="font-black text-text-primary text-sm">
                    ₹ {(selectedContractDetails.financials?.finalAmount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="bg-surface-app p-2.5 rounded-lg border border-border-app">
                  <span className="text-text-secondary block text-[11px]">Amount Collected</span>
                  <span className="font-black text-emerald-600 text-sm">
                    ₹ {(selectedContractDetails.financials?.paidAmount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="bg-surface-app p-2.5 rounded-lg border border-border-app">
                  <span className="text-text-secondary block text-[11px]">Outstanding Balance</span>
                  <span className="font-black text-rose-600 text-sm">
                    ₹ {Math.max(0, (selectedContractDetails.financials?.finalAmount || 0) - (selectedContractDetails.financials?.paidAmount || 0)).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Form to update payment */}
              <form onSubmit={handleUpdateContractPayment} className="pt-2 border-t border-border-app flex flex-wrap items-end gap-3 text-xs">
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-text-secondary font-bold mb-1">
                    Update Paid Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={contractPaymentForm.paidAmount}
                    onChange={(e) => setContractPaymentForm({ ...contractPaymentForm, paidAmount: Number(e.target.value) })}
                    className="w-full bg-surface-app border border-border-app rounded-xl p-2 font-bold text-text-primary"
                    min={0}
                    max={selectedContractDetails.financials?.finalAmount || 9999999}
                  />
                </div>

                <div className="flex-1 min-w-[140px]">
                  <label className="block text-text-secondary font-bold mb-1">
                    Payment Status
                  </label>
                  <select
                    value={contractPaymentForm.paymentStatus}
                    onChange={(e) => setContractPaymentForm({ ...contractPaymentForm, paymentStatus: e.target.value })}
                    className="w-full bg-surface-app border border-border-app rounded-xl p-2 font-bold text-text-primary"
                  >
                    <option value="UNPAID">Unpaid</option>
                    <option value="PARTIALLY_PAID">Partially Paid</option>
                    <option value="PAID">Paid in Full</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-xl font-bold transition shadow-xs cursor-pointer"
                >
                  Save Payment
                </button>
              </form>
            </div>

            {/* Bottom Actions Bar */}
            <div className="pt-2 border-t border-border-app flex items-center justify-between gap-3">
              {/* Delete Contract with cascade */}
              <button
                type="button"
                onClick={() => handleDeleteContract(selectedContractDetails._id, selectedContractDetails.contractNumber)}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                title="Delete this contract and all associated service visits"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Contract</span>
              </button>

              <div className="flex items-center gap-2">
                {/* WhatsApp Share */}
                <button
                  type="button"
                  onClick={() => handleShareContractWhatsApp(selectedContractDetails)}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Share Contract</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedContractDetails(null)}
                  className="px-4 py-2 bg-surface-2-app hover:bg-border-app text-text-secondary rounded-xl text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: PLAN DETAILS & ACTIVE/INACTIVE / SAFE DELETE */}
      {/* ---------------------------------------------------- */}
      {viewingPlan && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-app border border-border-app rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-border-app pb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-black text-text-primary">
                    {viewingPlan.name}
                  </h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black ${
                      viewingPlan.active !== false
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {viewingPlan.active !== false ? 'ACTIVE TEMPLATE' : 'INACTIVE TEMPLATE'}
                  </span>
                </div>
                <p className="text-xs text-text-secondary mt-0.5">
                  {viewingPlan.planType} • {viewingPlan.durationMonths} Months • Benchmark Rate: ₹ {(viewingPlan.basePrice || 0).toLocaleString('en-IN')}
                </p>
              </div>
              <button
                onClick={() => setViewingPlan(null)}
                className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Plan Entitlements */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-text-primary uppercase tracking-wider text-[11px]">
                Included Entitlements &amp; Frequencies:
              </h4>
              <div className="border border-border-app rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-surface-2-app text-text-secondary font-bold">
                    <tr>
                      <th className="p-2.5">Service Type</th>
                      <th className="p-2.5">Scheduling</th>
                      <th className="p-2.5">Quantity</th>
                      <th className="p-2.5">Scope</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-app">
                    {viewingPlan.entitlements?.map((e: any, i: number) => (
                      <tr key={i}>
                        <td className="p-2.5 font-semibold text-text-primary">
                          {e.serviceType?.replace(/_/g, ' ')}
                        </td>
                        <td className="p-2.5 text-text-secondary">{e.scheduling}</td>
                        <td className="p-2.5 font-bold text-primary-700">{e.quantity}</td>
                        <td className="p-2.5 text-text-secondary">{e.entitlementScope}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Gas & Parts Info */}
            <div className="p-3.5 bg-surface-2-app rounded-xl text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-text-secondary">Refrigerant Gas Top-Up:</span>
                <span className="font-bold text-text-primary">
                  {viewingPlan.gasCoverage?.included
                    ? `Included (Limit: ${viewingPlan.gasCoverage.quantityLimitKg || 'Limit'} kg)`
                    : 'Excluded (Chargeable)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Covered Spare Parts:</span>
                <span className="font-bold text-text-primary">
                  {viewingPlan.partCoverages?.length || 0} product SKUs included
                </span>
              </div>
            </div>

            {/* Policy notice */}
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
              💡 <strong>Deactivation Notice:</strong> If this plan template is marked Inactive, it cannot be selected for new quotations or contracts, but existing contracts that signed under this plan template will continue without disruption.
            </div>

            {/* Actions: Toggle Active/Inactive and Delete Plan */}
            <div className="pt-2 border-t border-border-app flex items-center justify-between gap-3">
              {/* Delete Plan */}
              <button
                type="button"
                onClick={() => handleDeletePlan(viewingPlan)}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                title="Delete this plan template"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Plan</span>
              </button>

              <div className="flex items-center gap-2">
                {/* Active / Inactive Toggle */}
                <button
                  type="button"
                  onClick={() => handleTogglePlanStatus(viewingPlan)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                    viewingPlan.active !== false
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{viewingPlan.active !== false ? 'Set as Inactive' : 'Set as Active'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewingPlan(null)}
                  className="px-4 py-2 bg-surface-2-app hover:bg-border-app text-text-secondary rounded-xl text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* POPUP: PLAN LINKED TO ACTIVE CONTRACTS ALERT */}
      {/* ---------------------------------------------------- */}
      {planDeactivatePrompt && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-surface-app border border-border-app rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-amber-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-black text-text-primary">
                Plan Currently in Active Use
              </h3>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              {planDeactivatePrompt.message}
            </p>

            <p className="text-xs text-text-primary font-medium bg-surface-2-app p-3 rounded-xl border border-border-app">
              Would you like to <strong>deactivate this plan template</strong> now? Inactive templates are hidden from future selection while keeping current active contracts intact.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-border-app">
              <button
                type="button"
                onClick={() => setPlanDeactivatePrompt(null)}
                className="px-4 py-2 bg-surface-2-app hover:bg-border-app text-text-secondary rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleTogglePlanStatus(planDeactivatePrompt.plan);
                  setPlanDeactivatePrompt(null);
                  setViewingPlan(null);
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                Deactivate Plan Now
              </button>
            </div>
          </div>
        </div>
      )}
      {entitlementModalData && (
        <EntitlementModal
          data={entitlementModalData}
          onClose={() => setEntitlementModalData(null)}
        />
      )}
    </div>
  );
}
