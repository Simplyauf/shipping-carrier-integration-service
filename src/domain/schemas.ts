import { z } from "zod";
import { CarrierError } from "./errors.js";

const AddressSchema = z.object({
  name: z.string().min(1),
  company: z.string().optional(),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  stateOrProvince: z.string().min(1),
  postalCode: z.string().min(1),
  countryCode: z.string().length(2),
  residential: z.boolean().optional(),
});

const PackageSpecSchema = z.object({
  weightLbs: z.number().positive(),
  dimensions: z
    .object({
      lengthIn: z.number().positive(),
      widthIn: z.number().positive(),
      heightIn: z.number().positive(),
    })
    .optional(),
});

export const RateShipmentRequestSchema = z.object({
  shipFrom: AddressSchema,
  shipTo: AddressSchema,
  packages: z.array(PackageSpecSchema).min(1, "At least one package is required"),
  requestAllServices: z.boolean().optional(),
});

/**
 * Validates a RateShipmentRequest before any external call is made.
 * Throws CarrierError RATE_REQUEST_INVALID with a descriptive message on failure.
 */
export function validateRateRequest(request: unknown): void {
  const result = RateShipmentRequestSchema.safeParse(request);
  if (!result.success) {
    throw new CarrierError(
      "RATE_REQUEST_INVALID",
      `Invalid rate request: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
      result.error
    );
  }
}
