import '../src/docs/zod-extend';
import app from '../src/app';
import { getOpenApiDocument } from '../src/docs';

interface RouteInfo {
  method: string;
  path: string;
}

function normalizeExpressPath(path: string): string {
  // Convert /path/:param to /path/{param}
  // Convert /path/:param? to /path/{param}
  // Strip trailing slashes unless it's root
  const converted = path.replace(/:([a-zA-Z0-9_]+)\??/g, '{$1}');
  if (converted.length > 1 && converted.endsWith('/')) {
    return converted.slice(0, -1);
  }
  return converted;
}

interface Layer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
  };
  name?: string;
  handle?: {
    stack?: Layer[];
  };
  regexp?: {
    source: string;
    fast_slash?: boolean;
  };
}

function extractRoutes(stack: Layer[], prefix = ''): RouteInfo[] {
  const routes: RouteInfo[] = [];

  for (const layer of stack) {
    if (layer.route) {
      let routePath = prefix + layer.route.path;
      routePath = routePath.replace(/\/+/g, '/');
      routePath = normalizeExpressPath(routePath);
      for (const method of Object.keys(layer.route.methods)) {
        if (layer.route.methods[method]) {
          routes.push({
            method: method.toUpperCase(),
            path: routePath,
          });
        }
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      let routerPrefix = '';
      if (layer.regexp && !layer.regexp.fast_slash) {
        let match = layer.regexp.source
          .replace('^\\', '')
          .replace('\\/?(?=\\/|$)', '')
          .replace('^', '')
          .replace('/?(?=/|$)', '')
          .replace(/\(\?=\/\|\$\)/g, '')
          .replace(/\/\?\(\?=\/\|\$\)/g, '')
          .replace(/\\\//g, '/');

        if (match.startsWith('/?')) match = match.slice(2);
        if (match.endsWith('/?')) match = match.slice(0, -2);

        if (match && match !== '' && match !== '/' && !match.startsWith('(?=')) {
          routerPrefix = match;
          if (!routerPrefix.startsWith('/')) {
            routerPrefix = `/${routerPrefix}`;
          }
          if (routerPrefix.endsWith('/')) {
            routerPrefix = routerPrefix.slice(0, -1);
          }
        }
      }
      routes.push(...extractRoutes(layer.handle.stack, prefix + routerPrefix));
    }
  }

  return routes;
}

async function runDocsCheck() {
  console.log('--- Checking OpenAPI Route Coverage ---');

  const expressRoutes = extractRoutes(app._router.stack);

  // Filter out internal docs routes if any
  const filteredExpressRoutes = expressRoutes.filter(
    (r) => !r.path.startsWith('/docs') && r.path !== '/openapi.json',
  );

  const openApiDoc = getOpenApiDocument();
  const openApiPaths = openApiDoc.paths || {};

  const openApiRoutes: RouteInfo[] = [];
  for (const [path, methods] of Object.entries(openApiPaths)) {
    for (const method of Object.keys(methods as object)) {
      openApiRoutes.push({
        method: method.toUpperCase(),
        path: normalizeExpressPath(path),
      });
    }
  }

  console.log(`Found ${filteredExpressRoutes.length} Express routes`);
  console.log(`Found ${openApiRoutes.length} OpenAPI documented endpoints`);

  const missingInDocs: RouteInfo[] = [];

  for (const expRoute of filteredExpressRoutes) {
    const isDocumented = openApiRoutes.some(
      (docRoute) => docRoute.method === expRoute.method && docRoute.path === expRoute.path,
    );

    if (!isDocumented) {
      missingInDocs.push(expRoute);
    }
  }

  if (missingInDocs.length > 0) {
    console.error('\n❌ MISSING ROUTES IN OPENAPI SPEC:');
    for (const missing of missingInDocs) {
      console.error(`  - ${missing.method.padEnd(7)} ${missing.path}`);
    }
    console.error(`\nTotal missing routes: ${missingInDocs.length}`);
    process.exit(1);
  }

  console.log('\n✅ All Express routes are fully documented in the OpenAPI specification!');
  console.log(`Total documented endpoints: ${openApiRoutes.length}`);
  process.exit(0);
}

runDocsCheck().catch((err) => {
  console.error('Docs check failed with error:', err);
  process.exit(1);
});
