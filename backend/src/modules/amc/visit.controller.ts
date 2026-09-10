import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AmcServiceVisit } from '../../database/models/AmcServiceVisit';
import { AmcContract } from '../../database/models/AmcContract';
import { Product } from '../../database/models/Product';
import { User } from '../../database/models/User';
import { InventoryTransaction } from '../../database/models/InventoryTransaction';
import { AmcQuotation } from '../../database/models/AmcQuotation';
import { InvoiceSequence } from '../../database/models/InvoiceSequence';
import { AmcCoverageEngine } from '../../services/AmcCoverageEngine';
import { BusinessMember } from '../../database/models/BusinessMember';
import { AppError } from '../../middleware/errorHandler';

const checklistSchema = z.object({
  filterCleaned: z.boolean().default(false),
  indoorCoilCleaned: z.boolean().default(false),
  outdoorCondenserWashed: z.boolean().default(false),
  electricalTightened: z.boolean().default(false),
  blowerMotorChecked: z.boolean().default(false),
  drainPipeChecked: z.boolean().default(false),
  operatingCurrentAmps: z.number().nullable().optional(),
  suctionPressurePsi: z.number().nullable().optional(),
  dischargePressurePsi: z.number().nullable().optional(),
});

const spareUsedInputSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().min(1).default(1),
  unitPrice: z.number().min(0).optional(),
  notes: z.string().nullable().optional(),
});

const completeJobCardSchema = z.object({
  actualServiceDate: z.string().optional(),
  checklist: checklistSchema.optional(),
  workPerformed: z.string().min(1, 'Work performed summary is required'),
  technicianNotes: z.string().nullable().optional(),
  customerRemarks: z.string().nullable().optional(),
  sparesUsed: z.array(spareUsedInputSchema).default([]),
  gasRefilledKg: z.number().min(0).nullable().optional(),
  refrigerantType: z.string().nullable().optional(),
  isPipingDamageLeak: z.boolean().default(false),
});

async function getNextVisitNumber(businessId: any): Promise<string> {
  let visitNumber = '';
  let isUnique = false;
  while (!isUnique) {
    const seq = await InvoiceSequence.findOneAndUpdate(
      { businessId, key: 'AMC_VISIT' },
      { $inc: { nextNumber: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    const prefix = seq.prefix || 'SV-2526';
    visitNumber = `${prefix}-${String(seq.nextNumber).padStart(4, '0')}`;
    const exists = await AmcServiceVisit.findOne({ businessId, visitNumber });
    if (!exists) {
      isUnique = true;
    }
  }
  return visitNumber;
}

export async function listVisits(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { contractId, acEquipmentId, technicianId, status, serviceType, search } = req.query;

    const query: any = { businessId, active: true };

    if (contractId) query.contractId = contractId;
    if (acEquipmentId) query.acEquipmentId = acEquipmentId;
    if (technicianId) query.technicianId = technicianId;
    if (status && status !== 'ALL') query.status = status;
    if (serviceType && serviceType !== 'ALL') query.serviceType = serviceType;

    if (search && typeof search === 'string') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ visitNumber: searchRegex }, { workPerformed: searchRegex }, { technicianNotes: searchRegex }];
    }

    const visits = await AmcServiceVisit.find(query)
      .populate('acEquipmentId', 'brand tonnage modelNumber serialNumber installationLocation')
      .populate('technicianId', 'name email phone')
      .populate('contractId', 'contractNumber contractType customerId')
      .populate('sparesUsed.productId', 'name uom defaultPriceMinor')
      .sort({ scheduledDate: 1 });

    res.status(200).json({
      success: true,
      data: visits,
    });
  } catch (error) {
    next(error);
  }
}

