# PHASE 4C-2P — AUTHENTICATION & AUTHORIZATION COMPLETION PLAN

> [!CAUTION]
> **PLAN ONLY — HARD STOP ENFORCED.**
> As instructed by explicit user directive:
> - No application code, database schema, services, API routes, integration tests, or browser scripts will be modified or executed.
> - No users created, no passwords hashed, no sessions generated, no migrations created, and no test scripts executed.
> - Execution will strictly commence ONLY after receiving the explicit command: `"APPROVED — EXECUTE PHASE 4C-2P"`.

---

## 1. Executive Summary & Codebase Audit

Phase 4C-2P establishes the comprehensive design for the missing production Authentication and Authorization architecture of the Transport Management & Accounting System (`Deepraj Transport` and `Shivsai Transport`).

### Current Codebase Audit Classification

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ IMPLEMENTED IN CODEBASE                                                         │
│ 1. `users` database schema table definition (`src/db/schema/users.ts`).          │
│ 2. Firm context header extraction (`x-firm-id`) via `getActiveFirmId()`.        │
│ 3. Zod UUID validation for firm context header IDs.                             │
│ 4. Firm-scoped database queries (`where(eq(table.firmId, firmId))`).            │
│ 5. Direct-ID entity tampering rejection (`404 ENTITY_NOT_FOUND`).              │
├─────────────────────────────────────────────────────────────────────────────────┤
│ PARTIALLY IMPLEMENTED                                                           │
│ 1. User-to-Firm relationship (currently single `firm_id` FK on `users` table).  │
│ 2. Audit logs schema (`audit_logs` table exists, auth events not yet hooked).   │
├─────────────────────────────────────────────────────────────────────────────────┤
│ NOT IMPLEMENTED (TO BE BUILT IN PHASE 4C-2P)                                    │
│ 1. Login API Endpoint (`/api/auth/login`).                                      │
│ 2. Password hashing & salt verification (`argon2id` / `bcrypt`).                │
│ 3. Secure HTTP-Only session cookie engine (`__Host-session`).                   │
│ 4. Session validation, rotation, and revocation engine.                         │
│ 5. Logout API Endpoint (`/api/auth/logout`).                                    │
│ 6. Next.js Middleware route protection (`middleware.ts`).                      │
│ 7. Role-Based Access Control (RBAC) permission engine (`ADMIN`, `ACCOUNTANT`).   │
│ 8. Multi-firm membership authorization junction table (`user_firm_memberships`).│
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. User Authentication Architecture

### Production Login Workflow

```
                        ┌──────────────────────────────┐
                        │          User UI             │
                        │       (/login page)          │
                        └──────────────┬───────────────┘
                                       │
                         POST /api/auth/login (HTTPS)
                         Payload: { email, password }
                                       │
                                       ▼
                        ┌──────────────────────────────┐
                        │      Server Credential       │
                        │        Verification          │
                        └──────────────┬───────────────┘
                                       │
                         1. Rate-Limit Check (5 req/15m)
                         2. Query User by Email
                         3. Verify `is_active === true`
                         4. Verify Argon2id Password Hash
                                       │
                                       ▼
                        ┌──────────────────────────────┐
                        │      Session Generation      │
                        └──────────────┬───────────────┘
                                       │
                         1. Generate Secure Session Token
                         2. Insert into `sessions` DB
                         3. Set `__Host-session` Cookie
                            (HttpOnly, Secure, SameSite)
                                       │
                                       ▼
                        ┌──────────────────────────────┐
                        │     Authenticated Context    │
                        │     Returns User Info JSON   │
                        └──────────────────────────────┘
```

### Key Technical Specifications
- **Login Endpoint**: `POST /api/auth/login`
- **Logout Endpoint**: `POST /api/auth/logout`
- **Password Hashing Algorithm**: `Argon2id` (or `bcrypt` with cost factor 12).
- **Password Rules**: Minimum 12 characters, requiring uppercase, lowercase, number, and special character. Plaintext passwords are **NEVER** stored, logged, or printed. Password hashes are **NEVER** returned in API responses.
- **Brute-Force Rate Limiting**: Maximum 5 failed attempts per 15-minute window per IP/Email. Lock user account (`locked_until` timestamp) after 5 consecutive failures.

