# PHASE 4C-2N — PRODUCTION READINESS AUDIT PLAN

> [!CAUTION]
> **PLAN ONLY — HARD STOP ENFORCED.**
> As instructed by explicit user directive:
> - No application code, database schema, services, API routes, integration tests, or browser scripts will be modified or executed.
> - No commands (`npm test`, `npm run build`, `npm run dev`, database scripts, deployment commands) will be run.
> - Execution will strictly commence ONLY after receiving the explicit command: `"APPROVED — EXECUTE PHASE 4C-2N"`.

---

## 1. Objective

Phase 4C-2N establishes a comprehensive Production Readiness Audit Plan to verify that the Transport Management & Accounting Application is fully prepared, secure, resilient, and audit-compliant for live deployment. 

The audit covers 15 critical operational domains, ensuring firm multi-tenancy isolation (`Deepraj Transport` vs `Shivsai Transport`), accounting integrity, automated 3-2-1 database backups, fail-safe reverse proxy & HTTPS configuration, rate limiting, audit logging, disaster recovery protocols, and a zero-downtime deployment sequence.

---

## 2. Comprehensive Production Audit Scope (15 Operational Domains)

### 1. Production Architecture
- **Framework**: Next.js (App Router, React 19, Node.js runtime).
- **Database Engine**: PostgreSQL 16+ with connection pooling (e.g., PgBouncer or Drizzle ORM pool management).
- **Reverse Proxy**: Caddy v2 or Nginx with TLS 1.3 termination, HTTP/2, auto-cert issuance via Let's Encrypt / ZeroSSL.
- **Process Manager**: PM2 or Systemd service daemon with auto-restart on crash and boot persistence (`systemctl enable app`).
- **Production Server**: Ubuntu 22.04 LTS / 24.04 LTS Linux server with UFW firewall enabled (open only SSH 22, HTTP 80, HTTPS 443).

### 2. Environment and Secrets Management
- **Secret Isolation**: Create strict `.env.production` managed via server root (`/etc/app/.env.production`) outside the Web root and Git tree.
- **Secrets Audit**: Verify `DATABASE_URL`, `NEXTAUTH_SECRET` / `SESSION_SECRET`, `PUPPETEER_EXECUTABLE_PATH`, and firm tokens.
- **Leakage Prevention**: Verify no sensitive credentials exist in `.env.example`, `.env.local`, public scripts, or Git commits.
- **Git Tracking**: Confirm `.gitignore` explicitly excludes `.env*` files except `.env.example`.

### 3. Authentication & Authorization
- **Authentication Strategy**: Session-based cookie / JWT authentication with HTTP-Only, Secure, SameSite=Lax/Strict flags.
- **Firm Multi-Tenancy Authorization**: Mandatory `x-firm-id` header and session context validation on every server action and `/api/*` endpoint.
- **Cross-Firm Defense**: Explicit database query constraints (`where(eq(schema.table.firmId, activeFirmId))`) on all CRUD queries.
- **Unauthorized Access Prevention**: Automatic redirect to login/unauthorized screen for invalid or expired sessions.

