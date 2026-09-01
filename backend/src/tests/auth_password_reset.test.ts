import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// Mock DocumentGenerationService to bypass Puppeteer ESM loading issues in Jest
jest.mock('../services/DocumentGenerationService', () => {
  return {
    DocumentGenerationService: {
      generateDocuments: jest.fn().mockResolvedValue({}),
      generateBuffers: jest.fn().mockResolvedValue({}),
    },
  };
});

import app from '../app';
import { User } from '../database/models/User';
import { PasswordResetToken } from '../database/models/PasswordResetToken';
import { emailService } from '../services/EmailService';

jest.setTimeout(30000);

let testUser: any;
const testEmail = 'operator.reset@example.com';
const originalPassword = 'InitialPassword123!';
const newPassword = 'NewSecretPassword456!';

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/jayramji_bill_test');
  }
});

afterAll(async () => {
  await PasswordResetToken.deleteMany({});
  await User.deleteMany({ email: testEmail });
  await mongoose.connection.close();
});

beforeEach(async () => {
  await PasswordResetToken.deleteMany({});
  await User.deleteMany({ email: testEmail });

  const passwordHash = await bcrypt.hash(originalPassword, 10);
  testUser = await User.create({
    name: 'Reset Test Operator',
    email: testEmail,
    passwordHash,
    status: 'ACTIVE',
  });

  // Spy on emailService
  jest.spyOn(emailService, 'sendPasswordResetEmail').mockResolvedValue(true);
});

describe('Forgot Password & Password Reset Flow', () => {
  describe('POST /api/auth/forgot-password', () => {
    it('should return generic success message and create hashed reset token for existing user', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testEmail });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('receive a password reset link');

      // Verify token record in database
      const resetRecord = await PasswordResetToken.findOne({ userId: testUser._id });
      expect(resetRecord).toBeTruthy();
      expect(resetRecord?.usedAt).toBeNull();
      expect(resetRecord?.expiresAt.getTime()).toBeGreaterThan(Date.now());

      // Verify email service was called
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        testEmail,
        expect.stringContaining('/reset-password?token='),
        'Reset Test Operator'
      );
    });

    it('should return the same generic success message for non-existent email without creating tokens', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent.user@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toContain('receive a password reset link');

      const count = await PasswordResetToken.countDocuments();
      expect(count).toBe(0);
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should reject invalid email formats', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should successfully reset password with valid token and allow login with new password', async () => {
      // 1. Generate token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await PasswordResetToken.create({
        userId: testUser._id,
        tokenHash,
        expiresAt,
      });

      // 2. Submit reset password
      const resetRes = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          password: newPassword,
          confirmPassword: newPassword,
        });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);
      expect(resetRes.body.data.message).toContain('Password updated successfully');

      // 3. Verify token is marked as used
      const updatedRecord = await PasswordResetToken.findOne({ tokenHash });
      expect(updatedRecord?.usedAt).toBeTruthy();

      // 4. Verify old password fails on login
      const oldLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: originalPassword,
        });
      expect(oldLoginRes.status).toBe(401);

      // 5. Verify new password succeeds on login
      const newLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: newPassword,
        });
      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body.success).toBe(true);
    });

    it('should reject already-used tokens', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await PasswordResetToken.create({
        userId: testUser._id,
        tokenHash,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        usedAt: new Date(), // Already used
      });

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          password: newPassword,
          confirmPassword: newPassword,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TOKEN_ALREADY_USED');
    });

    it('should reject expired tokens', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      await PasswordResetToken.create({
        userId: testUser._id,
        tokenHash,
        expiresAt: new Date(Date.now() - 5000), // Expired 5 seconds ago
      });

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: rawToken,
          password: newPassword,
          confirmPassword: newPassword,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    });

    it('should reject invalid or fabricated tokens', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'non_existent_fake_random_token_1234567890',
          password: newPassword,
          confirmPassword: newPassword,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_OR_EXPIRED_TOKEN');
    });

    it('should reject mismatched passwords', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'some_token',
          password: 'PasswordA123',
          confirmPassword: 'PasswordB456',
        });

      expect(res.status).toBe(400);
    });

    it('should reject passwords shorter than 6 characters', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'some_token',
          password: '123',
          confirmPassword: '123',
        });

      expect(res.status).toBe(400);
    });
  });
});
