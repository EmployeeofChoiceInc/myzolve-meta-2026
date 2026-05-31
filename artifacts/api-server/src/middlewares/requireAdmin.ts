import { type Request, type Response, type NextFunction } from "express";
import { isProgramAdmin } from "../lib/admin";

/**
 * Gate for program-admin-only routes. Must run after `requireAuth` so that
 * `req.dbUser` (and therefore the caller's email) is populated. Returns 403
 * for authenticated non-admins so the client can show a clean "not authorized"
 * state rather than a generic error.
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.dbUser || !isProgramAdmin(req.dbUser.email)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}
