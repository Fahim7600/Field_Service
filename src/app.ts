import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { notFound } from './middlewares/notFound';
import { generalRateLimiter } from './middlewares/rateLimiter';
import router from './routes';
import { ApiError } from './utils/apiError';

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet());

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
