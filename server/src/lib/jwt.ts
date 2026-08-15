import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "coffee-os-dev-secret";

export interface AdminPayload {
  id: number;
  role: string;
  type: "admin";
}

export interface UserPayload {
  id: number;
  type: "user";
}

export function signAdmin(payload: { id: number; role: string }) {
  return jwt.sign({ ...payload, type: "admin" }, SECRET, { expiresIn: "2d" });
}

export function signUser(id: number) {
  return jwt.sign({ id, type: "user" }, SECRET, { expiresIn: "30d" });
}

export function verify<T>(token: string): T | null {
  try {
    return jwt.verify(token, SECRET) as T;
  } catch {
    return null;
  }
}
