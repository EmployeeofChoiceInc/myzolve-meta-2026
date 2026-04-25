// Care Ledger Pro: aggregation, CSV/PDF generation, and signed-URL upload.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "@workspace/db";
import {
  circlesTable,
  ledgerEntriesTable,
  usersTable,
} from "@workspace/db";
import { and, eq, gte, lt, or, sql } from "drizzle-orm";

import { ObjectStorageService } from "./objectStorage";

export type ProPerson = {
  userId: number | null;
  name: string;
  avatarObjectPath: string | null;
  amount: number;
  count: number;
};

export type ProMonth = {
  month: number;
  given: number;
  received: number;
  balance: number;
};

export type ProView = {
  circleId: number;
  circleName: string;
  year: number;
  currency: string;
  totalGiven: number;
  totalReceived: number;
  totalRepaid: number;
  totalForgiven: number;
  netBalance: number;
  entryCount: number;
  months: ProMonth[];
  topSupported: ProPerson[];
  topSupporters: ProPerson[];
  availableYears: number[];
  softMessage: string;
};

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function startOfYear(year: number): Date {
  return new Date(Date.UTC(year, 0, 1));
}
function startOfNextYear(year: number): Date {
  return new Date(Date.UTC(year + 1, 0, 1));
}

function asNumber(amount: string | null | undefined): number {
  if (!amount) return 0;
  const n = parseFloat(amount);
  return Number.isFinite(n) ? n : 0;
}

export async function listLedgerYears(
  circleId: number,
  forUserId?: number,
): Promise<number[]> {
  const where =
    forUserId != null
      ? and(
          eq(ledgerEntriesTable.circleId, circleId),
          or(
            eq(ledgerEntriesTable.giverUserId, forUserId),
            eq(ledgerEntriesTable.receiverUserId, forUserId),
          ),
        )
      : eq(ledgerEntriesTable.circleId, circleId);
  const rows = await db
    .select({
      year: sql<string>`extract(year from ${ledgerEntriesTable.date})::text`,
    })
    .from(ledgerEntriesTable)
    .where(where)
    .groupBy(sql`extract(year from ${ledgerEntriesTable.date})`);

  const set = new Set<number>();
  for (const r of rows) {
    const y = parseInt(r.year, 10);
    if (Number.isFinite(y)) set.add(y);
  }
  // Always include the current year so the picker isn't empty for new circles.
  set.add(new Date().getUTCFullYear());
  return Array.from(set).sort((a, b) => b - a);
}

