import { Request, Response, NextFunction } from "express";
import camelCase from "lodash.camelcase";

function normalizeKeys(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(normalizeKeys);
  } else if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [camelCase(k), normalizeKeys(v)])
    );
  }
  return obj;
}

export function normalizeKeysMiddleware(req: Request, _res: Response, next: NextFunction) {
  const r = req as any; // 👈 allow mutation of body/query/params safely

  if (r.body && Object.keys(r.body).length > 0) {
    r.body = normalizeKeys(r.body);
  }
  if (r.query && Object.keys(r.query).length > 0) {
    r.query = normalizeKeys(r.query);
  }
  if (r.params && Object.keys(r.params).length > 0) {
    r.params = normalizeKeys(r.params);
  }

  next();
}
