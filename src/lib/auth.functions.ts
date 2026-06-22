/**
 * Auth server functions — TanStack Start RPC endpoints.
 * Browser থেকে useServerFn() দিয়ে call হয়।
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

export type AuthUserDTO = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  balance: string;
  lifetime_earning: string;
  roles: string[];
};

export type LoginResult = { token: string; user: AuthUserDTO };
export type SignupResult = { ok: true; pending: true; message: string };

// ---------- Signup ----------
const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  phone: z.string().trim().min(3).max(30),
  password: z.string().min(6).max(200),
  agent_email: z.string().trim().toLowerCase().email().max(255),
});

export const signupFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => signupSchema.parse(d))
  .handler(async ({ data }): Promise<SignupResult> => {
    const { sql } = await import("./db.server");
    const { hashPassword } = await import("./password.server");
    const { getSetting } = await import("./settings.server");

    const signupEnabled = await getSetting<boolean>("signup_enabled", true);
    if (!signupEnabled) throw new Error("Signups are currently disabled. Please contact your agent.");

    // Verify agent exists, is active, and actually has the 'agent' role
    const [agent] = await sql<any[]>`
      SELECT u.id, u.email::text AS email, u.agent_active, u.status::text AS status
      FROM users u
      WHERE lower(u.email::text) = ${data.agent_email}
        AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'agent')
    `;
    if (!agent) {
      throw new Error("Invalid agent email. Please ask your agent for the correct sign-up email.");
    }
    if (!agent.agent_active || agent.status !== "active") {
      throw new Error("This agent is currently inactive. Please contact your agent.");
    }

    const existing = await sql`SELECT id FROM users WHERE email = ${data.email}`;
    if (existing.length > 0) throw new Error("This email is already registered.");

    // Copy current agent's otp_rate as user's rate
    const [rateRow] = await sql<any[]>`SELECT otp_rate::text AS r FROM users WHERE id = ${agent.id}`;
    const rate = rateRow?.r ?? "0.60";

    const hash = await hashPassword(data.password);
    await sql`
      INSERT INTO users (email, password_hash, name, phone, status, agent_id, signup_agent_email, otp_rate)
      VALUES (${data.email}, ${hash}, ${data.name}, ${data.phone},
              'pending'::user_status, ${agent.id}, ${data.agent_email}, ${rate}::numeric)
    `;
    // default role = 'user' (created on approval too, but harmless either way)
    await sql`
      INSERT INTO user_roles (user_id, role)
      SELECT id, 'user'::app_role FROM users WHERE email = ${data.email}
      ON CONFLICT DO NOTHING
    `;

    return {
      ok: true as const,
      pending: true as const,
      message: `Account created! Your agent (${agent.email}) needs to approve it before you can log in.`,
    };
  });

// ---------- Login ----------
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export const loginFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => loginSchema.parse(d))
  .handler(async ({ data }): Promise<LoginResult> => {
    const { sql } = await import("./db.server");
    const { verifyPassword } = await import("./password.server");
    const { signToken } = await import("./jwt.server");

    const rows = await sql`
      SELECT id, email, password_hash, name, phone, balance, lifetime_earning,
             status::text AS status, banned_until, ban_reason
      FROM users WHERE email = ${data.email}
    `;
    if (rows.length === 0) throw new Error("Invalid email or password.");
    const user = rows[0];

    if (user.status === "pending") {
      throw new Error("Your account is awaiting agent approval. Please contact your agent.");
    }
    if (user.status === "blocked") {
      throw new Error(user.ban_reason ? `Account blocked: ${user.ban_reason}` : "This account is blocked.");
    }
    if (user.banned_until && new Date(user.banned_until).getTime() > Date.now()) {
      const until = new Date(user.banned_until).toLocaleString();
      throw new Error(`Account suspended until ${until}${user.ban_reason ? ` — ${user.ban_reason}` : ""}`);
    }

    const ok = await verifyPassword(data.password, user.password_hash);
    if (!ok) throw new Error("Invalid email or password.");

    const roleRows = await sql<{ role: string }[]>`
      SELECT role FROM user_roles WHERE user_id = ${user.id}
    `;
    const roles = roleRows.map((r) => r.role);
    if (roles.length === 0) roles.push("user");

    const { getSetting } = await import("./settings.server");
    const maintenance = Boolean(await getSetting("maintenance_mode", false));
    if (maintenance && !roles.includes("admin")) {
      const msg = String(await getSetting("maintenance_message", "System is under maintenance. Please try again later."));
      throw new Error(msg);
    }

    const ip = getRequestHeader("x-forwarded-for") || null;
    const ua = getRequestHeader("user-agent") || null;
    await sql`INSERT INTO sessions (user_id, ip, user_agent) VALUES (${user.id}, ${ip}, ${ua})`;
    await sql`UPDATE users SET last_login_at = now() WHERE id = ${user.id}`;

    const token = signToken({ sub: user.id, email: user.email, roles });
    return {
      token,
      user: {
        id: user.id, email: user.email, name: user.name, phone: user.phone,
        balance: String(user.balance), lifetime_earning: String(user.lifetime_earning),
        roles,
      },
    };
  });

// ---------- Me ----------
const meSchema = z.object({ token: z.string().min(1) });

export const meFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => meSchema.parse(d))
  .handler(async ({ data }): Promise<AuthUserDTO> => {
    const { sql } = await import("./db.server");
    const { requireAuth } = await import("./auth-guard.server");

    const payload = await requireAuth(data.token);

    const rows = await sql`
      SELECT id, email, name, phone, balance, lifetime_earning
      FROM users WHERE id = ${payload.sub}
    `;
    if (rows.length === 0) throw new Error("User not found.");
    const user = rows[0];

    const roleRows = await sql<{ role: string }[]>`
      SELECT role FROM user_roles WHERE user_id = ${user.id}
    `;
    const roles = roleRows.map((r) => r.role);
    if (roles.length === 0) roles.push("user");

    return {
      id: user.id, email: user.email, name: user.name, phone: user.phone,
      balance: String(user.balance), lifetime_earning: String(user.lifetime_earning),
      roles,
    };
  });
