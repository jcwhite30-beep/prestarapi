import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, hashPassword, verifyPassword, signToken } from "../lib/auth.js";
import { logAudit } from "../lib/audit.js";

const router = Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Usuario y contraseña requeridos" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (!user) {
    res.status(401).json({ error: "Usuario no encontrado" });
    return;
  }
  if (user.blocked) {
    res.status(401).json({ error: "Usuario bloqueado" });
    return;
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Contraseña incorrecta" });
    return;
  }
  const token = signToken(user.id);
  const { passwordHash: _, ...safeUser } = user;
  res.json({ user: safeUser, token });
});

// POST /api/auth/logout
router.post("/logout", requireAuth, (req, res) => {
  res.json({ success: true, message: "Sesión cerrada" });
});

// GET /api/auth/me
router.get("/me", requireAuth, (req, res) => {
  const user = (req as any).user;
  const { passwordHash: _, ...safeUser } = user;
  res.json(safeUser);
});

// POST /api/auth/change-password
router.post("/change-password", requireAuth, async (req, res) => {
  const user = (req as any).user;
  const { currentPassword, newPassword } = req.body;
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Contraseña actual incorrecta" });
    return;
  }
  const newHash = await hashPassword(newPassword);
  await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, user.id));
  res.json({ success: true, message: "Contraseña cambiada exitosamente" });
});

// POST /api/auth/recover-request
router.post("/recover-request", async (req, res) => {
  const { username } = req.body;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }
  await db.update(usersTable).set({ needsPasswordRecovery: true }).where(eq(usersTable.id, user.id));
  res.json({ success: true, message: "Solicitud enviada al administrador" });
});

// POST /api/auth/recover-approve/:userId
router.post("/recover-approve/:userId", requireAuth, async (req, res) => {
  const requestingUser = (req as any).user;
  if (!["superadmin", "admin"].includes(requestingUser.role)) {
    res.status(403).json({ error: "Sin permiso" });
    return;
  }
  const userId = parseInt(req.params.userId);
  const { newPassword } = req.body;
  const hash = await hashPassword(newPassword);
  await db.update(usersTable)
    .set({ passwordHash: hash, needsPasswordRecovery: false })
    .where(eq(usersTable.id, userId));
  const [updated] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  await logAudit(req, "APPROVE_PASSWORD_RECOVERY", "user", userId, null, { targetUser: updated.username });
  res.json({ newPassword, userName: updated.name });
});

export default router;
