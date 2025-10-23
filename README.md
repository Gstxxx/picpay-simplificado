# PicPay Simplificado

A simplified payment platform API built with TypeScript, Hono, and Prisma.

## 🚀 Features

- **User Authentication**: JWT-based auth with secure password hashing (bcrypt)
- **Transfer System**: Money transfers between users with comprehensive validation
- **Idempotency**: Duplicate request protection via `Idempotency-Key` header
- **Resilient External Services**: Timeout, retry, exponential backoff, and circuit breaker
- **Notification System**: Reliable notification delivery via outbox pattern with background worker
- **Security**: Rate limiting, CORS, security headers, JWT middleware
- **Observability**: Health checks (`/healthz`, `/readyz`), structured logging
- **Type Safety**: Full TypeScript with strict mode enabled
- **Database**: SQLite (dev) with Prisma ORM, Postgres-ready schema

## 📋 Requirements

- Node.js 20+
- npm or yarn

## 🛠️ Setup

1. **Clone the repository**

```bash
git clone <repository-url>
cd picpay-simplificado
```

2. **Install dependencies**

```bash
npm install
```

3. **Configure environment**

Create a `.env` file (or copy from `.env.example`):

```env
NODE_ENV=development
PORT=3005
DATABASE_URL="file:./dev.db"
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-long-change-in-production
AUTH_URL=https://util.devi.tools/api/v2/authorize
NOTIFY_URL=https://util.devi.tools/api/v1/notify
CORS_ORIGINS=*
```

4. **Initialize database**

```bash
npm run db:push
npm run db:generate
```

5. **Start development server**

```bash
npm run dev
```

Server runs at `http://localhost:3005`

## 📚 API Documentation

### Base URL

```
http://localhost:3005/api/v1
```

### Endpoints

#### Authentication

**POST /api/v1/auth/register**

Register a new user.

```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "confirmPassword": "SecurePass123",
  "name": "John Doe",
  "documentType": "COMMON",
  "documentNumber": "12345678901"
}
```

**POST /api/v1/auth/login**

Login and receive JWT token.

```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

Response:
```json
{
  "token": "eyJhbGc...",
  "user": { "id": "...", "email": "...", "name": "..." }
}
```

#### Transactions

**POST /api/v1/transactions/transfer** (Protected)

Transfer money between users. Requires `Authorization: Bearer <token>` header.

```json
{
  "payer": "uuid-of-payer",
  "payee": "uuid-of-payee",
  "value": 10000
}
```

**Note**: `value` is in cents (integer). Example: 10000 = R$ 100.00

Optional header for idempotency:
```
Idempotency-Key: unique-request-id
```

#### Health

**GET /api/v1/healthz** - Liveness probe  
**GET /api/v1/readyz** - Readiness probe (checks DB connection)

## 🏗️ Architecture & Design Decisions

### ID Strategy

- **UUIDs** for all primary keys (User, Transaction, NotificationOutbox)
- Compatible with distributed systems and easy migration to Postgres

### Money Representation

- All monetary values stored as **integers (cents)** to avoid floating-point precision issues
- API accepts and returns integers

### Concurrency & Race Conditions

- **Atomic balance check**: `updateMany` with `where: { balance: { gte: value } }` ensures safe decrement
- Prisma transactions wrap balance updates and transaction creation
- Idempotency prevents duplicate transfers

### External Service Resiliency

Custom HTTP client (`src/lib/http.ts`) with:
- **Timeout**: 2s for authorizer, 3s for notifications
- **Retries**: Exponential backoff (3 attempts for auth, 2 for notify)
- **Circuit Breaker**: Opens after 5 consecutive failures, cools down after 10s

### Notification Reliability

**Outbox Pattern**:
1. Transfer transaction inserts notification into `NotificationOutbox` table
2. Background worker polls pending notifications every 5s
3. Retries up to 5 times with exponential backoff
4. Marks as `SENT` or `FAILED` after max attempts

### Security

- **JWT Authentication**: 15-minute access tokens, no refresh for now
- **Rate Limiting**: 5 req/min for login, 10 req/min for transfers
- **Security Headers**: HSTS, X-Frame-Options, CSP-ready
- **Password Hashing**: bcrypt with salt rounds 10
- **CORS**: Configurable via `CORS_ORIGINS` env var

### Validation

- **Zod schemas** for all inputs
- Document type validation (CPF 11 digits for COMMON, CNPJ 14 digits for MERCHANT)
- Self-transfer prevention
- Merchant send restriction

## 🧪 Scripts

```bash
npm run dev          # Start dev server with watch mode
npm run build        # Compile TypeScript to dist/
npm start            # Run compiled production server
npm run typecheck    # Type check without emitting
npm run lint         # Check code formatting
npm run format       # Auto-format code with Prettier
npm run db:push      # Push schema changes to database
npm run db:migrate   # Create and apply migrations
npm run db:generate  # Regenerate Prisma Client
npm run db:studio    # Open Prisma Studio GUI
npm test             # Run tests (placeholder)
```

## 🗂️ Project Structure

```
src/
├── config.ts                  # Environment validation & config
├── index.ts                   # Server entry point
├── lib/
│   ├── http.ts               # Resilient HTTP client
│   └── prisma.ts             # Prisma client singleton
├── middleware/
│   ├── auth.ts               # JWT authentication
│   ├── errors.ts             # Global error handler
│   ├── rateLimit.ts          # In-memory rate limiter
│   └── security.ts           # Security headers
├── routes/
│   ├── auth/
│   │   ├── index.ts          # Login & register handlers
│   │   └── schema.ts         # Zod validation schemas
│   ├── transactions/
│   │   ├── index.ts          # Transfer handler
│   │   └── schema.ts         # Transfer validation
│   └── health/
│       └── index.ts          # Health check endpoints
└── workers/
    └── notificationWorker.ts  # Background notification sender
prisma/
└── schema.prisma             # Database schema
```

## 🐳 Future: Docker & Postgres

Schema is Postgres-ready. To migrate:

1. Update `datasource` in `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. Update `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/picpay"
```

3. Run migrations:
```bash
npm run db:migrate
```

## 🔒 Security Considerations

- Store `JWT_SECRET` securely (use secrets manager in production)
- Use HTTPS in production
- Restrict `CORS_ORIGINS` to known domains
- Implement refresh token rotation if long-lived sessions needed
- Add comprehensive audit logging
- Consider rate limiting per user ID (not just IP)

## 🚧 Known Limitations & Trade-offs

- **In-memory rate limiter**: Lost on restart; use Redis for production
- **SQLite**: Single-writer bottleneck; migrate to Postgres for scale
- **No refresh tokens**: Simplifies implementation; add if needed
- **Notification worker in-process**: Use queue (RabbitMQ/SQS) + separate worker for production
- **String-based enums**: SQLite doesn't support native enums; Postgres would use proper enums
- **No audit trail**: Consider event sourcing for compliance
- **Basic circuit breaker**: Per-URL, in-memory; use Hystrix/resilience4j for advanced patterns

## 📝 Testing

Tests are placeholders. Add:
- Unit tests: auth logic, validation, services
- Integration tests: full transfer flow
- External service mocks: use `nock` or `msw`
- Contract tests for external APIs

## 📜 License

MIT

## 🤝 Contributing

This is a technical challenge project. For production use, consider:
- Adding comprehensive tests
- Implementing proper logging (structured with correlation IDs)
- Adding observability (metrics, tracing)
- Migrating to Postgres + queue system
- Implementing proper secrets management
- Adding API documentation (OpenAPI/Swagger)
