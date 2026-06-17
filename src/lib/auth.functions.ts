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

// ---------- Signup ----------
const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(255),
  phone: z.string().trim().min(3).max(30),
  password: z.string().min(6).max(200),
});

export const signupFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => signupSchema.parse(d))
  .handler(async ({ data }): Promise<LoginResult> => {
    const { sql } = await import("./db.server");
    const { hashPassword } = await import("./password.server");
    const { signToken } = await import("./jwt.server");

    const existing = await sql`SELECT id FROM users WHERE email = ${data.email}`;
    if (existing.length > 0) {
      throw new Error("This email is already registered.");
    }

    const hash = await hashPassword(data.password);
    const [user] = await sql`
      INSERT INTO users (email, password_hash, name, phone)
      VALUES (${data.email}, ${hash}, ${data.name}, ${data.phone})
      RETURNING id, email, name, phone, balance, lifetime_earning
    `;

    // default role = 'user'
    await sql`INSERT INTO user_roles (user_id, role) VALUES (${user.id}, 'user')`;

    const ip = getRequestHeader("x-forwarded-for") || null;
    const ua = getRequestHeader("user-agent") || null;
    await sql`INSERT INTO sessions (user_id, ip, user_agent) VALUES (${user.id}, ${ip}, ${ua})`;
    await sql`UPDATE users SET last_login_at = now() WHERE id = ${user.id}`;

    const roles = ["user"];
    const token = signToken({ sub: user.id, email: user.email, roles });
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        balance: String(user.balance),
        lifetime_earning: String(user.lifetime_earning),
        roles,
      },
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
      SELECT id, email, password_hash, name, phone, balance, lifetime_earning, status
      FROM users WHERE email = ${data.email}
    `;
    if (rows.length === 0) throw new Error("Invalid email or password.");
    const user = rows[0];

    if (user.status === "blocked") throw new Error("This account is blocked.");

    const ok = await verifyPassword(data.password, user.password_hash);
    if (!ok) throw new Error("Invalid email or password.");

    const roleRows = await sql<{ role: string }[]>`
      SELECT role FROM user_roles WHERE user_id = ${user.id}
    `;
    const roles = roleRows.map((r) => r.role);
    if (roles.length === 0) roles.push("user");

    const ip = getRequestHeader("x-forwarded-for") || null;
    const ua = getRequestHeader("user-agent") || null;
    await sql`INSERT INTO sessions (user_id, ip, user_agent) VALUES (${user.id}, ${ip}, ${ua})`;
    await sql`UPDATE users SET last_login_at = now() WHERE id = ${user.id}`;

    const token = signToken({ sub: user.id, email: user.email, roles });
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        balance: String(user.balance),
        lifetime_earning: String(user.lifetime_earning),
        roles,
      },
    };
  });

// ---------- Me (validate token, return fresh user) ----------
const meSchema = z.object({ token: z.string().min(1) });

export const meFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => meSchema.parse(d))
  .handler(async ({ data }): Promise<AuthUserDTO> => {
    const { sql } = await import("./db.server");
    const { verifyToken } = await import("./jwt.server");

    const payload = verifyToken(data.token);
    const rows = await sql`
      SELECT id, email, name, phone, balance, lifetime_earning, status
      FROM users WHERE id = ${payload.sub}
    `;
    if (rows.length === 0) throw new Error("User not found.");
    const user = rows[0];
    if (user.status === "blocked") throw new Error("Account blocked.");

    const roleRows = await sql<{ role: string }[]>`
      SELECT role FROM user_roles WHERE user_id = ${user.id}
    `;
    const roles = roleRows.map((r) => r.role);
    if (roles.length === 0) roles.push("user");

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      balance: String(user.balance),
      lifetime_earning: String(user.lifetime_earning),
      roles,
    };
  });
