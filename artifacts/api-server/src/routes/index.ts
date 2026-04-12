import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import circlesRouter from "./circles";
import membersRouter from "./members";
import requestsRouter from "./requests";
import servicesRouter from "./services";
import activityRouter from "./activity";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use(circlesRouter);
router.use(membersRouter);
router.use(requestsRouter);
router.use(servicesRouter);
router.use(activityRouter);

export default router;
