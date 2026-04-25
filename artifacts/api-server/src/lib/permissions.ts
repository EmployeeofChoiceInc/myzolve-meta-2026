/**
 * Role-based permission helpers for circles.
 *
 * Roles in `circle_members.role` (column type `text`):
 *   - `owner`     — circle creator (or transferred-to). Full control.
 *   - `admin`     — legacy elevated role; still supported. Full member-level
 *                   moderation, can be granted by ownership transfer.
 *   - `host`      — Plus sub-role. Can manage members & invitations.
 *   - `treasurer` — Plus sub-role. Can manage the ledger (requests,
 *                   contributions, repayments, disputes, full ledger view).
 *   - `scribe`    — Plus sub-role. Can edit/delete wall posts & comments.
 *   - `member`    — default participant.
 *   - `guest`     — read-only-ish participant.
 *
 * Granting `host`, `treasurer`, or `scribe` requires the granting owner to
 * have an active Plus entitlement. Demoting back to `member` is always
 * allowed, even if the owner is no longer Plus, so circles never get
 * stranded.
 */

export type CircleRole =
  | "owner"
  | "admin"
  | "host"
  | "treasurer"
  | "scribe"
  | "member"
  | "guest";

const ADMIN_ROLES = new Set<string>(["owner", "admin"]);

/**
 * True when the role can act as a circle administrator (owner or admin).
 * Use this for high-stakes settings (delete circle, transfer ownership,
 * privacy mode, audit log access, etc.) that should NOT be delegated to
 * sub-roles.
 */
export function isOwnerOrAdmin(role: string | null | undefined): boolean {
  return !!role && ADMIN_ROLES.has(role);
}

/** True when the role can manage members & invitations. */
export function canManageMembers(role: string | null | undefined): boolean {
  return !!role && (ADMIN_ROLES.has(role) || role === "host");
}

/**
 * True when the role can act on the ledger: see admin-only requests,
 * manage contributions/repayments/disputes, and view the full ledger.
 */
export function canManageLedger(role: string | null | undefined): boolean {
  return !!role && (ADMIN_ROLES.has(role) || role === "treasurer");
}

/** True when the role can edit/delete wall posts & comments by anyone. */
export function canManagePosts(role: string | null | undefined): boolean {
  return !!role && (ADMIN_ROLES.has(role) || role === "scribe");
}

/** Sub-roles whose grant requires the owner to have Plus. */
export const PLUS_GATED_ROLES = new Set<string>(["host", "treasurer", "scribe"]);

/** All roles that may be set via the role-update endpoint. */
export const ASSIGNABLE_ROLES = [
  "member",
  "guest",
  "admin",
  "host",
  "treasurer",
  "scribe",
] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export function isPlusGatedRole(role: string): boolean {
  return PLUS_GATED_ROLES.has(role);
}
