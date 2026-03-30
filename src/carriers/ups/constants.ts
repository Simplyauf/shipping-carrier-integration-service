export const UPS_URLS = {
  sandbox: {
    auth: "https://wwwcie.ups.com/security/v1/oauth/token",
    rating: "https://wwwcie.ups.com/api/rating",
  },
  production: {
    auth: "https://onlinetools.ups.com/security/v1/oauth/token",
    rating: "https://onlinetools.ups.com/api/rating",
  },
} as const;

export const UPS_RATING_VERSION = "v2409" as const;

/**
 * UPS service codes mapped to human-readable names.
 * Source: https://developer.ups.com/api/reference/rating/appendix
 */
export const UPS_SERVICE_NAMES: Record<string, string> = {
  "01": "UPS Next Day Air",
  "02": "UPS 2nd Day Air",
  "03": "UPS Ground",
  "07": "UPS Worldwide Express",
  "08": "UPS Worldwide Expedited",
  "11": "UPS Standard",
  "12": "UPS 3 Day Select",
  "13": "UPS Next Day Air Saver",
  "14": "UPS Next Day Air Early",
  "54": "UPS Worldwide Express Plus",
  "59": "UPS 2nd Day Air A.M.",
  "65": "UPS Saver",
  "82": "UPS Today Standard",
  "83": "UPS Today Dedicated Courier",
  "84": "UPS Today Intercity",
  "85": "UPS Today Express",
  "86": "UPS Today Express Saver",
};
