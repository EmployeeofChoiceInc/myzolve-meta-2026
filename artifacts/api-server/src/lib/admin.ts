/**
 * Program-admin identity for MyZolve's internal tools (the verified-circle
 * queue, Circle Builder review, and complimentary-access management).
 *
 * Admins are identified by the comma-separated `VERIFICATION_ADMIN_EMAIL`
 * allow-list env var rather than a database flag — this matches the existing
 * convention and keeps "who is staff" out of user-editable data.
 */
export function isProgramAdmin(email: string | null | undefined): boolean {
  const raw = process.env["VERIFICATION_ADMIN_EMAIL"];
  if (!raw || !email) return false;
  const allowed = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
