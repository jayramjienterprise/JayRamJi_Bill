import mongoose from 'mongoose';
import { env } from '../config/env';

/**
 * Establishes connection to MongoDB database
 */
export async function connectDatabase(): Promise<void> {
  const uri = env.MONGODB_URI;

  // Set up connection event listeners
  mongoose.connection.on('connected', () => {
    // Mask password in logs if present
    const maskedUri = uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
    console.log(`🔌 MongoDB connected successfully to: ${maskedUri}`);
  });

  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error occurred:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB connection was disconnected');
  });

  try {
    await mongoose.connect(uri, {
      autoIndex: env.NODE_ENV === 'development',
    });
  } catch (error) {
    console.error('❌ Initial MongoDB connection failure:', error);
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
