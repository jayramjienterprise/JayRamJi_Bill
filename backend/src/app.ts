import express, { Express, Router } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';

const app: Express = express();

// Security Middlewares & Headers Configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [env.FRONTEND_URL];
      // In development mode, also permit local addresses
      if (env.NODE_ENV === 'development') {
        allowedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000');
      }

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS policy'));
      }
    },
    credentials: true,
  })
);

// Standard HTTP security response headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  next();
});

// Body parsers with payload restrictions (max 10MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Dev HTTP Logger
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ----------------------------------------------------
// Health Endpoint (Directly accessible on base app)
// ----------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
    },
  });
});

// ----------------------------------------------------
// Modular Routing Architecture Foundation
// ----------------------------------------------------
const apiRouter = Router();

/* FUTURE MODULE ATTACHMENTS (to be implemented in subsequent phases):
 *
 * Auth Module (Phase 2):
 * apiRouter.use('/auth', authRouter);
 *
 * Business Settings Module (Phase 3):
 * apiRouter.use('/business', businessRouter);
 *
 * Assets Storage Module (Phase 3):
 * apiRouter.use('/assets', assetsRouter);
 *
 * Customers Module (Phase 4):
 * apiRouter.use('/customers', customersRouter);
 *
 * Products & Services Module (Phase 5):
 * apiRouter.use('/products', productsRouter);
 *
 * Invoices Module (Phase 6 & 7):
 * apiRouter.use('/invoices', invoicesRouter);
 *
 * Dashboard Summary Module (Phase 8):
 * apiRouter.use('/dashboard', dashboardRouter);
 *
 * Analytics Module (Phase 9):
 * apiRouter.use('/analytics', analyticsRouter);
 *
 * Public Client Shared View (Phase 10):
 * apiRouter.use('/public', publicRouter);
 */

app.use('/api', apiRouter);

// ----------------------------------------------------
// Catch-All 404 Route handler
// ----------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `The endpoint ${req.method} ${req.path} does not exist on this server.`,
      details: {},
    },
  });
});

// ----------------------------------------------------
// Global Central Error Handler Middleware
// ----------------------------------------------------
app.use(errorHandler);

export default app;
