import './zod-extend';
import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import { env } from '../config/env';
import { registry } from './registry';
import { registerAdminDocs } from './routes/admin.docs';
import { registerAuthDocs } from './routes/auth.docs';
import { registerCatalogDocs } from './routes/catalog.docs';
import { registerFeedbackDocs } from './routes/feedback.docs';
import { registerHealthDocs } from './routes/health.docs';
import { registerInvoiceDocs } from './routes/invoice.docs';
import { registerNotificationDocs } from './routes/notification.docs';
import { registerPaymentDocs } from './routes/payment.docs';
import { registerServiceRequestDocs } from './routes/service-request.docs';
import { registerSubscriptionDocs } from './routes/subscription.docs';
import { registerTechnicianApplicationDocs } from './routes/technician-application.docs';
import { registerUserDocs } from './routes/user.docs';
import { registerWorkOrderDocs } from './routes/work-order.docs';

let initialized = false;

export const initDocs = () => {
  if (initialized) return;
  initialized = true;

  registerHealthDocs();
  registerAuthDocs();
  registerUserDocs();
  registerCatalogDocs();
  registerTechnicianApplicationDocs();
  registerServiceRequestDocs();
  registerWorkOrderDocs();
  registerInvoiceDocs();
  registerPaymentDocs();
  registerSubscriptionDocs();
  registerFeedbackDocs();
  registerNotificationDocs();
  registerAdminDocs();
};

export const getOpenApiDocument = () => {
  initDocs();

  const servers: { url: string; description?: string }[] = [];
  if (env.PUBLIC_BASE_URL) {
    servers.push({ url: env.PUBLIC_BASE_URL, description: 'Production server' });
  }
  servers.push({ url: `http://localhost:${env.PORT}`, description: 'Local development server' });

  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'Field Service Management API',
      version: '1.0.0',
      description:
        'RESTful API for the Field Service Management System. Provides comprehensive endpoints for customer self-service, technician job execution, dispatching, automated invoicing, payments, subscriptions, and administrative operations.',
    },
    servers,
    tags: [
      { name: 'Auth', description: 'Authentication and authorization endpoints' },
      { name: 'Users', description: 'User and Customer profile operations' },
      { name: 'Catalog', description: 'Skills and service categories catalog' },
      {
        name: 'Technician Applications',
        description: 'Technician onboarding and application reviews',
      },
      {
        name: 'Technicians',
        description: 'Technician profile, availability, and skill management',
      },
      { name: 'Service Requests', description: 'Customer service requests lifecycle' },
      { name: 'Dispatch', description: 'Admin dispatch queue and technician assignments' },
      { name: 'Work Orders', description: 'Work order state machine and execution' },
      { name: 'Invoices', description: 'Invoicing, discounts, and payments' },
      { name: 'Payments', description: 'Stripe payments and checkout sessions' },
      { name: 'Subscriptions', description: 'Premium subscription memberships and benefits' },
      { name: 'Feedback', description: 'Customer reviews and ratings' },
      { name: 'Notifications', description: 'In-app user notifications' },
      { name: 'Admin', description: 'Administrative user and platform management' },
      { name: 'Analytics', description: 'KPIs and technician performance metrics' },
      { name: 'Audit Logs', description: 'System-wide compliance audit trail' },
      { name: 'Health', description: 'Service health check endpoints' },
    ],
  });
};

export const createDocsRouter = (): Router => {
  const router = Router();
  const spec = getOpenApiDocument();

  router.get('/openapi.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(spec);
  });

  router.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'Field Service API Docs',
      swaggerOptions: {
        persistAuthorization: true,
      },
    }),
  );

  return router;
};
