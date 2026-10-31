import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import type {
  CircleContinuityPacket,
  ContinuityPacketMember,
  OrgContinuityPacket,
} from "@workspace/api-client-react";

type Packet = CircleContinuityPacket | OrgContinuityPacket;
type GroupBrand = CircleContinuityPacket["circle"] | OrgContinuityPacket["org"];

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const FOOTER_HEIGHT = 32;
const BLACK = rgb(0.12, 0.12, 0.12);
const MUTED = rgb(0.34, 0.34, 0.34);
const LIGHT = rgb(0.88, 0.88, 0.88);

function colorFromHex(value: string | null): ReturnType<typeof rgb> {
  const match = value?.match(/^#?([0-9a-f]{6})$/i);
  if (!match) return BLACK;
  const hex = match[1];
  return rgb(
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  );
}

function safePdfText(value: string, font: Awaited<ReturnType<PDFDocument["embedFont"]>>) {
  return Array.from(value, (character) => {
    try {
      font.encodeText(character);
      return character;
    } catch {
      return "?";
    }
  }).join("");
}

function wrapText(
  value: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  size: number,
  maxWidth: number,
): string[] {
  const safeValue = safePdfText(value, font);
  const words = safeValue.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);

    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      current = word;
      continue;
    }

    let fragment = "";
    for (const character of word) {
      const next = fragment + character;
      if (fragment && font.widthOfTextAtSize(next, size) > maxWidth) {
        lines.push(fragment);
        fragment = character;
      } else {
        fragment = next;
      }
    }
    current = fragment;
  }
  if (current) lines.push(current);
  return lines;
}

async function loadLogo(
  url: string | null,
  document: PDFDocument,
): Promise<PDFImage | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (contentType.includes("png")) return await document.embedPng(bytes);
    if (contentType.includes("jpeg") || contentType.includes("jpg")) {
      return await document.embedJpg(bytes);
    }
  } catch {
    // Logos are optional; preserve the printable packet when an image cannot be fetched.
  }
  return null;
}

function getGroup(packet: Packet): {
  brand: GroupBrand;
  scopeName: "Circle" | "Organization";
} {
  if ("org" in packet) return { brand: packet.org, scopeName: "Organization" };
  return { brand: packet.circle, scopeName: "Circle" };
}

function safeFilePart(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "continuity-packet"
  );
}

function memberContact(member: ContinuityPacketMember): string {
  const details = [member.email, member.phone].filter(
    (detail): detail is string => !!detail?.trim(),
  );
  return details.length ? details.join(" | ") : "No contact details shared";
}

