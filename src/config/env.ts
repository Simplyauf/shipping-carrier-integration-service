import { z } from "zod";
import dotenv from "dotenv";
import { ConfigurationError } from "../domain/errors.js";

dotenv.config();

const EnvSchema = z.object({
  UPS_CLIENT_ID: z.string().min(1, "UPS_CLIENT_ID is required"),
  UPS_CLIENT_SECRET: z.string().min(1, "UPS_CLIENT_SECRET is required"),
  UPS_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  UPS_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  UPS_TOKEN_REFRESH_BUFFER_SECS: z.coerce.number().int().positive().default(60),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type Env = z.infer<typeof EnvSchema>;

let _env: Env | undefined;

/**
 * Returns the validated environment configuration singleton.
 * Throws ConfigurationError on the first call if any required variables are missing.
 */
export function getEnv(): Env {
  if (!_env) {
    const result = EnvSchema.safeParse(process.env);
    if (!result.success) {
      throw new ConfigurationError(
        `Invalid environment configuration:\n${result.error.toString()}`
      );
    }
    _env = result.data;
  }
  return _env;
}

/**
 * Reset the cached env singleton. Used in tests to isolate environment state.
 */
export function resetEnvCache(): void {
  _env = undefined;
}
