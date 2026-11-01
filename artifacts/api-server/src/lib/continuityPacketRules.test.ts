import assert from "node:assert/strict";
import test from "node:test";
import {
  activeContinuityPacketNotes,
  addUnlinkedCirclePlaceholders,
  canDownloadCircleContinuityPacket,
  isOrgContinuityPacketAdmin,
  mapContinuityPacketMembers,
  uniqueMeetingLocations,
} from "./continuityPacketRules";

test("circle packet access is limited to owners and active admins", () => {
  assert.equal(
    canDownloadCircleContinuityPacket({
      ownerId: 1,
      userId: 1,
      membership: null,
    }),
    "owner",
  );
  assert.equal(
    canDownloadCircleContinuityPacket({
      ownerId: 1,
      userId: 2,
      membership: { role: "admin", status: "active" },
    }),
    "admin",
  );
  assert.equal(
    canDownloadCircleContinuityPacket({
      ownerId: 1,
      userId: 2,
      membership: { role: "member", status: "active" },
    }),
    "forbidden-member",
  );
  assert.equal(
    canDownloadCircleContinuityPacket({
      ownerId: 1,
      userId: 2,
      membership: { role: "admin", status: "inactive" },
    }),
    "not-member",
  );
  assert.equal(
    canDownloadCircleContinuityPacket({
      ownerId: 1,
      userId: 3,
      membership: null,
    }),
    "not-member",
  );
});

test("organization packet access is limited to owners and active owners/admins", () => {
  assert.equal(
    isOrgContinuityPacketAdmin({
      ownerId: 4,
      userId: 4,
      membership: null,
    }),
    true,
  );
  assert.equal(
    isOrgContinuityPacketAdmin({
      ownerId: 4,
      userId: 5,
      membership: { role: "admin", status: "active" },
    }),
    true,
  );
  assert.equal(
    isOrgContinuityPacketAdmin({
      ownerId: 4,
      userId: 5,
      membership: { role: "owner", status: "active" },
    }),
    true,
  );
  assert.equal(
    isOrgContinuityPacketAdmin({
      ownerId: 4,
      userId: 5,
      membership: { role: "member", status: "active" },
    }),
    false,
  );
  assert.equal(
    isOrgContinuityPacketAdmin({
      ownerId: 4,
      userId: 5,
      membership: { role: "admin", status: "inactive" },
    }),
    false,
  );
});

test("rosters include active members and expose phone only when discoverable", () => {
  const members = mapContinuityPacketMembers(
    [
      {
        userId: 10,
        name: "Ari",
        role: "member",
        email: "ari@example.test",
        phone: "555-0100",
        phoneDiscoverable: true,
        status: "active",
      },
      {
        userId: 11,
        name: "Bea",
        role: "member",
        email: "",
        phone: "555-0101",
        phoneDiscoverable: false,
        status: "active",
      },
      {
        userId: 12,
        name: "Inactive",
        role: "admin",
        email: "inactive@example.test",
        phone: "555-0102",
        phoneDiscoverable: true,
        status: "inactive",
      },
    ],
    [{ userId: 10, label: "First aid" }],
    [
      { userId: 10, label: "Van", isAvailable: true },
      { userId: 10, label: "Spare room", isAvailable: false },
    ],
  );

  assert.deepEqual(
    members.map(({ name }) => name),
    ["Ari", "Bea"],
  );
  assert.equal(members[0]?.phone, "555-0100");
  assert.equal(members[1]?.phone, null);
  assert.equal(members[1]?.email, null);
  assert.deepEqual(members[0]?.skills, ["First aid"]);
  assert.deepEqual(members[0]?.resources, [
    { label: "Van", isAvailable: true },
    { label: "Spare room", isAvailable: false },
  ]);
  assert.deepEqual(members[1]?.skills, []);
  assert.deepEqual(members[1]?.resources, []);
});

test("circle roster adds only unlinked placeholders in name order", () => {
  const members = addUnlinkedCirclePlaceholders(
    [
      {
        userId: 20,
        name: "Zoe",
        role: "member",
        email: null,
        phone: null,
        skills: [],
        resources: [],
      },
    ],
    [
      {
        name: "Mina",
        relationship: "aunt",
        email: "mina@example.test",
        status: "unlinked",
      },
      {
        name: "Already linked",
        relationship: "friend",
        email: null,
        status: "linked",
      },
      {
        name: "Sam",
        relationship: null,
        email: null,
        status: "unlinked",
      },
    ],
  );

  assert.deepEqual(
    members.map((member) => member.name),
    ["Mina", "Sam", "Zoe"],
  );
  assert.equal(members[0]?.role, "placeholder (aunt)");
  assert.equal(members[0]?.phone, null);
  assert.deepEqual(members[0]?.skills, []);
  assert.deepEqual(members[0]?.resources, []);
  assert.equal(members[1]?.role, "placeholder");
});

test("packets include only active shared notes and normalize saved locations", () => {
  const notes = activeContinuityPacketNotes([
    {
      title: "Current",
      body: "Keep the backup key with the neighbor.",
      authorName: "Ari",
      createdAt: "2026-10-31T12:00:00.000Z",
      status: "active",
    },
    {
      title: "Removed",
      body: "This note was removed.",
      authorName: "Bea",
      createdAt: "2026-10-30T12:00:00.000Z",
      status: "deleted",
    },
  ]);
  assert.deepEqual(notes.map((note) => note.title), ["Current"]);
  assert.deepEqual(
    uniqueMeetingLocations(["  Community hall ", null, "", "Community hall", "Clinic"]),
    ["Community hall", "Clinic"],
  );
});
