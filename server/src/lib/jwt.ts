import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "coffee-os-dev-secret";

export interface AdminPayload {
  id: number;
  role: string;
  ver: number;
  type: "admin";
}

export interface UserPayload {
  id: number;
  ver: number;
  type: "user";
}

export function signAdmin(payload: { id: number; role: string; ver: number }) {
  return jwt.sign({ ...payload, type: "admin" }, SECRET, { expiresIn: "2d" });
}

export function signUser(id: number, tokenVersion = 0) {
  return jwt.sign({ id, ver: tokenVersion, type: "user" }, SECRET, { expiresIn: "30d" });
}

export function verify<T>(token: string): T | null {
  try {
    return jwt.verify(token, SECRET) as T;
  } catch {
    return null;
  }
}
