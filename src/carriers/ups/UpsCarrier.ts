import type { ICarrier } from "../../carrier/ICarrier.js";
import type { RateShipmentRequest, RateShipmentResponse } from "../../domain/types.js";
import { ResponseParseError } from "../../domain/errors.js";
import { UpsAuthProvider } from "./UpsAuthProvider.js";
import { UpsHttpClient } from "./UpsHttpClient.js";
import { UpsRatingRequestBuilder } from "./UpsRatingRequestBuilder.js";
import { UpsRatingResponseMapper } from "./UpsRatingResponseMapper.js";
import { UpsRateResponseSchema } from "./schemas/rating.response.schema.js";
import { UPS_URLS, UPS_RATING_VERSION } from "./constants.js";
import type { Env } from "../../config/env.js";
import type { IAuthProvider } from "../../carrier/IAuthProvider.js";

/**
 * UPS carrier implementation.
 *
 * Orchestrates: request building → HTTP call → Zod validation → response mapping.
 *
 * The constructor accepts an optional IAuthProvider to allow injection of a mock
 * or test double in integration tests without needing to stub at the HTTP layer.
 *
 * To add a new UPS operation (e.g. label creation):
 * 1. Add a new builder/mapper pair (e.g. UpsLabelRequestBuilder, UpsLabelResponseMapper)
 * 2. Add the method to ICarrier (or a separate ILabelCapable interface)
 * 3. Implement here — no changes to existing methods required
 */
export class UpsCarrier implements ICarrier {
  readonly carrierId = "UPS";

  private readonly httpClient: UpsHttpClient;
  private readonly requestBuilder: UpsRatingRequestBuilder;
  private readonly responseMapper: UpsRatingResponseMapper;

  constructor(env: Env, authProvider?: IAuthProvider) {
    const auth = authProvider ?? new UpsAuthProvider(env);
    const baseUrl = UPS_URLS[env.UPS_ENVIRONMENT].rating;
    this.httpClient = new UpsHttpClient(auth, env, baseUrl);
    this.requestBuilder = new UpsRatingRequestBuilder();
    this.responseMapper = new UpsRatingResponseMapper();
  }

  async getRates(request: RateShipmentRequest): Promise<RateShipmentResponse> {
    const { body, transId } = this.requestBuilder.build(request);

    // Use /Shop to get all available services, /Rate for a specific service
    const requestOption = request.requestAllServices ? "Shop" : "Rate";
    const path = `/${UPS_RATING_VERSION}/${requestOption}`;

    const rawResponse = await this.httpClient.post(path, body, transId);

    const parsed = UpsRateResponseSchema.safeParse(rawResponse);
    if (!parsed.success) {
      throw new ResponseParseError(
        "UPS rating response did not match expected schema",
        parsed.error,
        rawResponse
      );
    }

    const rates = this.responseMapper.map(parsed.data);
    return { rates, requestId: transId };
  }
}
