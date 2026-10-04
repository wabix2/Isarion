import { Router, type IRouter } from "express";
import healthRouter from "./health";
import chatRouter from "./chat";
import progressRouter from "./progress";
import leaderboardRouter from "./leaderboard";
import learnerModelRouter from "./learner-model";
import quizRouter from "./quiz";
import feynmanRouter from "./feynman";
import answerReportsRouter from "./answer-reports";
import leagueRouter from "./league";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(progressRouter);
router.use(leaderboardRouter);
router.use(learnerModelRouter);
router.use(quizRouter);
router.use(feynmanRouter);
router.use(answerReportsRouter);
router.use(leagueRouter);

export default router;