export async function getVisit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const visit = await AmcServiceVisit.findOne({ _id: id, businessId, active: true })
      .populate('acEquipmentId')
      .populate('technicianId', 'name email phone')
      .populate('contractId')
      .populate('sparesUsed.productId')
      .populate('additionalWorkRequest.quotationId');

    if (!visit) {
      return next(new AppError('Service visit ticket not found', 404, 'VISIT_NOT_FOUND'));
    }

    res.status(200).json({
      success: true,
      data: visit,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Automatically generates periodic scheduled visit slots for all covered units under an AMC contract
 */
export async function generateContractVisits(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { contractId } = req.params;

    const contract = await AmcContract.findOne({ _id: contractId, businessId, active: true });
    if (!contract) {
      return next(new AppError('Contract not found', 404, 'CONTRACT_NOT_FOUND'));
    }

    const entitlements = contract.planSnapshot.entitlements || [];
    const coveredUnits = contract.coveredUnits || [];

    if (coveredUnits.length === 0) {
      return next(new AppError('Contract has no covered AC units', 400, 'NO_COVERED_UNITS'));
    }

    const createdVisits: any[] = [];
    const start = new Date(contract.startDate);
    const end = new Date(contract.endDate);
    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));

    for (const ent of entitlements) {
      // Calculate scheduling intervals
      const count = ent.quantity;
      const intervalDays = Math.floor(totalDays / (count + 1));

      if (ent.entitlementScope === 'PER_EQUIPMENT') {
        for (const unit of coveredUnits) {
          for (let i = 1; i <= count; i++) {
            const scheduledDate = new Date(start.getTime() + i * intervalDays * 24 * 60 * 60 * 1000);
            const visitNumber = await getNextVisitNumber(businessId);

            const visit = await AmcServiceVisit.create({
              businessId,
              visitNumber,
              contractId: contract._id,
              acEquipmentId: unit.acEquipmentId,
              serviceType: ent.serviceType,
              scheduledDate,
              status: 'SCHEDULED',
              active: true,
            });

            createdVisits.push(visit);
          }
        }
      } else {
        // PER_CONTRACT scope (e.g. general inspection or breakdown calls)
        for (let i = 1; i <= count; i++) {
          const scheduledDate = new Date(start.getTime() + i * intervalDays * 24 * 60 * 60 * 1000);
          const visitNumber = await getNextVisitNumber(businessId);

          const visit = await AmcServiceVisit.create({
            businessId,
            visitNumber,
            contractId: contract._id,
            acEquipmentId: coveredUnits[0].acEquipmentId, // Assign to primary unit as placeholder
            serviceType: ent.serviceType,
            scheduledDate,
            status: 'SCHEDULED',
            active: true,
          });

          createdVisits.push(visit);
        }
      }
    }

    res.status(201).json({
      success: true,
      data: createdVisits,
      message: `Generated ${createdVisits.length} scheduled service visits based on plan entitlements`,
    });
  } catch (error) {
    next(error);
  }
}

