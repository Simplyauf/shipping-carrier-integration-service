/**
 * Realistic UPS Rating API response fixtures based on UPS documentation payloads.
 * These are fed to nock interceptors to simulate live API responses.
 */

/** Successful Shop response with 3 service options */
export const shopSuccessResponse = {
  RateResponse: {
    Response: {
      ResponseStatus: {
        Code: "1",
        Description: "Success",
      },
      TransactionReference: {
        CustomerContext: "test-transaction-id",
      },
    },
    RatedShipment: [
      {
        Service: { Code: "03" },
        TotalCharges: { CurrencyCode: "USD", MonetaryValue: "12.50" },
        TransportationCharges: { CurrencyCode: "USD", MonetaryValue: "12.50" },
        ServiceOptionsCharges: { CurrencyCode: "USD", MonetaryValue: "0.00" },
        BillingWeight: {
          UnitOfMeasurement: { Code: "LBS", Description: "Pounds" },
          Weight: "5.0",
        },
        TimeInTransit: { DaysInTransit: "4" },
      },
      {
        Service: { Code: "02" },
        TotalCharges: { CurrencyCode: "USD", MonetaryValue: "24.75" },
        TransportationCharges: { CurrencyCode: "USD", MonetaryValue: "24.75" },
        ServiceOptionsCharges: { CurrencyCode: "USD", MonetaryValue: "0.00" },
        BillingWeight: {
          UnitOfMeasurement: { Code: "LBS", Description: "Pounds" },
          Weight: "5.0",
        },
        TimeInTransit: { DaysInTransit: "2" },
      },
      {
        Service: { Code: "01" },
        TotalCharges: { CurrencyCode: "USD", MonetaryValue: "48.00" },
        TransportationCharges: { CurrencyCode: "USD", MonetaryValue: "48.00" },
        ServiceOptionsCharges: { CurrencyCode: "USD", MonetaryValue: "0.00" },
        BillingWeight: {
          UnitOfMeasurement: { Code: "LBS", Description: "Pounds" },
          Weight: "5.0",
        },
        TimeInTransit: { DaysInTransit: "1" },
      },
    ],
  },
};

/** Successful Rate response for a single service */
export const singleRateSuccessResponse = {
  RateResponse: {
    Response: {
      ResponseStatus: { Code: "1", Description: "Success" },
    },
    RatedShipment: [
      {
        Service: { Code: "03" },
        TotalCharges: { CurrencyCode: "USD", MonetaryValue: "12.50" },
        BillingWeight: {
          UnitOfMeasurement: { Code: "LBS" },
          Weight: "5.0",
        },
      },
    ],
  },
};

/** Response with unknown service code — should still be mapped gracefully */
export const unknownServiceCodeResponse = {
  RateResponse: {
    Response: { ResponseStatus: { Code: "1", Description: "Success" } },
    RatedShipment: [
      {
        Service: { Code: "99" },
        TotalCharges: { CurrencyCode: "USD", MonetaryValue: "9.99" },
      },
    ],
  },
};

/** Shop response with no available rates */
export const emptyRatedShipmentResponse = {
  RateResponse: {
    Response: { ResponseStatus: { Code: "1", Description: "Success" } },
    RatedShipment: [],
  },
};

/** Completely malformed response — missing required fields */
export const malformedRatingResponse = {
  unexpected_key: "this is not a rating response",
  data: null,
};

/** UPS 400 Bad Request error */
export const badRequestError = {
  response: {
    errors: [
      {
        code: "10002",
        message: "The field ShipperNumber is invalid",
      },
    ],
  },
};

/** UPS 429 Rate Limit error */
export const rateLimitError = {
  response: {
    errors: [
      {
        code: "10429",
        message: "Too Many Requests",
      },
    ],
  },
};

/** UPS 500 Internal Server Error */
export const serverError = {
  response: {
    errors: [
      {
        code: "10500",
        message: "An internal error has occurred",
      },
    ],
  },
};

/** UPS 401 Unauthorized (token expired mid-session) */
export const unauthorizedError = {
  response: {
    errors: [
      {
        code: "10401",
        message: "Token is expired or invalid",
      },
    ],
  },
};
