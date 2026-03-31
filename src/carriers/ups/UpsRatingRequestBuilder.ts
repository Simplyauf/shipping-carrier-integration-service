import { randomUUID } from "crypto";
import type { RateShipmentRequest, Address } from "../../domain/types.js";
import type { UpsRateRequest } from "./schemas/rating.request.schema.js";

/**
 * Pure transformation class: converts domain RateShipmentRequest into UPS wire format.
 *
 * No side effects, no async — this makes it trivially testable in isolation and
 * straightforward to reason about. All UPS-specific field naming and encoding
 * lives here, keeping the carrier layer clean.
 */
export class UpsRatingRequestBuilder {
  /**
   * Builds the UPS rate request payload from a domain request.
   * Returns both the body and the transId so callers can correlate the response.
   */
  build(request: RateShipmentRequest): { body: UpsRateRequest; transId: string } {
    const transId = randomUUID();
    const requestOption = request.requestAllServices ? "Shop" : "Rate";

    const body: UpsRateRequest = {
      RateRequest: {
        Request: {
          RequestOption: requestOption,
          TransactionReference: { CustomerContext: transId },
        },
        Shipment: {
          Shipper: {
            Name: request.shipFrom.name,
            Address: this.mapAddress(request.shipFrom),
          },
          ShipTo: {
            Name: request.shipTo.name,
            Address: this.mapAddress(request.shipTo),
          },
          ShipFrom: {
            Name: request.shipFrom.name,
            Address: this.mapAddress(request.shipFrom),
          },
          Package: request.packages.map((pkg) => ({
            PackagingType: { Code: "02" },
            PackageWeight: {
              UnitOfMeasurement: { Code: "LBS" as const },
              Weight: pkg.weightLbs.toFixed(1),
            },
            ...(pkg.dimensions !== undefined && {
              Dimensions: {
                UnitOfMeasurement: { Code: "IN" as const },
                Length: String(pkg.dimensions.lengthIn),
                Width: String(pkg.dimensions.widthIn),
                Height: String(pkg.dimensions.heightIn),
              },
            }),
          })),
        },
      },
    };

    return { body, transId };
  }

  private mapAddress(addr: Address) {
    const lines = [addr.addressLine1, addr.addressLine2].filter(
      (line): line is string => line !== undefined && line.length > 0
    );

    return {
      AddressLine: lines,
      City: addr.city,
      StateProvinceCode: addr.stateOrProvince,
      PostalCode: addr.postalCode,
      CountryCode: addr.countryCode,
    };
  }
}