---

## 3. Session Security Architecture

### Cookie Parameters & Lifecycle

| Parameter | Recommended Setting | Security Rationale |
| :--- | :--- | :--- |
| **Cookie Name** | `__Host-session` | Prevents cookie domain overriding and subdomain tampering. |
| **HttpOnly** | `true` | Prevents JavaScript (`document.cookie`) access (XSS defense). |
| **Secure** | `true` | Enforces transmission strictly over HTTPS encrypted connections. |
| **SameSite** | `Lax` (or `Strict`) | Mitigates Cross-Site Request Forgery (CSRF) attacks. |
| **Path** | `/` | Restricted to application root. |
| **Idle Timeout** | 8 Hours | Automatically invalidates session after 8 hours of inactivity. |
| **Absolute Lifetime**| 24 Hours | Requires full re-authentication every 24 hours regardless of activity. |

### Session Operations
- **Session Creation**: Generates a 256-bit cryptographically secure random token, stores `token_hash` in `sessions` DB table, and sets `__Host-session` cookie.
- **Session Validation**: Middleware reads `__Host-session`, hashes the token, queries `sessions` table, verifies `expires_at > NOW()`, and loads user + active firm memberships.
- **Session Rotation**: Rotates session token upon login, firm context switch, and role change to prevent session fixation.
- **Session Revocation**: `POST /api/auth/logout` deletes session row from database and clears cookie.

---

## 4. Role-Based Access Control (RBAC) Architecture

### System Roles & Explicit Permissions Matrix

```
                          ┌───────────────────────────┐
                          │         System Roles      │
                          └─────────────┬─────────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
┌────────────────────┐       ┌────────────────────┐       ┌────────────────────┐
│       ADMIN        │       │     ACCOUNTANT     │       │      MANAGER       │
│ Full System Access │       │ Operational Access │       │  Read-Only Access  │
└────────────────────┘       └────────────────────┘       └────────────────────┘
```

| Feature / Module | ADMIN Role | ACCOUNTANT Role | MANAGER Role | Requires Client Confirmation |
| :--- | :---: | :---: | :---: | :---: |
| **Dashboard** | Full View | Full View | Read-Only View | No |
| **Parties & Companies Master** | Create, Edit, View | Read-Only View | Read-Only View | ❓ Confirm Accountant write access |
| **Customer Rules Master** | Create, Edit, View | Read-Only View | Read-Only View | ❓ Confirm Accountant rule access |
| **Trucks & Locations Master**| Create, Edit, View | Create, Edit, View | Read-Only View | No |
| **Daily Book Entries** | Create, Edit, Delete | Create, Edit | Read-Only View | ❓ Confirm Accountant delete access |
| **Billing Generation & Edit**| Create, Edit, Cancel | Create, Edit | Read-Only View | No |
| **Bill PDF Printing** | Print / Download | Print / Download | Print / Download | No |
| **Payments Recording** | Create, Allocate | Create, Allocate | Read-Only View | No |
| **Customer Ledger** | Read-Only View | Read-Only View | Read-Only View | No |
| **Outstanding & Aging** | Read-Only View | Read-Only View | Read-Only View | No |
| **Driver Vouchers** | Create, View | Create, View | Read-Only View | No |
| **User Management** | Full Access | No Access | No Access | No |
| **Audit Logs** | View Audit Logs | No Access | No Access | ❓ Confirm Accountant audit access |
| **Historical Excel Import** | Full Access (When active)| No Access | No Access | No |

---

## 5. Firm Authorization Architecture

### Authentication vs Firm Context Separation

