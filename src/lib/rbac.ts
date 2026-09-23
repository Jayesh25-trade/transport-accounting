// ============================================================
// ROLE-BASED ACCESS CONTROL (RBAC) ENGINE
// Server-side permission checks for ADMIN, ACCOUNTANT, and MANAGER.
// ============================================================

import { AppError } from "./errors";

export type UserRole = "ADMIN" | "ACCOUNTANT" | "MANAGER";

export interface RbacOptions {
  requiredRoles?: UserRole[];
  allowPublic?: boolean;
}

/**
 * Validates whether a user role satisfies required endpoint permissions.
 */
export function checkRolePermission(userRole: UserRole, requiredRoles?: UserRole[]) {
  if (!requiredRoles || requiredRoles.length === 0) return true;
  if (requiredRoles.includes(userRole)) return true;

  // ADMIN always inherits full permissions
  if (userRole === "ADMIN") return true;

  throw new AppError("Forbidden: Insufficient role permissions for this operation", "FORBIDDEN_ROLE_ACCESS");
}