export async function assignTechnician(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { id } = req.params;
    const { technicianId, scheduledDate } = req.body;

    const visit = await AmcServiceVisit.findOne({ _id: id, businessId, active: true });
    if (!visit) {
      return next(new AppError('Service visit ticket not found', 404, 'VISIT_NOT_FOUND'));
    }

    if (technicianId) {
      const techUser = await User.findById(technicianId);
      if (!techUser) {
        return next(new AppError('Technician user account not found', 404, 'TECHNICIAN_NOT_FOUND'));
      }
      visit.technicianId = techUser._id;
      visit.status = 'ASSIGNED';
    }

    if (scheduledDate) {
      visit.scheduledDate = new Date(scheduledDate);
    }

    await visit.save();

    const populated = await AmcServiceVisit.findById(visit._id)
      .populate('technicianId', 'name email phone')
      .populate('acEquipmentId');

    res.status(200).json({
      success: true,
      data: populated,
      message: 'Technician assigned successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Job-Card Completion: Admin enters technician findings, pressures, checklist, and spares used.
 * Runs AmcCoverageEngine to calculate charges, and creates InventoryTransactions for stock deduction.
 */
export async function completeVisitJobCard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { id } = req.params;
    const validated = completeJobCardSchema.parse(req.body);

    const visit = await AmcServiceVisit.findOne({ _id: id, businessId, active: true });
    if (!visit) {
      return next(new AppError('Service visit ticket not found', 404, 'VISIT_NOT_FOUND'));
    }

    const contract = await AmcContract.findById(visit.contractId);
    if (!contract) {
      return next(new AppError('Associated AMC contract not found', 404, 'CONTRACT_NOT_FOUND'));
    }

    let hasUncoveredWork = false;
    let totalUncoveredCharge = 0;
    const processedSpares: any[] = [];

    // 1. Process Spares Used
    for (const spareInput of validated.sparesUsed) {
      const product = await Product.findOne({ _id: spareInput.productId, businessId, active: true });
      if (!product) {
        return next(new AppError(`Product ${spareInput.productId} not found in inventory`, 404, 'PRODUCT_NOT_FOUND'));
      }

      const unitSellingPrice = spareInput.unitPrice !== undefined ? spareInput.unitPrice : product.defaultPriceMinor / 100;

      // Evaluate coverage via coverage engine
      const coverage = await AmcCoverageEngine.evaluatePartCoverage(
        contract,
        spareInput.productId,
        spareInput.quantity,
        unitSellingPrice
      );

      // Create Inventory Transaction to deduct stock
      const inventoryTx = await InventoryTransaction.create({
        businessId,
        productId: product._id,
        quantity: -Math.abs(spareInput.quantity), // Negative for consumption
        transactionType: 'AMC_SERVICE_USAGE',
        referenceType: 'AMC_SERVICE_VISIT',
        referenceId: visit._id,
        contractId: contract._id,
        unitCostPrice: null,
        unitSellingPrice: coverage.customerCharge > 0 ? unitSellingPrice : 0,
        notes: `Consumed in Visit #${visit.visitNumber} (${coverage.reason})`,
      });

      if (!coverage.isCovered || coverage.customerCharge > 0) {
        hasUncoveredWork = true;
        totalUncoveredCharge += coverage.customerCharge;
      }

      processedSpares.push({
        productId: product._id,
        quantity: spareInput.quantity,
        isCoveredByAmc: coverage.isCovered,
        unitPrice: unitSellingPrice,
        customerCharge: coverage.customerCharge,
        inventoryTransactionId: inventoryTx._id,
        notes: coverage.reason,
      });
    }

    // 2. Process Gas Refilling if applicable
    let gasCovered = false;
    let gasCustomerCharge = 0;

    if (validated.gasRefilledKg && validated.gasRefilledKg > 0) {
      const refrigerant = validated.refrigerantType || 'R32';
      const defaultGasPricePerKg = 1200; // standard market rate per kg

      const gasCoverage = await AmcCoverageEngine.evaluateGasCoverage(
        contract,
        refrigerant,
        validated.gasRefilledKg,
        validated.isPipingDamageLeak,
        defaultGasPricePerKg
      );

      gasCovered = gasCoverage.isCovered;
      gasCustomerCharge = gasCoverage.customerCharge;

      if (!gasCovered || gasCustomerCharge > 0) {
        hasUncoveredWork = true;
        totalUncoveredCharge += gasCustomerCharge;
      }

      // Log gas consumption transaction
      // (If a gas product exists in product table, can link it; otherwise transaction logged with notes)
      await InventoryTransaction.create({
        businessId,
        productId: processedSpares[0]?.productId || contract._id as any, // Link to primary product or general ref
        quantity: -Math.abs(validated.gasRefilledKg),
        transactionType: 'AMC_GAS_CONSUMPTION',
        referenceType: 'AMC_SERVICE_VISIT',
        referenceId: visit._id,
        contractId: contract._id,
        unitSellingPrice: gasCustomerCharge,
        notes: `Gas top-up ${validated.gasRefilledKg}kg (${gasCoverage.reason})`,
      });
    }

    // 3. Update Visit Record
    visit.status = 'COMPLETED';
    visit.actualServiceDate = validated.actualServiceDate ? new Date(validated.actualServiceDate) : new Date();
    visit.workPerformed = validated.workPerformed;
    visit.technicianNotes = validated.technicianNotes || null;
    visit.customerRemarks = validated.customerRemarks || null;
    if (validated.checklist) {
      visit.checklist = {
        ...visit.checklist,
        ...validated.checklist,
      };
    }
    visit.sparesUsed = processedSpares;
    visit.gasRefilledKg = validated.gasRefilledKg || null;
    visit.refrigerantType = validated.refrigerantType || null;
    visit.gasCoveredByAmc = gasCovered;
    visit.gasCustomerCharge = gasCustomerCharge;

    visit.additionalWorkRequest = {
      hasUncoveredWork,
      description: hasUncoveredWork
        ? `Extra chargeable parts / gas consumed totaling ₹${totalUncoveredCharge}`
        : null,
      estimatedAmount: totalUncoveredCharge,
      customerApproved: null,
      quotationId: null,
      invoiceId: null,
    };

    await visit.save();

    const populated = await AmcServiceVisit.findById(visit._id)
      .populate('acEquipmentId')
      .populate('technicianId', 'name email phone')
      .populate('sparesUsed.productId', 'name uom');

    res.status(200).json({
      success: true,
      data: populated,
      message: 'Job-card completed and stock usage recorded successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Generates a Supplementary Quotation / Estimate for non-covered parts/repairs identified during a visit (Issue 7)
 */
export async function createSupplementaryQuotationFromVisit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const visit = await AmcServiceVisit.findOne({ _id: id, businessId, active: true })
      .populate('contractId')
      .populate('sparesUsed.productId');

    if (!visit) {
      return next(new AppError('Service visit ticket not found', 404, 'VISIT_NOT_FOUND'));
    }

    const contract: any = visit.contractId;
    const customerId = contract.customerId;

    // Collect all chargeable items from visit
    const quotationItems: any[] = [];

    visit.sparesUsed.forEach((spare: any) => {
      if (!spare.isCoveredByAmc && spare.customerCharge > 0) {
        quotationItems.push({
          serialNumber: quotationItems.length + 1,
          description: `Replacement: ${spare.productId?.name || 'Spare Part'} (Visit #${visit.visitNumber})`,
          quantity: spare.quantity,
          unitPrice: spare.unitPrice,
          amount: spare.customerCharge,
        });
      }
    });

    if (!visit.gasCoveredByAmc && visit.gasCustomerCharge > 0) {
      quotationItems.push({
        serialNumber: quotationItems.length + 1,
        description: `Refrigerant Gas Top-Up (${visit.refrigerantType || 'R32'}) - ${visit.gasRefilledKg} kg`,
        quantity: visit.gasRefilledKg || 1,
        unitPrice: Math.round(visit.gasCustomerCharge / (visit.gasRefilledKg || 1)),
        amount: visit.gasCustomerCharge,
      });
    }

    if (quotationItems.length === 0) {
      return next(new AppError('No chargeable items exist on this service visit', 400, 'NO_CHARGEABLE_ITEMS'));
    }

    // Auto sequence next quotation number
    const seq = await InvoiceSequence.findOneAndUpdate(
      { businessId, key: 'AMC_QUOTATION' },
      { $inc: { nextNumber: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    const prefix = seq.prefix || '2526';
    const quotationNumber = `${prefix}${seq.nextNumber}`;

    const subtotal = quotationItems.reduce((acc, it) => acc + it.amount, 0);

    const quotation = await AmcQuotation.create({
      businessId,
      customerId,
      quotationNumber,
      quotationType: 'STANDARD',
      quotationDate: new Date(),
      validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      paymentTerms: 'Immediate on completion',
      items: quotationItems,
      subtotal,
      discount: 0,
      taxAmount: 0,
      grandTotal: subtotal,
      status: 'SENT',
      notes: `Supplementary estimate for non-covered repair work identified in Visit #${visit.visitNumber}`,
      active: true,
    });

    // Link quotation to visit
    visit.additionalWorkRequest.quotationId = quotation._id;
    await visit.save();

    res.status(201).json({
      success: true,
      data: quotation,
      message: `Supplementary estimate #${quotationNumber} created for customer approval`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Authoritative visit entitlement breakdown query for a contract (Issue 4 & Issue 10)
 */
export async function getVisitEntitlementSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { contractId } = req.params;

    const contract = await AmcContract.findOne({ _id: contractId, businessId, active: true });
    if (!contract) {
      return next(new AppError('Contract not found', 404, 'CONTRACT_NOT_FOUND'));
    }

    const completedVisits = await AmcServiceVisit.find({
      contractId,
      businessId,
      status: 'COMPLETED',
      active: true,
    });

    const entitlements = contract.planSnapshot.entitlements || [];
    const numUnits = contract.coveredUnits?.length || 1;

    const summary = entitlements.map((ent) => {
      const targetQuota = ent.entitlementScope === 'PER_EQUIPMENT' ? ent.quantity * numUnits : ent.quantity;
      const completedCount = completedVisits.filter((v) => v.serviceType === ent.serviceType).length;
      const remainingCount = Math.max(0, targetQuota - completedCount);

      return {
        serviceType: ent.serviceType,
        scheduling: ent.scheduling,
        entitlementScope: ent.entitlementScope,
        targetQuota,
        completedCount,
        remainingCount,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        contractNumber: contract.contractNumber,
        totalCoveredUnits: numUnits,
        entitlements: summary,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function listTechnicians(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = (req as any).businessId;
    const members = await BusinessMember.find({ businessId, status: 'ACTIVE' }).populate('userId', 'name email phone');
    const technicians: any[] = members
      .map((m: any) => ({
        _id: m.userId?._id,
        name: m.userId?.name,
        email: m.userId?.email,
        phone: m.userId?.phone,
        role: m.role,
      }))
      .filter((t: any) => t._id);

    if (technicians.length === 0 && (req as any).user) {
      technicians.push({
        _id: (req as any).user._id,
        name: (req as any).user.name,
        email: (req as any).user.email,
        phone: (req as any).user.phone,
        role: 'OWNER',
      });
    }

    res.status(200).json({
      success: true,
      data: technicians,
    });
  } catch (error) {
    next(error);
  }
}