> [!IMPORTANT]
> **CRITICAL RULE**: Authentication (`Who are you?`) and Firm Authorization (`Which firm data are you allowed to see?`) must be strictly separate validation steps. `x-firm-id` header alone **CANNOT** serve as authentication.

```
                        ┌──────────────────────────────┐
                        │   1. Authenticated User      │
                        │   (Validated Session Cookie) │
                        └──────────────┬───────────────┘
                                       │
                                       ▼
                        ┌──────────────────────────────┐
                        │  2. User Firm Memberships    │
                        │  (Check `user_firm_memberships`│
                        └──────────────┬───────────────┘
                                       │
                                       ▼
                        ┌──────────────────────────────┐
                        │   3. Active Firm Selection   │
                        │  (`x-firm-id` Header Match)  │
                        └──────────────┬───────────────┘
                                       │
                        Match Validated?
                       ├── NO  ──> HTTP 403 Forbidden
                       └── YES ──> Continue to Service
                                       │
                                       ▼
                        ┌──────────────────────────────┐
                        │    4. Firm-Scoped SQL Query  │
                        │  `where(eq(table.firmId, id))`│
                        └──────────────────────────────┘
```

### Multi-Firm Authorization Logic
1. A single user (e.g. Administrator or Owner) can belong to both `Deepraj Transport` and `Shivsai Transport` via the `user_firm_memberships` junction table.
2. When making an API request, the client sends `x-firm-id`.
3. Server middleware verifies:
   - Is the session valid?
   - Is the user an active member of `x-firm-id`?
4. If the user is **NOT** an authorized member of `x-firm-id`, server immediately returns `403 FORBIDDEN` (preventing cross-firm data access).

---

## 6. API Protection Matrix

### Complete API Protection Route Classification

| API Endpoint Path | HTTP Method | Security Level | Required Role | Required Scope |
| :--- | :---: | :---: | :---: | :--- |
| `/api/auth/login` | `POST` | **PUBLIC** | None | None |
| `/api/auth/logout` | `POST` | **AUTHENTICATED** | Any | None |
| `/api/auth/me` | `GET` | **AUTHENTICATED** | Any | None |
| `/api/health` | `GET` | **PUBLIC** | None | None |
| `/api/firms` | `GET` | **AUTHENTICATED** | Any | User Memberships |
| `/api/parties` | `GET`, `POST` | **PROTECTED** | Admin / Accountant | Firm-Scoped |
| `/api/companies` | `GET`, `POST` | **PROTECTED** | Admin / Accountant | Firm-Scoped |
| `/api/customer-rules` | `GET`, `POST` | **PROTECTED** | Admin / Accountant | Firm-Scoped |
| `/api/trucks` | `GET`, `POST` | **PROTECTED** | Admin / Accountant | Firm-Scoped |
| `/api/locations` | `GET`, `POST` | **PROTECTED** | Admin / Accountant | Firm-Scoped |
| `/api/daily-entries` | `GET`, `POST`, `PUT` | **PROTECTED** | Admin / Accountant | Firm-Scoped |
| `/api/daily-entries/[id]` | `DELETE` | **PROTECTED** | Admin Only | Firm-Scoped |
| `/api/trips` | `GET`, `POST` | **PROTECTED** | Admin / Accountant | Firm-Scoped |
| `/api/bills` | `GET`, `POST` | **PROTECTED** | Admin / Accountant | Firm-Scoped |
| `/api/bills/[id]` | `GET`, `PUT` | **PROTECTED** | Admin / Accountant | Firm-Scoped |
| `/api/bills/[id]/pdf` | `GET` | **PROTECTED** | Any Authenticated | Firm-Scoped |
| `/api/payments` | `GET`, `POST` | **PROTECTED** | Admin / Accountant | Firm-Scoped |
| `/api/payments/[id]/allocate`| `POST` | **PROTECTED** | Admin / Accountant | Firm-Scoped |
| `/api/ledger` | `GET` | **PROTECTED** | Any Authenticated | Firm-Scoped |
| `/api/reports/outstanding` | `GET` | **PROTECTED** | Any Authenticated | Firm-Scoped |
| `/api/reports/aging` | `GET` | **PROTECTED** | Any Authenticated | Firm-Scoped |
| `/api/driver-vouchers` | `GET` | **PROTECTED** | Any Authenticated | Firm-Scoped |
| `/api/dashboard` | `GET` | **PROTECTED** | Any Authenticated | Firm-Scoped |
| `/api/import/*` | `POST`, `GET` | **PROTECTED** | Admin Only | Firm-Scoped |
| `/api/users/*` | `GET`, `POST`, `PUT` | **PROTECTED** | Admin Only | System-Wide |

