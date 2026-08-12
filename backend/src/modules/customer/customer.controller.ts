import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Customer } from '../../database/models/Customer';
import { AppError } from '../../middleware/errorHandler';

// Zod Validation schemas
const customerContactSchema = z.object({
  phone: z.string().nullable().optional(),
  email: z.string().email('Invalid email format').or(z.literal('')).nullable().optional(),
});

const customerAddressSchema = z.object({
  line1: z.string().nullable().optional(),
  line2: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  country: z.string().default('India'),
});

const customerTaxProfileSchema = z.object({
  gstin: z.string().nullable().optional(),
  pan: z.string().nullable().optional(),
});

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Customer name is required'),
  contact: customerContactSchema.optional(),
  address: customerAddressSchema.optional(),
  taxProfile: customerTaxProfileSchema.optional(),
  notes: z.string().nullable().optional(),
});

export const updateCustomerSchema = z.object({
  name: z.string().min(1, 'Customer name cannot be empty').optional(),
  contact: customerContactSchema.optional(),
  address: customerAddressSchema.optional(),
  taxProfile: customerTaxProfileSchema.optional(),
  notes: z.string().nullable().optional(),
});

/**
 * Creates a new customer record scoped to the active business context
 */
export async function createCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validated = createCustomerSchema.parse(req.body);

    const customer = await Customer.create({
      ...validated,
      businessId: req.businessId,
      active: true,
      deletedAt: null,
    });

    res.status(201).json({
      success: true,
      data: {
        customer,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Lists customers scoped to the active business with pagination and search filtering
 */
export async function listCustomers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    let limit = Math.max(1, parseInt(req.query.limit as string) || 20);
    limit = Math.min(limit, 100); // Caps limit at 100

    const search = (req.query.search as string) || '';
    const activeQuery = req.query.active;

    const filter: any = { businessId: req.businessId };

    if (activeQuery !== undefined) {
      filter.active = activeQuery === 'true';
    } else {
      filter.active = true; // default to active only
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'contact.phone': { $regex: search, $options: 'i' } },
        { 'contact.email': { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Customer.countDocuments(filter);
    const pages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;

    const customers = await Customer.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: {
        customers,
        pagination: {
          page,
          limit,
          total,
          pages,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Fetches details of a single customer scoped to the active business
 */
export async function getCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { customerId } = req.params;

    const customer = await Customer.findOne({
      _id: customerId,
      businessId: req.businessId,
    });

    if (!customer) {
      return next(new AppError('Customer profile not found', 404, 'NOT_FOUND'));
    }

    res.status(200).json({
      success: true,
      data: {
        customer,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Updates an existing customer profile partial fields
 */
export async function updateCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { customerId } = req.params;
    const validated = updateCustomerSchema.parse(req.body);

    // Build subdocument path updates to prevent wiping out other keys during save
    const updateQuery: Record<string, any> = {};
    for (const [key, value] of Object.entries(validated)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [subKey, subVal] of Object.entries(value)) {
          updateQuery[`${key}.${subKey}`] = subVal;
        }
      } else {
        updateQuery[key] = value;
      }
    }

    const customer = await Customer.findOneAndUpdate(
      { _id: customerId, businessId: req.businessId },
      { $set: updateQuery },
      { new: true, runValidators: true }
    );

    if (!customer) {
      return next(new AppError('Customer profile not found', 404, 'NOT_FOUND'));
    }

    res.status(200).json({
      success: true,
      data: {
        customer,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Deactivates a customer (soft deletion)
 */
export async function deactivateCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { customerId } = req.params;

    const customer = await Customer.findOneAndUpdate(
      { _id: customerId, businessId: req.businessId },
      { $set: { active: false, deletedAt: new Date() } },
      { new: true }
    );

    if (!customer) {
      return next(new AppError('Customer profile not found', 404, 'NOT_FOUND'));
    }

    res.status(200).json({
      success: true,
      data: {
        customer,
      },
    });
  } catch (error) {
    next(error);
  }
}
