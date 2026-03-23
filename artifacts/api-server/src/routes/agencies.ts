import { Router } from "express";
import { db } from "@workspace/db";
import { agenciesTable, trashTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

router.use(requireAuth);

// GET /api/agencies
router.get("/", async (req, res) => {
  const user = (req as any).user;
  const all = await db.select().from(agenciesTable).where(eq(agenciesTable.active, true));
  if (user.role === "superadmin") {
    res.json(all);
  } else {
    const agencyIds = (user.agencyIds as number[]) ?? [];
    res.json(all.filter((a) => agencyIds.includes(a.id)));
  }
});

// POST /api/agencies
router.post("/", requireRole("superadmin", "admin"), async (req, res) => {
  const data = req.body;
  const [agency] = await db.insert(agenciesTable).values({
    name: data.name,
    city: data.city,
    currency: data.currency ?? "USD",
    baseRate: data.baseRate?.toString() ?? "0.10",
    graceDaysDisbursement: data.graceDaysDisbursement ?? 3,
    graceDaysPayment: data.graceDaysPayment ?? 3,
    paymentMethods: data.paymentMethods ?? ["Efectivo"],
    banks: data.banks ?? [],
    active: true,
  }).returning();
  await logAudit(req, "CREATE_AGENCY", "agency", agency.id, agency.id, { name: agency.name });
  res.status(201).json(agency);
});

// GET /api/agencies/:id
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [agency] = await db.select().from(agenciesTable).where(eq(agenciesTable.id, id));
  if (!agency) { res.status(404).json({ error: "No encontrada" }); return; }
  res.json(agency);
});

// PUT /api/agencies/:id
router.put("/:id", requireRole("superadmin", "admin"), async (req, res) => {
  const id = parseInt(req.params.id);
  const data = req.body;
  const updateData: Record<string, any> = {
    name: data.name,
    city: data.city,
    currency: data.currency,
    baseRate: data.baseRate?.toString(),
    graceDaysDisbursement: data.graceDaysDisbursement,
    graceDaysPayment: data.graceDaysPayment,
    paymentMethods: data.paymentMethods,
    banks: data.banks,
  };
  if (data.availableFlow !== undefined) {
    updateData.availableFlow = parseFloat(data.availableFlow).toFixed(2);
  }
  const [agency] = await db.update(agenciesTable).set(updateData).where(eq(agenciesTable.id, id)).returning();
  await logAudit(req, "UPDATE_AGENCY", "agency", id, id, { name: data.name });
  res.json(agency);
});

// POST /api/agencies/:id/flow — add or subtract available flow (superadmin only)
router.post("/:id/flow", requireRole("superadmin", "admin"), async (req, res) => {
  const id = parseInt(req.params.id);
  const { amount, concept } = req.body;
  if (!amount || isNaN(parseFloat(amount))) {
    res.status(400).json({ error: "Monto inválido" });
    return;
  }
  const [agency] = await db.select().from(agenciesTable).where(eq(agenciesTable.id, id));
  if (!agency) { res.status(404).json({ error: "No encontrada" }); return; }
  const newFlow = parseFloat(agency.availableFlow) + parseFloat(amount);
  if (newFlow < 0) {
    res.status(400).json({ error: "El flujo disponible no puede ser negativo" });
    return;
  }
  const [updated] = await db.update(agenciesTable).set({ availableFlow: newFlow.toFixed(2) }).where(eq(agenciesTable.id, id)).returning();
  await logAudit(req, "ADJUST_FLOW", "agency", id, id, { amount, concept, newFlow });
  res.json(updated);
});

// DELETE /api/agencies/:id
router.delete("/:id", requireRole("superadmin"), async (req, res) => {
  const id = parseInt(req.params.id);
  const [agency] = await db.select().from(agenciesTable).where(eq(agenciesTable.id, id));
  if (!agency) { res.status(404).json({ error: "No encontrada" }); return; }
  await db.insert(trashTable).values({ type: "agency", entityId: id, agencyId: id, data: agency as any, deletedById: (req as any).user.id });
  await db.update(agenciesTable).set({ active: false }).where(eq(agenciesTable.id, id));
  await logAudit(req, "DELETE_AGENCY", "agency", id, id);
  res.json({ success: true, message: "Agencia eliminada" });
});

export default router;
