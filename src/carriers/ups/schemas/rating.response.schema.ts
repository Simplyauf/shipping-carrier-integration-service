import { z } from "zod";

/**
 * Zod schema for the UPS Rating API inbound wire format.
 * TypeScript types are derived exclusively via z.infer<> — no manual type duplication.
 *
 * Fields are marked optional generously because UPS may omit them depending on
 * the request option (Rate vs Shop vs Ratetimeintransit).
 */

const UpsMoneySchema = z.object({
  CurrencyCode: z.string(),
  MonetaryValue: z.string(),
});

const UpsRatedShipmentSchema = z.object({
  Service: z.object({ Code: z.string() }),
  TotalCharges: UpsMoneySchema,
  TransportationCharges: UpsMoneySchema.optional(),
  ServiceOptionsCharges: UpsMoneySchema.optional(),
  BillingWeight: z
    .object({
      UnitOfMeasurement: z.object({
        Code: z.string(),
        Description: z.string().optional(),
      }),
      Weight: z.string(),
    })
    .optional(),
  TimeInTransit: z
    .object({
      PickupDate: z.string().optional(),
      DaysInTransit: z.string().optional(),
      ServiceSummary: z
        .object({
          EstimatedArrival: z
            .object({
              Arrival: z
                .object({ Date: z.string(), Time: z.string() })
                .optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
  RatedShipmentAlert: z
    .array(z.object({ Code: z.string(), Description: z.string() }))
    .optional(),
  NegotiatedRateCharges: z
    .object({ TotalCharge: UpsMoneySchema.optional() })
    .optional(),
});

export const UpsRateResponseSchema = z.object({
  RateResponse: z.object({
    Response: z.object({
      ResponseStatus: z.object({
        Code: z.string(),
        Description: z.string().optional(),
      }),
      Alert: z
        .array(z.object({ Code: z.string(), Description: z.string() }))
        .optional(),
    }),
    RatedShipment: z.array(UpsRatedShipmentSchema),
  }),
});

export type UpsRateResponse = z.infer<typeof UpsRateResponseSchema>;
export type UpsRatedShipment = z.infer<typeof UpsRatedShipmentSchema>;
