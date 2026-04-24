import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns the email to display in the UI, or null if the value looks like
 * the server-side placeholder we generate when a Clerk user has no email
 * claim (see api-server `requireAuth.ts`, which falls back to
 * `${clerkId}@unknown.com`). UI should hide the line entirely when this
 * returns null instead of showing an ugly synthetic address.
 */
export function displayEmail(email: string | null | undefined): string | null {
  if (!email) return null
  if (email.endsWith("@unknown.com")) return null
  return email
}
