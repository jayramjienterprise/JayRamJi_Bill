import express, { Express, Router } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import authRouter from './modules/auth/auth.routes';
import businessRouter from './modules/business/business.routes';
import customerRouter from './modules/customer/customer.routes';
import productRouter from './modules/product/product.routes';
import assetRouter from './modules/asset/asset.routes';
import invoiceRouter from './modules/invoice/invoice.routes';
import dashboardRouter from './modules/dashboard/dashboard.routes';
import analyticsRouter from './modules/analytics/analytics.routes';
import publicInvoiceRouter from './modules/invoice/public.routes';

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
app.use(cookieParser());
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

// Mount modules
apiRouter.use('/auth', authRouter);
apiRouter.use('/business', businessRouter);
apiRouter.use('/customers', customerRouter);
apiRouter.use('/products', productRouter);
apiRouter.use('/assets', assetRouter);
apiRouter.use('/invoices', invoiceRouter);
apiRouter.use('/dashboard', dashboardRouter);
apiRouter.use('/analytics', analyticsRouter);
apiRouter.use('/public/invoices', publicInvoiceRouter);

app.get('/health', async (_req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'UP',
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

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
