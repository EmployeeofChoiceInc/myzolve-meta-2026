import { type Request, type Response, type NextFunction } from "express";
import { isPlus } from "../lib/revenuecat";

/**
 * Server-side gate for Plus-only mutations. Must be mounted AFTER
 * `requireAuth` so `req.dbUser` is populated. RevenueCat is the source
 * of truth — we never store the Plus state in our DB.
 */
export async function requirePlus(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const user = req.dbUser;
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const ok = await isPlus(user.clerkId);
  if (!ok) {
    res.status(402).json({
      error: "plus_required",
      message: "MyZolve Connect Plus is required for this feature.",
    });
    return;
  }

  next();
}
