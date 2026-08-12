import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { AppError } from './errorHandler';

/**
 * Validates request components (body, query, params) against a Zod schema
 */
export function validateRequest(schema: AnyZodObject) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          new AppError('Request data validation failed', 400, 'VALIDATION_ERROR', {
            errors: error.errors.map((e) => ({
              path: e.path.join('.'),
              message: e.message,
            })),
          })
        );
      } else {
        next(error);
      }
    }
  };
}
export default validateRequest;
