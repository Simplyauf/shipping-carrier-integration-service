import axios, { type AxiosInstance } from "axios";
import type { IAuthProvider } from "../../carrier/IAuthProvider.js";
import {
  AuthFailedError,
  RateLimitedError,
  NetworkTimeoutError,
  CarrierError,
} from "../../domain/errors.js";
import { UpsErrorResponseSchema } from "./schemas/auth.schema.js";
import type { Env } from "../../config/env.js";

/**
 * Axios-based HTTP client for the UPS API.
 *
 * Responsibilities:
 * - Injects Bearer token and UPS-required headers on every request
 * - Handles 401 responses by invalidating the token cache and retrying once
 *   (covers clock-skew and race-condition expiry cases)
 * - Maps all HTTP/network errors to structured CarrierError subclasses
 * - Extracts UPS error messages from the response body for actionable error strings
 */
export class UpsHttpClient {
  private readonly http: AxiosInstance;

  constructor(
    private readonly authProvider: IAuthProvider,
    private readonly env: Env,
    baseURL: string
  ) {
    this.http = axios.create({
      baseURL,
      timeout: env.UPS_TIMEOUT_MS,
      headers: { "Content-Type": "application/json" },
    });
  }

  async post<TResponse>(
    path: string,
    body: unknown,
    transId: string
  ): Promise<TResponse> {
    const token = await this.authProvider.getAccessToken();

    try {
      const { data } = await this.http.post<TResponse>(path, body, {
        headers: this.buildHeaders(token, transId),
      });
      return data;
    } catch (err: unknown) {
      if (!axios.isAxiosError(err)) {
        throw new CarrierError(
          "NETWORK_ERROR",
          "Unexpected non-Axios error during request",
          err
        );
      }

      // On 401: invalidate the cached token and retry exactly once.
      // This handles cases where the token expired between cache check and use.
      if (err.response?.status === 401) {
        this.authProvider.invalidateToken();
        return this.retryWithFreshToken(path, body, transId);
      }

      throw this.mapAxiosError(err);
    }
  }

  private async retryWithFreshToken<TResponse>(
    path: string,
    body: unknown,
    transId: string
  ): Promise<TResponse> {
    const freshToken = await this.authProvider.getAccessToken();
    try {
      const { data } = await this.http.post<TResponse>(path, body, {
        headers: this.buildHeaders(freshToken, transId),
      });
      return data;
    } catch (err: unknown) {
      throw this.mapAxiosError(err);
    }
  }

  private buildHeaders(token: string, transId: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      transId,
      transactionSrc: "shipping-carrier-integration",
    };
  }

  private mapAxiosError(err: unknown): CarrierError {
    if (!axios.isAxiosError(err)) {
      return new CarrierError("NETWORK_ERROR", "Unexpected non-Axios error", err);
    }

    if (err.code === "ECONNABORTED" || err.code === "ETIMEDOUT") {
      return new NetworkTimeoutError(err);
    }
    if (!err.response) {
      return new CarrierError("NETWORK_ERROR", "No response received from UPS", err);
    }

    const status = err.response.status;
    const rawBody = err.response.data as unknown;

    // Try to extract structured UPS error messages for a more actionable error string
    const parsed = UpsErrorResponseSchema.safeParse(rawBody);
    const upsMsgs = parsed.success
      ? parsed.data.response.errors
          .map((e) => `[${e.code}] ${e.message}`)
          .join("; ")
      : "";

    if (status === 401 || status === 403) {
      return new AuthFailedError(
        `UPS returned ${status}${upsMsgs ? `: ${upsMsgs}` : ""}`,
        err
      );
    }
    if (status === 429) {
      return new RateLimitedError(err);
    }
    if (status === 400) {
      return new CarrierError(
        "RATE_REQUEST_INVALID",
        `UPS rejected the rate request${upsMsgs ? `: ${upsMsgs}` : ""}`,
        err,
        rawBody
      );
    }
    if (status >= 500) {
      return new CarrierError(
        "CARRIER_SERVER_ERROR",
        `UPS server error ${status}${upsMsgs ? `: ${upsMsgs}` : ""}`,
        err,
        rawBody,
        true
      );
    }

    return new CarrierError(
      "NETWORK_ERROR",
      `Unexpected HTTP ${status} from UPS${upsMsgs ? `: ${upsMsgs}` : ""}`,
      err,
      rawBody
    );
  }
}
