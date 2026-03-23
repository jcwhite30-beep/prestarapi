import { db } from "@workspace/db";
import { auditTable } from "@workspace/db";
import type { Request } from "express";

export async function logAudit(
  req: Request,
  action: string,
  entityType: string | null,
  entityId: number | null,
  agencyId: number | null,
  details: Record<string, unknown> | null = null
) {
  const user = (req as any).user;
  const ip = req.ip || req.socket?.remoteAddress || null;
  await db.insert(auditTable).values({
    userId: user?.id ?? null,
    action,
    entityType,
    entityId,
    agencyId,
    details: details as any,
    ip,
  });
}