export async function aggregateProLedger(params: {
  circleId: number;
  userId: number;
  year: number;
  // When true (summary-mode non-admin), redact other members' names.
  redactNames?: boolean;
}): Promise<ProView> {
  const { circleId, userId, year, redactNames = false } = params;

  const circle = await db
    .select({ id: circlesTable.id, name: circlesTable.name, currency: circlesTable.currency })
    .from(circlesTable)
    .where(eq(circlesTable.id, circleId))
    .limit(1)
    .then((r) => r[0]);

  const entries = await db
    .select()
    .from(ledgerEntriesTable)
    .where(
      and(
        eq(ledgerEntriesTable.circleId, circleId),
        gte(ledgerEntriesTable.date, startOfYear(year)),
        lt(ledgerEntriesTable.date, startOfNextYear(year)),
        // Summary mode for non-admins: scope to entries the user is part
        // of so entryCount and aggregates don't leak circle-wide metadata.
        ...(redactNames
          ? [
              or(
                eq(ledgerEntriesTable.giverUserId, userId),
                eq(ledgerEntriesTable.receiverUserId, userId),
              ),
            ]
          : []),
      ),
    );

  const months: ProMonth[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    given: 0,
    received: 0,
    balance: 0,
  }));

  let totalGiven = 0;
  let totalReceived = 0;
  let totalRepaid = 0;
  let totalForgiven = 0;

  type Bucket = { amount: number; count: number; name: string; avatar: string | null };
  const supportedByMe = new Map<string, Bucket>(); // people I've given to
  const supportersOfMe = new Map<string, Bucket>(); // people who've given to me

  const avatarCache = new Map<number, string | null>();
  async function avatarFor(uid: number | null): Promise<string | null> {
    if (uid == null) return null;
    if (avatarCache.has(uid)) return avatarCache.get(uid)!;
    const row = await db
      .select({ avatarObjectPath: usersTable.avatarObjectPath })
      .from(usersTable)
      .where(eq(usersTable.id, uid))
      .limit(1)
      .then((r) => r[0] ?? null);
    const v = row?.avatarObjectPath ?? null;
    avatarCache.set(uid, v);
    return v;
  }

  for (const e of entries) {
    const amount = asNumber(e.amount);
    const monthIdx = new Date(e.date).getUTCMonth();
    const giverIsMe = e.giverUserId === userId;
    const receiverIsMe = e.receiverUserId === userId;

    if (e.entryKind === "money_repaid") {
      if (giverIsMe || receiverIsMe) totalRepaid += amount;
      continue;
    }
    if (e.entryKind === "amount_forgiven") {
      if (giverIsMe || receiverIsMe) totalForgiven += amount;
      continue;
    }

    if (giverIsMe && amount > 0) {
      months[monthIdx].given += amount;
      totalGiven += amount;
      const key = e.receiverUserId != null ? `u:${e.receiverUserId}` : `n:${e.receiverName}`;
      const b = supportedByMe.get(key) ?? {
        amount: 0,
        count: 0,
        name: e.receiverName,
        avatar: await avatarFor(e.receiverUserId),
      };
      b.amount += amount;
      b.count += 1;
      supportedByMe.set(key, b);
    } else if (receiverIsMe && amount > 0) {
      months[monthIdx].received += amount;
      totalReceived += amount;
      const key = e.giverUserId != null ? `u:${e.giverUserId}` : `n:${e.giverName}`;
      const b = supportersOfMe.get(key) ?? {
        amount: 0,
        count: 0,
        name: e.giverName,
        avatar: await avatarFor(e.giverUserId),
      };
      b.amount += amount;
      b.count += 1;
      supportersOfMe.set(key, b);
    }
  }

  // Cumulative balance per month.
  let running = 0;
  for (const m of months) {
    running += m.given - m.received;
    m.balance = running;
  }

  function bucketsToList(map: Map<string, Bucket>, limit = 5): ProPerson[] {
    return Array.from(map.entries())
      .map(([key, b]) => {
        const userIdMatch = /^u:(\d+)$/.exec(key);
        return {
          userId: redactNames ? null : userIdMatch ? parseInt(userIdMatch[1], 10) : null,
          name: redactNames ? "Someone in your circle" : b.name,
          avatarObjectPath: redactNames ? null : b.avatar,
          amount: Math.round(b.amount * 100) / 100,
          count: b.count,
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit);
  }

  const netBalance = totalGiven - totalReceived;
  const softMessage =
    entries.length === 0
      ? `Your circle hasn't logged anything in ${year} yet — but caring rarely shows up on a balance sheet.`
      : netBalance > 0
        ? `In ${year} you gave more than you received. Thank you for showing up for your circle.`
        : netBalance < 0
          ? `In ${year} your circle leaned in to support you. Lean on them when you need to — that's what they're here for.`
          : `In ${year} your circle moved in beautiful balance — give and take in equal measure.`;

  return {
    circleId,
    circleName: circle?.name ?? "Circle",
    year,
    currency: circle?.currency ?? "USD",
    totalGiven: Math.round(totalGiven * 100) / 100,
    totalReceived: Math.round(totalReceived * 100) / 100,
    totalRepaid: Math.round(totalRepaid * 100) / 100,
    totalForgiven: Math.round(totalForgiven * 100) / 100,
    netBalance: Math.round(netBalance * 100) / 100,
    entryCount: entries.length,
    months: months.map((m) => ({
      ...m,
      given: Math.round(m.given * 100) / 100,
      received: Math.round(m.received * 100) / 100,
      balance: Math.round(m.balance * 100) / 100,
    })),
    topSupported: bucketsToList(supportedByMe),
    topSupporters: bucketsToList(supportersOfMe),
    availableYears: await listLedgerYears(circleId, redactNames ? userId : undefined),
    softMessage,
  };
}

/* ------------------------------- CSV --------------------------------- */

function escapeCsv(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function generateLedgerCsv(params: {
  circleId: number;
  year: number;
  // When redactNames is true, only include rows involving forUserId
  // and replace the other party's name with a placeholder.
  forUserId?: number;
  redactNames?: boolean;
}): Promise<Buffer> {
  const { circleId, year, forUserId, redactNames = false } = params;
  const allEntries = await db
    .select()
    .from(ledgerEntriesTable)
    .where(
      and(
        eq(ledgerEntriesTable.circleId, circleId),
        gte(ledgerEntriesTable.date, startOfYear(year)),
        lt(ledgerEntriesTable.date, startOfNextYear(year)),
      ),
    )
    .orderBy(ledgerEntriesTable.date);
  const entries =
    redactNames && forUserId != null
      ? allEntries.filter(
          (e) => e.giverUserId === forUserId || e.receiverUserId === forUserId,
        )
      : allEntries;

  const header = [
    "date",
    "kind",
    "giver",
    "receiver",
    "amount",
    "currency",
    "description",
  ];
  const rows = [header.join(",")];
  for (const e of entries) {
    const giverIsMe = forUserId != null && e.giverUserId === forUserId;
    const receiverIsMe = forUserId != null && e.receiverUserId === forUserId;
    const giver = redactNames && !giverIsMe ? "Someone in your circle" : e.giverName;
    const receiver =
      redactNames && !receiverIsMe ? "Someone in your circle" : e.receiverName;
    rows.push(
      [
        new Date(e.date).toISOString(),
        e.entryKind,
        giver,
        receiver,
        e.amount ?? "",
        e.currency ?? "",
        redactNames ? "" : e.description,
      ]
        .map(escapeCsv)
        .join(","),
    );
  }
  return Buffer.from(rows.join("\n") + "\n", "utf8");
}

/* ------------------------------- PDF --------------------------------- */

function fmtMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export async function generateYearRecapPdf(params: {
  view: ProView;
  forUserName: string;
  // Same redaction contract as generateLedgerCsv.
  forUserId?: number;
  redactNames?: boolean;
}): Promise<Buffer> {
  const { view, forUserName, forUserId, redactNames = false } = params;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN = 50;
  const ACCENT = rgb(0.27, 0.46, 0.95);
  const SOFT = rgb(0.96, 0.97, 1);
  const TEXT = rgb(0.12, 0.16, 0.24);
  const MUTED = rgb(0.45, 0.5, 0.6);

  function newPage() {
    return pdf.addPage([PAGE_W, PAGE_H]);
  }

  function drawText(
    page: ReturnType<typeof pdf.addPage>,
    text: string,
    x: number,
    y: number,
    opts: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> } = {},
  ) {
    page.drawText(text, {
      x,
      y,
      size: opts.size ?? 11,
      font: opts.bold ? fontBold : font,
      color: opts.color ?? TEXT,
    });
  }

  // Cover page ------------------------------------------------------------
  const cover = newPage();
  cover.drawRectangle({
    x: 0,
    y: PAGE_H - 220,
    width: PAGE_W,
    height: 220,
    color: SOFT,
  });
  drawText(cover, "Year of Care", MARGIN, PAGE_H - 120, {
    bold: true,
    size: 36,
    color: ACCENT,
  });
  drawText(cover, `${view.year}`, MARGIN, PAGE_H - 160, {
    bold: true,
    size: 28,
    color: TEXT,
  });
  drawText(cover, view.circleName, MARGIN, PAGE_H - 195, {
    size: 14,
    color: MUTED,
  });

  drawText(cover, `Prepared for ${forUserName}`, MARGIN, PAGE_H - 270, {
    size: 12,
    color: MUTED,
  });

  // Wrap soft message into ~70-char lines
  const wrap = (s: string, w: number) => {
    const words = s.split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const word of words) {
      if ((cur + " " + word).trim().length > w) {
        lines.push(cur);
        cur = word;
      } else {
        cur = (cur + " " + word).trim();
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };
  const messageLines = wrap(view.softMessage, 70);
  let cursor = PAGE_H - 320;
  for (const line of messageLines) {
    drawText(cover, line, MARGIN, cursor, { size: 13 });
    cursor -= 18;
  }

  cursor -= 30;
  drawText(cover, "By the numbers", MARGIN, cursor, { bold: true, size: 16 });
  cursor -= 24;
  const stats: [string, string][] = [
    ["You gave", fmtMoney(view.totalGiven, view.currency)],
    ["You received", fmtMoney(view.totalReceived, view.currency)],
    ["You repaid", fmtMoney(view.totalRepaid, view.currency)],
    ["Gifts forgiven", fmtMoney(view.totalForgiven, view.currency)],
    ["Total entries", `${view.entryCount}`],
  ];
  for (const [label, val] of stats) {
    drawText(cover, label, MARGIN, cursor, { color: MUTED, size: 12 });
    drawText(cover, val, MARGIN + 200, cursor, { bold: true, size: 12 });
    cursor -= 18;
  }

  drawText(
    cover,
    "MyZolve Connect — for personal record-keeping. Not a tax document.",
    MARGIN,
    40,
    { size: 9, color: MUTED },
  );

  // Monthly chart page ----------------------------------------------------
  const chart = newPage();
  drawText(chart, "Month-by-month", MARGIN, PAGE_H - 60, {
    bold: true,
    size: 22,
    color: ACCENT,
  });
  drawText(
    chart,
    "Blue is what you gave, mint is what you received.",
    MARGIN,
    PAGE_H - 84,
    { color: MUTED, size: 11 },
  );

  const chartTop = PAGE_H - 130;
  const chartBottom = chartTop - 320;
  const chartLeft = MARGIN + 30;
  const chartRight = PAGE_W - MARGIN;
  const usableW = chartRight - chartLeft;
  const usableH = chartTop - chartBottom;
  const maxVal = Math.max(
    1,
    ...view.months.flatMap((m) => [m.given, m.received]),
  );
  const colWidth = usableW / 12;

  // Axis baseline
  chart.drawLine({
    start: { x: chartLeft, y: chartBottom },
    end: { x: chartRight, y: chartBottom },
    thickness: 0.5,
    color: MUTED,
  });

  for (let i = 0; i < 12; i++) {
    const m = view.months[i];
    const x = chartLeft + i * colWidth;
    const givenH = (m.given / maxVal) * usableH * 0.9;
    const receivedH = (m.received / maxVal) * usableH * 0.9;
    const barW = Math.max(4, colWidth / 3);
    chart.drawRectangle({
      x: x + colWidth / 2 - barW - 2,
      y: chartBottom + 1,
      width: barW,
      height: givenH,
      color: ACCENT,
    });
    chart.drawRectangle({
      x: x + colWidth / 2 + 2,
      y: chartBottom + 1,
      width: barW,
      height: receivedH,
      color: rgb(0.36, 0.78, 0.65),
    });
    drawText(chart, MONTH_NAMES[i], x + colWidth / 2 - 10, chartBottom - 14, {
      size: 9,
      color: MUTED,
    });
  }

  let yCursor = chartBottom - 50;
  drawText(chart, "Per-month totals", MARGIN, yCursor, { bold: true, size: 14 });
  yCursor -= 20;
  drawText(chart, "Month", MARGIN, yCursor, { color: MUTED, size: 10 });
  drawText(chart, "Given", MARGIN + 100, yCursor, { color: MUTED, size: 10 });
  drawText(chart, "Received", MARGIN + 200, yCursor, { color: MUTED, size: 10 });
  drawText(chart, "Balance", MARGIN + 320, yCursor, { color: MUTED, size: 10 });
  yCursor -= 14;
  for (let i = 0; i < 12; i++) {
    const m = view.months[i];
    drawText(chart, MONTH_NAMES[i], MARGIN, yCursor, { size: 10 });
    drawText(chart, fmtMoney(m.given, view.currency), MARGIN + 100, yCursor, { size: 10 });
    drawText(chart, fmtMoney(m.received, view.currency), MARGIN + 200, yCursor, { size: 10 });
    drawText(chart, fmtMoney(m.balance, view.currency), MARGIN + 320, yCursor, { size: 10 });
    yCursor -= 14;
  }

  // Per-person totals page -----------------------------------------------
  const people = newPage();
  drawText(people, "People", MARGIN, PAGE_H - 60, {
    bold: true,
    size: 22,
    color: ACCENT,
  });
  let py = PAGE_H - 110;
  drawText(people, "People you supported most", MARGIN, py, { bold: true, size: 14 });
  py -= 20;
  if (view.topSupported.length === 0) {
    drawText(people, "—", MARGIN, py, { color: MUTED });
    py -= 18;
  }
  for (const p of view.topSupported) {
    drawText(people, p.name, MARGIN, py, { size: 11 });
    drawText(
      people,
      `${fmtMoney(p.amount, view.currency)} · ${p.count} times`,
      MARGIN + 260,
      py,
      { size: 11, color: MUTED },
    );
    py -= 16;
  }

  py -= 24;
  drawText(people, "People who supported you most", MARGIN, py, {
    bold: true,
    size: 14,
  });
  py -= 20;
  if (view.topSupporters.length === 0) {
    drawText(people, "—", MARGIN, py, { color: MUTED });
    py -= 18;
  }
  for (const p of view.topSupporters) {
    drawText(people, p.name, MARGIN, py, { size: 11 });
    drawText(
      people,
      `${fmtMoney(p.amount, view.currency)} · ${p.count} times`,
      MARGIN + 260,
      py,
      { size: 11, color: MUTED },
    );
    py -= 16;
  }

  // Full transaction list (auto-paginated) -------------------------------
  const allEntries = await db
    .select()
    .from(ledgerEntriesTable)
    .where(
      and(
        eq(ledgerEntriesTable.circleId, view.circleId),
        gte(ledgerEntriesTable.date, startOfYear(view.year)),
        lt(ledgerEntriesTable.date, startOfNextYear(view.year)),
      ),
    )
    .orderBy(ledgerEntriesTable.date);
  const entries =
    redactNames && forUserId != null
      ? allEntries.filter(
          (e) => e.giverUserId === forUserId || e.receiverUserId === forUserId,
        )
      : allEntries;

  let listPage = newPage();
  drawText(listPage, "All entries", MARGIN, PAGE_H - 60, {
    bold: true,
    size: 22,
    color: ACCENT,
  });
  let ly = PAGE_H - 100;

  function drawHeader(p: typeof listPage) {
    drawText(p, "Date", MARGIN, ly, { color: MUTED, size: 10 });
    drawText(p, "Kind", MARGIN + 75, ly, { color: MUTED, size: 10 });
    drawText(p, "Giver → Receiver", MARGIN + 170, ly, { color: MUTED, size: 10 });
    drawText(p, "Amount", PAGE_W - MARGIN - 60, ly, { color: MUTED, size: 10 });
  }
  drawHeader(listPage);
  ly -= 14;

  for (const e of entries) {
    if (ly < MARGIN + 30) {
      listPage = newPage();
      ly = PAGE_H - 60;
      drawText(listPage, "All entries (cont.)", MARGIN, ly, {
        bold: true,
        size: 16,
        color: ACCENT,
      });
      ly -= 30;
      drawHeader(listPage);
      ly -= 14;
    }
    const dateStr = new Date(e.date).toISOString().slice(0, 10);
    const kind = e.entryKind.replace(/_/g, " ");
    const giverIsMe = forUserId != null && e.giverUserId === forUserId;
    const receiverIsMe = forUserId != null && e.receiverUserId === forUserId;
    const giver = redactNames && !giverIsMe ? "Someone in your circle" : e.giverName;
    const receiver =
      redactNames && !receiverIsMe ? "Someone in your circle" : e.receiverName;
    const flow = `${giver} → ${receiver}`.slice(0, 40);
    const amount = e.amount
      ? fmtMoney(asNumber(e.amount), e.currency ?? view.currency)
      : "—";
    drawText(listPage, dateStr, MARGIN, ly, { size: 9 });
    drawText(listPage, kind, MARGIN + 75, ly, { size: 9 });
    drawText(listPage, flow, MARGIN + 170, ly, { size: 9 });
    drawText(listPage, amount, PAGE_W - MARGIN - 60, ly, { size: 9 });
    ly -= 13;
  }

  return Buffer.from(await pdf.save());
}

/* ------------------------------ Storage ------------------------------ */

export async function uploadExport(params: {
  circleId: number;
  year: number;
  userId: number;
  pdf: Buffer;
  csv: Buffer;
}): Promise<{
  pdfUrl: string;
  csvUrl: string;
  pdfPath: string;
  csvPath: string;
  expiresAt: string;
}> {
  const storage = new ObjectStorageService();
  const sub = `ledger-exports/${params.userId}/${params.circleId}/${params.year}`;
  const pdfFile = await storage.putObjectBytes({
    subfolder: sub,
    fileName: `year-of-care-${params.year}.pdf`,
    contentType: "application/pdf",
    bytes: params.pdf,
  });
  const csvFile = await storage.putObjectBytes({
    subfolder: sub,
    fileName: `year-of-care-${params.year}.csv`,
    contentType: "text/csv",
    bytes: params.csv,
  });

  const ttlSec = 60 * 60 * 24; // 24h — long enough to forward to email later.
  const pdfUrl = await storage.getSignedDownloadURL(pdfFile.objectPath, ttlSec);
  const csvUrl = await storage.getSignedDownloadURL(csvFile.objectPath, ttlSec);
  return {
    pdfUrl,
    csvUrl,
    pdfPath: pdfFile.objectPath,
    csvPath: csvFile.objectPath,
    expiresAt: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
}
