import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AmcContract, IAmcContractPlanSnapshot } from '../../database/models/AmcContract';
import { AmcServiceVisit } from '../../database/models/AmcServiceVisit';
import { AmcPlan } from '../../database/models/AmcPlan';
import { AmcQuotation } from '../../database/models/AmcQuotation';
import { Customer } from '../../database/models/Customer';
import { CustomerAcEquipment } from '../../database/models/CustomerAcEquipment';
import { InvoiceSequence } from '../../database/models/InvoiceSequence';
import { Business } from '../../database/models/Business';
import { Asset } from '../../database/models/Asset';
import { PaymentAccount } from '../../database/models/PaymentAccount';
import { DocumentGenerationService } from '../../services/DocumentGenerationService';
import { AmcContractRenderData } from '../../services/AmcRenderService';
import { AppError } from '../../middleware/errorHandler';

const coveredUnitSchema = z.object({
  acEquipmentId: z.string().min(1, 'AC Equipment ID is required'),
  unitTonnage: z.string().nullable().optional(),
  unitBrand: z.string().nullable().optional(),
  unitSerial: z.string().nullable().optional(),
  unitLocation: z.string().nullable().optional(),
  unitNotes: z.string().nullable().optional(),
});

const createContractSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  planId: z.string().optional(),
  contractType: z.enum(['COMPREHENSIVE', 'NON_COMPREHENSIVE']).default('NON_COMPREHENSIVE'),
  contractNumber: z.string().optional(),
  quotationId: z.string().nullable().optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  coveredUnits: z.array(coveredUnitSchema).min(1, 'At least one AC unit must be covered'),
  financials: z.object({
    contractAmount: z.number().min(0),
    discount: z.number().min(0).default(0),
    taxAmount: z.number().min(0).default(0),
    finalAmount: z.number().min(0),
    paidAmount: z.number().min(0).default(0),
  }),
  paymentScheduleType: z.enum(['LUMP_SUM', 'HALF_YEARLY', 'QUARTERLY', 'CUSTOM']).optional().default('LUMP_SUM'),
  customInstallments: z.any().optional(),
  activationTrigger: z.enum(['ADMIN_APPROVAL', 'PAYMENT_RECEIVED', 'ADVANCE_RECEIVED']).default('ADMIN_APPROVAL'),
  notes: z.string().nullable().optional(),
  customPlanSnapshot: z.any().optional(), // Allow custom override if not using planId
});