export async function downloadContinuityPacketPdf(packet: Packet): Promise<void> {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const { brand, scopeName } = getGroup(packet);
  const accent = colorFromHex(brand.accentColor);
  const logo = await loadLogo(brand.logoUrl, document);
  let page: PDFPage = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const pages: PDFPage[] = [page];
  let y = PAGE_HEIGHT - MARGIN;

  function addPage(): void {
    page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    y = PAGE_HEIGHT - MARGIN;
  }

  function ensureSpace(height: number): void {
    if (y - height < MARGIN + FOOTER_HEIGHT) addPage();
  }

  function writeBlock(
    value: string,
    font: typeof regular,
    size: number,
    indent = 0,
    color = BLACK,
    leading = size * 1.4,
  ): void {
    const maxWidth = PAGE_WIDTH - MARGIN * 2 - indent;
    for (const line of wrapText(value, font, size, maxWidth)) {
      ensureSpace(leading);
      page.drawText(line, {
        x: MARGIN + indent,
        y: y - size,
        size,
        font,
        color,
      });
      y -= leading;
    }
  }

  function sectionHeading(label: string): void {
    ensureSpace(28);
    y -= 5;
    page.drawText(label, {
      x: MARGIN,
      y: y - 13,
      size: 13,
      font: bold,
      color: BLACK,
    });
    y -= 22;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.7,
      color: LIGHT,
    });
    y -= 12;
  }

  const headerX = MARGIN + 58;
  if (logo) {
    const size = logo.scaleToFit(44, 44);
    page.drawImage(logo, {
      x: MARGIN,
      y: y - 44,
      width: size.width,
      height: size.height,
    });
  } else {
    const initials = brand.name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase();
    page.drawRectangle({
      x: MARGIN,
      y: y - 44,
      width: 44,
      height: 44,
      color: rgb(0.94, 0.94, 0.94),
      borderColor: accent,
      borderWidth: 1.2,
    });
    page.drawText(safePdfText(initials || "MZ", bold), {
      x: MARGIN + 7,
      y: y - 28,
      size: 14,
      font: bold,
      color: BLACK,
    });
  }

  page.drawText(`${scopeName.toUpperCase()} CONTINUITY PACKET`, {
    x: headerX,
    y: y - 12,
    size: 9,
    font: bold,
    color: MUTED,
  });
  const nameLines = wrapText(brand.name, bold, 19, PAGE_WIDTH - headerX - MARGIN);
  let headerNameY = y - 37;
  for (const line of nameLines.slice(0, 2)) {
    page.drawText(line, {
      x: headerX,
      y: headerNameY,
      size: 19,
      font: bold,
      color: BLACK,
    });
    headerNameY -= 22;
  }
  page.drawText(`Generated ${new Date(packet.generatedAt).toLocaleDateString()}`, {
    x: headerX,
    y: headerNameY - 1,
    size: 9,
    font: regular,
    color: MUTED,
  });
  y -= 64;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 2,
    color: accent,
  });
  y -= 23;

  sectionHeading("Member roster and contact tree");
  if (packet.members.length === 0) {
    writeBlock("No active members were found.", regular, 10);
  }
  for (const member of packet.members) {
    ensureSpace(72);
    writeBlock(member.name, bold, 11);
    writeBlock(`${member.role} | ${memberContact(member)}`, regular, 9, 8, MUTED);
    writeBlock(
      `Skills: ${member.skills.length ? member.skills.join(", ") : "None listed"}`,
      regular,
      9,
      8,
    );
    const resources = member.resources.length
      ? member.resources
          .map(
            (resource) =>
              `${resource.label} (${resource.isAvailable ? "available" : "unavailable"})`,
          )
          .join(", ")
      : "None listed";
    writeBlock(`Resources: ${resources}`, regular, 9, 8);
    ensureSpace(12);
    y -= 3;
    page.drawLine({
      start: { x: MARGIN + 8, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.45,
      color: LIGHT,
    });
    y -= 10;
  }

  sectionHeading("Meeting location");
  if (packet.meetingLocations.length > 0) {
    for (const location of packet.meetingLocations) {
      writeBlock(`Saved location: ${location}`, regular, 10);
    }
  }
  writeBlock("Location: __________________________________________________", regular, 10);
  writeBlock("____________________________________________________________", regular, 10);

  sectionHeading("Shared notes");
  if (packet.sharedNotes.length === 0) {
    writeBlock("No shared wall notes saved.", regular, 10, 0, MUTED);
  } else {
    for (const note of packet.sharedNotes) {
      writeBlock(note.title?.trim() || "Circle update", bold, 10);
      writeBlock(note.body, regular, 9, 8);
      writeBlock(
        `${note.authorName} · ${new Date(note.createdAt).toLocaleDateString()}`,
        regular,
        8,
        8,
        MUTED,
      );
      y -= 8;
    }
  }

  const footerLabel = `${scopeName} Continuity Packet`;
  pages.forEach((currentPage, index) => {
    currentPage.drawLine({
      start: { x: MARGIN, y: MARGIN - 6 },
      end: { x: PAGE_WIDTH - MARGIN, y: MARGIN - 6 },
      thickness: 0.5,
      color: LIGHT,
    });
    currentPage.drawText(
      safePdfText(`MyZolve Connect | ${footerLabel} | Page ${index + 1}`, regular),
      {
        x: MARGIN,
        y: MARGIN - 20,
        size: 8,
        font: regular,
        color: MUTED,
      },
    );
  });

  const bytes = await document.save();
  const blob = new Blob([Uint8Array.from(bytes).buffer], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = `${safeFilePart(brand.name)}-continuity-packet.pdf`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
