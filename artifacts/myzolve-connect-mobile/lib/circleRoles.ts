import type { UpdateCircleMemberBodyRole } from "@workspace/api-client-react";

export type CircleRole =
  | "owner"
  | "admin"
  | "host"
  | "treasurer"
  | "scribe"
  | "member"
  | "guest";

/**
 * Roles that can be assigned through the role picker. Aliased from the
 * generated `UpdateCircleMemberBodyRole` so the picker stays in sync with
 * the API contract — and so we don't need an `any` cast at the mutation
 * call site. Owner is intentionally excluded; ownership is transferred
 * through a dedicated flow rather than a role edit.
 */
export type AssignableRole = UpdateCircleMemberBodyRole;

export const ROLE_LABELS: Record<CircleRole, string> = {
  owner: "Owner",
  admin: "Admin",
  host: "Host",
  treasurer: "Treasurer",
  scribe: "Scribe",
  member: "Member",
  guest: "Guest",
};

export const ROLE_DESCRIPTIONS: Record<CircleRole, string> = {
  owner: "Full control of the circle.",
  admin: "Full management access (legacy).",
  host: "Can invite and remove members.",
  treasurer: "Can manage the care ledger.",
  scribe: "Can edit and delete wall posts.",
  member: "Standard participant.",
  guest: "Read-only participant.",
};

/**
 * Sub-roles that require the circle owner to have an active Plus
 * entitlement to grant. Demoting to member/guest is always free.
 */
export const PLUS_GATED_ROLES: ReadonlySet<CircleRole> = new Set([
  "host",
  "treasurer",
  "scribe",
]);

export function isPlusGatedRole(role: string): boolean {
  return PLUS_GATED_ROLES.has(role as CircleRole);
}

/**
 * Roles a circle owner can assign through the Roles panel. Owner is
 * intentionally excluded — ownership is moved through the dedicated
 * "transfer ownership" flow, not by editing a member's role.
 */
export const ASSIGNABLE_ROLES: readonly AssignableRole[] = [
  "member",
  "guest",
  "host",
  "treasurer",
  "scribe",
  "admin",
];

type ColorBag = {
  primary: string;
  primarySoft: string;
  secondary: string;
  secondarySoft: string;
  accent: string;
  accentForeground: string;
  muted: string;
  mutedForeground: string;
};

export function rolePillColors(
  role: string,
  c: ColorBag,
): { bg: string; fg: string } {
  switch (role as CircleRole) {
    case "owner":
    case "admin":
      return { bg: c.primarySoft, fg: c.primary };
    case "host":
      return { bg: c.secondarySoft, fg: c.secondary };
    case "treasurer":
    case "scribe":
      return { bg: c.accent, fg: c.accentForeground };
    case "guest":
      return { bg: c.muted, fg: c.mutedForeground };
    default:
      return { bg: c.muted, fg: c.mutedForeground };
  }
}
