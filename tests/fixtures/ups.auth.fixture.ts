/**
 * Realistic UPS auth API response fixtures based on UPS documentation payloads.
 */

const NOW_MS = Date.now();

export const validTokenResponse = {
  access_token: "test-access-token-abc123xyz",
  token_type: "Bearer",
  expires_in: 3600,
  issued_at: String(NOW_MS),
  client_id: "test-client-id",
  scope: "public",
  status: "approved",
  refresh_count: "0",
};

/** A token that was issued 3700 seconds ago — it has expired */
export const expiredTokenResponse = {
  ...validTokenResponse,
  access_token: "expired-token-old",
  issued_at: String(NOW_MS - 3700 * 1000),
};

/** A fresh token returned on second acquisition (after invalidation) */
export const refreshedTokenResponse = {
  ...validTokenResponse,
  access_token: "refreshed-token-xyz789",
  issued_at: String(NOW_MS),
};

/** UPS error response for 401 Unauthorized */
export const authUnauthorizedError = {
  response: {
    errors: [
      {
        code: "10401",
        message: "ClientId is Invalid",
      },
    ],
  },
};

/** Completely unexpected/malformed response from auth endpoint */
export const malformedAuthResponse = {
  totally_unexpected_field: "this is not a token",
  status_code: 200,
};
