import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Product } from '../../database/models/Product';
import { AppError } from '../../middleware/errorHandler';

// Zod validation schemas
export const createProductSchema = z.object({
  type: z.enum(['SERVICE', 'PRODUCT']).default('PRODUCT'),
  name: z.string().min(1, 'Product/service name is required'),
  description: z.string().nullable().optional(),
  sku: z.string().trim().nullable().optional(),
  barcode: z.string().trim().nullable().optional(),
  hsnCode: z.string().trim().nullable().optional(),
  uom: z.string().min(1, 'Unit of measurement (UOM) is required'),
  defaultPriceMinor: z.coerce.number().min(0, 'Default price cannot be negative'),
  lastPurchasePriceMinor: z.coerce.number().min(0).nullable().optional(),
  stockQuantity: z.coerce.number().min(0).optional().default(0),
  currency: z.enum(['INR']).default('INR'),
  defaultTaxRateBps: z.coerce.number().min(0, 'Tax rate cannot be negative').default(0),
});

export const updateProductSchema = z.object({
  type: z.enum(['SERVICE', 'PRODUCT']).optional(),
  name: z.string().min(1, 'Product/service name cannot be empty').optional(),
  description: z.string().nullable().optional(),
  sku: z.string().trim().nullable().optional(),
  barcode: z.string().trim().nullable().optional(),
  hsnCode: z.string().trim().nullable().optional(),
  uom: z.string().min(1, 'UOM cannot be empty').optional(),
  defaultPriceMinor: z.coerce.number().min(0, 'Default price cannot be negative').optional(),
  lastPurchasePriceMinor: z.coerce.number().min(0).nullable().optional(),
  stockQuantity: z.coerce.number().min(0).optional(),
  currency: z.enum(['INR']).optional(),
  defaultTaxRateBps: z.coerce.number().min(0, 'Tax rate cannot be negative').optional(),
});

/**
 * Creates a new product/service record scoped to the active business context
 */
export async function createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validated = createProductSchema.parse(req.body);

    // Duplicate prevention: check SKU
    if (validated.sku) {
      const existingBySku = await Product.findOne({
        businessId: req.businessId,
        sku: validated.sku.trim(),
        deletedAt: null,
      });
      if (existingBySku) {
        res.status(200).json({
          success: true,
          data: {
            product: existingBySku,
            alreadyExisted: true,
          },
          message: 'Product with this SKU already exists',
        });
        return;
      }
    }

    // Duplicate prevention: check Barcode
    if (validated.barcode) {
      const existingByBarcode = await Product.findOne({
        businessId: req.businessId,
        barcode: validated.barcode.trim(),
        deletedAt: null,
      });
      if (existingByBarcode) {
        res.status(200).json({
          success: true,
          data: {
            product: existingByBarcode,
            alreadyExisted: true,
          },
          message: 'Product with this barcode already exists',
        });
        return;
      }
    }

    // Duplicate prevention: check exact name (case-insensitive)
    const existingByName = await Product.findOne({
      businessId: req.businessId,
      name: { $regex: new RegExp(`^${validated.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      deletedAt: null,
    });
    if (existingByName) {
      res.status(200).json({
        success: true,
        data: {
          product: existingByName,
          alreadyExisted: true,
        },
        message: 'Product with this name already exists',
      });
      return;
    }

    const product = await Product.create({
      ...validated,
      businessId: req.businessId,
      active: true,
      deletedAt: null,
    });

    res.status(201).json({
      success: true,
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Lists products/services scoped to the active business with pagination and search filters
 */
export async function listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    let limit = Math.max(1, parseInt(req.query.limit as string) || 20);
    limit = Math.min(limit, 100);

    const search = (req.query.search as string) || '';
    const type = req.query.type as string;
    const activeQuery = req.query.active;

    const filter: any = { businessId: req.businessId };

    if (activeQuery !== undefined) {
      filter.active = activeQuery === 'true';
    } else {
      filter.active = true; // default to active only
    }

    if (type) {
      filter.type = type;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await Product.countDocuments(filter);
    const pages = Math.ceil(total / limit) || 1;
    const skip = (page - 1) * limit;

    const products = await Product.find(filter)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: {
        products,
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
 * Fetches details of a single product/service scoped to the active business
 */
export async function getProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = req.params.productId || req.params.id;

    if (!productId || !mongoose.isValidObjectId(productId)) {
      return next(new AppError('Invalid or missing product ID parameter', 400, 'INVALID_ID'));
    }

    const product = await Product.findOne({
      _id: productId,
      businessId: req.businessId,
    });

    if (!product) {
      return next(new AppError('Product/service not found', 404, 'NOT_FOUND'));
    }

    res.status(200).json({
      success: true,
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Updates an existing product/service record
 */
export async function updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = req.params.productId || req.params.id;

    if (!productId || !mongoose.isValidObjectId(productId)) {
      return next(new AppError('Invalid or missing product ID parameter', 400, 'INVALID_ID'));
    }

    const validated = updateProductSchema.parse(req.body);

    const product = await Product.findOneAndUpdate(
      { _id: productId, businessId: req.businessId },
      { $set: validated },
      { new: true, runValidators: true }
    );

    if (!product) {
      return next(new AppError('Product/service not found', 404, 'NOT_FOUND'));
    }

    res.status(200).json({
      success: true,
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Deactivates a product/service (soft deletion)
 */
export async function deactivateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const productId = req.params.productId || req.params.id;

    if (!productId || !mongoose.isValidObjectId(productId)) {
      return next(new AppError('Invalid or missing product ID parameter', 400, 'INVALID_ID'));
    }

    const product = await Product.findOneAndUpdate(
      { _id: productId, businessId: req.businessId },
      { $set: { active: false, deletedAt: new Date() } },
      { new: true }
    );

    if (!product) {
      return next(new AppError('Product/service not found', 404, 'NOT_FOUND'));
    }

    res.status(200).json({
      success: true,
      data: {
        product,
      },
    });
  } catch (error) {
    next(error);
  }
}
