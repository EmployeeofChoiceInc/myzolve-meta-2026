import { inArray } from "drizzle-orm";
import { db, memberResourcesTable, memberSkillsTable } from "@workspace/db";

export type ContinuityPacketResource = {
  label: string;
  isAvailable: boolean;
};

export async function withMemberCapacity<T extends { userId: number }>(
  members: T[],
): Promise<Array<T & { skills: string[]; resources: ContinuityPacketResource[] }>> {
  const userIds = [...new Set(members.map((member) => member.userId))];
  if (userIds.length === 0) {
    return members.map((member) => ({ ...member, skills: [], resources: [] }));
  }

  const [skills, resources] = await Promise.all([
    db
      .select({
        userId: memberSkillsTable.userId,
        label: memberSkillsTable.label,
      })
      .from(memberSkillsTable)
      .where(inArray(memberSkillsTable.userId, userIds)),
    db
      .select({
        userId: memberResourcesTable.userId,
        label: memberResourcesTable.label,
        isAvailable: memberResourcesTable.isAvailable,
      })
      .from(memberResourcesTable)
      .where(inArray(memberResourcesTable.userId, userIds)),
  ]);

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

  return members.map((member) => ({
    ...member,
    skills: skillsByUser.get(member.userId) ?? [],
    resources: resourcesByUser.get(member.userId) ?? [],
  }));
}
