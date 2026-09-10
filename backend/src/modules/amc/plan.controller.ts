import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AmcPlan } from '../../database/models/AmcPlan';
import { AmcContract } from '../../database/models/AmcContract';
import { Product } from '../../database/models/Product';
import { AppError } from '../../middleware/errorHandler';

const partCoverageSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  coverageType: z.enum(['FULL', 'LABOUR_ONLY', 'DISCOUNTED', 'NOT_COVERED']).default('FULL'),
  quantityLimitPerYear: z.number().nullable().optional(),
  discountPercent: z.number().min(0).max(100).default(0),
  notes: z.string().nullable().optional(),
});

const entitlementSchema = z.object({
  serviceType: z.enum([
    'DRY_SERVICE',
    'WATER_SERVICE',
    'PREVENTIVE_HEALTH_CHECK',
    'BREAKDOWN_REPAIR',
    'GAS_CHARGING',
  ]),
  scheduling: z.enum(['MONTHLY', 'QUARTERLY', 'BI_MONTHLY', 'ON_DEMAND']).default('QUARTERLY'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  entitlementScope: z.enum(['PER_EQUIPMENT', 'PER_CONTRACT']).default('PER_EQUIPMENT'),
});

const gasCoverageSchema = z.object({
  included: z.boolean().default(false),
  refrigerantTypes: z.array(z.string()).default(['R32', 'R410A']),
  quantityLimitKg: z.number().nullable().optional(),
  limitScope: z.enum(['PER_EQUIPMENT', 'PER_CONTRACT']).default('PER_EQUIPMENT'),
  excludeDamagePipingLeaks: z.boolean().default(true),
});

const createPlanSchema = z.object({
  name: z.string().min(1, 'Plan name is required'),
  code: z.string().nullable().optional(),
  planType: z.enum(['COMPREHENSIVE', 'NON_COMPREHENSIVE']).default('NON_COMPREHENSIVE'),
  durationMonths: z.number().min(1).default(12),
  basePrice: z.number().min(0, 'Base price cannot be negative'),
  applicableAcTypes: z.array(z.string()).default(['SPLIT', 'WINDOW']),
  applicableTonnages: z.array(z.string()).default(['1.0', '1.5', '2.0', 'Up to 5 Ton']),
  entitlements: z.array(entitlementSchema).default([]),
  partCoverages: z.array(partCoverageSchema).default([]),
  gasCoverage: gasCoverageSchema.optional(),
  termsAndConditions: z.array(z.string()).optional(),
});

const updatePlanSchema = createPlanSchema.partial().extend({
  active: z.boolean().optional(),
});

export async function listPlans(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { planType, search, activeOnly } = req.query;

    const query: any = { businessId, deletedAt: null };

    if (activeOnly === 'true') {
      query.active = true;
    }

    if (planType && (planType === 'COMPREHENSIVE' || planType === 'NON_COMPREHENSIVE')) {
      query.planType = planType;
    }

    if (search && typeof search === 'string') {
      query.name = new RegExp(search.trim(), 'i');
    }

    const plans = await AmcPlan.find(query)
      .populate('partCoverages.productId', 'name uom defaultPriceMinor type')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: plans,
    });
  } catch (error) {
    next(error);
  }
}

export async function getPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const plan = await AmcPlan.findOne({ _id: id, businessId, active: true })
      .populate('partCoverages.productId', 'name uom defaultPriceMinor type');

    if (!plan) {
      return next(new AppError('AMC Plan not found', 404, 'PLAN_NOT_FOUND'));
    }

    res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (error) {
    next(error);
  }
}

export async function createPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const validated = createPlanSchema.parse(req.body);

    // Verify all products exist in business
    if (validated.partCoverages && validated.partCoverages.length > 0) {
      const productIds = validated.partCoverages.map((p) => p.productId);
      const existingCount = await Product.countDocuments({
        _id: { $in: productIds },
        businessId,
        active: true,
      });

      if (existingCount !== productIds.length) {
        return next(
          new AppError(
            'One or more parts specified in plan coverage do not exist in inventory',
            400,
            'INVALID_PRODUCT_SELECTION'
          )
        );
      }
    }

    const plan = await AmcPlan.create({
      ...validated,
      businessId,
      active: true,
    });

    const populated = await AmcPlan.findById(plan._id)
      .populate('partCoverages.productId', 'name uom defaultPriceMinor type');

    res.status(201).json({
      success: true,
      data: populated,
      message: 'AMC Plan created successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function updatePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { id } = req.params;
    const validated = updatePlanSchema.parse(req.body);

    const plan = await AmcPlan.findOne({ _id: id, businessId, active: true });
    if (!plan) {
      return next(new AppError('AMC Plan not found', 404, 'PLAN_NOT_FOUND'));
    }

    if (validated.partCoverages && validated.partCoverages.length > 0) {
      const productIds = validated.partCoverages.map((p) => p.productId);
      const existingCount = await Product.countDocuments({
        _id: { $in: productIds },
        businessId,
        active: true,
      });

      if (existingCount !== productIds.length) {
        return next(
          new AppError(
            'One or more parts specified in plan coverage do not exist in inventory',
            400,
            'INVALID_PRODUCT_SELECTION'
          )
        );
      }
    }

    const updated = await AmcPlan.findByIdAndUpdate(id, validated, { new: true })
      .populate('partCoverages.productId', 'name uom defaultPriceMinor type');

    res.status(200).json({
      success: true,
      data: updated,
      message: 'AMC Plan updated successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function deletePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const plan = await AmcPlan.findOne({ _id: id, businessId, deletedAt: null });
    if (!plan) {
      return next(new AppError('AMC Plan not found', 404, 'PLAN_NOT_FOUND'));
    }

    // Check if any active contract is using this plan
    const activeContractCount = await AmcContract.countDocuments({
      businessId,
      planId: id,
      active: true,
      status: { $in: ['ACTIVE', 'PENDING_APPROVAL', 'PENDING_PAYMENT'] },
    });

    if (activeContractCount > 0) {
      return next(
        new AppError(
          `This plan is currently in use by ${activeContractCount} active contract(s). It cannot be permanently deleted, but you can deactivate it so it won't be selectable for future contracts while preserving active contract history.`,
          400,
          'PLAN_LINKED_TO_ACTIVE_CONTRACTS'
        )
      );
    }

    plan.active = false;
    plan.deletedAt = new Date();
    await plan.save();

    res.status(200).json({
      success: true,
      message: 'AMC Plan deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}
