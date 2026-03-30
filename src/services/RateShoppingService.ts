import type { CarrierRegistry } from "../carrier/CarrierRegistry.js";
import type { RateShipmentRequest, ServiceRate, RateShipmentResponse } from "../domain/types.js";

/**
 * High-level rate shopping façade.
 *
 * Provides two modes:
 * - shop(): fan out to ALL registered carriers, results sorted cheapest first
 * - shopCarrier(): rates from a single named carrier
 *
 * This layer is where cross-carrier concerns live: currency normalization,
 * result sorting, carrier selection logic, etc.
 */
export class RateShoppingService {
  constructor(private readonly registry: CarrierRegistry) {}

  /**
   * Get rates from all registered carriers, sorted cheapest-first.
   * One carrier failing does not prevent results from others.
   */
  async shop(request: RateShipmentRequest): Promise<ServiceRate[]> {
    return this.registry.getAllRates(request);
  }

  /**
   * Get rates from a single specific carrier by its carrierId.
   * Throws CarrierError CONFIGURATION_ERROR if the carrier is not registered.
   */
  async shopCarrier(
    carrierId: string,
    request: RateShipmentRequest
  ): Promise<RateShipmentResponse> {
    const carrier = this.registry.get(carrierId);
    return carrier.getRates(request);
  }
}
