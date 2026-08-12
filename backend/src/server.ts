import app from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase } from './database/db';

/**
 * Boots the database connection and Express server
 */
async function bootstrap() {
  try {
    // 1. Establish database connection
    await connectDatabase();

    // 2. Start Express listener
    const server = app.listen(env.PORT, () => {
      console.log(
        `🚀 Server is running on port ${env.PORT} in ${env.NODE_ENV} mode`
      );
      console.log(`🔗 Health check available at: http://localhost:${env.PORT}/api/health`);
    });

    // 3. Configure Graceful Shutdown Routine
    const handleExit = async (signal: string) => {
      console.log(`\n⚠️ Process received ${signal}. Starting graceful shutdown...`);

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

      // If shutdown takes too long, force terminate
      setTimeout(() => {
        console.error('💥 Graceful shutdown timed out, force terminating.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => handleExit('SIGINT'));
    process.on('SIGTERM', () => handleExit('SIGTERM'));
  } catch (error) {
    console.error('💥 Application boot error:', error);
    process.exit(1);
  }
}

bootstrap();
