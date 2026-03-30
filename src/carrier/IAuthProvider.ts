/**
 * Contract for carrier authentication providers.
 *
 * Each carrier has its own auth flow (UPS uses OAuth 2.0 client credentials,
 * FedEx uses a similar flow, USPS uses a different scheme entirely). Implementations
 * are responsible for token acquisition, caching, and refresh — the HTTP client
 * only calls getAccessToken() and trusts it to return a valid token.
 */
export interface IAuthProvider {
  /**
   * Returns a valid access token for use as a Bearer token.
   * Implementations must:
   * - Acquire a token on first call
   * - Return the cached token while it is still valid (respecting the refresh buffer)
   * - Deduplicate concurrent calls during token refresh (no thundering herd)
   * - Re-acquire after invalidateToken() has been called
   */
  getAccessToken(): Promise<string>;

  /**
   * Forces the cached token to be discarded. The HTTP client calls this
   * when it receives a 401, so the next getAccessToken() call re-acquires
   * rather than serving a potentially clock-skewed cached token.
   */
  invalidateToken(): void;
}
