import test from "node:test";
import assert from "node:assert/strict";
import { HealthCheckResponse, ReadinessCheckResponse } from "@workspace/api-zod";

test("health check payload matches the published schema", () => {
  const parsed = HealthCheckResponse.parse({ status: "ok" });
  assert.equal(parsed.status, "ok");
});

test("readiness check payload distinguishes database availability", () => {
  assert.deepEqual(
    ReadinessCheckResponse.parse({ status: "ok", database: "ok" }),
    { status: "ok", database: "ok" },
  );
  assert.deepEqual(
    ReadinessCheckResponse.parse({ status: "error", database: "unavailable" }),
    { status: "error", database: "unavailable" },
  );
});
