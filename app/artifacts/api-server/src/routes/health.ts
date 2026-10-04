import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { HealthCheckResponse, ReadinessCheckResponse } from "@workspace/api-zod";
import { db } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/readyz", async (req, res) => {
  try {
    await db.execute(sql`select 1`);
    const data = ReadinessCheckResponse.parse({ status: "ok", database: "ok" });
    res.json(data);
  } catch (error) {
    req.log?.error({ error }, "readiness check failed");
    const data = ReadinessCheckResponse.parse({
      status: "error",
      database: "unavailable",
    });
    res.status(503).json(data);
  }
});

export default router;
