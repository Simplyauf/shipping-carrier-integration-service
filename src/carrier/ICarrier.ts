import type { RateShipmentRequest, RateShipmentResponse } from "../domain/types.js";

/**
 * Contract for shipping carrier implementations.
 *
 * To add a new carrier (e.g. FedEx):
 * 1. Create src/carriers/fedex/FedExCarrier.ts implementing this interface
 * 2. Set carrierId = "FEDEX"
 * 3. Register with CarrierRegistry.register(new FedExCarrier(env))
 *
 * No existing code changes required.
 */
export interface ICarrier {
  /** Unique carrier identifier used in ServiceRate.carrier (e.g. "UPS", "FEDEX") */
  readonly carrierId: string;

  /**
   * Fetch shipping rates for the given shipment.
   * Must resolve to normalized domain rates or reject with a CarrierError subclass.
   * The caller should never need to know anything about the carrier's wire format.
   */
  getRates(request: RateShipmentRequest): Promise<RateShipmentResponse>;
}
