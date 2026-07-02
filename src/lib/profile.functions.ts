import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().min(1) });

export type ProfileDTO = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  timezone: string | null;
  telegram: string | null;
  bio: string | null;
  balance: string;
  lifetime_earning: string;
  otp_rate: number;
  created_at: string;
  last_login_at: string | null;
};


export type SessionDTO = {
  id: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

// ---------- Get profile ----------
export const getProfileFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }): Promise<ProfileDTO> => {
    const { sql } = await import("./db.server");
    const { requireAuth } = await import("./auth-guard.server");
    const auth = await requireAuth(data.token);
    const rows = await sql`
      SELECT id, email, name, phone, country, city, timezone, telegram, bio,
             balance::text, lifetime_earning::text,
             created_at, last_login_at
      FROM users WHERE id = ${auth.sub}
    `;
    if (rows.length === 0) throw new Error("User not found");
    const u = rows[0];
    return {
      id: u.id, email: u.email, name: u.name, phone: u.phone,
      country: u.country, city: u.city, timezone: u.timezone,
      telegram: u.telegram, bio: u.bio,
      balance: String(u.balance), lifetime_earning: String(u.lifetime_earning),
      created_at: u.created_at.toISOString(),
      last_login_at: u.last_login_at ? u.last_login_at.toISOString() : null,
    };
  });

// ---------- Update profile ----------
const updateSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  country: z.string().trim().max(80).optional().nullable(),
  city: z.string().trim().max(80).optional().nullable(),
  timezone: z.string().trim().max(80).optional().nullable(),
  telegram: z.string().trim().max(80).optional().nullable(),
  bio: z.string().trim().max(500).optional().nullable(),
});

export const updateProfileFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { sql } = await import("./db.server");
    const { requireAuth } = await import("./auth-guard.server");
    const auth = await requireAuth(data.token);

    // Build patch: only include keys the client explicitly sent.
    // Empty string ("") is treated as "clear" → NULL. Undefined keys are ignored.
    const fields = ["name", "phone", "country", "city", "timezone", "telegram", "bio"] as const;
    const patch: Record<string, string | null> = {};
    for (const k of fields) {
      const v = (data as any)[k];
      if (v === undefined) continue;
      patch[k] = v === null || v === "" ? null : v;
    }
    if (Object.keys(patch).length === 0) return { ok: true };

    // postgres-js: sql(obj) generates `SET "k" = $1, ...`
    await sql`UPDATE users SET ${sql(patch)} WHERE id = ${auth.sub}`;
    return { ok: true };
  });

// ---------- Change password ----------
const passwordSchema = z.object({
  token: z.string().min(1),
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(200),
});

export const changePasswordFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => passwordSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { sql } = await import("./db.server");
    const { requireAuth } = await import("./auth-guard.server");
    const { hashPassword, verifyPassword } = await import("./password.server");
    const auth = await requireAuth(data.token);
    const rows = await sql`SELECT password_hash FROM users WHERE id = ${auth.sub}`;
    if (rows.length === 0) throw new Error("User not found");
    const ok = await verifyPassword(data.currentPassword, rows[0].password_hash);
    if (!ok) throw new Error("Current password is incorrect");
    const hash = await hashPassword(data.newPassword);
    await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${auth.sub}`;
    return { ok: true };
  });

// ---------- Login history ----------
export const getSessionsFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data }): Promise<SessionDTO[]> => {
    const { sql } = await import("./db.server");
    const { requireAuth } = await import("./auth-guard.server");
    const auth = await requireAuth(data.token);
    const rows = await sql`
      SELECT id, ip, user_agent, created_at
      FROM sessions WHERE user_id = ${auth.sub}
      ORDER BY created_at DESC LIMIT 20
    `;
    return rows.map((r: any) => ({
      id: r.id, ip: r.ip, user_agent: r.user_agent,
      created_at: r.created_at.toISOString(),
    }));
  });
