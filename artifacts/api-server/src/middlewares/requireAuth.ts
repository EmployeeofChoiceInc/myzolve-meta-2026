import { type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      dbUser?: typeof usersTable.$inferSelect;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { userId: clerkId } = getAuth(req);
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  let user = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1)
    .then((rows) => rows[0]);

  if (!user) {
    const claims = getAuth(req).sessionClaims as Record<string, string> | null | undefined;
    const email =
      claims?.["email"] ?? `${clerkId}@unknown.com`;
    const firstName = claims?.["first_name"] ?? "";
    const lastName = claims?.["last_name"] ?? "";
    const displayName =
      firstName && lastName
        ? `${firstName} ${lastName}`
        : firstName || lastName || email.split("@")[0];

    const [inserted] = await db
      .insert(usersTable)
      .values({
        clerkId,
        email,
        displayName,
        firstName: firstName || null,
        lastName: lastName || null,
      })
      .returning();
    user = inserted;
  }

  req.dbUser = user;
  next();
}
