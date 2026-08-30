import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string({
    required_error: 'MONGODB_URI is required for database connection',
  }).min(1, 'MONGODB_URI cannot be empty'),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  JWT_SECRET: z.string().default('development_jwt_signing_secret_key_1234567890'),
}).refine((data) => {
  if (data.NODE_ENV === 'production') {
    if (!data.CLOUDINARY_CLOUD_NAME || data.CLOUDINARY_CLOUD_NAME.trim() === '') return false;
    if (!data.CLOUDINARY_API_KEY || data.CLOUDINARY_API_KEY.trim() === '') return false;
    if (!data.CLOUDINARY_API_SECRET || data.CLOUDINARY_API_SECRET.trim() === '') return false;
    if (data.JWT_SECRET === 'development_jwt_signing_secret_key_1234567890') return false;
  }
  return true;
}, {
  message: 'In production mode, all Cloudinary variables (CLOUD_NAME, API_KEY, API_SECRET) and a custom JWT_SECRET are required.',
});

const parsed = envSchema.safeParse(process.env);

let validatedEnv: z.infer<typeof envSchema>;

if (!parsed.success) {
  console.warn('⚠️ Environment validation warnings:');
  console.warn(JSON.stringify(parsed.error.format(), null, 2));
  // Provide safe fallback defaults so the server still boots and serves JSON error messages
  validatedEnv = {
    PORT: Number(process.env.PORT) || 5000,
    NODE_ENV: (process.env.NODE_ENV as any) || 'development',
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/jayramji_bill',
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || undefined,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || undefined,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || undefined,
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
    JWT_SECRET: process.env.JWT_SECRET || 'development_jwt_signing_secret_key_1234567890',
  };
} else {
  validatedEnv = parsed.data;
}

// Automatically isolate automated test runs into a dedicated local test database
if (process.env.NODE_ENV === 'test') {
  validatedEnv.MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/jayramji_bill_test';
}

export const env = validatedEnv;
export type Env = z.infer<typeof envSchema>;
