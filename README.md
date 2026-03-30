# Shipping Carrier Integration Service

A production-quality TypeScript service that wraps shipping carrier APIs (starting with UPS) to provide normalized rate shopping with a clean, extensible architecture.

## Design Decisions

### Architecture

The service is built around two core interfaces:

- **`ICarrier`** — contract every carrier implements (`getRates()`)
- **`IAuthProvider`** — contract for authentication (`getAccessToken()`, `invalidateToken()`)

This separation means adding a new carrier (FedEx, USPS, DHL) requires zero changes to existing code — just implement the interface and register it.

```
src/
├── domain/          # Shared types (Address, Package, ServiceRate) and error hierarchy
├── carrier/         # ICarrier, IAuthProvider interfaces + CarrierRegistry
├── carriers/
│   └── ups/         # UPS implementation (auth, HTTP client, request/response mapping)
├── services/        # RateShoppingService (multi-carrier orchestration)
└── config/          # Zod-validated environment config
```

### Key Decisions

| Decision | Rationale |
|----------|-----------|
| **Zod for validation** | Schemas are the types via `z.infer<>` — one source of truth, no manual type sync |
| **Axios over fetch** | Typed generics, timeout config, and a consistent error shape (AxiosError) |
| **String money amounts** | `"14.52"` instead of `14.52` to avoid floating-point precision issues |
| **`retryable` flag on errors** | Callers implement retry policies by checking this flag, not by pattern-matching codes |
| **In-flight token dedup** | A single `Promise<string>` reference prevents thundering herd on concurrent token refresh |
| **401-retry-once pattern** | Handles clock-skew between token expiry check and actual use without infinite loops |
| **Pure request/response classes** | `UpsRatingRequestBuilder` and `UpsRatingResponseMapper` have no async/side-effects — trivially testable |
| **`Promise.allSettled` for fan-out** | One carrier failing doesn't block results from others |

### Error Hierarchy

All errors extend `CarrierError` with a string `code` discriminant for switch-friendly handling:

```typescript
try {
  const rates = await carrier.getRates(request);
} catch (err) {
  if (err instanceof CarrierError) {
    switch (err.code) {
      case "CARRIER_RATE_LIMITED": // retry with backoff
      case "NETWORK_TIMEOUT":      // err.retryable === true
      case "AUTH_FAILED":          // check credentials
      case "RATE_REQUEST_INVALID": // fix the request
      case "RESPONSE_PARSE_ERROR": // upstream API changed
    }
  }
}
```

## Setup

### Prerequisites
- Node.js 20+
- npm 9+

### Installation

```bash
git clone https://github.com/Simplyauf/shipping-carrier-integration-service
cd shipping-carrier-integration-service
npm install
cp .env.example .env
# Edit .env with your UPS credentials (optional for running tests)
```

### Environment Variables

See [.env.example](.env.example) for all required variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `UPS_CLIENT_ID` | Yes | — | UPS OAuth client ID |
| `UPS_CLIENT_SECRET` | Yes | — | UPS OAuth client secret |
| `UPS_ENVIRONMENT` | No | `sandbox` | `sandbox` or `production` |
| `UPS_TIMEOUT_MS` | No | `10000` | HTTP request timeout in ms |
| `UPS_TOKEN_REFRESH_BUFFER_SECS` | No | `60` | Proactive refresh window before token expiry |

## Running Tests

```bash
npm test              # Run all integration tests
npm run test:coverage # With coverage report
npm run typecheck     # TypeScript check without emitting
npm run build         # Compile to dist/
```

All tests stub the HTTP layer with [nock](https://github.com/nock/nock) — no live UPS credentials needed.

## Usage Example

```typescript
import { createShippingService, type RateShipmentRequest } from './src/index.js';

const service = createShippingService(); // reads from process.env

const request: RateShipmentRequest = {
  shipFrom: {
    name: 'Acme Warehouse',
    addressLine1: '100 Industrial Pkwy',
    city: 'Chicago',
    stateOrProvince: 'IL',
    postalCode: '60601',
    countryCode: 'US',
  },
  shipTo: {
    name: 'John Doe',
    addressLine1: '456 Main St',
    city: 'Austin',
    stateOrProvince: 'TX',
    postalCode: '78701',
    countryCode: 'US',
    residential: true,
  },
  packages: [
    { weightLbs: 5, dimensions: { lengthIn: 12, widthIn: 10, heightIn: 8 } },
  ],
  requestAllServices: true, // get all available services
};

const rates = await service.shop(request);
// rates is ServiceRate[] sorted cheapest first:
// [
//   { carrier: 'UPS', serviceCode: '03', serviceName: 'UPS Ground', totalCharge: { amount: '12.50', currency: 'USD' }, estimatedDays: 4 },
//   { carrier: 'UPS', serviceCode: '02', serviceName: 'UPS 2nd Day Air', ... },
//   { carrier: 'UPS', serviceCode: '01', serviceName: 'UPS Next Day Air', ... },
// ]
```

## Adding a New Carrier (e.g. FedEx)

1. Create `src/carriers/fedex/FedExAuthProvider.ts` implementing `IAuthProvider`
2. Create `src/carriers/fedex/FedExCarrier.ts` implementing `ICarrier` with `carrierId = "FEDEX"`
3. Add `FEDEX_CLIENT_ID` / `FEDEX_CLIENT_SECRET` to `src/config/env.ts` and `.env.example`
4. Register in `src/index.ts`:

```typescript
registry.register(new FedExCarrier(env)); // one line change
```

No existing code needs to change. `getAllRates()` automatically includes FedEx in the fan-out.

## Adding a New UPS Operation (e.g. Label Creation)

1. Create `src/carriers/ups/UpsLabelRequestBuilder.ts` and `UpsLabelResponseMapper.ts`
2. Add Zod schemas in `src/carriers/ups/schemas/label.*.ts`
3. Add `createLabel()` to `ICarrier` (optional method to maintain backwards compatibility)
4. Implement in `UpsCarrier.ts` — reuses the existing `UpsHttpClient` and `UpsAuthProvider`

## What I Would Improve Given More Time

- **Retry middleware**: Implement exponential backoff for `retryable: true` errors at the `RateShoppingService` level
- **Label & tracking operations**: Extend `ICarrier` with optional `createLabel()` and `trackShipment()` methods
- **FedEx implementation**: The architecture is proven extensible — FedEx would be a straightforward addition
- **Token persistence**: Extract an `ITokenStore` interface so tokens can be stored in Redis for multi-instance deployments
- **Address validation**: Add an `IAddressValidationCapable` interface and UPS AV API integration
- **Observability**: Add structured logging (pino) and OpenTelemetry spans around HTTP calls and token refresh events
- **CI/CD**: GitHub Actions workflow for lint + test on PR
- **Input validation**: Zod schemas for domain `RateShipmentRequest` to validate before making any HTTP call (currently trusting callers)
