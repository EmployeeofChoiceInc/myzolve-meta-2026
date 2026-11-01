export type ContinuityPacketResource = {
  label: string;
  isAvailable: boolean;
};

export type PacketMemberRow = {
  userId: number;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  phoneDiscoverable: boolean;
  status: string;
};

export type PacketSkillRow = { userId: number; label: string };
export type PacketResourceRow = PacketSkillRow & { isAvailable: boolean };

export function mapContinuityPacketMembers<T extends PacketMemberRow>(
  rows: T[],
  skills: PacketSkillRow[],
  resources: PacketResourceRow[],
): Array<{
  userId: number;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  skills: string[];
  resources: ContinuityPacketResource[];
}> {
  const skillsByUser = new Map<number, string[]>();
  for (const skill of skills) {
    const current = skillsByUser.get(skill.userId) ?? [];
    current.push(skill.label);
    skillsByUser.set(skill.userId, current);
  }

  const resourcesByUser = new Map<number, ContinuityPacketResource[]>();
  for (const resource of resources) {
    const current = resourcesByUser.get(resource.userId) ?? [];
    current.push({
      label: resource.label,
      isAvailable: resource.isAvailable,
    });
    resourcesByUser.set(resource.userId, current);
  }

  return rows
    .filter((member) => member.status === "active")
    .map((member) => ({
      userId: member.userId,
      name: member.name,
      role: member.role,
      email: member.email || null,
      phone: member.phoneDiscoverable ? member.phone : null,
      skills: skillsByUser.get(member.userId) ?? [],
      resources: resourcesByUser.get(member.userId) ?? [],
    }));
}

export type PacketPlaceholderRow = {
  name: string;
  relationship: string | null;
  email: string | null;
  status: string;
};

export function addUnlinkedCirclePlaceholders<
  T extends { name: string },
>(members: T[], placeholders: PacketPlaceholderRow[]) {
  return [
    ...members,
    ...placeholders
      .filter((placeholder) => placeholder.status === "unlinked")
      .map((placeholder) => ({
        userId: null,
        name: placeholder.name,
        role: placeholder.relationship
          ? `placeholder (${placeholder.relationship})`
          : "placeholder",
        email: placeholder.email,
        phone: null,
        skills: [],
        resources: [],
      })),
  ].sort((a, b) => a.name.localeCompare(b.name));
}

export type PacketNoteRow = {
  title: string | null;
  body: string;
  authorName: string;
  createdAt: Date | string;
  status: string;
};

export function activeContinuityPacketNotes<T extends PacketNoteRow>(
  notes: T[],
): Array<Omit<T, "status">> {
  return notes
    .filter((note) => note.status === "active")
    .map(({ status: _status, ...note }) => note);
}

export function uniqueMeetingLocations(locations: Array<string | null>): string[] {
  return [
    ...new Set(
      locations
        .map((location) => location?.trim())
        .filter((location): location is string => !!location),
    ),
  ];
}

export function canDownloadCircleContinuityPacket(input: {
  ownerId: number;
  userId: number;
  membership: { role: string; status: string } | null;
}): "owner" | "admin" | "forbidden-member" | "not-member" {
  if (input.ownerId === input.userId) return "owner";
  if (input.membership?.status !== "active") return "not-member";
  if (input.membership.role === "owner" || input.membership.role === "admin") {
    return "admin";
  }
  return "forbidden-member";
}

export function isOrgContinuityPacketAdmin(input: {
  ownerId: number;
  userId: number;
  membership: { role: string; status: string } | null;
}): boolean {
  return (
    input.ownerId === input.userId ||
    (input.membership?.status === "active" &&
      (input.membership.role === "owner" || input.membership.role === "admin"))
  );
}
