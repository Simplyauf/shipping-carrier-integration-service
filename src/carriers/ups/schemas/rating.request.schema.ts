import { z } from "zod";

/**
 * Zod schema for the UPS Rating API outbound wire format.
 * This documents exactly what we send to UPS and serves as the source of truth
 * for the UpsRatingRequestBuilder.
 */

const UpsAddressSchema = z.object({
  AddressLine: z.union([z.string(), z.array(z.string())]).optional(),
  City: z.string(),
  StateProvinceCode: z.string(),
  PostalCode: z.string(),
  CountryCode: z.string(),
});

const UpsShipperSchema = z.object({
  Name: z.string(),
  ShipperNumber: z.string().optional(),
  Address: UpsAddressSchema,
});

const UpsShipToFromSchema = z.object({
  Name: z.string(),
  Address: UpsAddressSchema,
});

const UpsDimensionsSchema = z.object({
  UnitOfMeasurement: z.object({ Code: z.literal("IN") }),
  Length: z.string(),
  Width: z.string(),
  Height: z.string(),
});

const UpsPackageSchema = z.object({
  PackagingType: z.object({ Code: z.string() }),
  Dimensions: UpsDimensionsSchema.optional(),
  PackageWeight: z.object({
    UnitOfMeasurement: z.object({ Code: z.literal("LBS") }),
    Weight: z.string(),
  }),
});

export const UpsRateRequestSchema = z.object({
  RateRequest: z.object({
    Request: z.object({
      RequestOption: z.enum([
        "Rate",
        "Shop",
        "Ratetimeintransit",
        "Shoptimeintransit",
      ]),
      TransactionReference: z
        .object({ CustomerContext: z.string() })
        .optional(),
    }),
    Shipment: z.object({
      Shipper: UpsShipperSchema,
      ShipTo: UpsShipToFromSchema,
      ShipFrom: UpsShipToFromSchema,
      Package: z.array(UpsPackageSchema).min(1),
      PaymentInformation: z
        .object({
          ShipmentCharge: z.object({
            Type: z.literal("01"),
            BillShipper: z.object({ AccountNumber: z.string().optional() }),
          }),
        })
        .optional(),
    }),
  }),
});

export type UpsRateRequest = z.infer<typeof UpsRateRequestSchema>;
