import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ConditionPreset } from '../../database/models/ConditionPreset';
import { AppError } from '../../middleware/errorHandler';

const DEFAULT_SEEDS = [
  {
    title: 'VALIDITY 30 DAYS',
    text: 'THIS QUOTATION IS VALID FOR 30 DAYS FROM ISSUANCE DATE.',
    category: 'GENERAL' as const,
    isDefault: true,
    sortOrder: 1,
  },
  {
    title: 'PAYMENT TERMS 100% COMPLETION',
    text: 'PAYMENT TERMS: 100% AGAINST DELIVERY / WORK COMPLETION.',
    category: 'GENERAL' as const,
    isDefault: true,
    sortOrder: 2,
  },
  {
    title: 'GOODS RETURN POLICY',
    text: 'GOODS ONCE SOLD WILL NOT BE TAKEN BACK WITHOUT PRIOR AUTHORIZATION.',
    category: 'GENERAL' as const,
    isDefault: true,
    sortOrder: 3,
  },
  {
    title: 'MANUFACTURER WARRANTY',
    text: 'WARRANTY ON SPARE PARTS/UNITS AS PER ORIGINAL MANUFACTURER POLICY.',
    category: 'GENERAL' as const,
    isDefault: true,
    sortOrder: 4,
  },
  {
    title: 'TAXES EXTRA APPLICABLE',
    text: 'TAXES EXTRA AS APPLICABLE AT CURRENT PREVAILING RATES.',
    category: 'GENERAL' as const,
    isDefault: true,
    sortOrder: 5,
  },
  {
    title: 'AMC 1 YEAR VALIDITY',
    text: 'THIS AMC QUOTATION IS VALID FOR 1 YEAR FROM ISSUANCE DATE.',
    category: 'AMC' as const,
    isDefault: true,
    sortOrder: 6,
  },
  {
    title: 'NON-COMPREHENSIVE AMC SCOPE',
    text: 'NON-COMPREHENSIVE AMC: ONLY ROUTINE MAINTENANCE & INSPECTION LABOUR ARE INCLUDED. SPARE PARTS & GAS ARE CHARGEABLE.',
    category: 'AMC' as const,
    isDefault: true,
    sortOrder: 7,
  },
  {
    title: 'COMPREHENSIVE AMC SCOPE',
    text: 'COMPREHENSIVE AMC: SCHEDULED PERIODIC MAINTENANCE AND ELIGIBLE FUNCTIONAL COMPONENTS ARE COVERED.',
    category: 'AMC' as const,
    isDefault: false,
    sortOrder: 8,
  },
  {
    title: 'AMC EMERGENCY CALLS ATTENDANCE',
    text: 'EMERGENCY BREAKDOWN CALLS WILL BE ATTENDED TO WITHIN 24 TO 48 HOURS.',
    category: 'AMC' as const,
    isDefault: true,
    sortOrder: 9,
  },
  {
    title: 'STANDARD PIPING INCLUSION',
    text: 'AC INSTALLATION OR RELOCATION CHARGES INCLUDE UP TO 10 FEET OF STANDARD PIPING.',
    category: 'AMC' as const,
    isDefault: true,
    sortOrder: 10,
  },
  {
    title: 'INVOICE PAYMENT 15 DAYS',
    text: 'PAYMENT MUST BE MADE WITHIN 15 DAYS FROM THE DATE OF INVOICE.',
    category: 'INVOICE' as const,
    isDefault: true,
    sortOrder: 11,
  },
  {
    title: 'OVERDUE INTEREST 18% P.A.',
    text: 'INTEREST @ 18% PER ANNUM WILL BE CHARGED IF THE INVOICE IS NOT PAID WITHIN DUE DATE.',
    category: 'INVOICE' as const,
    isDefault: true,
    sortOrder: 12,
  },
  {
    title: 'DISCREPANCY NOTICE WINDOW',
    text: 'ANY DISCREPANCY IN THIS INVOICE MUST BE NOTIFIED WITHIN 3 DAYS OF RECEIPT.',
    category: 'INVOICE' as const,
    isDefault: true,
    sortOrder: 13,
  },
  {
    title: 'LEGAL JURISDICTION',
    text: 'ALL DISPUTES SUBJECT TO LOCAL MUNDRA / KUTCH JURISDICTION ONLY.',
    category: 'INVOICE' as const,
    isDefault: true,
    sortOrder: 14,
  },
];

const conditionSchema = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  text: z.string().min(1, 'Condition text is required').trim(),
  category: z.enum(['ALL', 'GENERAL', 'AMC', 'INVOICE']).default('ALL'),
  isDefault: z.boolean().optional().default(false),
  active: z.boolean().optional().default(true),
  sortOrder: z.number().optional().default(0),
});

export async function listConditions(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      throw new AppError('Business ID is required', 400, 'BUSINESS_REQUIRED');
    }

    // Check if any conditions exist for this business
    let count = await ConditionPreset.countDocuments({ businessId });
    if (count === 0) {
      // Auto-seed default standard conditions in UPPERCASE
      const toInsert = DEFAULT_SEEDS.map((s) => ({
        ...s,
        businessId,
        title: s.title.toUpperCase().trim(),
        text: s.text.toUpperCase().trim(),
        active: true,
      }));
      await ConditionPreset.insertMany(toInsert);
    }

    const filter: any = { businessId };
    if (req.query.active !== undefined) {
      filter.active = req.query.active === 'true';
    }
    if (req.query.category && req.query.category !== 'ALL') {
      filter.$or = [{ category: req.query.category }, { category: 'ALL' }];
    }

    const conditions = await ConditionPreset.find(filter).sort({ sortOrder: 1, createdAt: 1 });

    res.status(200).json({
      success: true,
      data: {
        conditions,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

export async function createCondition(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      throw new AppError('Business ID is required', 400, 'BUSINESS_REQUIRED');
    }

    const validated = conditionSchema.parse(req.body);

    const condition = await ConditionPreset.create({
      businessId,
      title: validated.title.toUpperCase().trim(),
      text: validated.text.toUpperCase().trim(),
      category: validated.category,
      isDefault: Boolean(validated.isDefault),
      active: validated.active !== undefined ? validated.active : true,
      sortOrder: validated.sortOrder || 0,
    });

    res.status(201).json({
      success: true,
      data: {
        condition,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

export async function updateCondition(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const validated = conditionSchema.partial().parse(req.body);

    const updatePayload: any = {};
    if (validated.title !== undefined) updatePayload.title = validated.title.toUpperCase().trim();
    if (validated.text !== undefined) updatePayload.text = validated.text.toUpperCase().trim();
    if (validated.category !== undefined) updatePayload.category = validated.category;
    if (validated.isDefault !== undefined) updatePayload.isDefault = validated.isDefault;
    if (validated.active !== undefined) updatePayload.active = validated.active;
    if (validated.sortOrder !== undefined) updatePayload.sortOrder = validated.sortOrder;

    const condition = await ConditionPreset.findOneAndUpdate(
      { _id: id, businessId },
      updatePayload,
      { new: true }
    );

    if (!condition) {
      throw new AppError('Condition preset not found', 404, 'NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      data: {
        condition,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

export async function deleteCondition(req: Request, res: Response, next: NextFunction) {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const condition = await ConditionPreset.findOneAndDelete({ _id: id, businessId });

    if (!condition) {
      throw new AppError('Condition preset not found', 404, 'NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      data: {
        message: 'Condition deleted successfully',
      },
    });
  } catch (err: any) {
    next(err);
  }
}
