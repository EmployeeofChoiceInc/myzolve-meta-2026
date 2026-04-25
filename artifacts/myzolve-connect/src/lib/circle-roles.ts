export type CircleRole =
  | "owner"
  | "admin"
  | "host"
  | "treasurer"
  | "scribe"
  | "member"
  | "guest";

export type AssignableRole = Exclude<CircleRole, "owner">;

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
  admin: "Full management access.",
  host: "Can invite and remove members.",
  treasurer: "Can manage the care ledger.",
  scribe: "Can edit and delete wall posts.",
  member: "Standard participant.",
  guest: "Read-only participant.",
};

export const PLUS_GATED_ROLES: ReadonlySet<CircleRole> = new Set([
  "host",
  "treasurer",
  "scribe",
]);

export function isPlusGatedRole(role: string): boolean {
  return PLUS_GATED_ROLES.has(role as CircleRole);
}

export const ASSIGNABLE_ROLES: readonly AssignableRole[] = [
  "member",
  "guest",
  "host",
  "treasurer",
  "scribe",
  "admin",
];

export function rolePillClasses(role: string): string {
  switch (role as CircleRole) {
    case "owner":
    case "admin":
      return "bg-primary/10 text-primary";
    case "host":
      return "bg-secondary/10 text-secondary";
    case "treasurer":
    case "scribe":
      return "bg-accent text-accent-foreground";
    case "guest":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function canManageMembers(role: string | undefined | null): boolean {
  return role === "owner" || role === "admin" || role === "host";
}

export function canManageLedger(role: string | undefined | null): boolean {
  return role === "owner" || role === "admin" || role === "treasurer";
}

export function canManagePosts(role: string | undefined | null): boolean {
  return role === "owner" || role === "admin" || role === "scribe";
}
