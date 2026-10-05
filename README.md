# Field Service Management System (Backend API)

A robust, enterprise-ready RESTful backend for managing end-to-end field service operations. It powers self-service customer requests, automated dispatching, technician scheduling and mobile reporting, dynamic invoice calculation, Stripe payment processing, and premium membership subscriptions.

---

## 1. Features by Role

### Customer
- **Authentication & Profile:** Email/password registration, login, token refresh, Google OAuth2 integration, and password change.
- **Service Catalog:** Browse service categories and base pricing.
- **Service Requests:** Submit maintenance requests with description, preferred schedule date/time, and photo attachments (via Cloudinary).
- **Work Orders & Tracking:** View live status transitions, cancel, or reschedule appointments.
- **Invoices & Payments:** Review itemized invoices (labor, parts, discounts, taxes) and pay securely via Stripe Checkout.
- **Feedback & Reviews:** Rate completed jobs (1–5 stars) and write technician reviews.
- **Technician Application:** Apply to become an onboarded technician directly from a customer account.
- **Premium Memberships:** Subscribe to monthly or yearly plans to unlock VIP benefits.
- **Notifications:** Receive in-app notifications and email alerts for all status updates.

### Technician
- **Onboarding & Profile:** Automated profile creation upon admin approval, skill set configuration, and experience bio.
- **Job Management:** View assigned work orders in personal queue, accept assignments, or reject with reason.
- **Status Workflow:** Transition jobs through structured phases: `EN_ROUTE` -> `ON_SITE` -> `IN_PROGRESS` -> `COMPLETED` (or `ON_HOLD`).
- **Service Reporting:** Submit final service reports detailing labor hours, parts consumed, and completion photos.
- **Schedule:** View upcoming scheduled appointments and availability.

### Admin
- **Dispatch Queue:** Smart priority queue displaying pending requests, with automatic prioritization for premium customers.
- **Technician Assignment:** Match service requests to available technicians by required skill set and proximity.
- **Application Review:** Review technician applications with uploaded identification documents; approve (with auto-generated temporary credentials) or reject with reason.
- **Catalog Management:** Add, edit, or remove skills and service categories.
- **Invoices & Adjustments:** Create manual invoices, adjust draft invoices, send reminders, void disputed bills, and run late fee jobs.
- **Payments & Refunds:** View transactions and issue full or partial refunds directly via Stripe.
- **User Management:** Manage roles (`CUSTOMER`, `TECHNICIAN`, `ADMIN`) and account statuses (`ACTIVE`, `INACTIVE`, `SUSPENDED`).
- **Analytics & Reporting:** Dashboard KPIs (revenue, completed jobs, active work orders) and technician performance analytics.
- **Audit Logs:** Immutable audit log trail for all critical administrative and financial actions.

---

## 2. Premium Benefits

Customers can upgrade to a **Premium Membership** (available as Monthly or Yearly subscriptions) to receive exclusive perks:
- **Priority Dispatch Queue:** Service requests submitted by premium members are flagged and prioritized at the top of the admin dispatch queue.
- **Invoice Service Fee Discount:** Automatic discount applied to service fees on generated invoices.
- **Free Reschedule & Cancellation:** Exemption from standard cancellation and late rescheduling penalty fees.
- **Flexible Billing:** Monthly (`$5.00/mo`) and Yearly (`$50.00/yr`) plans with automatic renewal and self-service cancellation.

---

## 3. Tech Stack

- **Runtime:** Node.js (v20+) with TypeScript (strict mode, CommonJS output)
- **Framework:** Express 4
- **Database & ORM:** PostgreSQL with Prisma ORM 6 (multi-file schema)
- **Validation:** Zod 4 (single source of truth for validation and OpenAPI schemas)
- **Caching & Rate Limiting:** Redis (via `ioredis` with fail-open resiliency), `express-rate-limit`, `rate-limit-redis`
- **Authentication:** JWT (short-lived access tokens + rotating refresh tokens), `bcryptjs`, `google-auth-library`
- **Payments & Billing:** Stripe SDK (Checkout sessions, Webhooks, Subscriptions)
- **File Storage:** Cloudinary (via `multer` memory storage)
- **Email Delivery:** Nodemailer (SMTP / Gmail)
- **API Documentation:** OpenAPI 3.0 via `@asteasolutions/zod-to-openapi`, Swagger UI (`swagger-ui-express`), Postman Collection v2.1 (`openapi-to-postmanv2`)
- **Linting & Formatting:** Biome

---

## 4. Project Structure

