import nock from "nock";

const SANDBOX_HOST = "https://wwwcie.ups.com";
const AUTH_PATH = "/security/v1/oauth/token";
const RATING_PATH_PATTERN = /\/api\/rating\/v2409\/.*/;

/**
 * Stub a successful UPS auth token response.
 */
export function stubUpsAuthSuccess(
  tokenResponse: object
): nock.Interceptor {
  return nock(SANDBOX_HOST)
    .post(AUTH_PATH, "grant_type=client_credentials")
    .reply(200, tokenResponse);
}

/**
 * Stub a failed UPS auth response with a given HTTP status.
 */
export function stubUpsAuthFailure(
  status: number,
  body: object
): nock.Interceptor {
  return nock(SANDBOX_HOST).post(AUTH_PATH).reply(status, body);
}

/**
 * Stub a successful UPS rating response.
 */
export function stubUpsRatingSuccess(responseBody: object): nock.Interceptor {
  return nock(SANDBOX_HOST)
    .post(RATING_PATH_PATTERN)
    .reply(200, responseBody);
}

/**
 * Stub a failed UPS rating response with a given HTTP status.
 */
export function stubUpsRatingFailure(
  status: number,
  body: object
): nock.Interceptor {
  return nock(SANDBOX_HOST).post(RATING_PATH_PATTERN).reply(status, body);
}

/**
 * Stub a UPS rating request that times out (connection reset).
 */
export function stubUpsRatingTimeout(): nock.Interceptor {
  return nock(SANDBOX_HOST)
    .post(RATING_PATH_PATTERN)
    .replyWithError({ code: "ECONNABORTED", message: "connect ETIMEDOUT" });
}

/**
 * Stub a UPS auth timeout.
 */
export function stubUpsAuthTimeout(): nock.Interceptor {
  return nock(SANDBOX_HOST)
    .post(AUTH_PATH)
    .replyWithError({ code: "ECONNABORTED", message: "connect ETIMEDOUT" });
}

/**
 * Stubs the 401-refresh-retry flow:
 * 1. Auth succeeds (first token)
 * 2. Rating call returns 401
 * 3. Auth succeeds again (after invalidateToken)
 * 4. Retry rating call succeeds
 */
export function stubUpsRating401ThenSuccess(
  tokenResponse: object,
  ratingResponse: object
): void {
  // First auth call
  stubUpsAuthSuccess(tokenResponse);
  // Rating: first call returns 401
  nock(SANDBOX_HOST).post(RATING_PATH_PATTERN).reply(401, {
    response: {
      errors: [{ code: "10401", message: "Token is expired or invalid" }],
    },
  });
  // Second auth call (after invalidateToken)
  stubUpsAuthSuccess(tokenResponse);
  // Rating: retry succeeds
  nock(SANDBOX_HOST).post(RATING_PATH_PATTERN).reply(200, ratingResponse);
}

/**
 * Stubs the 401-refresh-retry flow where the retry also returns 401.
 */
export function stubUpsRating401Twice(tokenResponse: object): void {
  stubUpsAuthSuccess(tokenResponse);
  nock(SANDBOX_HOST).post(RATING_PATH_PATTERN).reply(401, {
    response: {
      errors: [{ code: "10401", message: "Token is expired or invalid" }],
    },
  });
  stubUpsAuthSuccess(tokenResponse);
  nock(SANDBOX_HOST).post(RATING_PATH_PATTERN).reply(401, {
    response: {
      errors: [{ code: "10401", message: "Token is still expired" }],
    },
  });
}
