import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Base custom application error class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details: Record<string, unknown>;

  constructor(
    message: string,
    statusCode = 500,
    errorCode = 'INTERNAL_SERVER_ERROR',
    details: Record<string, unknown> = {}
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Express error handler middleware
 */
export function errorHandler(
  err: Error | AppError | any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode = 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details: Record<string, unknown> = {};

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.errorCode;
    message = err.message;
    details = err.details;
  } else if (err.name === 'ZodError' || err.constructor?.name === 'ZodError') {
    // Handle Zod schema validation errors
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = err.issues && Array.isArray(err.issues)
      ? err.issues.map((i: any) => i.message).join(', ')
      : 'Validation failed';
    details = { validationErrors: err.issues || [] };
  } else if (err.name === 'ValidationError') {
    // Handle Mongoose validation errors
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Data validation failed';
    const validationDetails: Record<string, string> = {};
    if (err.errors) {
      for (const field of Object.keys(err.errors)) {
        validationDetails[field] = err.errors[field].message;
      }
    }
    details = { validationErrors: validationDetails };
  } else if (err.name === 'CastError') {
    // Handle Mongoose type conversion failures (e.g. invalid ObjectId format)
    statusCode = 400;
    errorCode = 'BAD_REQUEST';
    message = `Invalid data format for path: ${err.path}`;
  } else if (err.code === 11000) {
    // Handle MongoDB duplicate key index error
    statusCode = 409;
    errorCode = 'CONFLICT';
    message = 'A resource with these details already exists';
  } else {
    // System or uncaught generic error
    if (env.NODE_ENV !== 'production') {
      message = err.message || message;
      details = { stack: err.stack };
    }
  }

  // Log error message safely
  console.error(`[Error Handler] ${errorCode} (${statusCode}): ${message}`);
  if (env.NODE_ENV !== 'production' && !(err instanceof AppError)) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      details,
    },
  });
}
export default errorHandler;
