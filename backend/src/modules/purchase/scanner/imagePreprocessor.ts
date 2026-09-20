import sharp from 'sharp';
import {
  ImageDecodeError,
  ImageProcessingError,
} from './preprocessingErrors';
import { ProcessedDocumentPage } from './preprocessingTypes';

export interface ImageNormalizationOptions {
  maxDimension?: number;
  skipContrastNormalization?: boolean;
  skipSharpening?: boolean;
}

export const DEFAULT_MAX_DIMENSION = 1800; // Optimal bounding box for vision/OCR models without quality loss or excessive token memory

/**
 * Normalizes an individual document page image for downstream AI vision & OCR extraction.
 *
 * Pipeline:
 * 1. Safe decode with decompression bomb guard
 * 2. EXIF orientation correction (auto-upright rotation)
 * 3. Color space normalization to sRGB
 * 4. Dimension normalization (bounded to maxDimension without stretching or enlargement)
 * 5. Contrast normalization (enhances faint thermal/printed receipts)
 * 6. Mild edge sharpening (improves alphanumeric OCR fidelity for HSN, amounts, percentages)
 * 7. Lossless PNG output encoding
 */
export async function normalizePageImage(
  inputBuffer: Buffer,
  pageNumber: number,
  options?: ImageNormalizationOptions
): Promise<ProcessedDocumentPage> {
  if (!inputBuffer || inputBuffer.length === 0) {
    throw new ImageDecodeError(`Page ${pageNumber}: input buffer is empty`);
  }

  const maxDimension = options?.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const skipContrast = options?.skipContrastNormalization ?? false;
  const skipSharpen = options?.skipSharpening ?? false;

  const preprocessingApplied: string[] = [];
  const warnings: string[] = [];

  try {
    // 1. Safe decode with pixel limit protection
    const sharpInstance = sharp(inputBuffer, {
      limitInputPixels: 268435456, // 16384 x 16384 max bounds (prevents decompression bombs)
    });

    const metadata = await sharpInstance.metadata();

    if (!metadata.width || !metadata.height) {
      throw new ImageDecodeError(`Page ${pageNumber}: unable to extract image dimensions`);
    }

    const originalDimensions = {
      width: metadata.width,
      height: metadata.height,
    };

    // 2. EXIF orientation determination
    let rotationApplied = 0;
    const exifOrientation = metadata.orientation ?? 1;

    switch (exifOrientation) {
      case 3:
        rotationApplied = 180;
        break;
      case 6:
        rotationApplied = 90;
        break;
      case 8:
        rotationApplied = 270;
        break;
      default:
        rotationApplied = 0;
        break;
    }

    // Auto-rotate according to EXIF
    let pipeline = sharpInstance.rotate();
    if (rotationApplied !== 0) {
      preprocessingApplied.push(`exif_auto_rotate_${rotationApplied}deg`);
    }

    // 3. Color space normalization to standard sRGB
    pipeline = pipeline.toColourspace('srgb');
    preprocessingApplied.push('colorspace_srgb');

    // 4. Dimension normalization (fit inside maxDimension without upscaling)
    const longestEdge = Math.max(metadata.width, metadata.height);
    if (longestEdge > maxDimension) {
      pipeline = pipeline.resize({
        width: maxDimension,
        height: maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      });
      preprocessingApplied.push(`dimension_scale_inside_${maxDimension}px`);
    }

    // 5. Contrast normalization (improves readability of faint bills / receipt thermal paper)
    if (!skipContrast) {
      pipeline = pipeline.normalise();
      preprocessingApplied.push('contrast_normalize');
    }

    // 6. Mild edge sharpening to assist vision/OCR boundary detection
    if (!skipSharpen) {
      pipeline = pipeline.sharpen({
        sigma: 1.0,
        m1: 0.5,
        m2: 2.0,
      });
      preprocessingApplied.push('mild_sharpen');
    }

    // 7. Output lossless PNG with optimal compression
    const normalizedBuffer = await pipeline
      .png({
        compressionLevel: 8,
        adaptiveFiltering: true,
      })
      .toBuffer();

    // Verify output metadata
    const outputMetadata = await sharp(normalizedBuffer).metadata();

    return {
      pageNumber,
      width: outputMetadata.width || originalDimensions.width,
      height: outputMetadata.height || originalDimensions.height,
      mimeType: 'image/png',
      buffer: normalizedBuffer,
      rotation: rotationApplied,
      originalDimensions,
      preprocessingApplied,
      warnings,
    };
  } catch (err: any) {
    if (err instanceof ImageDecodeError) {
      throw err;
    }
    throw new ImageProcessingError(
      `Failed to preprocess image for page ${pageNumber}: ${err?.message || 'sharp processing failure'}`,
      { pageNumber, originalError: err?.message }
    );
  }
}
