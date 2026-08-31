import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().default(''),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  JWT_SECRET: z.string().default('development_jwt_signing_secret_key_1234567890'),
});

const parsed = envSchema.safeParse(process.env);

let validatedEnv: z.infer<typeof envSchema>;

if (!parsed.success) {
  console.warn('⚠️ Environment schema parsing warnings:');
  console.warn(JSON.stringify(parsed.error.format(), null, 2));
  validatedEnv = {
    PORT: Number(process.env.PORT) || 5000,
    NODE_ENV: (process.env.NODE_ENV as any) || 'development',
    MONGODB_URI: process.env.MONGODB_URI || '',
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || undefined,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || undefined,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || undefined,
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
    JWT_SECRET: process.env.JWT_SECRET || 'development_jwt_signing_secret_key_1234567890',
  };
} else {
  validatedEnv = parsed.data;
}

// Log missing production configurations without terminating the process
if (validatedEnv.NODE_ENV === 'production') {
  if (!validatedEnv.MONGODB_URI) {
    console.error('❌ CONFIG ERROR: MONGODB_URI is not set in production environment variables');
  }
  if (!validatedEnv.JWT_SECRET || validatedEnv.JWT_SECRET === 'development_jwt_signing_secret_key_1234567890') {
    console.warn('⚠️ CONFIG WARNING: JWT_SECRET is using default placeholder in production');
  }
  if (!validatedEnv.CLOUDINARY_CLOUD_NAME || !validatedEnv.CLOUDINARY_API_KEY || !validatedEnv.CLOUDINARY_API_SECRET) {
    console.warn('⚠️ CONFIG WARNING: Cloudinary credentials incomplete in production');
  }
} else if (validatedEnv.NODE_ENV === 'development') {
  if (!validatedEnv.MONGODB_URI) {
    validatedEnv.MONGODB_URI = 'mongodb://127.0.0.1:27017/jayramji_bill';
  }
}

// Automatically isolate automated test runs into a dedicated local test database
if (process.env.NODE_ENV === 'test') {
  validatedEnv.MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/jayramji_bill_test';
}

export const env = validatedEnv;
export type Env = z.infer<typeof envSchema>;