---

## 7. Page / UI Protection Matrix

### Next.js Middleware Protection Blueprint (`src/middleware.ts`)

Unauthenticated users attempting to access protected UI pages are automatically redirected to `/login?redirectTo=<PATH>`.

```typescript
// Conceptual Middleware Protection Logic (Documentation Only)
export function middleware(req: NextRequest) {
  const sessionToken = req.cookies.get("__Host-session")?.value;
  const isPublicPage = req.nextUrl.pathname === "/login";

  if (!sessionToken && !isPublicPage) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirectTo", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (sessionToken && isPublicPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}
```

| UI Page Route Path | Security Classification | Redirect Target (If Unauthenticated) |
| :--- | :---: | :--- |
| `/login` | **PUBLIC** | Redirects to `/dashboard` if logged in |
| `/dashboard` | **AUTHENTICATED** | `/login?redirectTo=/dashboard` |
| `/masters/*` | **AUTHENTICATED + ROLE** | `/login?redirectTo=/masters/...` |
| `/daily-book` | **AUTHENTICATED + ROLE** | `/login?redirectTo=/daily-book` |
| `/billing/*` | **AUTHENTICATED + ROLE** | `/login?redirectTo=/billing/...` |
| `/payments` | **AUTHENTICATED + ROLE** | `/login?redirectTo=/payments` |
| `/ledger` | **AUTHENTICATED** | `/login?redirectTo=/ledger` |
| `/reports/*` | **AUTHENTICATED** | `/login?redirectTo=/reports/...` |
| `/driver-vouchers` | **AUTHENTICATED** | `/login?redirectTo=/driver-vouchers` |
| `/import` | **ADMIN ONLY** | `/unauthorized` if not Admin |

---

## 8. Password Security Rules

1. **Hashing Standard**: Argon2id (`memoryCost: 65536`, `timeCost: 3`, `parallelism: 4`) or Bcrypt (`cost: 12`).
2. **Plaintext Protection**: Plaintext passwords exist in memory only during credential verification and are zeroed immediately after.
3. **Log Protection**: Application logs (`Pino`/`Winston`) suppress `password`, `password_hash`, `token`, and `session_id` fields.
4. **API Safety**: API responses serialize user objects using `omit(user, ['passwordHash', 'passwordResetToken'])`.

---

## 9. Auth Event Audit Trail

All security and authentication events will write structured records to the existing `audit_logs` database table.

| Event Type | Trigger Condition | Recorded Audit Metadata |
| :--- | :--- | :--- |
| `AUTH_LOGIN_SUCCESS` | User logs in successfully | User ID, Email, IP Address, User-Agent, Timestamp. |
| `AUTH_LOGIN_FAILED` | Incorrect password or unknown email | Attempted Email, IP Address, User-Agent, Failure Reason. |
| `AUTH_LOGOUT` | User clicks logout | User ID, Session ID, IP Address, Timestamp. |
| `AUTH_PASSWORD_CHANGE`| Password reset or password update | User ID, IP Address, Timestamp. |
| `AUTH_ROLE_CHANGE` | Admin modifies user role | Targeted User ID, Admin User ID, Old Role, New Role. |
| `FIRM_ACCESS_CHANGED` | User firm membership modified | User ID, Firm ID, Action (`ADDED` / `REMOVED`). |

