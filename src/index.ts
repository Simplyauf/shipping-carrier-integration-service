/**
 * Public API for the shipping carrier integration service.
 *
 * Usage example:
 *
 *   import { createShippingService, type RateShipmentRequest } from './index.js';
 *
 *   const service = createShippingService();
 *
 *   const rates = await service.shop({
 *     shipFrom: { name: 'Warehouse', addressLine1: '100 Main St', city: 'Chicago',
 *                 stateOrProvince: 'IL', postalCode: '60601', countryCode: 'US' },
 *     shipTo:   { name: 'Customer', addressLine1: '456 Oak Ave', city: 'Austin',
 *                 stateOrProvince: 'TX', postalCode: '78701', countryCode: 'US' },
 *     packages: [{ weightLbs: 5, dimensions: { lengthIn: 12, widthIn: 10, heightIn: 8 } }],
 *     requestAllServices: true,
 *   });
 *
 *   console.log(rates); // ServiceRate[] sorted cheapest first
 */

import { getEnv } from "./config/env.js";
import { CarrierRegistry } from "./carrier/CarrierRegistry.js";
import { UpsCarrier } from "./carriers/ups/UpsCarrier.js";
import { RateShoppingService } from "./services/RateShoppingService.js";

// Domain types — callers work exclusively with these
export type {
  Address,
  PackageSpec,
  RateShipmentRequest,
  RateShipmentResponse,
  ServiceRate,
  Money,
  CurrencyCode,
  TokenInfo,
} from "./domain/types.js";

// Error hierarchy — import for instanceof checks or code-based switching
export {
  CarrierError,
  AuthFailedError,
  RateLimitedError,
  NetworkTimeoutError,
  ResponseParseError,
  ConfigurationError,
  type CarrierErrorCode,
} from "./domain/errors.js";

// Service and registry — for application bootstrap
export { RateShoppingService } from "./services/RateShoppingService.js";
export { CarrierRegistry } from "./carrier/CarrierRegistry.js";
export type { ICarrier } from "./carrier/ICarrier.js";
export type { IAuthProvider } from "./carrier/IAuthProvider.js";

// UPS carrier
export { UpsCarrier } from "./carriers/ups/UpsCarrier.js";
export { UpsAuthProvider } from "./carriers/ups/UpsAuthProvider.js";

// Config
export { getEnv, resetEnvCache, type Env } from "./config/env.js";

/**
 * Convenience factory that wires up all registered carriers from environment config.
 * Call this once at application startup.
 *
 * To add a new carrier, import it and call registry.register() before constructing the service.
 */
export function createShippingService(): RateShoppingService {
  const env = getEnv();
  const registry = new CarrierRegistry();
  registry.register(new UpsCarrier(env));
  // Future: registry.register(new FedExCarrier(env));
  return new RateShoppingService(registry);
}
