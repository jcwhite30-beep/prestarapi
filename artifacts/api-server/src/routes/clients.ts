import { Router } from "express";
import { db } from "@workspace/db";
import { clientsTable, usersTable, agenciesTable, loansTable, movementsTable, trashTable } from "@workspace/db";
import { eq, isNull, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { logAudit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

async function buildClientWithBalances(client: typeof clientsTable.$inferSelect, agencies: Map<number, string>, users: Map<number, {name:string; role:string}>) {
  const loans = await db.select().from(loansTable).where(eq(loansTable.clientId, client.id));
  const activeLoans = loans.filter(l => l.status === "active");
  
  let capitalBalance = 0;
  let currentInterest = 0;
  let overdueInterest = 0;
  let overdueQuincenas = 0;
  
  for (const loan of activeLoans) {
    capitalBalance += parseFloat(loan.currentCapital);
    currentInterest += parseFloat(loan.currentInterest);
    overdueInterest += parseFloat(loan.overdueInterest);
    if (parseFloat(loan.overdueInterest) > 0) {
      overdueQuincenas += 1;
    }
  }
  
  const assignedUser = users.get(client.assignedToId);
  
  return {
    ...client,
    agencyName: agencies.get(client.agencyId) ?? "",
    assignedToName: assignedUser?.name ?? "",
    assignedToRole: assignedUser?.role ?? "",
    capitalBalance,
    currentInterest,
    overdueInterest,
    overdueQuincenas,
  };
}

// GET /api/clients
router.get("/", async (req, res) => {
  const user = (req as any).user;
  const { agencyId, assignedTo } = req.query;
  
  let allClients = await db.select().from(clientsTable).where(isNull(clientsTable.deletedAt));
  const allUsers = await db.select().from(usersTable);
  const allAgencies = await db.select().from(agenciesTable);
  
  const agencyMap = new Map(allAgencies.map(a => [a.id, a.name]));
  const userMap = new Map(allUsers.map(u => [u.id, { name: u.name, role: u.role }]));
  
  // Filter by role
  if (user.role === "promoter") {
    allClients = allClients.filter(c => c.assignedToId === user.id);
  } else if (user.role === "manager") {
    const agIds = (user.agencyIds as number[]) ?? [];
    allClients = allClients.filter(c => agIds.includes(c.agencyId));
  } else if (user.role === "admin") {
    const agIds = (user.agencyIds as number[]) ?? [];
    allClients = allClients.filter(c => agIds.includes(c.agencyId));
  }
  
  if (agencyId) allClients = allClients.filter(c => c.agencyId === parseInt(agencyId as string));
  if (assignedTo) allClients = allClients.filter(c => c.assignedToId === parseInt(assignedTo as string));
  
  const enriched = await Promise.all(allClients.map(c => buildClientWithBalances(c, agencyMap, userMap)));
  res.json(enriched);
});

// POST /api/clients
router.post("/", async (req, res) => {
  const user = (req as any).user;
  const data = req.body;
  
  let agencyId = data.agencyId;
  let assignedToId = data.assignedToId;
  
  // If promoter: force their agency and self-assignment
  if (user.role === "promoter") {
    const agIds = (user.agencyIds as number[]) ?? [];
    agencyId = agIds[0] ?? data.agencyId;
    assignedToId = user.id;
  } else if (user.role === "manager") {
    const agIds = (user.agencyIds as number[]) ?? [];
    agencyId = agIds[0] ?? data.agencyId;
  }
  
  const [client] = await db.insert(clientsTable).values({
    name: data.name,
    phone: data.phone ?? null,
    phone2: data.phone2 ?? null,
    agencyId,
    assignedToId,
    active: true,
  }).returning();
  
  await logAudit(req, "CREATE_CLIENT", "client", client.id, agencyId, { name: client.name });
  
  const allAgencies = await db.select().from(agenciesTable);
  const allUsers = await db.select().from(usersTable);
  const agencyMap = new Map(allAgencies.map(a => [a.id, a.name]));
  const userMap = new Map(allUsers.map(u => [u.id, { name: u.name, role: u.role }]));
  
  const enriched = await buildClientWithBalances(client, agencyMap, userMap);
  res.status(201).json(enriched);
});

// GET /api/clients/:id
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id));
  if (!client) { res.status(404).json({ error: "No encontrado" }); return; }
  
  const allAgencies = await db.select().from(agenciesTable);
  const allUsers = await db.select().from(usersTable);
  const agencyMap = new Map(allAgencies.map(a => [a.id, a.name]));
  const userMap = new Map(allUsers.map(u => [u.id, { name: u.name, role: u.role }]));
  
  const enriched = await buildClientWithBalances(client, agencyMap, userMap);
  const loans = await db.select().from(loansTable).where(eq(loansTable.clientId, id));
  const loanIds = loans.map(l => l.id);
  let movements: typeof movementsTable.$inferSelect[] = [];
  if (loanIds.length > 0) {
    for (const lid of loanIds) {
      const mvs = await db.select().from(movementsTable).where(eq(movementsTable.loanId, lid));
      movements.push(...mvs);
    }
  }
  
  res.json({ ...enriched, loans, movements });
});

// PUT /api/clients/:id
router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const data = req.body;
  const [updated] = await db.update(clientsTable).set({
    name: data.name,
    phone: data.phone ?? null,
    phone2: data.phone2 ?? null,
    agencyId: data.agencyId,
    assignedToId: data.assignedToId,
  }).where(eq(clientsTable.id, id)).returning();
  
  await logAudit(req, "UPDATE_CLIENT", "client", id, updated.agencyId, { name: data.name });
  
  const allAgencies = await db.select().from(agenciesTable);
  const allUsers = await db.select().from(usersTable);
  const agencyMap = new Map(allAgencies.map(a => [a.id, a.name]));
  const userMap = new Map(allUsers.map(u => [u.id, { name: u.name, role: u.role }]));
  
  const enriched = await buildClientWithBalances(updated, agencyMap, userMap);
  res.json(enriched);
});

// DELETE /api/clients/:id
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, id));
  if (!client) { res.status(404).json({ error: "No encontrado" }); return; }
  await db.insert(trashTable).values({ type: "client", entityId: id, agencyId: client.agencyId, data: client as any, deletedById: (req as any).user.id });
  await db.update(clientsTable).set({ deletedAt: new Date(), active: false }).where(eq(clientsTable.id, id));
  await logAudit(req, "DELETE_CLIENT", "client", id, client.agencyId);
  res.json({ success: true, message: "Cliente eliminado" });
});

// POST /api/clients/:id/reassign
router.post("/:id/reassign", async (req, res) => {
  const id = parseInt(req.params.id);
  const { assignedToId } = req.body;
  const [updated] = await db.update(clientsTable).set({ assignedToId }).where(eq(clientsTable.id, id)).returning();
  await logAudit(req, "REASSIGN_CLIENT", "client", id, updated.agencyId, { newAssignee: assignedToId });
  res.json(updated);
});

export default router;
