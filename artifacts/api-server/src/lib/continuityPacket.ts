import { inArray } from "drizzle-orm";
import { db, memberResourcesTable, memberSkillsTable } from "@workspace/db";
import {
  mapContinuityPacketMembers,
  type PacketMemberRow,
} from "./continuityPacketRules";

export async function withMemberCapacity<T extends PacketMemberRow>(
  members: T[],
): Promise<Awaited<ReturnType<typeof mapContinuityPacketMembers<T>>>> {
  const activeMembers = members.filter((member) => member.status === "active");
  const userIds = [...new Set(activeMembers.map((member) => member.userId))];
  if (userIds.length === 0) {
    return mapContinuityPacketMembers(members, [], []);
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

  return mapContinuityPacketMembers(members, skills, resources);
}
