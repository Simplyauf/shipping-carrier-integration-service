import type { UpsRateResponse, UpsRatedShipment } from "./schemas/rating.response.schema.js";
import type { ServiceRate, CurrencyCode } from "../../domain/types.js";
import { UPS_SERVICE_NAMES } from "./constants.js";

/**
 * Pure transformation class: converts UPS wire-format response into domain ServiceRate[].
 *
 * Unknown service codes are preserved rather than dropped, using a fallback name.
 * Optional fields (BillingWeight, TimeInTransit) are gracefully handled.
 */
export class UpsRatingResponseMapper {
  map(response: UpsRateResponse): ServiceRate[] {
    return response.RateResponse.RatedShipment.map((shipment) =>
      this.mapShipment(shipment)
    );
  }

  private mapShipment(shipment: UpsRatedShipment): ServiceRate {
    const serviceCode = shipment.Service.Code;
    const currency = shipment.TotalCharges.CurrencyCode as CurrencyCode;

    const serviceName =
      UPS_SERVICE_NAMES[serviceCode] ?? `UPS Service ${serviceCode}`;

    const rate: ServiceRate = {
      carrier: "UPS",
      serviceCode,
      serviceName,
      totalCharge: {
        amount: shipment.TotalCharges.MonetaryValue,
        currency,
      },
    };

    if (shipment.BillingWeight) {
      rate.ratedWeightLbs = parseFloat(shipment.BillingWeight.Weight);
    }

    if (shipment.TimeInTransit?.DaysInTransit) {
      rate.estimatedDays = parseInt(shipment.TimeInTransit.DaysInTransit, 10);
    }

    return rate;
  }
}
