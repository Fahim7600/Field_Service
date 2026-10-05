import fs from 'node:fs';
import path from 'node:path';
import Converter from 'openapi-to-postmanv2';
import { getOpenApiDocument } from '../src/docs';

const targetDir = path.join(__dirname, '../postman');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// 1. Create Postman Environment
const postmanEnvironment = {
  id: 'field-service-env-001',
  name: 'Field Service Environment',
  values: [
    {
      key: 'baseUrl',
      value: 'http://localhost:5000',
      type: 'default',
      enabled: true,
    },
    {
      key: 'accessToken',
      value: '',
      type: 'secret',
      enabled: true,
    },
    {
      key: 'refreshToken',
      value: '',
      type: 'secret',
      enabled: true,
    },
    {
      key: 'serviceRequestId',
      value: '',
      type: 'default',
      enabled: true,
    },
    {
      key: 'workOrderId',
      value: '',
      type: 'default',
      enabled: true,
    },
    {
      key: 'invoiceId',
      value: '',
      type: 'default',
      enabled: true,
    },
    {
      key: 'technicianId',
      value: '',
      type: 'default',
      enabled: true,
    },
    {
      key: 'customerId',
      value: '',
      type: 'default',
      enabled: true,
    },
  ],
  _postman_variable_scope: 'environment',
  _postman_exported_at: new Date().toISOString(),
};

const envPath = path.join(targetDir, 'Field_Service.postman_environment.json');
fs.writeFileSync(envPath, `${JSON.stringify(postmanEnvironment, null, 2)}\n`, 'utf-8');
console.log('✅ Created postman/Field_Service.postman_environment.json');

// 2. Generate Postman Collection from OpenAPI spec
const openApiDoc = getOpenApiDocument();

Converter.convert(
  {
    type: 'json',
    data: openApiDoc,
  },
  {
    folderStrategy: 'Tags',
    includeAuthInfoInExample: true,
    requestParametersResolution: 'Example',
  },
  (err, conversionResult) => {
    if (err || !conversionResult.result) {
      console.error(
        '❌ Failed to convert OpenAPI spec to Postman collection:',
        err || conversionResult.reason,
      );
      process.exit(1);
    }

    const collection = conversionResult.output[0].data;

    // Set Collection Info
    collection.info.name = 'Field Service Management API';
    collection.info.description =
      'Comprehensive Postman Collection for Field Service Management System.';

    // Set Collection-level Bearer Auth
    collection.auth = {
      type: 'bearer',
      bearer: [
        {
          key: 'token',
          value: '{{accessToken}}',
          type: 'string',
        },
      ],
    };

    interface PostmanItem {
      name?: string;
      item?: PostmanItem[];
      request?: {
        url?: string | { host?: string[]; raw?: string };
      };
      event?: Array<{
        listen: string;
        script: {
          type: string;
          exec: string[];
        };
      }>;
    }

    // Helper: recursively inspect items
    function processItems(items: PostmanItem[]) {
      for (const item of items) {
        if (item.request) {
          // Replace hardcoded localhost / host with {{baseUrl}}
          if (item.request.url) {
            if (typeof item.request.url === 'string') {
              item.request.url = item.request.url.replace(/https?:\/\/[^/]+/g, '{{baseUrl}}');
            } else if (item.request.url.host) {
              item.request.url.raw = (item.request.url.raw || '').replace(
                /https?:\/\/[^/]+/g,
                '{{baseUrl}}',
              );
              item.request.url.host = ['{{baseUrl}}'];
            }
          }

          // Inject test scripts for login / register / refresh to save tokens
          const name = (item.name || '').toLowerCase();
          const pathStr =
            typeof item.request.url === 'string'
              ? item.request.url.toLowerCase()
              : (item.request.url?.raw || '').toLowerCase();

          if (
            name.includes('login') ||
            pathStr.includes('/auth/login') ||
            name.includes('register') ||
            pathStr.includes('/auth/register') ||
            name.includes('refresh') ||
            pathStr.includes('/auth/refresh')
          ) {
            item.event = [
              {
                listen: 'test',
                script: {
                  type: 'text/javascript',
                  exec: [
                    'if (pm.response.code === 200 || pm.response.code === 201) {',
                    '    var jsonData = pm.response.json();',
                    '    if (jsonData.data) {',
                    '        if (jsonData.data.accessToken) {',
                    '            pm.environment.set("accessToken", jsonData.data.accessToken);',
                    '            console.log("accessToken saved to environment");',
                    '        }',
                    '        if (jsonData.data.refreshToken) {',
                    '            pm.environment.set("refreshToken", jsonData.data.refreshToken);',
                    '            console.log("refreshToken saved to environment");',
                    '        }',
                    '    }',
                    '}',
                  ],
                },
              },
            ];
          }
        }

        if (item.item && Array.isArray(item.item)) {
          processItems(item.item);
        }
      }
    }

    processItems(collection.item);

    // Desired flow ordering
    const folderOrder = [
      'Auth',
      'Technician Applications',
      'Catalog',
      'Service Requests',
      'Dispatch',
      'Work Orders',
      'Invoices',
      'Payments',
      'Subscriptions',
      'Feedback',
      'Admin',
      'Users',
      'Technicians',
      'Notifications',
      'Analytics',
      'Audit Logs',
      'Health',
    ];

    if (Array.isArray(collection.item)) {
      collection.item.sort((a: PostmanItem, b: PostmanItem) => {
        const indexA = folderOrder.indexOf(a.name || '');
        const indexB = folderOrder.indexOf(b.name || '');
        const posA = indexA === -1 ? 999 : indexA;
        const posB = indexB === -1 ? 999 : indexB;
        return posA - posB;
      });
    }

    const collectionPath = path.join(targetDir, 'Field_Service.postman_collection.json');
    fs.writeFileSync(collectionPath, `${JSON.stringify(collection, null, 2)}\n`, 'utf-8');
    console.log('✅ Created postman/Field_Service.postman_collection.json');
    process.exit(0);
  },
);
