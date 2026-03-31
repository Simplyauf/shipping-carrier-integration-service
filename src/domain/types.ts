export type CurrencyCode = "USD" | "CAD" | "EUR" | "GBP";

export interface Money {
  /** String representation to avoid floating-point precision issues (e.g. "14.52") */
  amount: string;
  currency: CurrencyCode;
}

export interface Address {
  name: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  /** 2-letter state/province code (e.g. "CA", "TX") */
  stateOrProvince: string;
  postalCode: string;
  /** ISO 3166-1 alpha-2 country code (e.g. "US", "CA") */
  countryCode: string;
  residential?: boolean;
}

export interface PackageSpec {
  weightLbs: number;
  dimensions?: {
    lengthIn: number;
    widthIn: number;
    heightIn: number;
  };
}

export interface RateShipmentRequest {
  shipFrom: Address;
  shipTo: Address;
  packages: PackageSpec[];
  /**
   * When true, requests rates for all available services (Shop).
   * When false or omitted, requests rates for the default/ground service (Rate).
   */
  requestAllServices?: boolean;
}

export interface ServiceRate {
  carrier: string;
  /** Carrier-specific service code, e.g. "03" for UPS Ground */
  serviceCode: string;
  serviceName: string;
  totalCharge: Money;
  /** Estimated transit days, if provided by the carrier */
  estimatedDays?: number;
  /** Billed weight used for rating (may differ from actual due to dimensional weight) */
  ratedWeightLbs?: number;
}

export interface RateShipmentResponse {
  rates: ServiceRate[];
  /** Correlation ID for tracing back to the original request */
  requestId: string;
}

export interface TokenInfo {
  accessToken: string;
  /** Unix epoch milliseconds when token expires */
  expiresAt: number;
  tokenType: string;
}
