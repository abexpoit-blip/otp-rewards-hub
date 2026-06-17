/**
 * Server-side auth helper for createServerFn handlers.
 * Token client থেকে data payload এ আসে; এখানে verify করে user info return করি।
 */
import { verifyToken, type JwtPayload } from "./jwt.server";

export function requireAuth(token: string | undefined | null): JwtPayload {
  if (!token) {
    const err: any = new Error("Unauthorized");
    err.status = 401;
    throw err;
  }
  try {
    return verifyToken(token);
  } catch {
    const err: any = new Error("Invalid or expired session");
    err.status = 401;
    throw err;
  }
}

export function requireRole(payload: JwtPayload, role: string): JwtPayload {
  if (!payload.roles?.includes(role)) {
    const err: any = new Error("Forbidden");
    err.status = 403;
    throw err;
  }
  return payload;
}