### 4. Database Safety & Integrity
- **PostgreSQL Config**: Optimized `max_connections`, `shared_buffers`, `work_mem`, `effective_cache_size`, and write-ahead logging (WAL).
- **Transaction Safety**: Atomic database transactions (`db.transaction(async (tx) => ...)` across Daily Book -> Trip, Bill -> Debit Note -> TDS, and Payment -> Allocation.
- **Foreign Key Constraints**: Strict cascades/restrict rules ensuring orphaned records cannot exist.
- **Migration Strategy**: Execution of `npx drizzle-kit migrate` during deployment; zero manual DDL modifications.

### 5. Backup, Recovery & Disaster Management (3-2-1 Strategy)
- **3-2-1 Rule**: 3 copies of data, 2 different media types (Local disk + S3-compatible cloud bucket), 1 copy off-site.
- **Automated Backup Schedule**: Daily automated `pg_dump` cron job with GZIP compression (`0 2 * * *`).
- **Retention Policy**: Daily backups kept for 30 days; monthly snapshots kept for 12 months.
- **Target Metrics**:
  - **RPO (Recovery Point Objective)**: < 24 hours (Point-in-Time Recovery via WAL archive optional for < 1 hour).
  - **RTO (Recovery Time Objective)**: < 30 minutes.
- **Verification Protocol**: Automated weekly test restore into temporary database target to verify dump integrity.

### 6. Web Server & Reverse Proxy Configuration
- **Caddy / Nginx Directives**:
  - Automatic HTTP to HTTPS redirection (301 Permanent Redirect).
  - HSTS (`Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`).
  - Gzip / Brotli compression for static assets.
  - Proxy header forwarding (`X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`).

### 7. Application Process & Health Monitoring
- **Build Strategy**: `npm run build` producing optimized Next.js standalone server (`.next/standalone`).
- **Process Manager Config**: PM2 `ecosystem.config.js` or Systemd `transport-app.service` with auto-restart on memory limit (> 1GB).
- **Health Check Endpoint**: `/api/health` returning JSON `{ status: "ok", db: "connected", timestamp: "..." }`.

### 8. Security Hardening
- **SQL Injection**: 100% parameterized queries via Drizzle ORM query builder.
- **XSS Prevention**: React automatic escaping + Content-Security-Policy (CSP) headers.
- **CSRF Protection**: SameSite cookies and anti-CSRF tokens for state-changing POST/PUT/DELETE requests.
- **Security Headers**: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- **API Input Validation**: Zod schema validation on 100% of API payload inputs.
- **Puppeteer PDF Security**: Isolated Chromium sandbox (`--no-sandbox` strictly controlled, local file access prohibited).

### 9. Firm Data Isolation Audit
- **Deepraj Transport vs Shivsai Transport**: Verified zero cross-contamination.
- **Direct-ID Access Test**: Verify requesting `/api/bills/[billId]` belonging to Firm A while authenticated under Firm B returns `404 Not Found` or `403 Forbidden`.

### 10. Accounting Safety & Audit Trail
- **Immutability Rules**: Locked bills, posted ledger transactions, and allocated payments cannot be silently overwritten.
- **Audit Logs**: Comprehensive recording of `action`, `entity_type`, `entity_id`, `firm_id`, `user_id`, `timestamp`, and `changes`.
- **Financial Validation**: Balance formulas strictly enforced: `Net Bill = Gross - Shortage - TDS`.

### 11. Historical Excel Import Safety
- **State**: Infrastructure present but **100% DISABLED / READ-ONLY** until client supplies authentic Excel files.
- **Zero Fake Data Rule**: No demo or simulated Excel data populated into production database.
- **Staging Pipeline Ready**: Upload -> Column Detection -> Mapping -> Staging -> Dry-Run Validation -> Human Approval Gate -> Atomic Commit.

### 12. Logging, Diagnostics & Telemetry
- **Application Logging**: Structured JSON logging (Pino/Winston) with log levels (`INFO`, `WARN`, `ERROR`).
- **Log Rotation**: `logrotate` configuration for system and application logs (max 50MB per file, 14 days retention).
- **Audit Log Inspection**: Administrative UI/view for auditing critical business events.

### 13. Step-by-Step Production Deployment Plan
1. **Provision Server**: Provision Ubuntu 22.04 LTS server, setup SSH keys, configure UFW firewall.
2. **Install Runtime**: Install Node.js 20 LTS, PostgreSQL 16, Caddy / Nginx, PM2.
3. **Database Setup**: Create production PostgreSQL user, database, and extensions.
4. **Environment Setup**: Populate `/etc/app/.env.production` with secure randomly generated secrets.
5. **Code Checkout**: Git clone application codebase to production directory (`/var/www/transport-app`).
6. **Build & Migrate**: Run `npm clean-install`, `npx drizzle-kit migrate`, and `npm run build`.
7. **Start Process**: Launch app via PM2 (`pm2 start ecosystem.config.js`) and enable startup service (`pm2 startup`).
8. **Configure Web Server**: Configure Caddy/Nginx reverse proxy and obtain SSL certificates.
9. **Post-Deployment Verification**: Run smoke tests against live domain.

### 14. Domain & DNS Configuration
- **Domain Mapping**: Client domain configuration (`transport.example.com` or custom domain).
- **DNS Records**: A Record pointing to server static IPv4, AAAA Record for IPv6, CNAME for `www`.
- **SSL Termination**: Automatic Let's Encrypt TLS certificate provisioning and renewal.

### 15. Production Acceptance Verification Matrix
- **Smoke Tests**: Verify `/api/health`, `/dashboard`, `/daily-book`, `/billing`, `/payments`, `/ledger`, `/reports/outstanding`, `/reports/aging`, `/driver-vouchers`.
- **Firm Switch Check**: Toggle active firm and confirm complete UI and API data boundary separation.
- **PDF Generation**: Generate sample PDF bill in production browser mode.
- **Backup Restoration Smoke Test**: Perform test database dump and verify database restored cleanly.

---

## 3. Mandatory Rules & Hard Stop

> [!IMPORTANT]
> **NO EXECUTION HAS OCCURRED.**
> - Application code was **NOT** modified.
> - Database schema and migrations were **NOT** modified.
> - `integration.test.ts` was **NOT** modified or executed.
> - Browser QA scripts were **NOT** executed.
> - No deployment commands, builds, or test scripts were executed.
> - Database row counts remain untouched.

---

## 4. Authorization Request

The Production Readiness Audit Plan is complete and ready for review.

Awaiting your explicit authorization command:

**`APPROVED — EXECUTE PHASE 4C-2N`**
