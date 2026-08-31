import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { Asset } from '../../database/models/Asset';
import { AppError } from '../../middleware/errorHandler';
import { cloudinary, isCloudinaryConfigured } from '../../services/cloudinary';
import { UploadApiResponse } from 'cloudinary';

// Zod schemas
const uploadAssetBodySchema = z.object({
  type: z.enum(['LOGO', 'STAMP', 'SIGNATURE', 'OTHER']),
});

/**
 * Helper to stream buffer upload to Cloudinary
 */
function uploadFromBuffer(buffer: Buffer, options: any): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) return reject(error);
      if (!result) return reject(new Error('Cloudinary upload stream returned empty response'));
      resolve(result);
    });
    stream.write(buffer);
    stream.end();
  });
}

/**
 * Handles multipart file upload and creates asset record scoped to active business
 */
export async function uploadAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      return next(new AppError('No image file provided', 400, 'BAD_REQUEST'));
    }

    const validated = uploadAssetBodySchema.parse(req.body);
    const type = validated.type;

    // File Validation: size, format, MIME type
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'webp'];

    const fileExt = req.file.originalname.split('.').pop()?.toLowerCase();
    if (!fileExt || !allowedExtensions.includes(fileExt)) {
      return next(new AppError('Only PNG, JPG, JPEG, and WEBP image extensions are allowed', 400, 'BAD_REQUEST'));
    }

    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return next(new AppError('Invalid image MIME type format', 400, 'BAD_REQUEST'));
    }

    // Limit size at 5MB
    const maxSizeBytes = 5 * 1024 * 1024;
    if (req.file.size > maxSizeBytes) {
      return next(new AppError('File size exceeds the maximum limit of 5MB', 400, 'BAD_REQUEST'));
    }

    let secureUrl = '';
    let cloudinaryPublicId = '';
    let width: number | null = null;
    let height: number | null = null;
    let format: string | null = fileExt;
    let version: number | null = null;

    if (isCloudinaryConfigured) {
      try {
        // Construct predictable business-scoped public ID:
        // businesses/{businessId}/assets/{type}/{timestamp}
        const folderPath = `businesses/${req.businessId}/assets/${type.toLowerCase()}`;
        const publicId = `${Date.now()}`;

        const uploadResult = await uploadFromBuffer(req.file.buffer, {
          folder: folderPath,
          public_id: publicId,
          resource_type: 'image',
        });

        secureUrl = uploadResult.secure_url;
        cloudinaryPublicId = uploadResult.public_id;
        width = uploadResult.width;
        height = uploadResult.height;
        format = uploadResult.format;
        version = uploadResult.version;
      } catch (uploadErr: any) {
        if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
          console.warn(
            `⚠️ WARNING: Cloudinary upload failed (${uploadErr.message || 'Unknown network error'}). Falling back to mock URL mode for development.`
          );
          cloudinaryPublicId = `mock_businesses_${req.businessId}_assets_${type.toLowerCase()}_${Date.now()}`;
          secureUrl = `https://res.cloudinary.com/mock-cloud/image/upload/v1/${cloudinaryPublicId}.png`;
          width = 400;
          height = 150;
          version = 1;
        } else {
          return next(
            new AppError(
              `Failed to upload asset to Cloudinary: ${uploadErr.message || 'Unknown network error'}`,
              502,
              'BAD_GATEWAY'
            )
          );
        }
      }
    } else {
      // Fallback offline mock mode
      console.warn('⚠️ Cloudinary is offline. Generating mock URL paths.');
      cloudinaryPublicId = `mock_businesses_${req.businessId}_assets_${type.toLowerCase()}_${Date.now()}`;
      secureUrl = `https://res.cloudinary.com/mock-cloud/image/upload/v1/${cloudinaryPublicId}.png`;
      width = 400;
      height = 150;
      version = 1;
    }

    // Create asset metadata in DB (only one can be active at a time for LOGO, STAMP, SIGNATURE)
    if (type !== 'OTHER') {
      await Asset.updateMany(
        { businessId: req.businessId, type, active: true },
        { $set: { active: false } }
      );
    }

    const asset = await Asset.create({
      businessId: req.businessId,
      type,
      cloudinaryPublicId,
      secureUrl,
      format,
      width,
      height,
      version,
      active: true,
    });

    res.status(201).json({
      success: true,
      data: {
        asset,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Lists assets scoped to the active business
 */
export async function listAssets(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const type = req.query.type as string;
    const filter: any = { businessId: req.businessId };

    if (type) {
      filter.type = type;
    }

    const assets = await Asset.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        assets,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Activates an asset (deactivates others of the same type for that business)
 */
export async function activateAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { assetId } = req.params;

    if (!assetId || assetId === 'undefined' || !Types.ObjectId.isValid(assetId)) {
      return next(new AppError('Invalid asset ID format', 400, 'BAD_REQUEST'));
    }

    const asset = await Asset.findOne({ _id: assetId, businessId: req.businessId });
    if (!asset) {
      return next(new AppError('Asset record not found', 404, 'NOT_FOUND'));
    }

    // Deactivate all other active assets of the same type for this business
    if (asset.type !== 'OTHER') {
      await Asset.updateMany(
        { businessId: req.businessId, type: asset.type, active: true },
        { $set: { active: false } }
      );
    }

    asset.active = true;
    await asset.save();

    res.status(200).json({
      success: true,
      data: {
        asset,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Deactivates an asset without deleting the physical asset from Cloudinary
 */
export async function deactivateAsset(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { assetId } = req.params;

    if (!assetId || assetId === 'undefined' || !Types.ObjectId.isValid(assetId)) {
      return next(new AppError('Invalid asset ID format', 400, 'BAD_REQUEST'));
    }

    const asset = await Asset.findOneAndUpdate(
      { _id: assetId, businessId: req.businessId },
      { $set: { active: false } },
      { new: true }
    );

    if (!asset) {
      return next(new AppError('Asset record not found', 404, 'NOT_FOUND'));
    }

    res.status(200).json({
      success: true,
      data: {
        asset,
      },
    });
  } catch (error) {
    next(error);
  }
}