---

## 10. Database Schema Requirements

To implement Phase 4C-2P, the following schema additions are required:

### 1. `sessions` Table Schema (New Table)
```typescript
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 255 }).notNull().unique(),
  activeFirmId: uuid("active_firm_id").references(() => firms.id, { onDelete: "set null" }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 2. `user_firm_memberships` Junction Table Schema (New Table)
```typescript
export const userFirmMemberships = pgTable("user_firm_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  firmId: uuid("firm_id").notNull().references(() => firms.id, { onDelete: "cascade" }),
  role: userRoleEnum("role").notNull().default("ACCOUNTANT"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

---

## 11. Client Confirmation Checklist

The following 12 business questions must be confirmed by the client prior to final RBAC execution:

1. ❓ Who should hold the `ADMIN` role? (e.g. Owner/Managing Director only).
2. ❓ Should `ACCOUNTANT` users have permission to create and edit Customer Rules?
3. ❓ Can `ACCOUNTANT` users delete Daily Book entries, or only `ADMIN` users?
4. ❓ Are `MANAGER` users allowed to print/download Bill PDFs?
5. ❓ Does any single user (e.g. Owner) require active login access to both `Deepraj Transport` and `Shivsai Transport`?
6. ❓ Should password reset be supported via automated email (SMTP required), or managed manually by Admin?
7. ❓ What is the required session inactivity timeout (Default: 8 hours)?
8. ❓ Should Accountants be allowed to view System Audit Logs?
9. ❓ Is account lockout after 5 failed login attempts acceptable?
10. ❓ Are Accountant users permitted to edit already-posted Bills?
11. ❓ Who is authorized to execute the historical Excel import once real files arrive?
12. ❓ Confirm initial admin user email address for production seeding.

---

## 12. Staged Implementation Plan (Phases P1 – P8)

### Phase P1: Database Schema & Hashing Setup
- **Files**: `src/db/schema/sessions.ts`, `src/db/schema/user-firm-memberships.ts`, `src/lib/password.ts`.
- **Database**: Add `sessions` and `user_firm_memberships` tables via `drizzle-kit generate`.
- **Tests**: Password hashing & verification unit tests (`bcrypt`/`argon2`).

### Phase P2: Login & Logout API Routes
- **Files**: `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`, `src/app/api/auth/me/route.ts`.
- **Tests**: Credential validation tests, session cookie generation tests.

### Phase P3: Server-Side Session Security
- **Files**: `src/lib/session.ts`, `src/lib/api-context.ts`.
- **Security**: Cookie flag enforcement (`HttpOnly`, `Secure`, `SameSite=Lax`), session idle timeout.

### Phase P4: Multi-Firm Membership Authorization
- **Files**: `src/services/firm-membership.ts`, `src/lib/api-context.ts`.
- **Security**: Validate that authenticated user belongs to `x-firm-id` membership; return `403 FORBIDDEN` if non-member.

### Phase P5: Role-Based Access Control (RBAC) Engine
- **Files**: `src/lib/rbac.ts`, `src/services/*`.
- **Security**: Role permission enforcement per route handler.

### Phase P6: Next.js API Route Protection Middleware
- **Files**: `src/middleware.ts`, `src/lib/api-context.ts`.
- **Security**: Intercept all `/api/*` endpoints (except public ones) and assert session validity.

### Phase P7: Next.js UI Page Protection & Navigation Guards
- **Files**: `src/middleware.ts`, `src/app/(auth)/login/page.tsx`, `src/components/layout/sidebar.tsx`.
- **Security**: Unauthenticated UI redirect to `/login`, UI element rendering scoped to user role.

### Phase P8: Security Verification & Audit Trail
- **Files**: `src/tests/auth.test.ts`, `src/services/audit.ts`.
- **Tests**: Run 20 security test scenarios; verify audit event logs.

---

## 13. Security Test Plan (20 Security Scenarios)

When authorized to execute, the test suite will run the following 20 security test cases:

- [ ] 1. **Valid Login**: Correct email + password returns HTTP 200 OK and sets `__Host-session` cookie.
- [ ] 2. **Invalid Password**: Incorrect password returns HTTP 401 Unauthorized without creating session.
- [ ] 3. **Unknown User**: Non-existent email returns generic HTTP 401 Unauthorized.
- [ ] 4. **Logout Execution**: `POST /api/auth/logout` invalidates session in DB and clears cookie.
- [ ] 5. **Expired Session**: Request with expired session cookie returns HTTP 401 Unauthorized.
- [ ] 6. **Revoked Session**: Request with manually revoked session returns HTTP 401 Unauthorized.
- [ ] 7. **Unauthorized Role Access**: `MANAGER` user attempting `POST /api/bills` returns HTTP 403 Forbidden.
- [ ] 8. **Authorized Role Access**: `ACCOUNTANT` user creating bill succeeds HTTP 200.
- [ ] 9. **Cross-Firm Access Rejection**: User requesting `x-firm-id` of unassigned firm returns HTTP 403.
- [ ] 10. **Tampered Firm ID**: Malformed or invalid UUID `x-firm-id` returns HTTP 400 Bad Request.
- [ ] 11. **Direct-ID Entity Tampering**: Attempting to fetch bill belonging to another firm returns HTTP 404.
- [ ] 12. **Horizontal Privilege Escalation**: User A attempting to modify User B session fails.
- [ ] 13. **Vertical Privilege Escalation**: `ACCOUNTANT` attempting user creation (`POST /api/users`) returns 403.
- [ ] 14. **Protected API Without Session**: `GET /api/bills` without cookie returns HTTP 401 Unauthorized.
- [ ] 15. **Protected Page Without Session**: Navigating to `/dashboard` redirects to `/login`.
- [ ] 16. **Password Hash Privacy**: User API endpoints never include `password_hash` in JSON output.
- [ ] 17. **Log Password Suppression**: Application logs suppress password fields.
- [ ] 18. **Login Rate Limiting**: 6th failed login attempt within 15 mins returns HTTP 429 Too Many Requests.
- [ ] 19. **CSRF SameSite Defense**: Cross-site form submission fails cookie inclusion.
- [ ] 20. **Session Fixation Defense**: Session token rotates upon successful authentication.

---

## 14. Production Gate: AUTHENTICATION & AUTHORIZATION READY

> [!IMPORTANT]
> **PRODUCTION GATE CRITERIA**  
> Gate **AUTHENTICATION & AUTHORIZATION READY** can ONLY transition to **PASS** when:
> 1. Login and Logout endpoints function cleanly.
> 2. `__Host-session` cookie is HTTP-Only, Secure, and SameSite=Lax.
> 3. RBAC permissions (`ADMIN`, `ACCOUNTANT`, `MANAGER`) are strictly enforced across 100% of API endpoints and UI pages.
> 4. Multi-firm authorization prevents all cross-firm access attempts.
> 5. 20/20 Security Test Plan scenarios pass with 0 failures.
> 6. Zero plaintext credentials exist in database or logs.

---

## 15. Mandatory Confirmation

> [!IMPORTANT]
> **EXPLICIT CONFIRMATION: NO EXECUTION OCCURRED**
> - Application source code was **NOT** modified.
> - Database schemas and migrations were **NOT** modified.
> - `integration.test.ts` was **NOT** modified or executed.
> - Browser QA scripts were **NOT** executed.
> - No user accounts, passwords, or sessions were created.
> - No deployment commands (`npm test`, `npm run build`, `npm run dev`) were executed.
> - Database row counts remain untouched (all 12 business tables contain **0 rows**).

---

## 16. Authorization Request

The Authentication & Authorization Completion Plan is complete and ready for review.

Awaiting your explicit authorization command:

**`APPROVED — EXECUTE PHASE 4C-2P`**
