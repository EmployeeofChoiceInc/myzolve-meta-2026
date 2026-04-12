import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import circlesRouter from "./circles";
import membersRouter from "./members";
import requestsRouter from "./requests";
import servicesRouter from "./services";
import activityRouter from "./activity";
import commentsRouter from "./comments";
import notificationsRouter from "./notifications";
import disputesRouter from "./disputes";
import placeholdersRouter from "./placeholders";
import connectionsRouter from "./connections";
import auditRouter from "./audit";
import attachmentsRouter from "./attachments";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use(circlesRouter);
router.use(membersRouter);
router.use(requestsRouter);
router.use(servicesRouter);
router.use(activityRouter);
router.use(commentsRouter);
router.use(notificationsRouter);
router.use(disputesRouter);
router.use(placeholdersRouter);
router.use(connectionsRouter);
router.use(auditRouter);
router.use(attachmentsRouter);
router.use(storageRouter);

export default router;
