import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import agenciesRouter from "./agencies.js";
import usersRouter from "./users.js";
import clientsRouter from "./clients.js";
import loansRouter from "./loans.js";
import paymentsRouter from "./payments.js";
import fundersRouter from "./funders.js";
import holidaysRouter from "./holidays.js";
import auditRouter from "./audit.js";
import trashRouter from "./trash.js";
import dashboardRouter from "./dashboard.js";
import interestRouter from "./interest.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/agencies", agenciesRouter);
router.use("/users", usersRouter);
router.use("/clients", clientsRouter);
router.use("/loans", loansRouter);
router.use("/payments", paymentsRouter);
router.use("/funders", fundersRouter);
router.use("/holidays", holidaysRouter);
router.use("/audit", auditRouter);
router.use("/trash", trashRouter);
router.use("/dashboard", dashboardRouter);
router.use("/interest", interestRouter);

export default router;
