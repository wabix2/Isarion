import { z } from "zod";

export const HealthCheckResponse = z.object({
  status: z.literal("ok"),
});

export type HealthCheckResponse = z.infer<typeof HealthCheckResponse>;

export const ReadinessCheckResponse = z.object({
  status: z.enum(["ok", "error"]),
  database: z.enum(["ok", "unavailable"]),
});

export type ReadinessCheckResponse = z.infer<typeof ReadinessCheckResponse>;
