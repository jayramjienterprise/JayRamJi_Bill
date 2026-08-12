import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { z } from 'zod';
import { env } from '../../config/env';
import { User } from '../../database/models/User';
import { Business } from '../../database/models/Business';
import { BusinessMember } from '../../database/models/BusinessMember';
import { AppError } from '../../middleware/errorHandler';

// Zod schemas for input validation
const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Handles user registration and auto-provisions their initial business
 */
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validated = registerSchema.parse(req.body);
    const emailNormalized = validated.email.toLowerCase();

    // Check existing user
    const existingUser = await User.findOne({ email: emailNormalized });
    if (existingUser) {
      return next(new AppError('An account with this email already exists', 409, 'CONFLICT'));
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(validated.password, saltRounds);

    let user: any;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Create User inside transaction
        const [createdUser] = await User.create(
          [
            {
              name: validated.name,
              email: emailNormalized,
              passwordHash,
              status: 'ACTIVE',
            },
          ],
          { session }
        );
        user = createdUser;

        // Auto-create default Business inside transaction
        const [business] = await Business.create(
          [
            {
              name: `${validated.name}'s Shop`,
              legalName: null,
              displayName: `${validated.name}'s Shop`,
              address: {
                line1: 'Enter address line 1',
                line2: null,
                city: 'Mundra',
                state: 'Gujarat',
                postalCode: '370421',
                country: 'India',
              },
              contact: {
                phone: null,
                email: emailNormalized,
                website: null,
              },
              timezone: 'Asia/Kolkata',
              taxProfile: {
                gstin: null,
                pan: null,
                taxRegistrationType: null,
              },
              bankDetails: {
                bankName: null,
                accountHolderName: null,
                accountNumber: null,
                ifsc: null,
                branch: null,
              },
              invoiceSettings: {
                invoiceTitle: 'TAX INVOICE',
                prefix: 'JRE',
                defaultCurrency: 'INR',
                defaultPaymentTerms: 'Within 15 days clear payment',
                defaultTaxMode: 'NONE',
                defaultTaxRateBps: 0,
                numberingMode: 'SEQUENTIAL',
              },
              paymentSettings: {
                defaultPaymentStatus: 'UNPAID',
              },
              status: 'ACTIVE',
            },
          ],
          { session }
        );

        // Create Business Membership inside transaction
        await BusinessMember.create(
          [
            {
              businessId: business._id,
              userId: user._id,
              role: 'OWNER',
              status: 'ACTIVE',
            },
          ],
          { session }
        );
      });
    } catch (transactionErr: any) {
      // If transactions fail because the local DB does not support them, log a loud warning and use fallback
      if (
        transactionErr.message?.includes('replica set') ||
        transactionErr.message?.includes('Transactions are not supported')
      ) {
        console.warn(
          '⚠️ WARNING: MongoDB transactions are not supported by your database deployment (running in standalone mode). Falling back to non-transactional creation for development.'
        );

        user = await User.create({
          name: validated.name,
          email: emailNormalized,
          passwordHash,
          status: 'ACTIVE',
        });

        const business = await Business.create({
          name: `${validated.name}'s Shop`,
          legalName: null,
          displayName: `${validated.name}'s Shop`,
          address: {
            line1: 'Enter address line 1',
            line2: null,
            city: 'Mundra',
            state: 'Gujarat',
            postalCode: '370421',
            country: 'India',
          },
          contact: {
            phone: null,
            email: emailNormalized,
            website: null,
          },
          timezone: 'Asia/Kolkata',
          taxProfile: {
            gstin: null,
            pan: null,
            taxRegistrationType: null,
          },
          bankDetails: {
            bankName: null,
            accountHolderName: null,
            accountNumber: null,
            ifsc: null,
            branch: null,
          },
          invoiceSettings: {
            invoiceTitle: 'TAX INVOICE',
            prefix: 'JRE',
            defaultCurrency: 'INR',
            defaultPaymentTerms: 'Within 15 days clear payment',
            defaultTaxMode: 'NONE',
            defaultTaxRateBps: 0,
            numberingMode: 'SEQUENTIAL',
          },
          paymentSettings: {
            defaultPaymentStatus: 'UNPAID',
          },
          status: 'ACTIVE',
        });

        await BusinessMember.create({
          businessId: business._id,
          userId: user._id,
          role: 'OWNER',
          status: 'ACTIVE',
        });
      } else {
        throw transactionErr;
      }
    } finally {
      await session.endSession();
    }

    // Generate session JWT token
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set browser HTTP-only session cookie
    res.cookie('token', token, COOKIE_OPTIONS);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Authenticates user credentials and logs them in
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validated = loginSchema.parse(req.body);
    const emailNormalized = validated.email.toLowerCase();

    const user = await User.findOne({ email: emailNormalized });
    if (!user || !user.passwordHash) {
      return next(new AppError('Invalid email or password', 401, 'UNAUTHORIZED'));
    }

    if (user.status !== 'ACTIVE') {
      return next(new AppError('This user account has been suspended', 403, 'FORBIDDEN'));
    }

    // Verify password hash
    const isMatch = await bcrypt.compare(validated.password, user.passwordHash);
    if (!isMatch) {
      return next(new AppError('Invalid email or password', 401, 'UNAUTHORIZED'));
    }

    // Update lastLoginAt
    user.lastLoginAt = new Date();
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, COOKIE_OPTIONS);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Returns currently logged-in user profile and their business memberships
 */
export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401, 'UNAUTHORIZED'));
    }

    // Query active business memberships and populate business details
    const memberships = await BusinessMember.find({
      userId: req.user._id,
      status: 'ACTIVE',
    }).populate('businessId', 'name displayName status');

    const businesses = memberships
      .filter((m) => m.businessId) // filter out orphaned records
      .map((m: any) => ({
        id: m.businessId._id,
        name: m.businessId.displayName || m.businessId.name,
        role: m.role,
        status: m.status,
      }));

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          phone: req.user.phone,
          status: req.user.status,
        },
        businesses,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Clears authentication session cookie
 */
export async function logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    });

    res.status(200).json({
      success: true,
      data: null,
    });
  } catch (error) {
    next(error);
  }
}
