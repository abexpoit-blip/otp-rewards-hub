import jwt from "jsonwebtoken";

export type JwtPayload = {
  sub: string;        // user id
  email: string;
  roles: string[];    // ['user', 'admin', ...]
};

function getSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error("JWT_SECRET is missing or too short (need 16+ chars)");
  }
  return s;
}

export function signToken(payload: JwtPayload, expiresIn: string = "30d"): string {
  return jwt.sign(payload, getSecret(), { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getSecret()) as JwtPayload;
}
