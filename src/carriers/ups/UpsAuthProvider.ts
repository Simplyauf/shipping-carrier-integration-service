import axios from "axios";
import type { IAuthProvider } from "../../carrier/IAuthProvider.js";
import type { TokenInfo } from "../../domain/types.js";
import {
  AuthFailedError,
  NetworkTimeoutError,
  ResponseParseError,
  CarrierError,
} from "../../domain/errors.js";
import { UpsTokenResponseSchema } from "./schemas/auth.schema.js";
import { UPS_URLS } from "./constants.js";
import type { Env } from "../../config/env.js";

/**
 * UPS OAuth 2.0 client credentials authentication provider.
 *
 * Token lifecycle:
 * 1. First call: acquires token from UPS auth endpoint
 * 2. Subsequent calls: returns cached token (no HTTP request)
 * 3. Near-expiry: refreshes proactively (UPS_TOKEN_REFRESH_BUFFER_SECS before expiry)
 * 4. After 401 from HTTP layer: invalidateToken() is called, next call re-acquires
 *
 * Concurrency: in-flight deduplication prevents multiple simultaneous token requests
 * (thundering herd) when many requests trigger a refresh at the same moment.
 */
export class UpsAuthProvider implements IAuthProvider {
  private cachedToken: TokenInfo | null = null;
  /**
   * Deduplicates concurrent token requests. If a refresh is already in flight,
   * new callers attach to the same promise rather than starting a second HTTP call.
   */
  private inFlightTokenRequest: Promise<string> | null = null;

  constructor(private readonly env: Env) {}

  async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.isTokenValid(this.cachedToken)) {
      return this.cachedToken.accessToken;
    }

    if (this.inFlightTokenRequest) {
      return this.inFlightTokenRequest;
    }

    this.inFlightTokenRequest = this.fetchNewToken().finally(() => {
      this.inFlightTokenRequest = null;
    });

    return this.inFlightTokenRequest;
  }

  invalidateToken(): void {
    this.cachedToken = null;
  }

  private isTokenValid(token: TokenInfo): boolean {
    const bufferMs = this.env.UPS_TOKEN_REFRESH_BUFFER_SECS * 1000;
    return Date.now() < token.expiresAt - bufferMs;
  }

  private async fetchNewToken(): Promise<string> {
    const authUrl = UPS_URLS[this.env.UPS_ENVIRONMENT].auth;
    const credentials = Buffer.from(
      `${this.env.UPS_CLIENT_ID}:${this.env.UPS_CLIENT_SECRET}`
    ).toString("base64");

    let responseData: unknown;
    try {
      const { data } = await axios.post(
        authUrl,
        "grant_type=client_credentials",
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          timeout: this.env.UPS_TIMEOUT_MS,
        }
      );
      responseData = data;
    } catch (err: unknown) {
      throw this.mapAxiosError(err);
    }

    const parsed = UpsTokenResponseSchema.safeParse(responseData);
    if (!parsed.success) {
      throw new ResponseParseError(
        "UPS token response did not match expected schema",
        parsed.error,
        responseData
      );
    }

    // UPS returns issued_at as a Unix epoch timestamp in milliseconds (as a string)
    const issuedAtMs = parseInt(parsed.data.issued_at, 10);
    const expiresAt = issuedAtMs + parsed.data.expires_in * 1000;

    this.cachedToken = {
      accessToken: parsed.data.access_token,
      expiresAt,
      tokenType: parsed.data.token_type,
    };

    return this.cachedToken.accessToken;
  }

  private mapAxiosError(err: unknown): CarrierError {
    if (!axios.isAxiosError(err)) {
      return new CarrierError("NETWORK_ERROR", "Unexpected error during auth token fetch", err);
    }

    if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
      return new NetworkTimeoutError(err);
    }

    const status = err.response?.status;
    if (status === 401 || status === 403) {
      return new AuthFailedError(
        `UPS auth endpoint returned ${status}: invalid credentials`,
        err
      );
    }

    return new CarrierError(
      "NETWORK_ERROR",
      `Network error during auth token fetch (status: ${status ?? "none"})`,
      err
    );
  }
}
