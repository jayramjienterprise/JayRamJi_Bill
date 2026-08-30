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

if (!parsed.success) {
  console.error('❌ Environment validation failed:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

const validatedEnv = parsed.data;

// Automatically isolate automated test runs into a dedicated test database
if (process.env.NODE_ENV === 'test') {
  if (process.env.TEST_MONGODB_URI) {
    validatedEnv.MONGODB_URI = process.env.TEST_MONGODB_URI;
  } else if (!validatedEnv.MONGODB_URI.includes('_test')) {
    validatedEnv.MONGODB_URI = validatedEnv.MONGODB_URI.replace(/\/?$/, '') + '_test';
  }
}

export const env = validatedEnv;
export type Env = z.infer<typeof envSchema>;
