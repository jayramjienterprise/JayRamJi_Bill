console.log('BOOT: server.js loaded');

// Register global diagnostic exception handlers
process.on('uncaughtException', (error) => {
  console.error('FATAL_UNCAUGHT_EXCEPTION', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('FATAL_UNHANDLED_REJECTION', reason);
});

import app from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './database/db';

console.log(`BOOT: SERVER_STARTING | PORT=${env.PORT} | NODE_ENV=${env.NODE_ENV}`);
console.log('BOOT: starting HTTP server');

// 1. Start Express listener immediately on 0.0.0.0
const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`BOOT: HTTP server listening on PORT ${env.PORT}`);
  console.log(`🔗 Health check available at: http://localhost:${env.PORT}/api/health`);
});

// 2. Start MongoDB connection in background without blocking or terminating the HTTP process
console.log('BOOT: starting MongoDB connection');
connectDatabase()
  .then(() => {
    console.log('BOOT: MongoDB connection established successfully');
  })
  .catch((dbErr) => {
    console.error('BOOT: MongoDB connection failed:', dbErr.message);
  });

// 3. Configure Graceful Shutdown Routine
const handleExit = async (signal: string) => {
  console.log(`\n⚠️ Process received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      console.log('🛑 Express HTTP server stopped receiving requests.');
      
      try {
        await disconnectDatabase();
        console.log('⚡ Application terminated cleanly.');
        process.exit(0);
      } catch (dbErr) {
        console.error('❌ Failed during database disconnect:', dbErr);
        process.exit(1);
      }
    });

    // If shutdown takes too long, force terminate after 10s
    setTimeout(() => {
      console.error('💥 Graceful shutdown timed out, force terminating.');
      process.exit(1);
    }, 10000);
  }
};

process.on('SIGINT', () => handleExit('SIGINT'));
process.on('SIGTERM', () => handleExit('SIGTERM'));
