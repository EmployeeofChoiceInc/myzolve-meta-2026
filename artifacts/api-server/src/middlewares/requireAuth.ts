import { type Request, type Response, type NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";
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

type ClerkProfile = {
  email: string;
  firstName: string;
  lastName: string;
};

function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !email || email.endsWith("@unknown.com");
}

/**
 * Fetch the user's real profile (primary email + name) from Clerk's backend
 * API. The session token does not include the email claim, so we cannot rely
 * on `sessionClaims`; the Clerk Backend API is the source of truth.
 * Returns null on any failure so callers can fall back gracefully.
 */
async function fetchClerkProfile(clerkId: string): Promise<ClerkProfile | null> {
  try {
    const u = await clerkClient.users.getUser(clerkId);
    const primary =
      u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId) ??
      u.emailAddresses[0];
    const email = primary?.emailAddress;
    if (!email) return null;
    return {
      email,
      firstName: u.firstName ?? "",
      lastName: u.lastName ?? "",
    };
  } catch {
    return null;
  }
}

function deriveDisplayName(
  email: string,
  firstName: string,
  lastName: string,
): string {
  const fromName =
    firstName && lastName
      ? `${firstName} ${lastName}`
      : firstName || lastName || "";
  if (fromName) return fromName;
  const emailLocal = email.split("@")[0] ?? "";
  return emailLocal && !emailLocal.startsWith("user_")
    ? emailLocal
    : "New friend";
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
    const profile = await fetchClerkProfile(clerkId);
    const claims = getAuth(req).sessionClaims as
      | Record<string, string>
      | null
      | undefined;
    const email =
      profile?.email ?? claims?.["email"] ?? `${clerkId}@unknown.com`;
    const firstName = profile?.firstName ?? claims?.["first_name"] ?? "";
    const lastName = profile?.lastName ?? claims?.["last_name"] ?? "";
    const displayName = deriveDisplayName(email, firstName, lastName);

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
  } else if (isPlaceholderEmail(user.email)) {
    // Heal legacy rows that were created before we fetched the real email
    // from Clerk (the session token never carried an `email` claim).
    const profile = await fetchClerkProfile(clerkId);
    if (profile && !isPlaceholderEmail(profile.email)) {
      const [updated] = await db
        .update(usersTable)
        .set({ email: profile.email })
        .where(eq(usersTable.id, user.id))
        .returning();
      if (updated) user = updated;
    }
  }

  req.dbUser = user;
  next();
}
