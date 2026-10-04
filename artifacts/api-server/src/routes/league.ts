import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import { getLeagueView } from "../lib/league-store";

const router: IRouter = Router();

// GET /api/league/me — the caller's weekly league group and standing.
router.get("/league/me", requireAuth, async (req, res) => {
  try {
    const view = await getLeagueView(req.auth!.userId);
    if (!view) {
      res.status(404).json({ error: "Sync your progress first to join a league." });
      return;
    }
    res.json(view);
  } catch (err) {
    req.log?.error({ err }, "league/me error");
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
