import { describe, it, expect, beforeEach, afterEach } from "vitest";
import nock from "nock";
import { UpsCarrier } from "../../src/carriers/ups/UpsCarrier.js";
import {
  stubUpsAuthSuccess,
  stubUpsRatingSuccess,
} from "../helpers/nock.helper.js";
import { validTokenResponse } from "../fixtures/ups.auth.fixture.js";
import {
  shopSuccessResponse,
  singleRateSuccessResponse,
  unknownServiceCodeResponse,
  emptyRatedShipmentResponse,
  malformedRatingResponse,
} from "../fixtures/ups.rating.response.fixture.js";
import {
  basicDomesticRequest,
  singleServiceRequest,
  multiPieceRequest,
  noDimensionsRequest,
} from "../fixtures/ups.rating.request.fixture.js";
import { ResponseParseError, CarrierError } from "../../src/domain/errors.js";

const testEnv = {
  UPS_CLIENT_ID: "test-client-id",
  UPS_CLIENT_SECRET: "test-client-secret",
  UPS_ENVIRONMENT: "sandbox" as const,
  UPS_TIMEOUT_MS: 5000,
  UPS_TOKEN_REFRESH_BUFFER_SECS: 60,
  NODE_ENV: "test" as const,
};

describe("UpsCarrier.getRates — response parsing", () => {
  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it("returns normalized ServiceRate[] from a successful Shop response", async () => {
    stubUpsAuthSuccess(validTokenResponse);
    stubUpsRatingSuccess(shopSuccessResponse);
    const carrier = new UpsCarrier(testEnv);

    const result = await carrier.getRates(basicDomesticRequest);

    expect(result.rates).toHaveLength(3);
    expect(result.requestId).toBeTruthy();

    // Cheapest service (UPS Ground)
    const ground = result.rates.find((r) => r.serviceCode === "03");
    expect(ground).toBeDefined();
    expect(ground!.carrier).toBe("UPS");
    expect(ground!.serviceName).toBe("UPS Ground");
    expect(ground!.totalCharge).toEqual({ amount: "12.50", currency: "USD" });
    expect(ground!.estimatedDays).toBe(4);
    expect(ground!.ratedWeightLbs).toBe(5.0);

    // Most expensive service (Next Day Air)
    const nextDay = result.rates.find((r) => r.serviceCode === "01");
    expect(nextDay!.serviceName).toBe("UPS Next Day Air");
    expect(nextDay!.totalCharge.amount).toBe("48.00");
    expect(nextDay!.estimatedDays).toBe(1);
  });

  it("returns a single ServiceRate from a Rate (non-shop) response", async () => {
    stubUpsAuthSuccess(validTokenResponse);
    stubUpsRatingSuccess(singleRateSuccessResponse);
    const carrier = new UpsCarrier(testEnv);

    const result = await carrier.getRates(singleServiceRequest);

    expect(result.rates).toHaveLength(1);
    expect(result.rates[0]?.serviceCode).toBe("03");
  });

  it("maps unknown service codes to a fallback name rather than dropping them", async () => {
    stubUpsAuthSuccess(validTokenResponse);
    stubUpsRatingSuccess(unknownServiceCodeResponse);
    const carrier = new UpsCarrier(testEnv);

    const result = await carrier.getRates(basicDomesticRequest);

    expect(result.rates).toHaveLength(1);
    expect(result.rates[0]?.serviceName).toBe("UPS Service 99");
  });

  it("returns empty rates array when RatedShipment is empty (no error)", async () => {
    stubUpsAuthSuccess(validTokenResponse);
    stubUpsRatingSuccess(emptyRatedShipmentResponse);
    const carrier = new UpsCarrier(testEnv);

    const result = await carrier.getRates(basicDomesticRequest);

    expect(result.rates).toHaveLength(0);
  });

  it("throws ResponseParseError on malformed rating response", async () => {
    stubUpsAuthSuccess(validTokenResponse);
    stubUpsRatingSuccess(malformedRatingResponse);
    const carrier = new UpsCarrier(testEnv);

    const err = await carrier.getRates(basicDomesticRequest).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ResponseParseError);
    expect((err as ResponseParseError).code).toBe("RESPONSE_PARSE_ERROR");
    expect((err as ResponseParseError).carrierRawError).toEqual(malformedRatingResponse);
  });

  it("throws RATE_REQUEST_INVALID before any HTTP call when input is invalid", async () => {
    // No nock stubs registered — any HTTP call would throw an unmatched request error
    const carrier = new UpsCarrier(testEnv);
    const badRequest = { shipFrom: {}, shipTo: {}, packages: [] };

    const err = await carrier.getRates(badRequest as never).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(CarrierError);
    expect((err as CarrierError).code).toBe("RATE_REQUEST_INVALID");
    expect(nock.pendingMocks()).toHaveLength(0); // no HTTP was attempted
  });
});

