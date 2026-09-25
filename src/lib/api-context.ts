// ============================================================
// API CONTEXT & AUTHORIZATION MIDDLEWARE
// Enforces firm header UUID validation, session authentication,
// multi-firm membership authorization, and RBAC server-side checks.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { AppError } from "./errors";
import { z } from "zod";
import { validateRequestSession, AuthenticatedUserSession } from "./session";
import { UserRole, checkRolePermission } from "./rbac";

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
}

export interface ApiHandlerOptions {
  requiredRoles?: UserRole[];
  isPublic?: boolean;
  requireAuth?: boolean;
}

export interface ApiHandlerContext {
  firmId: string;
  user?: AuthenticatedUserSession["user"];
  session?: AuthenticatedUserSession["session"];
  memberships?: AuthenticatedUserSession["memberships"];
  params?: any;
}

/**
 * Extracts and validates the active firm context from HTTP request headers.
 * Header key: `x-firm-id`
 */
export function getActiveFirmId(req: NextRequest): string {
  const firmId = req.headers.get("x-firm-id");
  if (!firmId) {
    throw new AppError("Missing active firm context header ('x-firm-id')", "FIRM_CONTEXT_REQUIRED");
  }
  const parsed = z.string().uuid("Invalid firm context ID format").safeParse(firmId);
  if (!parsed.success) {
    throw new AppError("Invalid firm context ID format in header", "INVALID_FIRM_CONTEXT");
  }
  return parsed.data;
}

/**
 * Higher-order helper for Next.js App Router API Route Handlers.
 * Wraps route logic with firm context validation, session authentication,
 * firm membership authorization, and server-side RBAC enforcement.
 */
export function createApiHandler<T>(
  handler: (req: NextRequest, context: ApiHandlerContext) => Promise<T>,
  options?: ApiHandlerOptions
) {
  return async (req: NextRequest, { params }: { params?: any } = {}) => {
    try {
      const firmId = getActiveFirmId(req);

      // Validate server-side session
      const sessionCtx = await validateRequestSession(req);

      if (!sessionCtx) {
        // If public endpoint, allow unauthenticated access
        if (options?.isPublic) {
          const data = await handler(req, { firmId, params });
          return NextResponse.json<ApiResponse<T>>({ success: true, data }, { status: 200 });
        }

        // In test mode or when explicitly permitted for legacy scripts with valid x-firm-id header
        const isTestEnv = process.env.NODE_ENV === "test" || process.env.DISABLE_AUTH_FOR_TESTS === "true";
        if (isTestEnv && !options?.requireAuth) {
          const data = await handler(req, {
            firmId,
            user: { id: "test-user-id", name: "Test User", email: "test@example.com", role: "ADMIN", isActive: true },
            params,
          });
          return NextResponse.json<ApiResponse<T>>({ success: true, data }, { status: 200 });
        }

        throw new AppError("Unauthenticated: Active user session required", "UNAUTHENTICATED");
      }

      // Verify firm membership: User must belong to requested x-firm-id
      const hasMembership = sessionCtx.memberships.some((m) => m.firmId === firmId);
      if (!hasMembership && sessionCtx.activeFirmId !== firmId) {
        throw new AppError("Forbidden: User is not an authorized member of requested firm", "FORBIDDEN_FIRM_ACCESS");
      }

      // Verify Server-Side RBAC
      checkRolePermission(sessionCtx.user.role, options?.requiredRoles);

      // Execute handler with validated context
      const data = await handler(req, {
        firmId,
        user: sessionCtx.user,
        session: sessionCtx.session,
        memberships: sessionCtx.memberships,
        params,
      });

      return NextResponse.json<ApiResponse<T>>({ success: true, data }, { status: 200 });
    } catch (err: any) {
      if (err instanceof AppError) {
        let status = 400;
        if (err.code === "ENTITY_NOT_FOUND") status = 404;
        if (err.code === "UNAUTHENTICATED") status = 401;
        if (err.code === "FORBIDDEN_ROLE_ACCESS" || err.code === "FORBIDDEN_FIRM_ACCESS") status = 403;
        if (err.code === "BILLED_TRIP_EDIT_LOCKED") status = 409;

        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: { message: err.message, code: err.code },
          },
          { status }
        );
      }

      if (err instanceof z.ZodError) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: {
              message: "Input validation failed",
              code: "VALIDATION_ERROR",
              details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
            },
          },
          { status: 400 }
        );
      }

      // Log unexpected internal errors silently (sanitized)
      console.error("[API_ERROR]", err?.message || err);

      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: { message: "An unexpected error occurred", code: "INTERNAL_SERVER_ERROR" },
        },
        { status: 500 }
      );
    }
  };
}
