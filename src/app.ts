import cookieParser from 'cookie-parser';
import express from 'express';
import { errorHandler } from './middlewares/errorHandler';
import { notFound } from './middlewares/notFound';
import router from './routes';

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/api/v1', router);
app.use(notFound);
app.use(errorHandler);

export default app;
