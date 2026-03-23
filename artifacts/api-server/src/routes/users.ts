import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, trashTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { requireAuth, requireRole, hashPassword } from "../lib/auth.js";
import { logAudit } from "../lib/audit.js";

const router = Router();
router.use(requireAuth);

function sanitize(u: typeof usersTable.$inferSelect) {
  const { passwordHash: _, ...rest } = u;
  return rest;
}

// GET /api/users
router.get("/", async (req, res) => {
  const user = (req as any).user;
  const { agencyId, role } = req.query;
  let all = await db.select().from(usersTable);
  
  if (user.role !== "superadmin") {
    const agIds = (user.agencyIds as number[]) ?? [];
    all = all.filter(u => {
      const uIds = (u.agencyIds as number[]) ?? [];
      return uIds.some(id => agIds.includes(id));
    });
  }
  if (agencyId) {
    const aid = parseInt(agencyId as string);
    all = all.filter(u => ((u.agencyIds as number[]) ?? []).includes(aid));
  }
  if (role) {
    all = all.filter(u => u.role === role);
  }
  res.json(all.map(sanitize));
});

// POST /api/users
router.post("/", requireRole("superadmin", "admin", "manager"), async (req, res) => {
  const requestingUser = (req as any).user;
  const data = req.body;
  
  // Role hierarchy enforcement
  const allowedRoles: Record<string, string[]> = {
    superadmin: ["superadmin", "admin", "manager", "promoter"],
    admin: ["manager", "promoter"],
    manager: ["promoter"],
  };
  if (!allowedRoles[requestingUser.role]?.includes(data.role)) {
    res.status(403).json({ error: "No puede crear este rol" });
    return;
  }
  
  const hash = await hashPassword(data.password || "1234");
  const [newUser] = await db.insert(usersTable).values({
    name: data.name,
    username: data.username,
    passwordHash: hash,
    phone: data.phone ?? null,
    email: data.email ?? null,
    role: data.role,
    agencyIds: data.agencyIds ?? [],
    blocked: false,
    needsPasswordRecovery: false,
  }).returning();
  
  await logAudit(req, "CREATE_USER", "user", newUser.id, null, { username: newUser.username, role: newUser.role });
  res.status(201).json(sanitize(newUser));
});

// GET /api/users/recovery-requests
router.get("/recovery-requests", requireRole("superadmin", "admin"), async (req, res) => {
  const all = await db.select().from(usersTable).where(eq(usersTable.needsPasswordRecovery, true));
  res.json(all.map(sanitize));
});

// GET /api/users/:id
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "No encontrado" }); return; }
  res.json(sanitize(user));
});

// PUT /api/users/:id
router.put("/:id", requireRole("superadmin", "admin", "manager"), async (req, res) => {
  const id = parseInt(req.params.id);
  const data = req.body;
  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (data.name) updates.name = data.name;
  if (data.phone !== undefined) updates.phone = data.phone;
  if (data.email !== undefined) updates.email = data.email;
  if (data.agencyIds !== undefined) updates.agencyIds = data.agencyIds;
  
  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  await logAudit(req, "UPDATE_USER", "user", id, null, { name: data.name });
  res.json(sanitize(updated));
});

// DELETE /api/users/:id
router.delete("/:id", requireRole("superadmin", "admin"), async (req, res) => {
  const id = parseInt(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "No encontrado" }); return; }
  await db.insert(trashTable).values({ type: "user", entityId: id, data: sanitize(user) as any, deletedById: (req as any).user.id });
  await db.delete(usersTable).where(eq(usersTable.id, id));
  await logAudit(req, "DELETE_USER", "user", id, null);
  res.json({ success: true, message: "Usuario eliminado" });
});

// POST /api/users/:id/toggle-block
router.post("/:id/toggle-block", requireRole("superadmin", "admin", "manager"), async (req, res) => {
  const id = parseInt(req.params.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "No encontrado" }); return; }
  const [updated] = await db.update(usersTable).set({ blocked: !user.blocked }).where(eq(usersTable.id, id)).returning();
  await logAudit(req, updated.blocked ? "BLOCK_USER" : "UNBLOCK_USER", "user", id, null);
  res.json(sanitize(updated));
});

export default router;