```
Field_Service/
├── prisma/
│   ├── schema/              # Modular Prisma schema files (*.prisma)
│   ├── migrations/          # SQL migration history
│   └── seed.ts              # Idempotent database seeder
├── postman/
│   ├── Field_Service.postman_collection.json
│   └── Field_Service.postman_environment.json
├── scripts/
│   ├── docs-check.ts        # Route coverage vs OpenAPI comparator
│   ├── generate-postman.ts  # Postman collection & environment generator
│   ├── test-all.ts          # Comprehensive test runner (12 suites)
│   ├── test-premium-cache.ts# Redis cache unit tests
│   └── test-rate-limit.ts   # Rate limiting integration tests
├── src/
│   ├── config/              # Environment variables & Prisma client instance
│   ├── controllers/         # Express request handlers
│   ├── docs/                # OpenAPI spec generators, route definitions & Swagger UI
│   ├── jobs/                # Background cron/interval jobs (e.g. auto-close)
│   ├── lib/                 # Shared utilities (Redis client, Cloudinary, Mailer)
│   ├── middlewares/         # Auth, RBAC, Validation, Error Handling, Rate Limiter
│   ├── routes/              # Express API route declarations
│   ├── services/            # Core business logic & state machine engines
│   ├── utils/               # Response formatters, ApiError, Audit logger
│   ├── validators/          # Zod validation schemas
│   ├── app.ts               # Express application configuration
│   └── server.ts            # Server entry point & graceful shutdown
├── biome.json               # Biome linter/formatter configuration
├── package.json
└── tsconfig.json
```

---

## 5. Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/Fahim7600/Field_Service.git
cd Field_Service
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup environment variables
Copy `.env.example` to `.env` and fill in your configuration:
```bash
cp .env.example .env
```

### 4. Run database migrations
```bash
npm run db:migrate
```

### 5. Seed initial database data
```bash
npm run db:seed
```

### 6. Start development server
```bash
npm run dev
```
The server will start on `http://localhost:5000`.

---

## 6. Environment Variables

