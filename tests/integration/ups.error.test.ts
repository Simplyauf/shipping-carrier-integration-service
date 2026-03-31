import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { UpsCarrier } from "../../src/carriers/ups/UpsCarrier.js";
import {
  stubUpsAuthSuccess,
  stubUpsRatingFailure,
  stubUpsRatingTimeout,
  stubUpsRating401ThenSuccess,
  stubUpsRating401Twice,
} from "../helpers/nock.helper.js";
import { validTokenResponse } from "../fixtures/ups.auth.fixture.js";
import {
  shopSuccessResponse,
  badRequestError,
  rateLimitError,
  serverError,
} from "../fixtures/ups.rating.response.fixture.js";
import { basicDomesticRequest } from "../fixtures/ups.rating.request.fixture.js";
import {
  CarrierError,
  AuthFailedError,
  RateLimitedError,
  NetworkTimeoutError,
} from "../../src/domain/errors.js";

const testEnv = {
  UPS_CLIENT_ID: "test-client-id",
  UPS_CLIENT_SECRET: "test-client-secret",
  UPS_ENVIRONMENT: "sandbox" as const,
  UPS_TIMEOUT_MS: 5000,
  UPS_TOKEN_REFRESH_BUFFER_SECS: 60,
  NODE_ENV: "test" as const,
};

describe("UpsCarrier error handling", () => {
  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it("throws RateLimitedError (retryable) on HTTP 429", async () => {
    stubUpsAuthSuccess(validTokenResponse);
    stubUpsRatingFailure(429, rateLimitError);
    const carrier = new UpsCarrier(testEnv);

    const err = await carrier.getRates(basicDomesticRequest).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(RateLimitedError);
    expect((err as RateLimitedError).code).toBe("CARRIER_RATE_LIMITED");
    expect((err as RateLimitedError).retryable).toBe(true);
  });

  it("throws CarrierError RATE_REQUEST_INVALID on HTTP 400 with UPS error message", async () => {
    stubUpsAuthSuccess(validTokenResponse);
    stubUpsRatingFailure(400, badRequestError);
    const carrier = new UpsCarrier(testEnv);

    const err = await carrier.getRates(basicDomesticRequest).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(CarrierError);
    expect((err as CarrierError).code).toBe("RATE_REQUEST_INVALID");
    expect((err as CarrierError).message).toContain("ShipperNumber is invalid");
    expect((err as CarrierError).retryable).toBe(false);
  });

  it("throws CarrierError CARRIER_SERVER_ERROR (retryable) on HTTP 500", async () => {
    stubUpsAuthSuccess(validTokenResponse);
    stubUpsRatingFailure(500, serverError);
    const carrier = new UpsCarrier(testEnv);

    const err = await carrier.getRates(basicDomesticRequest).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(CarrierError);
    expect((err as CarrierError).code).toBe("CARRIER_SERVER_ERROR");
    expect((err as CarrierError).retryable).toBe(true);
  });

  it("throws NetworkTimeoutError on connection timeout", async () => {
    stubUpsAuthSuccess(validTokenResponse);
    stubUpsRatingTimeout();
    const carrier = new UpsCarrier(testEnv);

    const err = await carrier.getRates(basicDomesticRequest).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(NetworkTimeoutError);
    expect((err as NetworkTimeoutError).code).toBe("NETWORK_TIMEOUT");
    expect((err as NetworkTimeoutError).retryable).toBe(true);
  });

  it("transparently retries and succeeds after receiving a 401 on the rating call", async () => {
    stubUpsRating401ThenSuccess(validTokenResponse, shopSuccessResponse);
    const carrier = new UpsCarrier(testEnv);

    const result = await carrier.getRates(basicDomesticRequest);

    expect(result.rates).toHaveLength(3);
  });

  it("throws AuthFailedError if retry after 401 also returns 401", async () => {
    stubUpsRating401Twice(validTokenResponse);
    const carrier = new UpsCarrier(testEnv);

    const err = await carrier.getRates(basicDomesticRequest).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AuthFailedError);
    expect((err as AuthFailedError).code).toBe("AUTH_FAILED");
    expect((err as AuthFailedError).retryable).toBe(false);
  });
});
