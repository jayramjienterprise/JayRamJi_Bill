import { Router } from 'express';
import { authenticate, requireBusiness } from '../../middleware/auth';
import {
  listEquipment,
  getEquipment,
  getEquipmentHistory,
  createEquipment,
  updateEquipment,
  deleteEquipment,
} from './equipment.controller';
import {
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
} from './plan.controller';
import {
  listQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  updateQuotationStatus,
  generateQuotationPdf,
  deleteQuotation,
  convertQuotationToInvoice,
} from './quotation.controller';
import {
  listContracts,
  getContract,
  generateContractPdf,
  createContract,
  convertQuotationToContract,
  updateContractStatus,
  renewContract,
  deleteContract,
  updateContractPayment,
} from './contract.controller';
import {
  listVisits,
  getVisit,
  createServiceVisit,
  updateVisitStatus,
  generateContractVisits,
  assignTechnician,
  completeVisitJobCard,
  createSupplementaryQuotationFromVisit,
  getVisitEntitlementSummary,
  listTechnicians,
  createTechnician,
  updateTechnician,
  deleteTechnician,
} from './visit.controller';

const router = Router();

// Apply auth & business context globally to AMC module
router.use(authenticate);
router.use(requireBusiness);

// ----------------------------------------------------
// 1. Customer AC Equipment Endpoints
// ----------------------------------------------------
router.get('/equipment', listEquipment);
router.get('/equipment/:id', getEquipment);
router.get('/equipment/:id/history', getEquipmentHistory);
router.post('/equipment', createEquipment);
router.patch('/equipment/:id', updateEquipment);
router.delete('/equipment/:id', deleteEquipment);

// ----------------------------------------------------
// 2. AMC Plans Templates Endpoints
// ----------------------------------------------------
router.get('/plans', listPlans);
router.get('/plans/:id', getPlan);
router.post('/plans', createPlan);
router.patch('/plans/:id', updatePlan);
router.delete('/plans/:id', deletePlan);

// ----------------------------------------------------
// 3. AMC Quotations Endpoints
// ----------------------------------------------------
router.get('/quotations', listQuotations);
router.get('/quotations/:id', getQuotation);
router.get('/quotations/:id/pdf', generateQuotationPdf);
router.post('/quotations', createQuotation);
router.patch('/quotations/:id', updateQuotation);
router.patch('/quotations/:id/status', updateQuotationStatus);
router.post('/quotations/:quotationId/convert', convertQuotationToContract);
router.post('/quotations/:id/convert-to-invoice', convertQuotationToInvoice);
router.delete('/quotations/:id', deleteQuotation);

// ----------------------------------------------------
// 4. AMC Contracts Endpoints
// ----------------------------------------------------
router.get('/contracts', listContracts);
router.get('/contracts/:id', getContract);
router.get('/contracts/:id/pdf', generateContractPdf);
router.post('/contracts', createContract);
router.patch('/contracts/:id/status', updateContractStatus);
router.patch('/contracts/:id/payment', updateContractPayment);
router.delete('/contracts/:id', deleteContract);
router.post('/contracts/:id/renew', renewContract);
router.get('/contracts/:contractId/entitlements', getVisitEntitlementSummary);
router.post('/contracts/:contractId/generate-visits', generateContractVisits);

// ----------------------------------------------------
// 5. AMC Service Visits & Job-Cards Endpoints
// ----------------------------------------------------
router.get('/visits', listVisits);
router.post('/visits', createServiceVisit);
router.get('/technicians', listTechnicians);
router.post('/technicians', createTechnician);
router.patch('/technicians/:id', updateTechnician);
router.delete('/technicians/:id', deleteTechnician);
router.get('/visits/:id', getVisit);
router.patch('/visits/:id/status', updateVisitStatus);
router.patch('/visits/:id/assign', assignTechnician);
router.post('/visits/:id/complete-jobcard', completeVisitJobCard);
router.post('/visits/:id/supplementary-quotation', createSupplementaryQuotationFromVisit);

export default router;