| Variable | Type | Description |
|---|---|---|
| `NODE_ENV` | Optional | Environment mode (`development`, `production`, `test`). Default: `development` |
| `PORT` | Optional | Port on which the Express server listens. Default: `5000` |
| `DATABASE_URL` | **Required** | PostgreSQL connection string (supports Prisma Postgres / pooled connections) |
| `ADMIN_NAME` | Optional | Default admin name for database seeding |
| `ADMIN_EMAIL` | Optional | Default admin email for database seeding |
| `ADMIN_PASSWORD` | Optional | Default admin password for database seeding (min 8 chars) |
| `JWT_ACCESS_SECRET` | **Required** | 32+ character secret for signing short-lived JWT access tokens |
| `JWT_REFRESH_SECRET`| **Required** | 32+ character secret for signing JWT refresh tokens (must differ from access secret) |
| `JWT_ACCESS_EXPIRES_MINUTES` | Optional | Access token expiration duration in minutes. Default: `15` |
| `JWT_REFRESH_EXPIRES_DAYS` | Optional | Refresh token expiration duration in days. Default: `7` |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth 2.0 Client Secret |
| `GOOGLE_CALLBACK_URL` | Optional | Google OAuth redirect callback URL |
| `SMTP_HOST` | Optional | SMTP mail server hostname. Default: `smtp.gmail.com` |
| `SMTP_PORT` | Optional | SMTP mail server port. Default: `465` |
| `SMTP_USER` | Optional | SMTP username / email address |
| `SMTP_PASS` | Optional | SMTP password / app-specific password |
| `MAIL_FROM` | Optional | Default "From" email header |
| `CLOUDINARY_CLOUD_NAME` | Optional | Cloudinary cloud account name |
| `CLOUDINARY_API_KEY` | Optional | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Optional | Cloudinary API secret |
| `FRONTEND_URL` | Optional | Frontend application URL for redirection. Default: `http://localhost:3000` |
| `STRIPE_SECRET_KEY` | Optional | Stripe secret API key (`sk_test_...` or `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Optional | Stripe webhook signing secret (`whsec_...`) |
| `PUBLIC_API_URL` | Optional | Public URL of this API for webhooks/callbacks |
| `PUBLIC_BASE_URL` | Optional | Base URL displayed in OpenAPI servers list |
| `TAX_PERCENT` | Optional | Percentage tax rate applied to invoices (0–100). Default: `0` |
| `STRIPE_PRICE_MONTHLY` | Optional | Stripe Price ID for monthly recurring premium plan |
| `STRIPE_PRICE_YEARLY` | Optional | Stripe Price ID for yearly recurring premium plan |
| `REDIS_URL` | Optional | Redis connection URL (`redis://` or `rediss://`). If omitted, caching fails open |
| `RATE_LIMIT_ENABLED` | Optional | Toggle rate limiting (`true` / `false`). Default: `true` |
| `CORS_ORIGINS` | Optional | Comma-separated list of allowed CORS origins. Default: `http://localhost:3000` |

---

## 7. NPM Scripts

| Script | Command | Purpose |
|---|---|---|
| `npm run dev` | `tsx watch src/server.ts` | Starts the development server with live reload |
| `npm run build` | `tsc` | Compiles TypeScript source to CommonJS in `dist/` |
| `npm start` | `node dist/server.js` | Starts compiled production server |
| `npm run lint` | `biome lint .` | Runs Biome code quality linter |
| `npm run format` | `biome format --write .` | Formats all codebase files with Biome |
| `npm run check` | `biome check .` | Runs Biome linting, formatting and imports check |
| `npm run test:all` | `tsx scripts/test-all.ts` | Executes all 12 end-to-end and functional test suites |
| `npm run test:cache` | `tsx scripts/test-premium-cache.ts` | Runs Redis premium caching test suite |
| `npm run test:rate-limit` | `tsx scripts/test-rate-limit.ts` | Runs strict & general rate limiter verification |
| `npm run docs:check` | `tsx scripts/docs-check.ts` | Validates 100% route coverage in OpenAPI spec |
| `npm run docs:postman` | `tsx scripts/generate-postman.ts` | Generates Postman collection & environment files |
| `npm run render:build` | `npm ci ... && npm run build` | Render deployment build command |
| `npm run render:start` | `node dist/server.js` | Render deployment start command |
| `npm run db:generate` | `prisma generate` | Generates Prisma client bindings |
| `npm run db:migrate` | `prisma migrate dev` | Creates and applies new database migrations |
| `npm run db:deploy` | `prisma migrate deploy` | Applies pending migrations in production |
| `npm run db:seed` | `prisma db seed` | Seeds database with admin, skills, categories, plans |
| `npm run db:studio` | `prisma studio` | Opens Prisma Web GUI database viewer |

---

## 8. API Documentation & Postman

- **Swagger UI Interactive Documentation:** [`/docs`](http://localhost:5000/docs)
- **Raw OpenAPI 3.0 Specification:** [`/openapi.json`](http://localhost:5000/openapi.json)
- **Postman Collection:** Located at `postman/Field_Service.postman_collection.json`
- **Postman Environment:** Located at `postman/Field_Service.postman_environment.json`

### Using Postman:
1. Import both the collection and environment into Postman.
2. Select the **Field Service Environment**.
3. Run the **Auth -> Login** request. The test script will automatically extract `accessToken` and `refreshToken` and store them in the environment.
4. All subsequent secured requests automatically use `{{accessToken}}` via collection-level Bearer authentication.

---

## 9. Main Workflow Step-by-Step

### A. Technician Onboarding Flow
1. **Application Submission:** A registered customer submits a technician application (`POST /api/v1/technician-applications`) with bio, experience years, skill IDs, and an ID document upload.
2. **Admin Review:** Admin views pending applications (`GET /api/v1/admin/technician-applications`) and inspects credentials.
3. **Approval:** Admin approves the application (`PATCH /api/v1/admin/technician-applications/:id/approve`). The system:
   - Upgrades user role to `TECHNICIAN`.
   - Generates a secure temporary password.
   - Creates the `TechnicianProfile` and skill mappings.
   - Emails login credentials to the technician.
4. **First Login:** Technician logs in (`POST /api/v1/auth/login`) with `mustChangePassword: true` and updates password (`PATCH /api/v1/auth/change-password`).

### B. Service Request to Payment Flow
1. **Creation:** Customer creates a service request (`POST /api/v1/service-requests`) selecting category, preferred date, and optional photos.
2. **Review & Dispatch:** Admin reviews the request (`PATCH /api/v1/admin/service-requests/:id/review` with action `APPROVE`). A `WorkOrder` is created in `APPROVED` status.
3. **Assignment:** Admin queries available technicians (`GET /api/v1/admin/technicians/available`) and assigns a technician (`POST /api/v1/work-orders/:id/assign`).
4. **Technician Acceptance:** Technician accepts the assignment (`POST /api/v1/work-orders/:id/accept`). Status moves to `ACCEPTED`.
5. **Execution:** Technician updates progress status (`PATCH /api/v1/work-orders/:id/status`): `EN_ROUTE` -> `ON_SITE` -> `IN_PROGRESS` -> `COMPLETED`.
6. **Service Report & Invoicing:** Technician submits service report (`POST /api/v1/work-orders/:id/service-report`) with labor hours and parts used. System creates an itemized draft `Invoice`.
7. **Payment:** Customer initiates payment (`POST /api/v1/payments/initiate`), completes Stripe Checkout, and Stripe webhook triggers `checkout.session.completed`, marking invoice `PAID` and work order `CLOSED`.
8. **Feedback:** Customer rates the technician (`POST /api/v1/work-orders/:id/feedback`).

### C. Premium Subscription Flow
1. **Browse Plans:** Customer views active subscription plans (`GET /api/v1/subscription-plans`).
2. **Checkout:** Customer initiates subscription checkout (`POST /api/v1/subscriptions/checkout`).
3. **Webhook Activation:** Stripe processes recurring payment; webhook synchronizes customer membership status and invalidates cache.
4. **Instant Perks:** Immediate priority dispatch in queue, invoice discounts, and free reschedule/cancellation privileges.

---

## 10. Testing

Run all test suites locally with a single command:
```bash
npm run test:all
```
This runs 12 test suites sequentially:
1. `auth` (Registration, login, refresh tokens, password change)
2. `profile` (Customer and technician profile management)
3. `catalog` (Skills and categories management)
4. `technician` (Application onboarding and review)
5. `service-request` (Request creation, search, attachments)
6. `dispatch` (Priority queue and assignments)
7. `work-order` (State transitions and service report)
8. `invoice` (Calculation, items, discounts, late fee job)
9. `payment` (Stripe checkout session and webhook verification)
10. `subscription` (Plan listing, checkout, and cancellation)
11. `redis-premium-cache` (Redis caching and invalidation)
12. `rate-limit` (Strict auth limiter and general limiter)

---

## 11. Stripe Integration Setup

1. **Products & Prices:** Create recurring prices in your Stripe Dashboard for Premium Monthly and Premium Yearly, and add the price IDs to `STRIPE_PRICE_MONTHLY` and `STRIPE_PRICE_YEARLY`.
2. **Webhook Endpoint:** Configure Stripe Webhooks pointing to `https://<your-domain>/api/v1/payments/webhook` with the following event listeners:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

---

## 12. Redis Behavior & Fail-Open Architecture

- **Fail-Open Design:** If Redis is down, unreachable, or `REDIS_URL` is omitted, the backend logs a single warning and continues functioning normally by falling back to database queries.
- **Cache Invalidation:** Customer premium status is cached with a 5-minute TTL (`premium:{userId}`) and automatically invalidated upon:
  - Stripe webhook subscription sync
  - Customer subscription cancellation
  - Admin role / user modifications

---

## 13. Security Hardening

- **Security Headers:** Enforced using `helmet` with custom Content Security Policy relaxation strictly limited to `/docs`.
- **CORS Protection:** Configurable allowlist via `CORS_ORIGINS` with `credentials: true`.
- **Rate Limiting:**
  - **Strict limiter:** 10 requests / 15 minutes on sensitive authentication routes (`/register`, `/login`, `/refresh-token`, `/google`, `/change-password`).
  - **General limiter:** 100 requests / 1 minute on standard API endpoints.
  - Excluded paths: Stripe Webhooks (`/api/v1/payments/webhook`), `/health`, `/docs`.
- **Body Size Limitation:** JSON bodies restricted to `100kb` to prevent payload memory exhaustion.
- **Error Sanitization:** Passwords, bearer tokens, and internal stack traces are redacted from logs and client responses in production.

---

## 14. Deployment on Render

### Configuration:
- **Build Command:**
  ```bash
  npm run render:build
  ```
  *(Runs `npm ci --include=dev && npx prisma generate && npx prisma migrate deploy && npm run db:seed && npm run build`)*
- **Start Command:**
  ```bash
  npm run render:start
  ```
  *(Runs `node dist/server.js`)*
- **Health Check Path:**
  ```
  /health
  ```
  *(Fast in-memory health probe listening on `0.0.0.0:${PORT}` without database overhead)*

### Required Environment Variables on Render:
`NODE_ENV`, `PORT`, `DATABASE_URL`, `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_MINUTES`, `JWT_REFRESH_EXPIRES_DAYS`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `FRONTEND_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PUBLIC_API_URL`, `PUBLIC_BASE_URL`, `TAX_PERCENT`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `REDIS_URL`, `RATE_LIMIT_ENABLED`, `CORS_ORIGINS`.

---

## 15. Known Limitations

- **Email Dispatch:** Requires active SMTP credentials (or App Password for Gmail); if unconfigured, emails are logged to console.
- **Multipart Uploads:** Cloudinary credentials required for image persistence; files are held in-memory before upload.
- **Stripe Webhooks in Local Dev:** Requires the Stripe CLI (`stripe listen --forward-to localhost:5000/api/v1/payments/webhook`) to forward real-time webhook events during local testing.
