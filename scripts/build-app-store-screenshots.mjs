import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

const DEVICES = [
  { id: "iphone-6.9", w: 1320, h: 2868 },
  { id: "iphone-6.5", w: 1284, h: 2778 },
];

const COLORS = {
  bgTop: "#FBE6D8",
  bgBottom: "#F5C9A8",
  cream: "#FAF3EA",
  card: "#FFFFFF",
  primary: "#D9622A",
  primarySoft: "#F5D6C3",
  sage: "#5B8456",
  sageSoft: "#D6E4D2",
  ink: "#2A1F18",
  inkSoft: "#5C4A3E",
  muted: "#F1E7DA",
  border: "#E8D8C5",
  divider: "#EFE3D2",
};

const xml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function deviceFrame(x, y, w, h, screenSvg) {
  const r = w * 0.13;
  const bezel = w * 0.022;
  const sx = x + bezel;
  const sy = y + bezel;
  const sw = w - bezel * 2;
  const sh = h - bezel * 2;
  const sr = r - bezel * 0.7;
  const islandW = w * 0.34;
  const islandH = w * 0.085;
  const islandX = x + (w - islandW) / 2;
  const islandY = y + bezel + w * 0.018;

  return `
    <defs>
      <clipPath id="screenClip">
        <rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="${sr}" ry="${sr}"/>
      </clipPath>
      <linearGradient id="frameGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1a1a1a"/>
        <stop offset="1" stop-color="#0a0a0a"/>
      </linearGradient>
    </defs>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="url(#frameGrad)"/>
    <rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="${sr}" ry="${sr}" fill="${COLORS.cream}"/>
    <g clip-path="url(#screenClip)">
      <g transform="translate(${sx} ${sy})">
        ${screenSvg(sw, sh)}
      </g>
    </g>
    <rect x="${islandX}" y="${islandY}" width="${islandW}" height="${islandH}" rx="${islandH / 2}" ry="${islandH / 2}" fill="#000"/>
  `;
}

function statusBar(w, h) {
  const pad = w * 0.07;
  return `
    <g font-family="-apple-system, 'Plus Jakarta Sans', sans-serif" font-weight="600" fill="${COLORS.ink}">
      <text x="${pad}" y="${h * 0.5}" font-size="${w * 0.038}" dominant-baseline="middle">9:41</text>
      <g transform="translate(${w - pad - w * 0.18} ${h * 0.5}) translate(0 -${w * 0.012})">
        <rect x="0" y="0" width="${w * 0.05}" height="${w * 0.025}" rx="2" fill="${COLORS.ink}"/>
        <rect x="${w * 0.06}" y="-${w * 0.005}" width="${w * 0.04}" height="${w * 0.03}" rx="2" fill="${COLORS.ink}"/>
        <rect x="${w * 0.11}" y="-${w * 0.002}" width="${w * 0.07}" height="${w * 0.025}" rx="3" fill="none" stroke="${COLORS.ink}" stroke-width="${w * 0.003}"/>
        <rect x="${w * 0.115}" y="${w * 0.003}" width="${w * 0.045}" height="${w * 0.014}" rx="1.5" fill="${COLORS.ink}"/>
      </g>
    </g>
  `;
}

