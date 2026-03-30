import type { RateShipmentRequest } from "../../src/domain/types.js";

/**
 * Domain-layer request fixtures for UPS rating tests.
 */

export const basicDomesticRequest: RateShipmentRequest = {
  shipFrom: {
    name: "Acme Warehouse",
    company: "Acme Corp",
    addressLine1: "100 Industrial Pkwy",
    city: "Chicago",
    stateOrProvince: "IL",
    postalCode: "60601",
    countryCode: "US",
  },
  shipTo: {
    name: "John Doe",
    addressLine1: "456 Main St",
    city: "Austin",
    stateOrProvince: "TX",
    postalCode: "78701",
    countryCode: "US",
    residential: true,
  },
  packages: [
    {
      weightLbs: 5.0,
      dimensions: { lengthIn: 12, widthIn: 10, heightIn: 8 },
    },
  ],
  requestAllServices: true,
};

export const singleServiceRequest: RateShipmentRequest = {
  ...basicDomesticRequest,
  requestAllServices: false,
};

export const multiPieceRequest: RateShipmentRequest = {
  ...basicDomesticRequest,
  packages: [
    { weightLbs: 3.0 },
    { weightLbs: 7.5, dimensions: { lengthIn: 20, widthIn: 15, heightIn: 10 } },
  ],
};

export const noDimensionsRequest: RateShipmentRequest = {
  ...basicDomesticRequest,
  packages: [{ weightLbs: 5.0 }],
};
