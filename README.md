# Shipping Carrier Integration Service

TypeScript service wrapping shipping carrier APIs (starting with UPS) for normalized rate shopping.

## Architecture

```
src/
├── domain/          # Shared types (Address, Package, ServiceRate) and error hierarchy
├── carrier/         # ICarrier, IAuthProvider interfaces + CarrierRegistry
├── carriers/
│   └── ups/         # UPS implementation (auth, HTTP client, request/response mapping)
├── services/        # RateShoppingService (multi-carrier orchestration)
└── config/          # Zod-validated environment config
```

Two core interfaces drive the design:

- **`ICarrier`** — every carrier implements `getRates()`
- **`IAuthProvider`** — every carrier implements `getAccessToken()` / `invalidateToken()`

Adding FedEx, USPS, or DHL requires zero changes to existing code — implement the interfaces and register.

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Zod for validation | Schemas are the types via `z.infer<>` — one source of truth |
| Axios over fetch | Typed generics, timeout config, consistent `AxiosError` shape |
| String money amounts | `"14.52"` not `14.52` — avoids floating-point precision issues |
| `retryable` flag on errors | Callers implement retry policies without pattern-matching error codes |
| In-flight token dedup | Single `Promise<string>` reference prevents thundering herd on concurrent refresh |
| 401-retry-once pattern | Handles clock-skew between expiry check and actual use, no infinite loops |
| Pure request/response classes | `UpsRatingRequestBuilder` and `UpsRatingResponseMapper` have no async/side-effects |
| `Promise.allSettled` for fan-out | One carrier failing doesn't block results from others |

## Error Handling

All errors extend `CarrierError` with a `code` string discriminant:

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

**Prerequisites:** Node.js 20+, npm 9+

```bash
git clone https://github.com/Simplyauf/shipping-carrier-integration-service
cd shipping-carrier-integration-service
npm install
cp .env.example .env
```

## Environment Variables

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

## Usage

```typescript
import { createShippingService, type RateShipmentRequest } from './src/index.js';

const service = createShippingService();

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
  requestAllServices: true,
};

const rates = await service.shop(request);
// ServiceRate[] sorted cheapest first:
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
registry.register(new FedExCarrier(env));
```

No existing code changes. `getAllRates()` automatically includes FedEx in the fan-out.

## Adding a New UPS Operation (e.g. Label Creation)

1. Create `src/carriers/ups/UpsLabelRequestBuilder.ts` and `UpsLabelResponseMapper.ts`
2. Add Zod schemas in `src/carriers/ups/schemas/label.*.ts`
3. Add `createLabel()` to `ICarrier` (optional to maintain backwards compatibility)
4. Implement in `UpsCarrier.ts` — reuses `UpsHttpClient` and `UpsAuthProvider`

## What I Would Improve Given More Time

- **Retry middleware** — exponential backoff for `retryable: true` errors at the `RateShoppingService` level
- **Label & tracking** — extend `ICarrier` with optional `createLabel()` and `trackShipment()` methods
- **FedEx implementation** — the architecture is proven extensible; FedEx would be a straightforward addition
- **Token persistence** — extract an `ITokenStore` interface so tokens survive across service restarts (Redis)
- **Observability** — structured logging (pino) and OpenTelemetry spans around HTTP calls and token refresh
- **CI/CD** — GitHub Actions workflow for lint + test on PR
