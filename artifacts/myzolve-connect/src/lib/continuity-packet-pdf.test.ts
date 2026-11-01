import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import type {
  CircleContinuityPacket,
  OrgContinuityPacket,
} from "@workspace/api-client-react";
import { downloadContinuityPacketPdf } from "./continuity-packet-pdf";

type Packet = CircleContinuityPacket | OrgContinuityPacket;

function member(name: string) {
  return {
    userId: 1,
    name,
    role: "member",
    email: `${name.toLowerCase().replaceAll(" ", ".")}@example.test`,
    phone: null,
    skills: ["First aid", "School pickup coordination"],
    resources: [
      { label: "Car seats", isAvailable: true },
      { label: "Guest room", isAvailable: false },
    ],
  };
}

function circlePacket(
  members: CircleContinuityPacket["members"],
  sharedNotes: CircleContinuityPacket["sharedNotes"],
): CircleContinuityPacket {
  return {
    generatedAt: "2026-11-01T12:00:00.000Z",
    circle: {
      id: 42,
      name: "Café / North & South",
      logoUrl: null,
      accentColor: "#245a42",
    },
    members,
    meetingLocations: ["Community center"],
    sharedNotes,
    continuityNotes: [],
  };
}

async function download(packet: Packet, fetchOverride?: typeof fetch) {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldCreateObjectURL = URL.createObjectURL;
  const oldRevokeObjectURL = URL.revokeObjectURL;
  const oldFetch = globalThis.fetch;
  let downloadedBlob: Blob | null = null;
  let clicked = false;
  const link = {
    href: "",
    download: "",
    click() {
      clicked = true;
    },
  };
  const createObjectURL = (blob: Blob) => {
    downloadedBlob = blob;
    return "blob:continuity-packet-test";
  };

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      document: { createElement: () => link },
      setTimeout: (callback: () => void) => {
        callback();
        return 0;
      },
    },
  });
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = () => {};
  if (fetchOverride) globalThis.fetch = fetchOverride;

  try {
    await downloadContinuityPacketPdf(packet);
    assert.ok(downloadedBlob, "the PDF blob should be created for download");
    assert.equal(clicked, true, "the browser download link should be clicked");
    return {
      blob: downloadedBlob,
      filename: link.download,
    };
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
    URL.createObjectURL = oldCreateObjectURL;
    URL.revokeObjectURL = oldRevokeObjectURL;
    globalThis.fetch = oldFetch;
  }
}

async function assertValidPdf(blob: Blob): Promise<PDFDocument> {
  assert.equal(blob.type, "application/pdf");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  return PDFDocument.load(bytes);
}

test("circle packet downloads as a valid PDF with a safe filename", async () => {
  const result = await download(circlePacket([member("Ari Rivera")], []));
  assert.equal(result.filename, "cafe-north-south-continuity-packet.pdf");
  const pdf = await assertValidPdf(result.blob);
  assert.equal(pdf.getPageCount(), 1);
});

test("circle packet includes dedicated continuity notes", async () => {
  const packet = circlePacket([], []);
  packet.continuityNotes = [
    {
      title: "Care plan",
      body: "Keep the medication list and emergency contact plan current.",
      authorName: "Ari Rivera",
      createdAt: "2026-10-31T12:00:00.000Z",
    },
  ];
  const result = await download(packet);
  const pdf = await assertValidPdf(result.blob);
  assert.equal(pdf.getPageCount(), 1);
});

test("organization packet downloads with an organization-specific filename", async () => {
  const packet: OrgContinuityPacket = {
    generatedAt: "2026-11-01T12:00:00.000Z",
    org: {
      id: 7,
      name: "Northside Reunion",
      logoUrl: null,
      accentColor: null,
    },
    members: [member("Ari Rivera")],
    meetingLocations: [],
    sharedNotes: [],
  };
  const result = await download(packet);
  assert.equal(result.filename, "northside-reunion-continuity-packet.pdf");
  const pdf = await assertValidPdf(result.blob);
  assert.equal(pdf.getPageCount(), 1);
});

test("an unavailable logo does not block a valid packet download", async () => {
  const packet = circlePacket([member("Ari Rivera")], []);
  packet.circle.logoUrl = "/api/orgs/7/logo";
  const result = await download(packet, async () => new Response(null, { status: 404 }));
  assert.equal(result.filename, "cafe-north-south-continuity-packet.pdf");
  const pdf = await assertValidPdf(result.blob);
  assert.equal(pdf.getPageCount(), 1);
});

test("long rosters and long shared notes continue onto additional PDF pages", async () => {
  const longRoster = Array.from({ length: 45 }, (_, index) =>
    member(`Caregiver ${index + 1} with extended roster name`),
  );
  const rosterPdf = await assertValidPdf(
    (await download(circlePacket(longRoster, []))).blob,
  );
  assert.ok(rosterPdf.getPageCount() > 1, "the roster should span pages");

  const longBody = Array.from(
    { length: 110 },
    (_, index) =>
      `Note detail ${index + 1}: keep the medication list and emergency contact plan updated before each seasonal trip.`,
  ).join(" ");
  const notePdf = await assertValidPdf(
    (
      await download(
        circlePacket([], [
          {
            title: "Long continuity note",
            body: longBody,
            authorName: "Ari Rivera",
            createdAt: "2026-10-31T12:00:00.000Z",
          },
        ]),
      )
    ).blob,
  );
  assert.ok(notePdf.getPageCount() > 1, "the long note should span pages");
});
