import { OpenAPIRegistry, type RouteConfig } from '@asteasolutions/zod-to-openapi';

export const registry = new OpenAPIRegistry();

// Register Bearer Authentication
registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
  description: 'JWT Bearer token for authentication. Format: Bearer <token>',
});

export const registerRoute = (route: RouteConfig) => {
  registry.registerPath(route);
};
