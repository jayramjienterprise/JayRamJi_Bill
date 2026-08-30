import express, { Express, Router } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env';
import { connectDatabase } from './database/db';
import { errorHandler } from './middleware/errorHandler';

import authRouter from './modules/auth/auth.routes';
import businessRouter from './modules/business/business.routes';
import customerRouter from './modules/customer/customer.routes';
import productRouter from './modules/product/product.routes';
import assetRouter from './modules/asset/asset.routes';
import invoiceRouter from './modules/invoice/invoice.routes';
import paymentAccountRouter from './modules/payment-account/payment-account.routes';
import dashboardRouter from './modules/dashboard/dashboard.routes';
import analyticsRouter from './modules/analytics/analytics.routes';
import publicInvoiceRouter from './modules/invoice/public.routes';
import uploadSessionRouter from './modules/upload-session/upload-session.routes';

const app: Express = express();

// Auto-connect to database on incoming requests if disconnected
app.use((_req, _res, next) => {
  if (mongoose.connection.readyState === 0) {
    connectDatabase().catch((err) => {
      console.error('⚠️ On-demand MongoDB connection error:', err.message);
    });
  }
  next();
});

// Security Middlewares & Headers Configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [env.FRONTEND_URL];
      // Permit local addresses for dev
      allowedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://localhost:5000');

      // Check if origin matches allowed origins or is a vercel deployment domain
      const isVercelDomain = origin.endsWith('.vercel.app') || origin.includes('localhost');
      if (allowedOrigins.includes(origin) || isVercelDomain) {
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
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Dev HTTP Logger
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ----------------------------------------------------
// Health Endpoints
// ----------------------------------------------------
const healthHandler = async (_req: express.Request, res: express.Response) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      database: dbStatus,
      timestamp: new Date().toISOString(),
    },
  });
};

app.get('/api/health', healthHandler);
app.get('/api/backend/api/health', healthHandler);
app.get('/api/backend/health', healthHandler);
app.get('/health', healthHandler);

// ----------------------------------------------------
// Modular Routing Architecture Foundation
// ----------------------------------------------------
const apiRouter = Router();

// Mount modules
apiRouter.use('/auth', authRouter);
apiRouter.use('/business', businessRouter);
apiRouter.use('/customers', customerRouter);
apiRouter.use('/products', productRouter);
apiRouter.use('/assets', assetRouter);
apiRouter.use('/invoices', invoiceRouter);
apiRouter.use('/payment-accounts', paymentAccountRouter);
apiRouter.use('/upload-sessions', uploadSessionRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/analytics', analyticsRouter);
apiRouter.use('/public/invoices', publicInvoiceRouter);

// Support direct /api, same-domain proxy /api/backend/api, and /api/backend
app.use('/api', apiRouter);
app.use('/api/backend/api', apiRouter);
app.use('/api/backend', apiRouter);

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
