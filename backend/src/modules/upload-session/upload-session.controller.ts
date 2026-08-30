import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { v2 as cloudinary } from 'cloudinary';
import { UploadSession } from '../../database/models/UploadSession';
import { Business } from '../../database/models/Business';
import { AppError } from '../../middleware/errorHandler';
import { env } from '../../config/env';

// Determine if Cloudinary is fully configured
const isCloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME &&
  env.CLOUDINARY_API_KEY &&
  env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * 1. Create a temporary secure upload session
 * POST /api/upload-sessions
 * Protected
 */
export async function createUploadSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { invoiceId, metadata } = req.body;

    // Generate cryptographically secure random raw token (64 hex characters)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    // 15-minute expiration
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Base URL for the public mobile phone upload page
    const frontendBaseUrl = env.FRONTEND_URL || 'http://localhost:3000';
    const uploadUrl = `${frontendBaseUrl}/upload-proof/${rawToken}`;

    // Generate high-resolution QR code data URL
    const qrCodeDataUrl = await QRCode.toDataURL(uploadUrl, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 300,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    const session = await UploadSession.create({
      businessId: req.businessId,
      invoiceId: invoiceId || null,
      tokenHash,
      metadata: {
        invoiceNumber: metadata?.invoiceNumber || null,
        amountMinor: metadata?.amountMinor || null,
        method: metadata?.method || null,
        customerName: metadata?.customerName || null,
      },
      status: 'CREATED',
      expiresAt,
      createdBy: req.user?._id,
    });

    res.status(201).json({
      success: true,
      data: {
        sessionId: session._id,
        token: rawToken,
        qrCodeDataUrl,
        uploadUrl,
        expiresAt: session.expiresAt,
        status: session.status,
        metadata: session.metadata,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

/**
 * 2. Get upload session status (for laptop real-time polling)
 * GET /api/upload-sessions/:id/status
 * Protected
 */
export async function getUploadSessionStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await UploadSession.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!session) {
      return next(new AppError('Upload session not found', 404, 'NOT_FOUND'));
    }

    // Check if expired
    if (new Date() > session.expiresAt && ['CREATED', 'SCANNED', 'UPLOADING'].includes(session.status)) {
      session.status = 'EXPIRED';
      await session.save();
    }

    res.status(200).json({
      success: true,
      data: {
        sessionId: session._id,
        status: session.status,
        proof: session.proof,
        expiresAt: session.expiresAt,
        scannedAt: session.scannedAt,
        completedAt: session.completedAt,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

/**
 * 3. Cancel upload session
 * POST /api/upload-sessions/:id/cancel
 * Protected
 */
export async function cancelUploadSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await UploadSession.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!session) {
      return next(new AppError('Upload session not found', 404, 'NOT_FOUND'));
    }

    session.status = 'CANCELLED';
    await session.save();

    res.status(200).json({
      success: true,
      data: {
        sessionId: session._id,
        status: 'CANCELLED',
      },
    });
  } catch (err: any) {
    next(err);
  }
}

/**
 * 4. Get public upload session info (opened by phone upon scanning QR)
 * GET /api/upload-sessions/public/:token
 * Public
 */
export async function getPublicUploadSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawToken = req.params.token;
    if (!rawToken || rawToken.length < 16) {
      return next(new AppError('Invalid upload token format', 400, 'INVALID_TOKEN'));
    }

    const tokenHash = hashToken(rawToken);
    const session = await UploadSession.findOne({ tokenHash });

    if (!session) {
      return next(new AppError('Upload session not found or link is invalid', 404, 'NOT_FOUND'));
    }

    // Check expiration
    if (new Date() > session.expiresAt) {
      if (['CREATED', 'SCANNED', 'UPLOADING'].includes(session.status)) {
        session.status = 'EXPIRED';
        await session.save();
      }
      return next(new AppError('This upload session has expired. Please request a new QR code on the desktop billing screen.', 410, 'SESSION_EXPIRED'));
    }

    if (session.status === 'CANCELLED') {
      return next(new AppError('This upload session was cancelled from the desktop billing screen.', 400, 'SESSION_CANCELLED'));
    }

    // If first time opened on phone, mark as SCANNED
    if (session.status === 'CREATED') {
      session.status = 'SCANNED';
      session.scannedAt = new Date();
      await session.save();
    }

    // Fetch minimal business info
    const business = await Business.findById(session.businessId).select('name branding');

    res.status(200).json({
      success: true,
      data: {
        businessName: business?.name || 'Jay Ramji',
        invoiceNumber: session.metadata?.invoiceNumber || 'New Bill',
        amountMinor: session.metadata?.amountMinor || null,
        method: session.metadata?.method || 'UPI',
        status: session.status,
        expiresAt: session.expiresAt,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

/**
 * 5. Public proof upload from mobile phone
 * POST /api/upload-sessions/public/:token/upload
 * Public (Single file in 'file' field)
 */
export async function uploadPublicProof(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawToken = req.params.token;
    if (!rawToken || rawToken.length < 16) {
      return next(new AppError('Invalid upload token', 400, 'INVALID_TOKEN'));
    }

    if (!req.file) {
      return next(new AppError('No proof file provided for upload', 400, 'NO_FILE'));
    }

    const tokenHash = hashToken(rawToken);
    const session = await UploadSession.findOne({ tokenHash });

    if (!session) {
      return next(new AppError('Upload session not found or link is invalid', 404, 'NOT_FOUND'));
    }

    if (new Date() > session.expiresAt) {
      session.status = 'EXPIRED';
      await session.save();
      return next(new AppError('This upload session has expired', 410, 'SESSION_EXPIRED'));
    }

    if (session.status === 'CANCELLED') {
      return next(new AppError('This upload session was cancelled', 400, 'SESSION_CANCELLED'));
    }

    if (session.status === 'COMPLETED') {
      return next(new AppError('Payment proof has already been uploaded for this session', 400, 'SESSION_ALREADY_COMPLETED'));
    }

    // File format & size validations
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'webp', 'pdf'];

    const fileExt = req.file.originalname.split('.').pop()?.toLowerCase();
    if (!fileExt || !allowedExtensions.includes(fileExt)) {
      return next(new AppError('Only PNG, JPG, JPEG, WEBP, and PDF files are allowed', 400, 'INVALID_FILE_TYPE'));
    }

    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return next(new AppError('Invalid file MIME type format', 400, 'INVALID_MIME_TYPE'));
    }

    const maxSizeBytes = 10 * 1024 * 1024;
    if (req.file.size > maxSizeBytes) {
      return next(new AppError('File size exceeds the maximum limit of 10MB', 400, 'FILE_TOO_LARGE'));
    }

    // Update status to UPLOADING
    session.status = 'UPLOADING';
    await session.save();

    let secureUrl = '';
    let publicId = '';
    let format = fileExt;

    if (process.env.NODE_ENV === 'test' || !isCloudinaryConfigured) {
      publicId = `proof_${session.businessId}_${Date.now()}`;
      secureUrl = `https://res.cloudinary.com/mock-cloud/image/upload/v1/${publicId}.${fileExt}`;
    } else {
      try {
        const folderPath = `businesses/${session.businessId}/proofs`;
        const uploadResult: any = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: folderPath,
              public_id: `proof_${Date.now()}`,
              resource_type: 'auto',
            },
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            }
          );
          stream.write(req.file!.buffer);
          stream.end();
        });

        secureUrl = uploadResult.secure_url;
        publicId = uploadResult.public_id;
        format = uploadResult.format || fileExt;
      } catch (uploadErr: any) {
        session.status = 'FAILED';
        await session.save();
        return next(new AppError(`Cloud storage upload failed: ${uploadErr.message}`, 502, 'UPLOAD_FAILED'));
      }
    }

    const proof = {
      publicId,
      secureUrl,
      format,
      fileType: req.file.mimetype,
      originalFilename: req.file.originalname,
      uploadedAt: new Date(),
    };

    session.proof = proof;
    session.status = 'COMPLETED';
    session.completedAt = new Date();
    await session.save();

    res.status(200).json({
      success: true,
      message: 'Payment proof uploaded successfully',
      data: {
        proof,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

/**
 * 6. Direct desktop file proof upload
 * POST /api/upload-sessions/direct-upload
 * Protected (Single file in 'file' field)
 */
export async function directProofUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      return next(new AppError('No proof file provided', 400, 'NO_FILE'));
    }

    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'webp', 'pdf'];

    const fileExt = req.file.originalname.split('.').pop()?.toLowerCase();
    if (!fileExt || !allowedExtensions.includes(fileExt)) {
      return next(new AppError('Only PNG, JPG, JPEG, WEBP, and PDF files are allowed', 400, 'INVALID_FILE_TYPE'));
    }

    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return next(new AppError('Invalid file MIME type format', 400, 'INVALID_MIME_TYPE'));
    }

    const maxSizeBytes = 10 * 1024 * 1024;
    if (req.file.size > maxSizeBytes) {
      return next(new AppError('File size exceeds the maximum limit of 10MB', 400, 'FILE_TOO_LARGE'));
    }

    let secureUrl = '';
    let publicId = '';
    let format = fileExt;

    if (process.env.NODE_ENV === 'test' || !isCloudinaryConfigured) {
      publicId = `proof_${req.businessId}_${Date.now()}`;
      secureUrl = `https://res.cloudinary.com/mock-cloud/image/upload/v1/${publicId}.${fileExt}`;
    } else {
      try {
        const folderPath = `businesses/${req.businessId}/proofs`;
        const uploadResult: any = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: folderPath,
              public_id: `proof_${Date.now()}`,
              resource_type: 'auto',
            },
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            }
          );
          stream.write(req.file!.buffer);
          stream.end();
        });

        secureUrl = uploadResult.secure_url;
        publicId = uploadResult.public_id;
        format = uploadResult.format || fileExt;
      } catch (uploadErr: any) {
        return next(new AppError(`Cloud storage upload failed: ${uploadErr.message}`, 502, 'UPLOAD_FAILED'));
      }
    }

    const proof = {
      publicId,
      secureUrl,
      format,
      fileType: req.file.mimetype,
      originalFilename: req.file.originalname,
      uploadedAt: new Date(),
    };

    res.status(200).json({
      success: true,
      message: 'Payment proof uploaded successfully',
      data: {
        proof,
      },
    });
  } catch (err: any) {
    next(err);
  }
}
