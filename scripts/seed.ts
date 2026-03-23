import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import bcrypt from "bcryptjs";
import * as schema from "../lib/db/src/schema/index.js";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function seed() {
  const hash = await bcrypt.hash("admin123", 10);
  const [user] = await db.insert(schema.usersTable).values({
    name: "Super Admin",
    username: "superadmin",
    passwordHash: hash,
    role: "superadmin",
    agencyIds: [],
    blocked: false,
    needsPasswordRecovery: false,
  }).onConflictDoUpdate({ target: schema.usersTable.username, set: { passwordHash: hash } }).returning();
  console.log("Seeded superadmin:", user.id, user.username);
  await pool.end();
}

seed().catch((e) => { console.error(e); process.exit(1); });
