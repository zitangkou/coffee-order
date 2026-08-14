import type { Response } from "express";

export function ok(res: Response, data: unknown = null, msg = "success") {
  return res.json({ code: 0, data, msg });
}

export function fail(res: Response, msg: string, code = 1, status = 200) {
  return res.status(status).json({ code, data: null, msg });
}
