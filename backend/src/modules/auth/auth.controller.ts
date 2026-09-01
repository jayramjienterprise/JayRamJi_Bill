import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { z } from 'zod';
import { env } from '../../config/env';
import { User } from '../../database/models/User';
import { Business } from '../../database/models/Business';
import { BusinessMember } from '../../database/models/BusinessMember';
import { PasswordResetToken } from '../../database/models/PasswordResetToken';
import { emailService } from '../../services/EmailService';
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

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  confirmPassword: z.string().optional(),
}).refine((data) => !data.confirmPassword || data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
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

/**
 * Initiates password reset flow by sending a secure one-time link via Gmail SMTP
 * POST /api/auth/forgot-password
 */
export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validated = forgotPasswordSchema.parse(req.body);
    const emailNormalized = validated.email.toLowerCase().trim();

    const user = await User.findOne({ email: emailNormalized });

    if (user && user.status === 'ACTIVE') {
      // Generate cryptographically secure random token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes expiration

      // Invalidate any existing unused reset tokens for this user
      await PasswordResetToken.updateMany(
        { userId: user._id, usedAt: null },
        { usedAt: new Date() }
      );

      // Save hashed reset token record
      await PasswordResetToken.create({
        userId: user._id,
        tokenHash,
        expiresAt,
      });

      // Construct HTTPS reset URL
      const frontendUrl = env.FRONTEND_URL.replace(/\/$/, '');
      const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

      // Deliver password reset email via Gmail SMTP
      await emailService.sendPasswordResetEmail(user.email, resetUrl, user.name);
    }

    // Always return generic response to prevent email enumeration
    res.status(200).json({
      success: true,
      data: {
        message: "If an account exists for this email, you'll receive a password reset link.",
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Validates reset token and updates user password
 * POST /api/auth/reset-password
 */
export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validated = resetPasswordSchema.parse(req.body);

    const tokenHash = crypto.createHash('sha256').update(validated.token).digest('hex');
    const resetRecord = await PasswordResetToken.findOne({ tokenHash });

    if (!resetRecord) {
      return next(new AppError('This password reset link is invalid or has expired', 400, 'INVALID_OR_EXPIRED_TOKEN'));
    }

    if (resetRecord.usedAt !== null) {
      return next(new AppError('This password reset link has already been used', 400, 'TOKEN_ALREADY_USED'));
    }

    if (new Date() > resetRecord.expiresAt) {
      return next(new AppError('This password reset link has expired', 400, 'TOKEN_EXPIRED'));
    }

    const user = await User.findById(resetRecord.userId);
    if (!user) {
      return next(new AppError('User account associated with this token not found', 404, 'USER_NOT_FOUND'));
    }

    // Hash new password using bcrypt (standard 10 rounds)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(validated.password, saltRounds);

    user.passwordHash = passwordHash;
    await user.save();

    // Mark reset token as used
    resetRecord.usedAt = new Date();
    await resetRecord.save();

    // Invalidate existing sessions
    res.clearCookie('token', {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    });

    res.status(200).json({
      success: true,
      data: {
        message: 'Password updated successfully. You can now sign in with your new password.',
      },
    });
  } catch (error) {
    next(error);
  }
}