function tabBar(w, h, activeIdx) {
  const items = ["home", "compass", "inbox", "user", "settings"];
  const labels = ["Home", "Discover", "Messages", "Profile", "Settings"];
  const barH = h * 0.11;
  const top = h - barH;
  const colW = w / items.length;
  const fs = w * 0.026;

  const icon = (name, cx, cy, size, color) => {
    const r = size / 2;
    const sw = Math.max(1.5, size * 0.08);
    if (name === "home") {
      return `<path d="M ${cx - r} ${cy + r * 0.2} L ${cx} ${cy - r * 0.9} L ${cx + r} ${cy + r * 0.2} L ${cx + r} ${cy + r * 0.9} L ${cx - r} ${cy + r * 0.9} Z" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    }
    if (name === "compass") {
      return `<circle cx="${cx}" cy="${cy}" r="${r * 0.95}" fill="none" stroke="${color}" stroke-width="${sw}"/><path d="M ${cx + r * 0.3} ${cy - r * 0.3} L ${cx - r * 0.1} ${cy + r * 0.1} L ${cx - r * 0.3} ${cy + r * 0.4} L ${cx + r * 0.1} ${cy - r * 0.1} Z" fill="${color}"/>`;
    }
    if (name === "inbox") {
      return `<path d="M ${cx - r} ${cy - r * 0.6} L ${cx + r} ${cy - r * 0.6} L ${cx + r * 0.7} ${cy + r * 0.7} L ${cx - r * 0.7} ${cy + r * 0.7} Z" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    }
    if (name === "user") {
      return `<circle cx="${cx}" cy="${cy - r * 0.3}" r="${r * 0.45}" fill="none" stroke="${color}" stroke-width="${sw}"/><path d="M ${cx - r * 0.8} ${cy + r * 0.85} Q ${cx} ${cy + r * 0.1} ${cx + r * 0.8} ${cy + r * 0.85}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
    }
    return `<circle cx="${cx}" cy="${cy}" r="${r * 0.45}" fill="none" stroke="${color}" stroke-width="${sw}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.13}" fill="${color}"/>`;
  };

  return `
    <g>
      <rect x="0" y="${top}" width="${w}" height="${barH}" fill="${COLORS.cream}"/>
      <rect x="0" y="${top}" width="${w}" height="1.5" fill="${COLORS.divider}"/>
      ${items.map((it, i) => {
        const cx = colW * i + colW / 2;
        const cy = top + barH * 0.34;
        const color = i === activeIdx ? COLORS.primary : COLORS.inkSoft;
        return `
          ${icon(it, cx, cy, w * 0.06, color)}
          <text x="${cx}" y="${top + barH * 0.7}" text-anchor="middle" font-size="${fs}" font-family="-apple-system, 'Plus Jakarta Sans', sans-serif" font-weight="${i === activeIdx ? 600 : 500}" fill="${color}">${labels[i]}</text>
        `;
      }).join("")}
      <rect x="${w * 0.32}" y="${h - barH * 0.05}" width="${w * 0.36}" height="${w * 0.012}" rx="${w * 0.006}" fill="${COLORS.ink}" opacity="0.8"/>
    </g>
  `;
}

function avatar(cx, cy, r, initials, hue) {
  const colors = [
    [COLORS.primarySoft, COLORS.primary],
    [COLORS.sageSoft, COLORS.sage],
    ["#E8DCC8", "#8A6A3A"],
    ["#E5D7E0", "#7A4A6E"],
  ];
  const [bg, fg] = colors[hue % colors.length];
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${bg}"/>
    <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-family="-apple-system, 'Plus Jakarta Sans', sans-serif" font-weight="700" font-size="${r * 0.85}" fill="${fg}">${initials}</text>
  `;
}

const screens = {
  onboarding: (w, h) => {
    const pad = w * 0.08;
    return `
      ${statusBar(w, h * 0.05)}
      <g transform="translate(${pad} ${h * 0.1})" font-family="-apple-system, 'Plus Jakarta Sans', sans-serif" fill="${COLORS.ink}">
        <text x="0" y="${h * 0.06}" font-size="${w * 0.095}" font-weight="700" letter-spacing="-1">Welcome.</text>
        <text x="0" y="${h * 0.115}" font-size="${w * 0.038}" fill="${COLORS.inkSoft}">MyZolve Connect is a private, warm space</text>
        <text x="0" y="${h * 0.15}" font-size="${w * 0.038}" fill="${COLORS.inkSoft}">for the people you trust. Let's start your</text>
        <text x="0" y="${h * 0.185}" font-size="${w * 0.038}" fill="${COLORS.inkSoft}">first circle.</text>

        <text x="0" y="${h * 0.27}" font-size="${w * 0.034}" font-weight="600" fill="${COLORS.ink}">Circle name</text>
        <rect x="0" y="${h * 0.285}" width="${w - pad * 2}" height="${h * 0.075}" rx="${h * 0.018}" fill="${COLORS.card}" stroke="${COLORS.border}" stroke-width="1.5"/>
        <text x="${w * 0.04}" y="${h * 0.333}" font-size="${w * 0.04}" fill="${COLORS.ink}">The Village</text>

        <text x="0" y="${h * 0.42}" font-size="${w * 0.034}" font-weight="600" fill="${COLORS.ink}">What kind of circle is this?</text>
        ${[
          ["Chosen family", true, 0],
          ["Family", false, 1],
          ["Close friends", false, 2],
          ["Mutual aid", false, 0],
          ["Neighbors", false, 1],
        ].map((p, i) => {
          const cols = 2;
          const col = i % cols;
          const row = Math.floor(i / cols);
          const pillW = (w - pad * 2 - 10) / cols;
          const pillH = h * 0.06;
          const px = col * (pillW + 10);
          const py = h * 0.44 + row * (pillH + 10);
          const [label, active] = p;
          return `
            <rect x="${px}" y="${py}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${active ? COLORS.primary : COLORS.muted}"/>
            <text x="${px + pillW / 2}" y="${py + pillH / 2}" text-anchor="middle" dominant-baseline="central" font-size="${w * 0.032}" font-weight="600" fill="${active ? "#fff" : COLORS.ink}">${label}</text>
          `;
        }).join("")}

        <rect x="0" y="${h * 0.78}" width="${(w - pad * 2 - 10) * 0.4}" height="${h * 0.075}" rx="${h * 0.018}" fill="none" stroke="${COLORS.border}" stroke-width="1.5"/>
        <text x="${(w - pad * 2 - 10) * 0.2}" y="${h * 0.78 + h * 0.038}" text-anchor="middle" dominant-baseline="central" font-size="${w * 0.034}" font-weight="600" fill="${COLORS.inkSoft}">Skip for now</text>
        <rect x="${(w - pad * 2 - 10) * 0.42}" y="${h * 0.78}" width="${(w - pad * 2 - 10) * 0.58}" height="${h * 0.075}" rx="${h * 0.018}" fill="${COLORS.primary}"/>
        <text x="${(w - pad * 2 - 10) * 0.42 + (w - pad * 2 - 10) * 0.29}" y="${h * 0.78 + h * 0.038}" text-anchor="middle" dominant-baseline="central" font-size="${w * 0.036}" font-weight="700" fill="#fff">Create circle</text>
      </g>
    `;
  },
  signin: (w, h) => {
    const pad = w * 0.08;
    return `
      ${statusBar(w, h * 0.05)}
      <g transform="translate(${pad} ${h * 0.09})" font-family="-apple-system, 'Plus Jakarta Sans', sans-serif">
        <circle cx="${w * 0.075}" cy="${w * 0.075}" r="${w * 0.075}" fill="${COLORS.primarySoft}"/>
        <path d="M ${w * 0.075 - w * 0.035} ${w * 0.075 - w * 0.005} q 0 -${w * 0.03} ${w * 0.035} -${w * 0.03} q ${w * 0.035} 0 ${w * 0.035} ${w * 0.03} q 0 ${w * 0.025} -${w * 0.035} ${w * 0.05} q -${w * 0.035} -${w * 0.025} -${w * 0.035} -${w * 0.05} z" fill="${COLORS.primary}"/>

        <text x="0" y="${h * 0.165}" font-size="${w * 0.085}" font-weight="700" letter-spacing="-1" fill="${COLORS.ink}">Welcome back</text>
        <text x="0" y="${h * 0.205}" font-size="${w * 0.036}" fill="${COLORS.inkSoft}">Sign in to your trusted circles.</text>

        <text x="0" y="${h * 0.275}" font-size="${w * 0.032}" font-weight="600" fill="${COLORS.ink}">Email</text>
        <rect x="0" y="${h * 0.29}" width="${w - pad * 2}" height="${h * 0.07}" rx="${h * 0.018}" fill="${COLORS.card}" stroke="${COLORS.border}" stroke-width="1.5"/>
        <text x="${w * 0.04}" y="${h * 0.336}" font-size="${w * 0.038}" fill="${COLORS.ink}">you@example.com</text>

        <text x="0" y="${h * 0.405}" font-size="${w * 0.032}" font-weight="600" fill="${COLORS.ink}">Password</text>
        <rect x="0" y="${h * 0.42}" width="${w - pad * 2}" height="${h * 0.07}" rx="${h * 0.018}" fill="${COLORS.card}" stroke="${COLORS.border}" stroke-width="1.5"/>
        <text x="${w * 0.04}" y="${h * 0.466}" font-size="${w * 0.05}" fill="${COLORS.ink}" letter-spacing="3">••••••••</text>

        <rect x="0" y="${h * 0.52}" width="${w - pad * 2}" height="${h * 0.075}" rx="${h * 0.018}" fill="${COLORS.primary}"/>
        <text x="${(w - pad * 2) / 2}" y="${h * 0.52 + h * 0.038}" text-anchor="middle" dominant-baseline="central" font-size="${w * 0.038}" font-weight="700" fill="#fff">Sign in</text>

        <text x="${(w - pad * 2) / 2}" y="${h * 0.65}" text-anchor="middle" font-size="${w * 0.032}" fill="${COLORS.inkSoft}">New here?  <tspan font-weight="700" fill="${COLORS.primary}">Create an account</tspan></text>
      </g>
    `;
  },
  discover: (w, h) => {
    const pad = w * 0.06;
    const cards = [
      { tag: "Chosen family", name: "Sunday Suppers", desc: "A small group sharing meals and check-ins.", privacy: "open", hue: 0 },
      { tag: "Mutual aid", name: "East Side Helpers", desc: "Neighbors lending hands when life gets heavy.", privacy: "approval", hue: 1 },
      { tag: "Close friends", name: "The Book Five", desc: "Five friends, one slow-moving book club.", privacy: "open", hue: 2 },
      { tag: "Neighbors", name: "Maple Street Circle", desc: "Tools, rides, and casseroles when needed.", privacy: "approval", hue: 3 },
    ];
    const cardH = h * 0.16;
    return `
      ${statusBar(w, h * 0.05)}
      <g transform="translate(${pad} ${h * 0.09})" font-family="-apple-system, 'Plus Jakarta Sans', sans-serif" fill="${COLORS.ink}">
        <text x="0" y="${h * 0.06}" font-size="${w * 0.085}" font-weight="700" letter-spacing="-1">Discover</text>
        <text x="0" y="${h * 0.105}" font-size="${w * 0.034}" fill="${COLORS.inkSoft}">Browse public circles you can ask to join.</text>
        ${cards.map((card, i) => {
          const y = h * 0.14 + i * (cardH + 14);
          return `
            <rect x="0" y="${y}" width="${w - pad * 2}" height="${cardH}" rx="${h * 0.022}" fill="${COLORS.card}" stroke="${COLORS.border}" stroke-width="1.2"/>
            <rect x="${w * 0.03}" y="${y + h * 0.018}" width="${w * 0.22}" height="${h * 0.034}" rx="${h * 0.017}" fill="${COLORS.sageSoft}"/>
            <text x="${w * 0.14}" y="${y + h * 0.035}" text-anchor="middle" dominant-baseline="central" font-size="${w * 0.026}" font-weight="700" fill="${COLORS.sage}">${card.tag}</text>
            <text x="${w - pad * 2 - w * 0.03}" y="${y + h * 0.035}" text-anchor="end" dominant-baseline="central" font-size="${w * 0.026}" font-weight="500" fill="${COLORS.inkSoft}">${card.privacy}</text>
            <text x="${w * 0.03}" y="${y + h * 0.085}" font-size="${w * 0.044}" font-weight="700" fill="${COLORS.ink}">${card.name}</text>
            <text x="${w * 0.03}" y="${y + h * 0.122}" font-size="${w * 0.03}" fill="${COLORS.inkSoft}">${card.desc}</text>
          `;
        }).join("")}
      </g>
      ${tabBar(w, h, 1)}
    `;
  },
  messages: (w, h) => {
    const pad = w * 0.06;
    const threads = [
      { name: "Mara",   last: "I left soup on the porch — no rush",      time: "9:42a", unread: 1, hue: 0, init: "M" },
      { name: "Diego",  last: "Got a ride covered for tomorrow",         time: "8:15a", unread: 0, hue: 1, init: "D" },
      { name: "Joy",    last: "Thank you. Truly.",                        time: "Yest.", unread: 2, hue: 2, init: "J" },
      { name: "Tomás",  last: "Returning the $40 this Friday",           time: "Yest.", unread: 0, hue: 3, init: "T" },
      { name: "Aunt Lo",last: "The kids loved the cookies",              time: "Mon",   unread: 0, hue: 0, init: "L" },
      { name: "River",  last: "Can we move the carpool to 7:30?",         time: "Mon",   unread: 0, hue: 1, init: "R" },
    ];
    const rowH = h * 0.095;
    return `
      ${statusBar(w, h * 0.05)}
      <g transform="translate(${pad} ${h * 0.09})" font-family="-apple-system, 'Plus Jakarta Sans', sans-serif" fill="${COLORS.ink}">
        <text x="0" y="${h * 0.06}" font-size="${w * 0.085}" font-weight="700" letter-spacing="-1">Messages</text>
        <text x="0" y="${h * 0.105}" font-size="${w * 0.034}" fill="${COLORS.inkSoft}">Private conversations with your people.</text>

        <rect x="0" y="${h * 0.135}" width="${w - pad * 2}" height="${h * 0.06}" rx="${h * 0.022}" fill="${COLORS.muted}"/>
        <circle cx="${w * 0.05}" cy="${h * 0.135 + h * 0.03}" r="${w * 0.018}" fill="none" stroke="${COLORS.inkSoft}" stroke-width="2"/>
        <line x1="${w * 0.062}" y1="${h * 0.135 + h * 0.042}" x2="${w * 0.082}" y2="${h * 0.135 + h * 0.062}" stroke="${COLORS.inkSoft}" stroke-width="2.5" stroke-linecap="round"/>
        <text x="${w * 0.11}" y="${h * 0.135 + h * 0.03}" dominant-baseline="central" font-size="${w * 0.034}" fill="${COLORS.inkSoft}">Search messages</text>

        ${threads.map((t, i) => {
          const y = h * 0.215 + i * rowH;
          const cx = w * 0.06;
          const cy = y + rowH * 0.45;
          return `
            ${avatar(cx, cy, w * 0.055, t.init, t.hue)}
            <text x="${w * 0.135}" y="${cy - h * 0.012}" font-size="${w * 0.038}" font-weight="700" fill="${COLORS.ink}">${t.name}</text>
            <text x="${w * 0.135}" y="${cy + h * 0.022}" font-size="${w * 0.032}" fill="${COLORS.inkSoft}">${xml(t.last)}</text>
            <text x="${w - pad * 2 - w * 0.02}" y="${cy - h * 0.012}" text-anchor="end" font-size="${w * 0.026}" fill="${COLORS.inkSoft}">${t.time}</text>
            ${t.unread ? `
              <circle cx="${w - pad * 2 - w * 0.04}" cy="${cy + h * 0.018}" r="${w * 0.022}" fill="${COLORS.primary}"/>
              <text x="${w - pad * 2 - w * 0.04}" y="${cy + h * 0.018}" text-anchor="middle" dominant-baseline="central" font-size="${w * 0.026}" font-weight="700" fill="#fff">${t.unread}</text>
            ` : ""}
            ${i < threads.length - 1 ? `<line x1="${w * 0.135}" y1="${y + rowH - 1}" x2="${w - pad * 2}" y2="${y + rowH - 1}" stroke="${COLORS.divider}" stroke-width="1"/>` : ""}
          `;
        }).join("")}
      </g>
      ${tabBar(w, h, 2)}
    `;
  },
  profile: (w, h) => {
    const pad = w * 0.06;
    return `
      ${statusBar(w, h * 0.05)}
      <g transform="translate(0 ${h * 0.07})" font-family="-apple-system, 'Plus Jakarta Sans', sans-serif" fill="${COLORS.ink}">
        <rect x="0" y="0" width="${w}" height="${h * 0.27}" fill="${COLORS.primarySoft}"/>
        ${avatar(w / 2, h * 0.13, w * 0.13, "RS", 0)}
        <text x="${w / 2}" y="${h * 0.225}" text-anchor="middle" font-size="${w * 0.058}" font-weight="700" fill="${COLORS.ink}">Rosa Santos</text>
        <text x="${w / 2}" y="${h * 0.252}" text-anchor="middle" font-size="${w * 0.032}" fill="${COLORS.inkSoft}">Brooklyn, NY · Joined March 2026</text>
      </g>
      <g transform="translate(${pad} ${h * 0.41})" font-family="-apple-system, 'Plus Jakarta Sans', sans-serif" fill="${COLORS.ink}">
        <text x="0" y="0" font-size="${w * 0.034}" font-weight="700" letter-spacing="0.5" fill="${COLORS.inkSoft}">ABOUT</text>
        <text x="0" y="${h * 0.04}" font-size="${w * 0.034}" fill="${COLORS.ink}">Mother of two, slow cook, quick to listen.</text>
        <text x="0" y="${h * 0.075}" font-size="${w * 0.034}" fill="${COLORS.ink}">Always has soup. Sometimes has answers.</text>

        <text x="0" y="${h * 0.155}" font-size="${w * 0.034}" font-weight="700" letter-spacing="0.5" fill="${COLORS.inkSoft}">CIRCLES</text>
        ${[
          ["Sunday Suppers", "Chosen family", 0],
          ["Maple Street Circle", "Neighbors", 1],
          ["The Book Five", "Close friends", 2],
        ].map(([name, tag, hue], i) => {
          const y = h * 0.18 + i * h * 0.075;
          return `
            <rect x="0" y="${y}" width="${w - pad * 2}" height="${h * 0.062}" rx="${h * 0.018}" fill="${COLORS.card}" stroke="${COLORS.border}" stroke-width="1"/>
            ${avatar(w * 0.05, y + h * 0.031, w * 0.025, name[0], hue)}
            <text x="${w * 0.1}" y="${y + h * 0.025}" font-size="${w * 0.034}" font-weight="600" fill="${COLORS.ink}">${name}</text>
            <text x="${w * 0.1}" y="${y + h * 0.05}" font-size="${w * 0.026}" fill="${COLORS.inkSoft}">${tag}</text>
          `;
        }).join("")}

        <rect x="0" y="${h * 0.425}" width="${w - pad * 2}" height="${h * 0.07}" rx="${h * 0.018}" fill="${COLORS.primary}"/>
        <text x="${(w - pad * 2) / 2}" y="${h * 0.425 + h * 0.035}" text-anchor="middle" dominant-baseline="central" font-size="${w * 0.036}" font-weight="700" fill="#fff">Send a message</text>
      </g>
      ${tabBar(w, h, 3)}
    `;
  },
  settings: (w, h) => {
    const pad = w * 0.06;
    const prefs = [
      ["New requests", true],
      ["Support received", true],
      ["Repayment reminders", true],
      ["Repayments received", true],
      ["Service matches", false],
      ["New comments", true],
      ["Reactions", false],
      ["Gratitude notes", true],
    ];
    const rowH = h * 0.062;
    return `
      ${statusBar(w, h * 0.05)}
      <g transform="translate(${pad} ${h * 0.09})" font-family="-apple-system, 'Plus Jakarta Sans', sans-serif" fill="${COLORS.ink}">
        <text x="0" y="${h * 0.06}" font-size="${w * 0.085}" font-weight="700" letter-spacing="-1">Settings</text>
        <text x="0" y="${h * 0.105}" font-size="${w * 0.034}" fill="${COLORS.inkSoft}">Decide what you'd like to hear about.</text>

        <text x="0" y="${h * 0.15}" font-size="${w * 0.04}" font-weight="700" fill="${COLORS.ink}">Notifications</text>

        <rect x="0" y="${h * 0.165}" width="${w - pad * 2}" height="${rowH * prefs.length}" rx="${h * 0.022}" fill="${COLORS.card}" stroke="${COLORS.border}" stroke-width="1"/>
        ${prefs.map(([label, on], i) => {
          const y = h * 0.165 + i * rowH;
          const cy = y + rowH / 2;
          return `
            <text x="${w * 0.04}" y="${cy}" dominant-baseline="central" font-size="${w * 0.034}" font-weight="500" fill="${COLORS.ink}">${label}</text>
            <g transform="translate(${w - pad * 2 - w * 0.13} ${cy - w * 0.025})">
              <rect x="0" y="0" width="${w * 0.09}" height="${w * 0.05}" rx="${w * 0.025}" fill="${on ? COLORS.primary : "#D9D2C5"}"/>
              <circle cx="${on ? w * 0.067 : w * 0.023}" cy="${w * 0.025}" r="${w * 0.021}" fill="#fff"/>
            </g>
            ${i < prefs.length - 1 ? `<line x1="${w * 0.04}" y1="${y + rowH}" x2="${w - pad * 2 - w * 0.04}" y2="${y + rowH}" stroke="${COLORS.divider}" stroke-width="1"/>` : ""}
          `;
        }).join("")}

        <rect x="0" y="${h * 0.69}" width="${w - pad * 2}" height="${h * 0.07}" rx="${h * 0.022}" fill="${COLORS.muted}"/>
        <circle cx="${w * 0.05}" cy="${h * 0.69 + h * 0.035}" r="${w * 0.022}" fill="none" stroke="${COLORS.inkSoft}" stroke-width="2"/>
        <text x="${w * 0.05}" y="${h * 0.69 + h * 0.035}" text-anchor="middle" dominant-baseline="central" font-size="${w * 0.028}" font-weight="700" fill="${COLORS.inkSoft}">i</text>
        <text x="${w * 0.1}" y="${h * 0.69 + h * 0.027}" font-size="${w * 0.026}" fill="${COLORS.inkSoft}">MyZolve Connect is private to your circles.</text>
        <text x="${w * 0.1}" y="${h * 0.69 + h * 0.05}" font-size="${w * 0.026}" fill="${COLORS.inkSoft}">We never show your activity publicly.</text>
      </g>
      ${tabBar(w, h, 4)}
    `;
  },
};

const SCENES = [
  { key: "onboarding", file: "01-onboarding", headline: "Start your circle.",      tagline: "A private, warm space for the people you trust." },
  { key: "signin",     file: "02-sign-in",    headline: "Welcome home.",            tagline: "Your trusted circles, one tap away." },
  { key: "discover",   file: "03-discover",   headline: "Find your people.",        tagline: "Browse circles that fit the life you actually live." },
  { key: "messages",   file: "04-messages",   headline: "Stay close.",              tagline: "Private conversations with the people who matter." },
  { key: "profile",    file: "05-profile",    headline: "Show up with care.",       tagline: "A profile that feels like you, shared only with your circles." },
  { key: "settings",   file: "06-settings",   headline: "On your terms.",           tagline: "Decide what reaches you, and when." },
];

function composeMarketing(W, H, scene) {
  const deviceW = W * 0.78;
  const deviceH = deviceW * (19.5 / 9);
  const deviceX = (W - deviceW) / 2;
  const headlineY = H * 0.085;
  const taglineY = H * 0.16;
  const deviceY = H * 0.215;

  const headlineFs = W * 0.065;
  const taglineFs = W * 0.034;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${COLORS.bgTop}"/>
      <stop offset="0.55" stop-color="${COLORS.bgBottom}"/>
      <stop offset="1" stop-color="${COLORS.primary}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.35" r="0.6">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <g font-family="'Plus Jakarta Sans', -apple-system, sans-serif" text-anchor="middle">
    <text x="${W / 2}" y="${headlineY}" font-size="${headlineFs}" font-weight="700" fill="${COLORS.ink}" letter-spacing="-1.5">${xml(scene.headline)}</text>
    <text x="${W / 2}" y="${taglineY}" font-size="${taglineFs}" font-weight="500" fill="${COLORS.inkSoft}">${xml(scene.tagline)}</text>
  </g>

  ${deviceFrame(deviceX, deviceY, deviceW, deviceH, screens[scene.key])}

  <g font-family="'Plus Jakarta Sans', -apple-system, sans-serif" text-anchor="middle" opacity="0.85">
    <text x="${W / 2}" y="${H - H * 0.02}" font-size="${W * 0.022}" font-weight="600" fill="${COLORS.ink}">MyZolve Connect · a sub-brand by MyZolve</text>
  </g>
</svg>`;
}

async function main() {
  const outRoot = join(ROOT, "exports", "app-store");
  await mkdir(outRoot, { recursive: true });

  for (const dev of DEVICES) {
    const dir = join(outRoot, dev.id);
    await mkdir(dir, { recursive: true });
    for (const scene of SCENES) {
      const svg = composeMarketing(dev.w, dev.h, scene);
      const out = join(dir, `${scene.file}.png`);
      await sharp(Buffer.from(svg), { density: 144 })
        .resize(dev.w, dev.h)
        .png({ compressionLevel: 9 })
        .toFile(out);
      console.log("✓", out);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
