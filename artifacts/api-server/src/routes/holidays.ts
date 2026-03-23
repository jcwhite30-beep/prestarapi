import { Router } from "express";
import { db } from "@workspace/db";
import { holidaysTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { logAudit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

// GET /api/holidays
router.get("/", async (_req, res) => {
  const holidays = await db.select().from(holidaysTable);
  res.json(holidays);
});

// POST /api/holidays
router.post("/", requireRole("superadmin", "admin", "manager"), async (req, res) => {
  const { date, description, amortization } = req.body;
  const [holiday] = await db.insert(holidaysTable).values({ date, description, amortization: amortization ?? "none" }).returning();
  await logAudit(req, "CREATE_HOLIDAY", "holiday", holiday.id, null, { date, description });
  res.status(201).json(holiday);
});

// PUT /api/holidays/:id
router.put("/:id", requireRole("superadmin", "admin", "manager"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { date, description, amortization } = req.body;
  const [holiday] = await db.update(holidaysTable).set({ date, description, amortization }).where(eq(holidaysTable.id, id)).returning();
  await logAudit(req, "UPDATE_HOLIDAY", "holiday", id, null);
  res.json(holiday);
});

// DELETE /api/holidays/:id
router.delete("/:id", requireRole("superadmin", "admin"), async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(holidaysTable).where(eq(holidaysTable.id, id));
  await logAudit(req, "DELETE_HOLIDAY", "holiday", id, null);
  res.json({ success: true, message: "Feriado eliminado" });
});

export default router;
