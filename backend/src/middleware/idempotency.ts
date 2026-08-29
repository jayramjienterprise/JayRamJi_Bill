import { Request, Response, NextFunction } from 'express';
import { IdempotencyKey } from '../database/models/IdempotencyKey';
import { AppError } from './errorHandler';

export async function idempotency(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const key = req.headers['idempotency-key'] as string;
    if (!key) {
      return next();
    }

    const businessId = req.businessId;
    if (!businessId) {
      return next(new AppError('Business workspace context is required for idempotent requests', 400, 'BAD_REQUEST'));
    }

    // 1. Try to find if the key already exists
    const existing = await IdempotencyKey.findOne({ key, businessId });

    if (existing) {
      if (existing.responseStatus === 0) {
        // Status 0 means a request is currently processing (pending lock)
        return next(new AppError('A request with this idempotency key is already in progress', 409, 'CONFLICT'));
      }
      // Return cached response
      res.status(existing.responseStatus).json(existing.responseBody);
      return;
    }

    // 2. Lock the key as pending (status: 0)
    try {
      await IdempotencyKey.create({
        key,
        businessId,
        responseStatus: 0,
        responseBody: { status: 'PENDING' },
      });
    } catch (err: any) {
      // If concurrent insertion occurred, Mongo will throw a duplicate key error (code 11000)
      if (err.code === 11000) {
        return next(new AppError('A request with this idempotency key is already in progress', 409, 'CONFLICT'));
      }
      throw err;
    }

    // 3. Intercept res.json to save the response on completion
    const originalJson = res.json;
    res.json = function (body: any): Response {
      res.json = originalJson;

      const status = res.statusCode;
      if (status >= 500) {
        // For server-side crashes/transient issues, delete the key so user can retry
        IdempotencyKey.deleteOne({ key, businessId })
          .catch((e) => console.error('Error cleaning up failed idempotency key:', e));
      } else {
        IdempotencyKey.updateOne(
          { key, businessId },
          { $set: { responseStatus: status, responseBody: body } }
        ).catch((e) => console.error('Error saving idempotency response cache:', e));
      }

      return originalJson.call(this, body);
    };

    next();
  } catch (error) {
    next(error);
  }
}
