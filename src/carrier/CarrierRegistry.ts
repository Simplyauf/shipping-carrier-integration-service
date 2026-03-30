import type { ICarrier } from "./ICarrier.js";
import type { RateShipmentRequest, ServiceRate } from "../domain/types.js";
import { CarrierError } from "../domain/errors.js";

/**
 * Registry for all available carrier implementations.
 *
 * Provides two modes:
 * - shopCarrier(): rates from a single named carrier
 * - getAllRates(): fan-out to all registered carriers, sorted cheapest-first
 *
 * getAllRates() uses Promise.allSettled so one carrier failing does not
 * prevent results from others (graceful degradation).
 */
export class CarrierRegistry {
  private readonly carriers = new Map<string, ICarrier>();

  register(carrier: ICarrier): this {
    this.carriers.set(carrier.carrierId, carrier);
    return this;
  }

  get(carrierId: string): ICarrier {
    const carrier = this.carriers.get(carrierId);
    if (!carrier) {
      throw new CarrierError(
        "CONFIGURATION_ERROR",
        `No carrier registered with id "${carrierId}". Registered carriers: [${Array.from(this.carriers.keys()).join(", ")}]`
      );
    }
    return carrier;
  }

  /**
   * Fan out to all registered carriers in parallel.
   * Failed carriers are silently dropped — at least zero results returned.
   * Rates are sorted by total charge ascending (cheapest first).
   */
  async getAllRates(request: RateShipmentRequest): Promise<ServiceRate[]> {
    const results = await Promise.allSettled(
      Array.from(this.carriers.values()).map((c) => c.getRates(request))
    );

    const rates: ServiceRate[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        rates.push(...result.value.rates);
      }
      // Rejected carriers could be logged/instrumented here
    }

    return rates.sort(
      (a, b) => parseFloat(a.totalCharge.amount) - parseFloat(b.totalCharge.amount)
    );
  }

  registeredCarrierIds(): string[] {
    return Array.from(this.carriers.keys());
  }
}
