import mongoose from 'mongoose';
import { env } from '../config/env';

let cachedPromise: Promise<typeof mongoose> | null = null;

/**
 * Establishes connection to MongoDB database with connection state caching
 */
export async function connectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 1) {
    return;
  }
  if (mongoose.connection.readyState === 2 && cachedPromise) {
    await cachedPromise;
    return;
  }

  const uri = env.MONGODB_URI;

  // Set up connection event listeners once
  if (mongoose.connection.listenerCount('connected') === 0) {
    mongoose.connection.on('connected', () => {
      const maskedUri = uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
      console.log(`🔌 MongoDB connected successfully to: ${maskedUri}`);
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error occurred:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB connection was disconnected');
    });
  }

  try {
    cachedPromise = mongoose.connect(uri, {
      autoIndex: env.NODE_ENV === 'development',
      serverSelectionTimeoutMS: 10000,
    });
    await cachedPromise;
  } catch (error: any) {
    cachedPromise = null;
    console.error('❌ Initial MongoDB connection failure:', error.message);
    throw error;
  }
}

/**
 * Closes the database connection cleanly
 */
export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.disconnect();
      console.log('🔌 MongoDB connection closed cleanly');
    } catch (error) {
      console.error('❌ Error during MongoDB disconnection:', error);
    }
  }
}
