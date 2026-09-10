import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AmcContract, IAmcContractPlanSnapshot } from '../../database/models/AmcContract';
import { AmcPlan } from '../../database/models/AmcPlan';
import { AmcQuotation } from '../../database/models/AmcQuotation';
import { Customer } from '../../database/models/Customer';
import { CustomerAcEquipment } from '../../database/models/CustomerAcEquipment';
import { InvoiceSequence } from '../../database/models/InvoiceSequence';
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

    if (search && typeof search === 'string') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ contractNumber: searchRegex }, { notes: searchRegex }];
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
