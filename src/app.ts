import './docs/zod-extend';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { createDocsRouter } from './docs';
import { errorHandler } from './middlewares/errorHandler';
import { notFound } from './middlewares/notFound';
import { generalRateLimiter } from './middlewares/rateLimiter';
import router from './routes';
import { ApiError } from './utils/apiError';
import { sendSuccess } from './utils/response';

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

// Relax CSP only for Swagger UI at /docs, keep strict helmet everywhere else
app.use((req, res, next) => {
  if (req.path.startsWith('/docs')) {
    helmet({
      contentSecurityPolicy: false,
    })(req, res, next);
  } else {
    helmet()(req, res, next);
  }
});

const allowedOrigins = env.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new ApiError(403, 'CORS origin not allowed'));
      }
    },
    credentials: true,
  }),
);

// Root entry / service directory
app.get('/', (_req, res) => {
  return sendSuccess(res, {
    message: 'Welcome to Field Service Management API',
    data: {
      name: 'Field Service Management API',
      version: '1.0.0',
      description: 'RESTful API for field service operations, dispatching, and invoicing',
      endpoints: {
        documentation: '/docs',
        openapiSpec: '/openapi.json',
        health: '/health',
        apiHealth: '/api/v1/health',
        apiBase: '/api/v1',
      },
    },
  });
});

// Health check endpoint for external monitors / Render health probe
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Swagger UI at /docs and raw OpenAPI JSON at /openapi.json
app.use(createDocsRouter());

// Raw body for Stripe webhook must come BEFORE express.json()
app.use('/api/v1/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// General rate limiter on /api/v1
app.use('/api/v1', generalRateLimiter);

app.use('/api/v1', router);
app.use(notFound);
app.use(errorHandler);

export default app;
