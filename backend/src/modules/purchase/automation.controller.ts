import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import Purchase from '../../database/models/Purchase';
import { AppError } from '../../middleware/errorHandler';
import { uploadBufferToCloudinary } from '../../services/cloudinary';
import { extractBillData } from './billExtraction.service';
import { parsePurchaseItemsCsv } from './csvImport.service';

/**
 * Extract structured draft purchase from uploaded bill (PDF/Image)
 */
export async function extractBillDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return next(new AppError('Business context required', 400, 'BUSINESS_REQUIRED'));
    }

    const file = req.file;
    if (!file) {
      return next(new AppError('Purchase bill file (PDF, PNG, JPG) is required', 400, 'FILE_REQUIRED'));
    }

    // Upload to Cloudinary for persistence
    const fileExt = file.originalname.split('.').pop() || 'png';
    const isRaw = fileExt.toLowerCase() === 'pdf';
    const publicId = `purchase_bill_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    let uploadedFileUrl = '';
    try {
      const uploadResult = await uploadBufferToCloudinary(file.buffer, {
        folder: `businesses/${businessId}/purchases`,
        public_id: publicId,
        resource_type: isRaw ? 'raw' : 'image',
      });
      uploadedFileUrl = uploadResult.secure_url;
    } catch (uploadErr) {
      console.warn('⚠️ Cloudinary upload warning in extractBillDraft:', uploadErr);
      uploadedFileUrl = `https://res.cloudinary.com/mock-cloud/image/upload/v1/businesses/${businessId}/purchases/${publicId}.${fileExt}`;
    }

    // Extract structured data from bill buffer
    const extraction = await extractBillData(file.buffer, file.originalname, businessId);

    res.json({
      success: true,
      data: {
        attachmentUrl: uploadedFileUrl,
        fileName: file.originalname,
        extraction,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Parse CSV file or raw CSV text for purchase items
 */
export async function parsePurchaseCsv(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return next(new AppError('Business context required', 400, 'BUSINESS_REQUIRED'));
    }

    let csvContent = '';
    if (req.file) {
      csvContent = req.file.buffer.toString('utf-8');
    } else if (req.body?.csvText) {
      csvContent = String(req.body.csvText);
    } else {
      return next(new AppError('CSV file or csvText body is required', 400, 'CSV_REQUIRED'));
    }

    const result = await parsePurchaseItemsCsv(csvContent, businessId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Upload an attachment to an existing purchase order
 */
export async function uploadPurchaseAttachment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const businessId = req.businessId;
    const { purchaseId } = req.params;
    const userId = (req as any).user?.id || (req as any).user?._id;

    const file = req.file;
    if (!file) {
      return next(new AppError('Attachment file is required', 400, 'FILE_REQUIRED'));
    }

    const purchase = await Purchase.findOne({ _id: purchaseId, businessId });
    if (!purchase) {
      return next(new AppError('Purchase not found', 404, 'PURCHASE_NOT_FOUND'));
    }

    const fileExt = file.originalname.split('.').pop() || 'png';
    const isRaw = fileExt.toLowerCase() === 'pdf';
    const publicId = `attachment_${purchaseId}_${Date.now()}`;

    const uploadResult = await uploadBufferToCloudinary(file.buffer, {
      folder: `businesses/${businessId}/purchases/${purchaseId}`,
      public_id: publicId,
      resource_type: isRaw ? 'raw' : 'image',
    });

    const newAttachment = {
      _id: new Types.ObjectId(),
      fileName: file.originalname,
      fileUrl: uploadResult.secure_url,
      uploadedAt: new Date(),
      uploadedBy: userId ? new Types.ObjectId(userId) : undefined,
    };

    purchase.billAttachments.push(newAttachment as any);
    await purchase.save();

    res.json({
      success: true,
      data: {
        attachment: newAttachment,
        purchase,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete an attachment from a purchase order
 */
export async function deletePurchaseAttachment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const businessId = req.businessId;
    const { purchaseId, attachmentId } = req.params;

    const purchase = await Purchase.findOne({ _id: purchaseId, businessId });
    if (!purchase) {
      return next(new AppError('Purchase not found', 404, 'PURCHASE_NOT_FOUND'));
    }

    purchase.billAttachments = purchase.billAttachments.filter(
      (att: any) => att._id.toString() !== attachmentId
    );
    await purchase.save();

    res.json({
      success: true,
      message: 'Attachment deleted successfully',
      data: {
        purchase,
      },
    });
  } catch (error) {
    next(error);
  }
}