async function getNextContractNumber(businessId: any, prefix = 'AMC-2526'): Promise<string> {
  let contractNumber = '';
  let isUnique = false;
  while (!isUnique) {
    const seq = await InvoiceSequence.findOneAndUpdate(
      { businessId, key: 'AMC_CONTRACT' },
      { $inc: { nextNumber: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    contractNumber = `${prefix}-${String(seq.nextNumber).padStart(3, '0')}`;
    const exists = await AmcContract.findOne({ businessId, contractNumber });
    if (!exists) {
      isUnique = true;
    }
  }
  return contractNumber;
}

export function generateMilestoneInstallments(
  scheduleType: 'LUMP_SUM' | 'HALF_YEARLY' | 'QUARTERLY' | 'CUSTOM',
  finalAmount: number,
  startDate: Date,
  paidAmount: number = 0
) {
  const installments: any[] = [];
  const start = new Date(startDate);

  if (scheduleType === 'HALF_YEARLY') {
    const half = Math.round(finalAmount / 2);
    const secondHalf = finalAmount - half;
    const due1 = new Date(start);
    const due2 = new Date(start);
    due2.setMonth(due2.getMonth() + 6);

    installments.push({
      installmentNumber: 1,
      title: 'Half-Yearly Installment 1 of 2',
      dueDate: due1,
      amount: half,
      status: paidAmount >= half ? 'PAID' : (due1 < new Date() ? 'OVERDUE' : 'PENDING'),
      paidAt: paidAmount >= half ? new Date() : null,
    });
    installments.push({
      installmentNumber: 2,
      title: 'Half-Yearly Installment 2 of 2',
      dueDate: due2,
      amount: secondHalf,
      status: paidAmount >= finalAmount ? 'PAID' : (due2 < new Date() ? 'OVERDUE' : 'PENDING'),
      paidAt: paidAmount >= finalAmount ? new Date() : null,
    });
  } else if (scheduleType === 'QUARTERLY') {
    const qAmount = Math.round(finalAmount / 4);
    for (let i = 1; i <= 4; i++) {
      const amt = i === 4 ? finalAmount - (qAmount * 3) : qAmount;
      const due = new Date(start);
      due.setMonth(due.getMonth() + (i - 1) * 3);
      const threshold = qAmount * i;

      installments.push({
        installmentNumber: i,
        title: `Quarterly Installment ${i} of 4`,
        dueDate: due,
        amount: amt,
        status: paidAmount >= threshold ? 'PAID' : (due < new Date() ? 'OVERDUE' : 'PENDING'),
        paidAt: paidAmount >= threshold ? new Date() : null,
      });
    }
  } else {
    // LUMP_SUM or default
    installments.push({
      installmentNumber: 1,
      title: 'Full Annual Contract Payment',
      dueDate: start,
      amount: finalAmount,
      status: paidAmount >= finalAmount ? 'PAID' : (start < new Date() ? 'OVERDUE' : 'PENDING'),
      paidAt: paidAmount >= finalAmount ? new Date() : null,
    });
  }

  return installments;
}

export async function listContracts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { customerId, status, search, expiringDays } = req.query;

    const query: any = { businessId, active: true };

    if (customerId) {
      query.customerId = customerId;
    }

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (expiringDays && !isNaN(Number(expiringDays))) {
      const days = Number(expiringDays);
      const now = new Date();
      const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      query.status = 'ACTIVE';
      query.endDate = { $gte: now, $lte: futureDate };
    }

    if (search && typeof search === 'string' && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const matchingCustomers = await Customer.find({
        businessId,
        $or: [{ name: searchRegex }, { companyName: searchRegex }, { phone: searchRegex }],
      }).select('_id');
      const customerIds = matchingCustomers.map((c) => c._id);

      query.$or = [
        { contractNumber: searchRegex },
        { notes: searchRegex },
        { customerId: { $in: customerIds } },
      ];
    }

    const contracts = await AmcContract.find(query)
      .populate('customerId', 'name contact address taxProfile')
      .populate('coveredUnits.acEquipmentId', 'brand tonnage modelNumber serialNumber installationLocation')
      .populate('previousContractId', 'contractNumber status')
      .populate('renewedByContractId', 'contractNumber status')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: contracts,
    });
  } catch (error) {
    next(error);
  }
}

export async function getContract(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const contract = await AmcContract.findOne({ _id: id, businessId, active: true })
      .populate('customerId', 'name contact address taxProfile')
      .populate('coveredUnits.acEquipmentId', 'brand tonnage modelNumber serialNumber installationLocation refrigerantType')
      .populate('previousContractId', 'contractNumber startDate endDate status')
      .populate('renewedByContractId', 'contractNumber startDate endDate status');

    if (!contract) {
      return next(new AppError('AMC Contract not found', 404, 'CONTRACT_NOT_FOUND'));
    }

    res.status(200).json({
      success: true,
      data: contract,
    });
  } catch (error) {
    next(error);
  }
}

