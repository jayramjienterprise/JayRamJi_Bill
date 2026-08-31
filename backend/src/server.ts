import app from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './database/db';

console.log('REAL-BOOT: server.ts started');
console.log(`REAL-BOOT: PORT=${env.PORT} | NODE_ENV=${env.NODE_ENV}`);

// 1. Start Express listener immediately on 0.0.0.0
const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`REAL-BOOT: Express app listening on ${env.PORT}`);
  console.log(`🔗 Health check available at: http://localhost:${env.PORT}/api/health`);
});

server.on('error', (error) => {
  console.error('REAL-BOOT: HTTP SERVER ERROR', error);
});

// 2. Start MongoDB connection in background
console.log('REAL-BOOT: starting MongoDB connection');
connectDatabase()
  .then(() => {
    console.log('REAL-BOOT: MongoDB connected successfully');
  })
  .catch((dbErr) => {
    console.error('REAL-BOOT: MongoDB connection failed:', dbErr.message);
  });

// 3. Graceful Shutdown Routine
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

    setTimeout(() => {
      console.error('💥 Graceful shutdown timed out, force terminating.');
      process.exit(1);
    }, 10000);
  }
};

process.on('SIGINT', () => handleExit('SIGINT'));
process.on('SIGTERM', () => handleExit('SIGTERM'));

process.on('uncaughtException', (error) => {
  console.error('REAL-BOOT: UNCAUGHT EXCEPTION', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('REAL-BOOT: UNHANDLED REJECTION', reason);
});
