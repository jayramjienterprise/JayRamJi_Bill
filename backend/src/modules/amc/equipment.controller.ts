import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CustomerAcEquipment } from '../../database/models/CustomerAcEquipment';
import { Customer } from '../../database/models/Customer';
import { EquipmentAssignmentHistory } from '../../database/models/EquipmentAssignmentHistory';
import { AppError } from '../../middleware/errorHandler';

const createEquipmentSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  acType: z.enum(['SPLIT', 'WINDOW', 'CASSETTE', 'DUCTABLE', 'TOWER', 'PACKAGE', 'OTHER']).default('SPLIT'),
  tonnage: z.string().min(1, 'Tonnage / Capacity is required'),
  brand: z.string().min(1, 'Brand is required'),
  modelNumber: z.string().optional().nullable(),
  serialNumber: z.string().optional().nullable(),
  installationLocation: z.string().min(1, 'Installation location is required'),
  refrigerantType: z.string().optional().nullable().default('R32'),
  indoorUnitSerial: z.string().optional().nullable(),
  outdoorUnitSerial: z.string().optional().nullable(),
  installationDate: z.string().optional().nullable(),
  status: z.enum(['OPERATIONAL', 'NEEDS_SERVICE', 'UNDER_REPAIR', 'DECOMMISSIONED']).default('OPERATIONAL'),
  notes: z.string().optional().nullable(),
});

const updateEquipmentSchema = createEquipmentSchema.partial();

export async function listEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { customerId, status, search } = req.query;

    const query: any = { businessId, active: true };

    if (customerId) {
      query.customerId = customerId;
    }

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (search && typeof search === 'string') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { brand: searchRegex },
        { modelNumber: searchRegex },
        { serialNumber: searchRegex },
        { installationLocation: searchRegex },
        { tonnage: searchRegex },
      ];
    }

    const items = await CustomerAcEquipment.find(query)
      .populate('customerId', 'name contact address taxProfile')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: items,
    });
  } catch (error) {
    next(error);
  }
}

export async function getEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const equipment = await CustomerAcEquipment.findOne({ _id: id, businessId, active: true })
      .populate('customerId', 'name contact address taxProfile');

    if (!equipment) {
      return next(new AppError('AC Equipment not found', 404, 'EQUIPMENT_NOT_FOUND'));
    }

    res.status(200).json({
      success: true,
      data: equipment,
    });
  } catch (error) {
    next(error);
  }
}

export async function createEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const validated = createEquipmentSchema.parse(req.body);

    const customer = await Customer.findOne({ _id: validated.customerId, businessId, active: true });
    if (!customer) {
      return next(new AppError('Associated customer not found', 404, 'CUSTOMER_NOT_FOUND'));
    }

    const equipment = await CustomerAcEquipment.create({
      ...validated,
      businessId,
      installationDate: validated.installationDate ? new Date(validated.installationDate) : null,
      active: true,
    });

    // Record initial assignment history
    await EquipmentAssignmentHistory.create({
      businessId,
      equipmentId: equipment._id,
      fromCustomerId: null,
      toCustomerId: validated.customerId,
      transferredAt: new Date(),
      reason: 'Initial Registration',
      performedBy: req.user?._id || null,
    });

    const populated = await CustomerAcEquipment.findById(equipment._id)
      .populate('customerId', 'name contact address taxProfile');

    res.status(201).json({
      success: true,
      data: populated,
      message: 'AC Equipment registered successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function updateEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { id } = req.params;
    const validated = updateEquipmentSchema.parse(req.body);

    const equipment = await CustomerAcEquipment.findOne({ _id: id, businessId, active: true });
    if (!equipment) {
      return next(new AppError('AC Equipment not found', 404, 'EQUIPMENT_NOT_FOUND'));
    }

    if (validated.customerId && validated.customerId !== equipment.customerId.toString()) {
      const customer = await Customer.findOne({ _id: validated.customerId, businessId, active: true });
      if (!customer) {
        return next(new AppError('New customer not found', 404, 'CUSTOMER_NOT_FOUND'));
      }

      // Record transfer history audit
      await EquipmentAssignmentHistory.create({
        businessId,
        equipmentId: equipment._id,
        fromCustomerId: equipment.customerId,
        toCustomerId: validated.customerId,
        transferredAt: new Date(),
        reason: req.body.transferReason || 'Ownership Transfer',
        notes: req.body.transferNotes || null,
        performedBy: req.user?._id || null,
      });
    }

    const updatePayload: any = { ...validated };
    if (validated.installationDate !== undefined) {
      updatePayload.installationDate = validated.installationDate ? new Date(validated.installationDate) : null;
    }

    const updated = await CustomerAcEquipment.findByIdAndUpdate(id, updatePayload, { new: true })
      .populate('customerId', 'name contact address taxProfile');

    res.status(200).json({
      success: true,
      data: updated,
      message: 'AC Equipment updated successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function getEquipmentHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const history = await EquipmentAssignmentHistory.find({ businessId, equipmentId: id })
      .populate('fromCustomerId', 'name contact')
      .populate('toCustomerId', 'name contact')
      .populate('performedBy', 'name email')
      .sort({ transferredAt: -1 });

    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const equipment = await CustomerAcEquipment.findOne({ _id: id, businessId, active: true });
    if (!equipment) {
      return next(new AppError('AC Equipment not found', 404, 'EQUIPMENT_NOT_FOUND'));
    }

    equipment.active = false;
    equipment.deletedAt = new Date();
    await equipment.save();

    res.status(200).json({
      success: true,
      message: 'AC Equipment deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}