export async function createContract(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const validated = createContractSchema.parse(req.body);

    const customer = await Customer.findOne({ _id: validated.customerId, businessId, active: true });
    if (!customer) {
      return next(new AppError('Customer not found', 404, 'CUSTOMER_NOT_FOUND'));
    }

    // Verify covered units exist and belong to customer
    const equipmentIds = validated.coveredUnits.map((u) => u.acEquipmentId);
    const existingEquipments = await CustomerAcEquipment.find({
      _id: { $in: equipmentIds },
      customerId: validated.customerId,
      businessId,
      active: true,
    });

    if (existingEquipments.length !== equipmentIds.length) {
      return next(
        new AppError(
          'One or more AC units do not belong to this customer or do not exist',
          400,
          'INVALID_EQUIPMENT_SELECTION'
        )
      );
    }

    // Build immutable planSnapshot
    let planSnapshot: IAmcContractPlanSnapshot;

    if (validated.planId) {
      const plan = await AmcPlan.findOne({ _id: validated.planId, businessId, active: true })
        .populate('partCoverages.productId', 'name');

      if (!plan) {
        return next(new AppError('AMC Plan not found', 404, 'PLAN_NOT_FOUND'));
      }

      planSnapshot = {
        planId: plan._id,
        planName: plan.name,
        planType: plan.planType,
        durationMonths: plan.durationMonths,
        entitlements: plan.entitlements.map((e) => ({
          serviceType: e.serviceType,
          scheduling: e.scheduling,
          quantity: e.quantity,
          entitlementScope: e.entitlementScope,
        })),
        partCoverages: plan.partCoverages.map((p: any) => ({
          productId: p.productId?._id || p.productId,
          productName: p.productId?.name || 'Spare Part',
          coverageType: p.coverageType,
          quantityLimitPerYear: p.quantityLimitPerYear,
          discountPercent: p.discountPercent,
        })),
        gasCoverage: {
          included: plan.gasCoverage.included,
          refrigerantTypes: plan.gasCoverage.refrigerantTypes,
          quantityLimitKg: plan.gasCoverage.quantityLimitKg,
          limitScope: plan.gasCoverage.limitScope,
          excludeDamagePipingLeaks: plan.gasCoverage.excludeDamagePipingLeaks,
        },
        termsAndConditions: plan.termsAndConditions,
      };
    } else if (validated.customPlanSnapshot) {
      planSnapshot = validated.customPlanSnapshot;
    } else {
      // Default fallback snapshot
      planSnapshot = {
        planName: `${validated.contractType === 'COMPREHENSIVE' ? 'Comprehensive' : 'Non-Comprehensive'} AMC Standard`,
        planType: validated.contractType,
        durationMonths: 12,
        entitlements: [
          { serviceType: 'WATER_SERVICE', scheduling: 'QUARTERLY', quantity: 4, entitlementScope: 'PER_EQUIPMENT' },
          { serviceType: 'BREAKDOWN_REPAIR', scheduling: 'ON_DEMAND', quantity: 2, entitlementScope: 'PER_CONTRACT' },
        ],
        partCoverages: [],
        gasCoverage: {
          included: false,
          refrigerantTypes: ['R32', 'R410A'],
          quantityLimitKg: null,
          limitScope: 'PER_EQUIPMENT',
          excludeDamagePipingLeaks: true,
        },
        termsAndConditions: [
          'This AMC is valid for 1 year from the date of agreement or approval.',
          'Spare parts are not included unless specified in plan coverage.',
        ],
      };
    }

    // Auto-generate Contract Number if not provided
    let contractNumber = validated.contractNumber?.trim();
    if (!contractNumber) {
      contractNumber = await getNextContractNumber(businessId);
    }

    // Determine initial status based on activation trigger & payment
    let initialStatus: any = 'PENDING_APPROVAL';
    let paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' = 'UNPAID';

    const { finalAmount, paidAmount } = validated.financials;
    if (paidAmount >= finalAmount && finalAmount > 0) {
      paymentStatus = 'PAID';
    } else if (paidAmount > 0) {
      paymentStatus = 'PARTIALLY_PAID';
    }

    if (validated.activationTrigger === 'ADMIN_APPROVAL') {
      initialStatus = 'ACTIVE';
    } else if (validated.activationTrigger === 'PAYMENT_RECEIVED') {
      initialStatus = paymentStatus === 'PAID' ? 'ACTIVE' : 'PENDING_PAYMENT';
    } else if (validated.activationTrigger === 'ADVANCE_RECEIVED') {
      initialStatus = paidAmount > 0 ? 'ACTIVE' : 'PENDING_PAYMENT';
    }

    // Map units with enriched details from DB
    const enrichedUnits = validated.coveredUnits.map((unit) => {
      const eq = existingEquipments.find((e) => e._id.toString() === unit.acEquipmentId);
      return {
        ...unit,
        unitTonnage: unit.unitTonnage || eq?.tonnage,
        unitBrand: unit.unitBrand || eq?.brand,
        unitSerial: unit.unitSerial || eq?.serialNumber,
        unitLocation: unit.unitLocation || eq?.installationLocation,
      };
    });

    const scheduleType = validated.paymentScheduleType || 'LUMP_SUM';
    const installments = validated.customInstallments && Array.isArray(validated.customInstallments)
      ? validated.customInstallments
      : generateMilestoneInstallments(scheduleType, finalAmount, new Date(validated.startDate), paidAmount);

    const contract = await AmcContract.create({
      businessId,
      contractNumber,
      customerId: validated.customerId,
      contractType: validated.contractType,
      coveredUnits: enrichedUnits,
      startDate: new Date(validated.startDate),
      endDate: new Date(validated.endDate),
      planSnapshot,
      financials: validated.financials,
      paymentStatus,
      paymentScheduleType: scheduleType,
      installments,
      paymentRecords: [],
      activationTrigger: validated.activationTrigger,
      status: initialStatus,
      quotationId: validated.quotationId ? validated.quotationId : null,
      notes: validated.notes,
      active: true,
    });

    // If converted from a quotation, update quotation status
    if (validated.quotationId) {
      await AmcQuotation.findByIdAndUpdate(validated.quotationId, {
        status: 'CONVERTED_TO_CONTRACT',
        convertedContractId: contract._id,
      });
    }

    const populated = await AmcContract.findById(contract._id)
      .populate('customerId', 'name contact address taxProfile')
      .populate('coveredUnits.acEquipmentId', 'brand tonnage modelNumber serialNumber installationLocation');

    res.status(201).json({
      success: true,
      data: populated,
      message: 'AMC Contract created successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function convertQuotationToContract(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { quotationId } = req.params;
    const { coveredEquipmentIds, planId, activationTrigger, startDate, endDate } = req.body;

    const quotation = await AmcQuotation.findOne({ _id: quotationId, businessId, active: true });
    if (!quotation) {
      return next(new AppError('Quotation not found', 404, 'QUOTATION_NOT_FOUND'));
    }

    if (quotation.status === 'CONVERTED_TO_CONTRACT') {
      return next(new AppError('This quotation has already been converted to a contract', 400, 'ALREADY_CONVERTED'));
    }

    // Default covered units: If user specified equipment IDs, fetch them; otherwise fetch all customer's AC units
    let equipmentQuery: any = { customerId: quotation.customerId, businessId, active: true };
    if (coveredEquipmentIds && Array.isArray(coveredEquipmentIds) && coveredEquipmentIds.length > 0) {
      equipmentQuery._id = { $in: coveredEquipmentIds };
    }

    let customerEquipments = await CustomerAcEquipment.find(equipmentQuery);
    if (customerEquipments.length === 0) {
      // Auto-register a default AC unit for this customer from quotation line items so conversion succeeds seamlessly
      const firstItem = quotation.items?.[0];
      const autoEquip = await CustomerAcEquipment.create({
        businessId,
        customerId: quotation.customerId,
        acType: 'SPLIT',
        tonnage: '1.5 Ton',
        brand: 'General / Multi-Brand',
        installationLocation: 'Customer Premises',
        notes: `Auto-registered from Quotation #${quotation.quotationNumber}${firstItem?.description ? ` (${firstItem.description})` : ''}`,
        status: 'OPERATIONAL',
        active: true,
      });
      customerEquipments = [autoEquip];
    }

    const coveredUnits = customerEquipments.map((eq) => ({
      acEquipmentId: eq._id.toString(),
      unitTonnage: eq.tonnage,
      unitBrand: eq.brand,
      unitSerial: eq.serialNumber,
      unitLocation: eq.installationLocation,
    }));

    const contractStartDate = startDate ? new Date(startDate) : new Date();
    const contractEndDate = endDate
      ? new Date(endDate)
      : new Date(new Date(contractStartDate).setFullYear(contractStartDate.getFullYear() + 1));

    // Call createContract logic
    req.body = {
      customerId: quotation.customerId.toString(),
      planId,
      contractType: quotation.quotationType === 'PERIODIC_CONTRACT' ? 'NON_COMPREHENSIVE' : 'NON_COMPREHENSIVE',
      quotationId: quotation._id.toString(),
      startDate: contractStartDate.toISOString(),
      endDate: contractEndDate.toISOString(),
      coveredUnits,
      financials: {
        contractAmount: quotation.subtotal,
        discount: quotation.discount,
        taxAmount: quotation.taxAmount,
        finalAmount: quotation.grandTotal,
        paidAmount: 0,
      },
      paymentScheduleType: req.body.paymentScheduleType || 'LUMP_SUM',
      activationTrigger: activationTrigger || 'ADMIN_APPROVAL',
      notes: `Converted from Quotation #${quotation.quotationNumber}`,
    };

    return createContract(req, res, next);
  } catch (error) {
    next(error);
  }
}

export async function updateContractStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['DRAFT', 'PENDING_APPROVAL', 'PENDING_PAYMENT', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'CANCELLED', 'SUSPENDED'];
    if (!allowed.includes(status)) {
      return next(new AppError('Invalid contract status', 400, 'INVALID_STATUS'));
    }

    const contract = await AmcContract.findOne({ _id: id, businessId, active: true });
    if (!contract) {
      return next(new AppError('Contract not found', 404, 'CONTRACT_NOT_FOUND'));
    }

    contract.status = status;
    await contract.save();

    res.status(200).json({
      success: true,
      data: contract,
      message: `Contract status updated to ${status}`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 1-Click Non-Destructive Contract Renewal
 */
export async function renewContract(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const oldContract = await AmcContract.findOne({ _id: id, businessId, active: true });
    if (!oldContract) {
      return next(new AppError('Existing contract not found', 404, 'CONTRACT_NOT_FOUND'));
    }

    if (oldContract.renewedByContractId) {
      return next(new AppError('This contract has already been renewed', 400, 'ALREADY_RENEWED'));
    }

    // Determine new start date: next day after old contract ends
    const newStartDate = new Date(oldContract.endDate.getTime() + 24 * 60 * 60 * 1000);
    const newEndDate = new Date(newStartDate);
    newEndDate.setFullYear(newEndDate.getFullYear() + 1);

    // Auto-generate Contract Number
    const contractNumber = await getNextContractNumber(businessId);

    // Create new contract linked to oldContract
    const newContract = await AmcContract.create({
      businessId,
      contractNumber,
      customerId: oldContract.customerId,
      previousContractId: oldContract._id,
      contractType: oldContract.contractType,
      coveredUnits: oldContract.coveredUnits,
      startDate: newStartDate,
      endDate: newEndDate,
      planSnapshot: oldContract.planSnapshot, // preserve snapshot or update if desired
      financials: {
        ...oldContract.financials,
        paidAmount: 0,
      },
      paymentStatus: 'UNPAID',
      activationTrigger: oldContract.activationTrigger,
      status: 'PENDING_APPROVAL',
      notes: `Renewed from contract #${oldContract.contractNumber}`,
      active: true,
    });

    // Link successor in oldContract
    oldContract.renewedByContractId = newContract._id as any;
    await oldContract.save();

    const populated = await AmcContract.findById(newContract._id)
      .populate('customerId', 'name contact address taxProfile')
      .populate('coveredUnits.acEquipmentId', 'brand tonnage modelNumber serialNumber installationLocation')
      .populate('previousContractId', 'contractNumber startDate endDate');

    res.status(201).json({
      success: true,
      data: populated,
      message: `Contract #${oldContract.contractNumber} renewed successfully into new contract #${contractNumber}`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete AMC Contract and cascade delete all associated Service Visits & Job-Cards
 */
export async function deleteContract(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const contract = await AmcContract.findOne({ _id: id, businessId });
    if (!contract) {
      return next(new AppError('Contract not found', 404, 'CONTRACT_NOT_FOUND'));
    }

    // Cascade delete all service visits and job cards associated with this contract
    const visitsDeleted = await AmcServiceVisit.deleteMany({ contractId: id, businessId });

    // Delete contract
    await AmcContract.deleteOne({ _id: id, businessId });

    res.status(200).json({
      success: true,
      message: `Contract #${contract.contractNumber} and ${visitsDeleted.deletedCount} associated service visit(s) deleted successfully.`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update payment status and payment amount for AMC Contract
 */
export async function updateContractPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { id } = req.params;
    const {
      paymentStatus,
      paidAmount,
      paymentScheduleType,
      installments: customInstallments,
      // Payment Record fields:
      paymentMethod,
      paymentAccountId,
      referenceNumber,
      chequeDetails,
      proof,
      notes,
      installmentIndex,
      isNewPaymentRecord,
    } = req.body;

    const contract = await AmcContract.findOne({ _id: id, businessId });
    if (!contract) {
      return next(new AppError('Contract not found', 404, 'CONTRACT_NOT_FOUND'));
    }

    // 1. Update Schedule Configuration if requested
    if (paymentScheduleType && paymentScheduleType !== contract.paymentScheduleType) {
      contract.paymentScheduleType = paymentScheduleType;
      if (customInstallments && Array.isArray(customInstallments)) {
        contract.installments = customInstallments as any;
      } else {
        contract.installments = generateMilestoneInstallments(
          paymentScheduleType,
          contract.financials.finalAmount || 0,
          contract.startDate,
          contract.financials.paidAmount || 0
        ) as any;
      }
    } else if (customInstallments && Array.isArray(customInstallments)) {
      contract.installments = customInstallments as any;
    }

    // 2. Process New Payment Transaction Receipt (if paymentMethod or receipt amount provided)
    const receiptAmount = paidAmount !== undefined ? Number(paidAmount) : (req.body.amount !== undefined ? Number(req.body.amount) : null);

    if (isNewPaymentRecord && receiptAmount !== null && receiptAmount > 0) {
      let paymentAccountSnapshot: any = null;
      if (paymentAccountId) {
        const acc = await PaymentAccount.findOne({ _id: paymentAccountId, businessId });
        if (acc) {
          paymentAccountSnapshot = {
            name: acc.name,
            type: acc.type,
            displayName: acc.displayName,
            bankName: acc.bankName || null,
            maskedAccountNumber: acc.maskedAccountNumber || null,
            ifsc: acc.ifsc || null,
            upiId: acc.upiId || null,
          };
        }
      }

      const paymentRecord: any = {
        amount: receiptAmount,
        paidAt: req.body.paidAt ? new Date(req.body.paidAt) : new Date(),
        method: paymentMethod || 'CASH',
        paymentAccountId: paymentAccountId || null,
        paymentAccountSnapshot,
        referenceNumber: referenceNumber || null,
        chequeDetails: chequeDetails || null,
        proof: proof || null,
        notes: notes || null,
      };

      if (!contract.paymentRecords) {
        contract.paymentRecords = [];
      }
      contract.paymentRecords.push(paymentRecord);

      // Increase total paid amount
      const updatedTotalPaid = (contract.financials.paidAmount || 0) + receiptAmount;
      contract.financials.paidAmount = updatedTotalPaid;

      // Update installment milestone status
      if (installmentIndex !== undefined && contract.installments && contract.installments[installmentIndex]) {
        contract.installments[installmentIndex].status = 'PAID';
        contract.installments[installmentIndex].paidAt = new Date();
        contract.installments[installmentIndex].paymentRecordIndex = contract.paymentRecords.length - 1;
      } else if (contract.installments && contract.installments.length > 0) {
        // Auto mark milestones
        let runningPaid = updatedTotalPaid;
        contract.installments.forEach((inst) => {
          if (runningPaid >= inst.amount) {
            inst.status = 'PAID';
            if (!inst.paidAt) inst.paidAt = new Date();
            runningPaid -= inst.amount;
          } else {
            inst.status = new Date(inst.dueDate) < new Date() ? 'OVERDUE' : 'PENDING';
          }
        });
      }
    } else if (paidAmount !== undefined && !isNaN(Number(paidAmount)) && !isNewPaymentRecord) {
      // Direct adjustment of total paid amount
      const newPaid = Number(paidAmount);
      contract.financials.paidAmount = newPaid;
    }

    // 3. Compute overall contract payment status
    const finalAmt = contract.financials.finalAmount || 0;
    const currentPaid = contract.financials.paidAmount || 0;

    if (currentPaid >= finalAmt && finalAmt > 0) {
      contract.paymentStatus = 'PAID';
    } else if (currentPaid > 0) {
      contract.paymentStatus = 'PARTIALLY_PAID';
    } else {
      contract.paymentStatus = paymentStatus || 'UNPAID';
    }

    // 4. Auto-activate contract if advance/payment received
    if (contract.paymentStatus === 'PAID' || contract.paymentStatus === 'PARTIALLY_PAID') {
      if (contract.status === 'PENDING_PAYMENT' || contract.status === 'PENDING_APPROVAL') {
        contract.status = 'ACTIVE';
      }
    }

    await contract.save();

    const populated = await AmcContract.findById(contract._id)
      .populate('customerId', 'name contact address taxProfile')
      .populate('coveredUnits.acEquipmentId', 'brand tonnage modelNumber serialNumber installationLocation');

    res.status(200).json({
      success: true,
      data: populated,
      message: `Payment successfully recorded for Contract #${contract.contractNumber}. Status: ${contract.paymentStatus}.`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Generate official PDF for AMC Contract Agreement
 */
export async function generateContractPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const contract = await AmcContract.findOne({ _id: id, businessId, active: true })
      .populate('customerId')
      .populate('coveredUnits.acEquipmentId');

    if (!contract) {
      return next(new AppError('AMC Contract not found', 404, 'CONTRACT_NOT_FOUND'));
    }

    const business = await Business.findById(businessId);
    if (!business) {
      return next(new AppError('Business profile not found', 404, 'BUSINESS_NOT_FOUND'));
    }

    const activeAssets = await Asset.find({ businessId, active: true });
    const logo = activeAssets.find((a) => a.type === 'LOGO');
    const stamp = activeAssets.find((a) => a.type === 'STAMP');
    const signature = activeAssets.find((a) => a.type === 'SIGNATURE');

    const customer: any = contract.customerId;

    const coveredUnitsData = contract.coveredUnits.map((u: any, idx: number) => {
      const eq = u.acEquipmentId || {};
      return {
        serialNumber: idx + 1,
        brand: u.unitBrand || eq.brand || 'Air Conditioner',
        model: u.unitModel || eq.modelNumber || '',
        tonnage: u.unitTonnage || eq.tonnage || '1.5 Ton',
        serial: u.unitSerial || eq.serialNumber || 'N/A',
        location: u.unitLocation || eq.installationLocation || 'Premises',
      };
    });

    const renderData: AmcContractRenderData = {
      contract: {
        id: contract._id.toString(),
        contractNumber: contract.contractNumber,
        contractType: contract.contractType,
        startDate: contract.startDate,
        endDate: contract.endDate,
        status: contract.status,
        paymentStatus: contract.paymentStatus,
        financials: {
          contractAmount: contract.financials?.contractAmount || 0,
          discount: contract.financials?.discount || 0,
          taxAmount: contract.financials?.taxAmount || 0,
          finalAmount: contract.financials?.finalAmount || 0,
          paidAmount: contract.financials?.paidAmount || 0,
        },
        planSnapshot: contract.planSnapshot,
        coveredUnits: coveredUnitsData,
      },
      business: {
        name: business.name,
        displayName: business.displayName || business.name,
        legalName: business.legalName,
        address: business.address as any,
        contact: business.contact,
        taxProfile: business.taxProfile,
        bankDetails: (business as any).bankDetails,
      },
      customer: {
        name: customer?.name || 'Valued Customer',
        address: customer?.address,
        contact: customer?.contact,
        taxProfile: customer?.taxProfile,
      },
      assets: {
        logo: logo ? { secureUrl: logo.secureUrl } : null,
        stamp: stamp ? { secureUrl: stamp.secureUrl } : null,
        signature: signature ? { secureUrl: signature.secureUrl } : null,
      },
    };

    const { pdfBuffer } = await DocumentGenerationService.generateAmcContractBuffers(renderData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="Contract-${contract.contractNumber}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
}


