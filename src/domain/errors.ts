/**
 * Structured error hierarchy for all carrier operations.
 *
 * All errors extend CarrierError, which carries a string `code` discriminant.
 * This allows callers to switch on `err.code` without instanceof chains across
 * module boundaries.
 *
 * The `retryable` flag lets callers implement retry policies (e.g. exponential backoff)
 * without needing to pattern-match on error codes.
 */

export type CarrierErrorCode =
  | "AUTH_FAILED"
  | "RATE_REQUEST_INVALID"
  | "CARRIER_RATE_LIMITED"
  | "CARRIER_SERVER_ERROR"
  | "CARRIER_BLOCKED"
  | "NETWORK_TIMEOUT"
  | "NETWORK_ERROR"
  | "RESPONSE_PARSE_ERROR"
  | "CONFIGURATION_ERROR";

export class CarrierError extends Error {
  constructor(
    public readonly code: CarrierErrorCode,
    override readonly message: string,
    override readonly cause?: unknown,
    /** Raw upstream response payload, if available */
    public readonly carrierRawError?: unknown,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = "CarrierError";
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CarrierError);
    }
  }
}

export class AuthFailedError extends CarrierError {
  constructor(message: string, cause?: unknown) {
    super("AUTH_FAILED", message, cause, undefined, false);
    this.name = "AuthFailedError";
  }
}

export class RateLimitedError extends CarrierError {
  constructor(cause?: unknown) {
    super(
      "CARRIER_RATE_LIMITED",
      "Carrier returned 429 Too Many Requests",
      cause,
      undefined,
      true
    );
    this.name = "RateLimitedError";
  }
}

export class NetworkTimeoutError extends CarrierError {
  constructor(cause?: unknown) {
    super("NETWORK_TIMEOUT", "Request to carrier timed out", cause, undefined, true);
    this.name = "NetworkTimeoutError";
  }
}

export class ResponseParseError extends CarrierError {
  constructor(message: string, cause?: unknown, rawPayload?: unknown) {
    super("RESPONSE_PARSE_ERROR", message, cause, rawPayload, false);
    this.name = "ResponseParseError";
  }
}

export class ConfigurationError extends CarrierError {
  constructor(message: string) {
    super("CONFIGURATION_ERROR", message, undefined, undefined, false);
    this.name = "ConfigurationError";
  }
}
