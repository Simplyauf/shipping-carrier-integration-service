import { z } from "zod";

/**
 * Zod schema for the UPS OAuth 2.0 token endpoint success response.
 * expires_in is coerced to number because UPS returns it as a string in some versions.
 * issued_at is a string epoch timestamp in milliseconds.
 */
export const UpsTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.string(),
  expires_in: z.coerce.number().positive(),
  issued_at: z.string(),
  client_id: z.string().optional(),
  scope: z.string().optional(),
  status: z.string().optional(),
  refresh_count: z.coerce.number().optional(),
});

export type UpsTokenResponse = z.infer<typeof UpsTokenResponseSchema>;

/**
 * Zod schema for UPS error responses (used across auth and rating endpoints).
 * UPS always wraps errors in { response: { errors: [...] } }
 */
export const UpsErrorResponseSchema = z.object({
  response: z.object({
    errors: z.array(
      z.object({
        code: z.string(),
        message: z.string(),
      })
    ),
  }),
});

export type UpsErrorResponse = z.infer<typeof UpsErrorResponseSchema>;
