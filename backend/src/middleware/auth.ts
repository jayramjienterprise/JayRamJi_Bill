import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User, IUser } from '../database/models/User';
import { BusinessMember, IBusinessMember } from '../database/models/BusinessMember';
import { AppError } from './errorHandler';

// Extend Express Request interface within global namespace
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      businessId?: string;
      membership?: IBusinessMember;
    }
  }
}

interface DecodedToken {
  userId: string;
  email: string;
}

/**
 * Authentication middleware validating the JWT token (cookie or header)
 * and resolving the multi-tenant business context for the user.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    let token = req.cookies?.token;

    // Fallback to Bearer token in Authorization header
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('Authentication session token is missing', 401, 'UNAUTHORIZED'));
    }

    let decoded: DecodedToken;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as DecodedToken;
    } catch (err) {
      return next(new AppError('Session token is invalid or expired', 401, 'UNAUTHORIZED'));
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return next(new AppError('Authorized user profile not found', 401, 'UNAUTHORIZED'));
    }

    if (user.status !== 'ACTIVE') {
      return next(new AppError('This user account has been suspended', 403, 'FORBIDDEN'));
    }

    req.user = user;

    // Resolve current business tenant context
    const requestedBusinessId = req.headers['x-business-id'] as string;
    let membership: IBusinessMember | null = null;

    if (requestedBusinessId) {
      membership = await BusinessMember.findOne({
        businessId: requestedBusinessId,
        userId: user._id,
        status: 'ACTIVE',
      });
    }

    // If requested business is not specified or does not belong to this user,
    // fallback gracefully to the user's first active business membership
    if (!membership) {
      membership = await BusinessMember.findOne({
        userId: user._id,
        status: 'ACTIVE',
      });
    }

    if (membership) {
      req.businessId = membership.businessId.toString();
      req.membership = membership;
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Guard middleware verifying that a request has a resolved business context.
 */
export function requireBusiness(req: Request, _res: Response, next: NextFunction): void {
  if (!req.businessId || !req.membership) {
    return next(
      new AppError(
        'An active business workspace context is required to access this resource',
        400,
        'BAD_REQUEST'
      )
    );
  }
  next();
}

/**
 * Guard middleware verifying that a user membership role satisfies authorization rules.
 */
export function requireRole(allowedRoles: ('OWNER' | 'ADMIN' | 'STAFF')[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.membership) {
      return next(new AppError('No business workspace context resolved', 401, 'UNAUTHORIZED'));
    }

    if (!allowedRoles.includes(req.membership.role)) {
      return next(
        new AppError(
          'You do not have the required permissions to perform this operation',
          403,
          'FORBIDDEN',
          {
            requiredRoles: allowedRoles,
            userRole: req.membership.role,
          }
        )
      );
    }

    next();
  };
}
