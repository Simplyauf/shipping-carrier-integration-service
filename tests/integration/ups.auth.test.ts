import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { UpsAuthProvider } from "../../src/carriers/ups/UpsAuthProvider.js";
import {
  stubUpsAuthSuccess,
  stubUpsAuthFailure,
  stubUpsAuthTimeout,
} from "../helpers/nock.helper.js";
import {
  validTokenResponse,
  refreshedTokenResponse,
  malformedAuthResponse,
  authUnauthorizedError,
} from "../fixtures/ups.auth.fixture.js";
import {
  AuthFailedError,
  NetworkTimeoutError,
  ResponseParseError,
} from "../../src/domain/errors.js";

const testEnv = {
  UPS_CLIENT_ID: "test-client-id",
  UPS_CLIENT_SECRET: "test-client-secret",
  UPS_ENVIRONMENT: "sandbox" as const,
  UPS_TIMEOUT_MS: 5000,
  UPS_TOKEN_REFRESH_BUFFER_SECS: 60,
  NODE_ENV: "test" as const,
};

describe("UpsAuthProvider", () => {
  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it("acquires a token on first call and returns access_token", async () => {
    stubUpsAuthSuccess(validTokenResponse);
    const provider = new UpsAuthProvider(testEnv);

    const token = await provider.getAccessToken();

    expect(token).toBe("test-access-token-abc123xyz");
  });

  it("serves from cache on second call (no additional HTTP request)", async () => {
    stubUpsAuthSuccess(validTokenResponse);
    const provider = new UpsAuthProvider(testEnv);

    const token1 = await provider.getAccessToken();
    const token2 = await provider.getAccessToken();

    expect(token1).toBe(token2);
    expect(nock.pendingMocks()).toHaveLength(0);
  });

  it("deduplicates concurrent token requests into a single HTTP call", async () => {
    stubUpsAuthSuccess(validTokenResponse);
    const provider = new UpsAuthProvider(testEnv);

    const [t1, t2, t3] = await Promise.all([
      provider.getAccessToken(),
      provider.getAccessToken(),
      provider.getAccessToken(),
    ]);

    expect(t1).toBe(t2);
    expect(t2).toBe(t3);
    expect(nock.pendingMocks()).toHaveLength(0);
  });

  it("re-acquires token after invalidateToken() is called", async () => {
    stubUpsAuthSuccess(validTokenResponse);
    stubUpsAuthSuccess(refreshedTokenResponse);
    const provider = new UpsAuthProvider(testEnv);

    await provider.getAccessToken();
    provider.invalidateToken();
    const fresh = await provider.getAccessToken();

    expect(fresh).toBe("refreshed-token-xyz789");
    expect(nock.pendingMocks()).toHaveLength(0);
  });

  it("throws AuthFailedError on HTTP 401 from auth endpoint", async () => {
    stubUpsAuthFailure(401, authUnauthorizedError);
    const provider = new UpsAuthProvider(testEnv);

    await expect(provider.getAccessToken()).rejects.toBeInstanceOf(AuthFailedError);
  });

  it("throws AuthFailedError on HTTP 403 from auth endpoint", async () => {
    stubUpsAuthFailure(403, authUnauthorizedError);
    const provider = new UpsAuthProvider(testEnv);

    const err = await provider.getAccessToken().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthFailedError);
    expect((err as AuthFailedError).code).toBe("AUTH_FAILED");
    expect((err as AuthFailedError).retryable).toBe(false);
  });

  it("throws NetworkTimeoutError on connection timeout", async () => {
    stubUpsAuthTimeout();
    const provider = new UpsAuthProvider(testEnv);

    const err = await provider.getAccessToken().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(NetworkTimeoutError);
    expect((err as NetworkTimeoutError).retryable).toBe(true);
  });

  it("throws ResponseParseError on malformed token response", async () => {
    nock("https://wwwcie.ups.com")
      .post("/security/v1/oauth/token")
      .reply(200, malformedAuthResponse);
    const provider = new UpsAuthProvider(testEnv);

    const err = await provider.getAccessToken().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ResponseParseError);
    expect((err as ResponseParseError).code).toBe("RESPONSE_PARSE_ERROR");
    expect((err as ResponseParseError).carrierRawError).toEqual(malformedAuthResponse);
  });

  it("sends correct Basic auth header and content-type", async () => {
    const expectedCredentials = Buffer.from("test-client-id:test-client-secret").toString("base64");
    let capturedHeaders: Record<string, string | string[]> = {};

    nock("https://wwwcie.ups.com")
      .post("/security/v1/oauth/token")
      .reply(function (uri, requestBody) {
        capturedHeaders = this.req.headers as Record<string, string | string[]>;
        return [200, validTokenResponse];
      });

    const provider = new UpsAuthProvider(testEnv);
    await provider.getAccessToken();

    expect(capturedHeaders["authorization"]).toBe(`Basic ${expectedCredentials}`);
    expect(capturedHeaders["content-type"]).toContain("application/x-www-form-urlencoded");
  });
});