describe("UpsCarrier.getRates — request payload validation", () => {
  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it("sends RequestOption=Shop when requestAllServices=true", async () => {
    stubUpsAuthSuccess(validTokenResponse);
    let capturedBody: Record<string, unknown> = {};

    nock("https://wwwcie.ups.com")
      .post(/\/api\/rating\/v2409\/.*/, (body: unknown) => {
        capturedBody = body as Record<string, unknown>;
        return true;
      })
      .reply(200, shopSuccessResponse);

    const carrier = new UpsCarrier(testEnv);
    await carrier.getRates(basicDomesticRequest);

    const rateRequest = capturedBody["RateRequest"] as Record<string, unknown>;
    const request = rateRequest["Request"] as Record<string, unknown>;
    expect(request["RequestOption"]).toBe("Shop");
  });

  it("sends RequestOption=Rate when requestAllServices=false", async () => {
    stubUpsAuthSuccess(validTokenResponse);
    let capturedBody: Record<string, unknown> = {};

    nock("https://wwwcie.ups.com")
      .post(/\/api\/rating\/v2409\/.*/, (body: unknown) => {
        capturedBody = body as Record<string, unknown>;
        return true;
      })
      .reply(200, singleRateSuccessResponse);

    const carrier = new UpsCarrier(testEnv);
    await carrier.getRates(singleServiceRequest);

    const rateRequest = capturedBody["RateRequest"] as Record<string, unknown>;
    const request = rateRequest["Request"] as Record<string, unknown>;
    expect(request["RequestOption"]).toBe("Rate");
  });

  it("maps multi-piece packages to correct Package[] entries with weights", async () => {
    stubUpsAuthSuccess(validTokenResponse);
    let capturedBody: Record<string, unknown> = {};

    nock("https://wwwcie.ups.com")
      .post(/\/api\/rating\/v2409\/.*/, (body: unknown) => {
        capturedBody = body as Record<string, unknown>;
        return true;
      })
      .reply(200, shopSuccessResponse);

    const carrier = new UpsCarrier(testEnv);
    await carrier.getRates(multiPieceRequest);

    const rateRequest = capturedBody["RateRequest"] as Record<string, unknown>;
    const shipment = rateRequest["Shipment"] as Record<string, unknown>;
    const packages = shipment["Package"] as Array<Record<string, unknown>>;

    expect(packages).toHaveLength(2);

    const pkg1 = packages[0] as Record<string, unknown>;
    const weight1 = pkg1["PackageWeight"] as Record<string, unknown>;
    expect(weight1["Weight"]).toBe("3.0");

    const pkg2 = packages[1] as Record<string, unknown>;
    const weight2 = pkg2["PackageWeight"] as Record<string, unknown>;
    expect(weight2["Weight"]).toBe("7.5");
    const dims2 = pkg2["Dimensions"] as Record<string, unknown>;
    expect(dims2["Length"]).toBe("20");
    expect(dims2["Width"]).toBe("15");
    expect(dims2["Height"]).toBe("10");
  });

  it("omits Dimensions field entirely when package has no dimensions", async () => {
    stubUpsAuthSuccess(validTokenResponse);
    let capturedBody: Record<string, unknown> = {};

    nock("https://wwwcie.ups.com")
      .post(/\/api\/rating\/v2409\/.*/, (body: unknown) => {
        capturedBody = body as Record<string, unknown>;
        return true;
      })
      .reply(200, singleRateSuccessResponse);

    const carrier = new UpsCarrier(testEnv);
    await carrier.getRates(noDimensionsRequest);

    const rateRequest = capturedBody["RateRequest"] as Record<string, unknown>;
    const shipment = rateRequest["Shipment"] as Record<string, unknown>;
    const packages = shipment["Package"] as Array<Record<string, unknown>>;
    const pkg = packages[0] as Record<string, unknown>;

    expect(pkg["Dimensions"]).toBeUndefined();
  });

  it("maps shipFrom address fields correctly to UPS wire format", async () => {
    stubUpsAuthSuccess(validTokenResponse);
    let capturedBody: Record<string, unknown> = {};

    nock("https://wwwcie.ups.com")
      .post(/\/api\/rating\/v2409\/.*/, (body: unknown) => {
        capturedBody = body as Record<string, unknown>;
        return true;
      })
      .reply(200, shopSuccessResponse);

    const carrier = new UpsCarrier(testEnv);
    await carrier.getRates(basicDomesticRequest);

    const rateRequest = capturedBody["RateRequest"] as Record<string, unknown>;
    const shipment = rateRequest["Shipment"] as Record<string, unknown>;
    const shipper = shipment["Shipper"] as Record<string, unknown>;
    const address = shipper["Address"] as Record<string, unknown>;

    expect(shipper["Name"]).toBe("Acme Warehouse");
    expect(address["City"]).toBe("Chicago");
    expect(address["StateProvinceCode"]).toBe("IL");
    expect(address["PostalCode"]).toBe("60601");
    expect(address["CountryCode"]).toBe("US");
  });

  it("sends Bearer token and required UPS headers", async () => {
    stubUpsAuthSuccess(validTokenResponse);
    let capturedHeaders: Record<string, string | string[]> = {};

    nock("https://wwwcie.ups.com")
      .post(/\/api\/rating\/v2409\/.*/)
      .reply(function () {
        capturedHeaders = this.req.headers as Record<string, string | string[]>;
        return [200, shopSuccessResponse];
      });

    const carrier = new UpsCarrier(testEnv);
    await carrier.getRates(basicDomesticRequest);

    expect(capturedHeaders["authorization"]).toBe(
      "Bearer test-access-token-abc123xyz"
    );
    expect(capturedHeaders["transid"]).toBeTruthy();
    expect(capturedHeaders["transactionsrc"]).toBe(
      "shipping-carrier-integration"
    );
  });
});
