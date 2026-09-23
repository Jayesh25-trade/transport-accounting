/**
 * Domain & Application Error Classes for Transport Accounting System.
 * Ensures typed, clean, and explicit error handling across service & domain layers.
 */

export class AppError extends Error {
  constructor(message: string, public code: string = "INTERNAL_ERROR") {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Thrown when an operation violates firm context isolation rules
 * (e.g. attempting to reference Party A from Firm B).
 */
export class FirmIsolationError extends AppError {
  constructor(message: string = "Cross-firm reference is strictly prohibited") {
    super(message, "FIRM_ISOLATION_VIOLATION");
  }
}

/**
 * Thrown when domain calculation rules are violated
 * (e.g. invalid shortage weights, negative rates).
 */
export class DomainValidationError extends AppError {
  constructor(message: string) {
    super(message, "DOMAIN_VALIDATION_ERROR");
  }
}

/**
 * Thrown when editing a bill would cause net bill amount to drop below already received payments.
 */
export class BillEditValidationError extends AppError {
  constructor(message: string) {
    super(message, "BILL_EDIT_VALIDATION_ERROR");
  }
}

/**
 * Thrown when allocating a payment would exceed the allowable pending bill amount.
 */
export class PaymentAllocationError extends AppError {
  constructor(message: string) {
    super(message, "PAYMENT_ALLOCATION_ERROR");
  }
}

/**
 * Thrown when an entity requested by ID within a firm context is not found.
 */
export class EntityNotFoundError extends AppError {
  constructor(entityName: string, id: string) {
    super(`${entityName} with ID '${id}' was not found in the active firm context`, "ENTITY_NOT_FOUND");
  }
}

/**
 * Thrown when sequence allocation or locking fails under concurrency.
 */
export class ConcurrencyError extends AppError {
  constructor(message: string) {
    super(message, "CONCURRENCY_ERROR");
  }
}
