/**
 * App Store screenshot pipeline.
 *
 * Composites real screen captures (from scripts/capture-app-store-shots.mjs,
 * stored under tmp/captures/) into a marketing frame: warm gradient background,
 * headline + tagline copy, iPhone device frame with a bezel, and a sub-brand
 * mark at the bottom.
 *
 * Outputs PNGs at exact App Store dimensions for iPhone 6.9" and 6.5" devices.
 *
 * Run via: pnpm screenshots:app-store
 *   (which invokes capture first, then this composer)
 */
import sharp from "sharp";
import { mkdir, readFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");
const CAPTURES = join(ROOT, "tmp", "captures");

const DEVICES = [
  { id: "iphone-6.9", w: 1320, h: 2868 },
  { id: "iphone-6.5", w: 1284, h: 2778 },
];

const COLORS = {
  bgTop: "#FBE6D8",
  bgBottom: "#F5C9A8",
  cream: "#FAF3EA",
  primary: "#D9622A",
  ink: "#2A1F18",
  inkSoft: "#5C4A3E",
};

const xml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const SCENES = [
  { file: "01-onboarding", headline: "Start your circle.",   tagline: "A private, warm space for the people you trust." },
  { file: "02-sign-in",    headline: "Welcome home.",         tagline: "Your trusted circles, one tap away." },
  { file: "03-discover",   headline: "Find your people.",     tagline: "Browse circles that fit the life you actually live." },
  { file: "04-messages",   headline: "Stay close.",           tagline: "Private conversations with the people who matter." },
  { file: "05-profile",    headline: "Show up with care.",    tagline: "A profile shared only with your circles." },
  { file: "06-settings",   headline: "On your terms.",        tagline: "Decide what reaches you, and when." },
];

function backgroundSvg(W, H, scene) {
  const headlineY = H * 0.085;
  const taglineY  = H * 0.14;
  const headlineFs = W * 0.062;
  const taglineFs  = W * 0.032;
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
  <g font-family="'Plus Jakarta Sans', -apple-system, sans-serif" text-anchor="middle" opacity="0.85">
    <text x="${W / 2}" y="${H - H * 0.018}" font-size="${W * 0.022}" font-weight="600" fill="${COLORS.ink}">MyZolve Connect · a sub-brand by MyZolve</text>
  </g>
</svg>`;
}

function deviceFrameSvg(deviceW, deviceH) {
  const W = deviceW, H = deviceH;
  const r = W * 0.13;
  const bezel = W * 0.022;
  const sx = bezel, sy = bezel;
  const sw = W - bezel * 2, sh = H - bezel * 2;
  const sr = r - bezel * 0.7;
  const islandW = W * 0.34;
  const islandH = W * 0.085;
  const islandX = (W - islandW) / 2;
  const islandY = bezel + W * 0.018;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="frameGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1a1a1a"/>
      <stop offset="1" stop-color="#0a0a0a"/>
    </linearGradient>
    <mask id="screenMask">
      <rect width="${W}" height="${H}" fill="black"/>
      <rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="${sr}" ry="${sr}" fill="white"/>
    </mask>
    <mask id="cutout">
      <rect width="${W}" height="${H}" fill="white"/>
      <rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="${sr}" ry="${sr}" fill="black"/>
    </mask>
  </defs>
  <rect width="${W}" height="${H}" rx="${r}" ry="${r}" fill="url(#frameGrad)" mask="url(#cutout)"/>
  <rect x="${islandX}" y="${islandY}" width="${islandW}" height="${islandH}" rx="${islandH / 2}" ry="${islandH / 2}" fill="#000"/>
</svg>`;
}

function screenMaskSvg(deviceW, deviceH) {
  const W = deviceW, H = deviceH;
  const bezel = W * 0.022;
  const sx = bezel, sy = bezel;
  const sw = W - bezel * 2, sh = H - bezel * 2;
  const r = W * 0.13;
  const sr = r - bezel * 0.7;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="black"/>
  <rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="${sr}" ry="${sr}" fill="white"/>
</svg>`;
}

async function pngExists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function composeOne(W, H, scene) {
  // Layout: device fills ~78% width, anchored ~21.5% from top
  const deviceW = Math.round(W * 0.78);
  const deviceH = Math.round(deviceW * (19.5 / 9));
  const deviceX = Math.round((W - deviceW) / 2);
  const deviceY = Math.round(H * 0.215);

  const bezel = Math.round(deviceW * 0.022);
  const screenW = deviceW - bezel * 2;
  const screenH = deviceH - bezel * 2;

  const capturePath = join(CAPTURES, `${scene.file}.png`);
  if (!(await pngExists(capturePath))) {
    throw new Error(`Missing capture: ${capturePath}. Run capture-app-store-shots.mjs first.`);
  }

  // 1. Background + headline (full canvas)
  const bg = await sharp(Buffer.from(backgroundSvg(W, H, scene)), { density: 144 })
    .resize(W, H)
    .png()
    .toBuffer();

  // 2. Resize captured screen to fit screen area, leaving cream space at the
  // top so the Dynamic Island doesn't cover real content.
  const topInset = Math.round(deviceW * 0.085 + bezel * 1.6);
  const innerScreen = await sharp(await readFile(capturePath))
    .resize(screenW, screenH - topInset, { fit: "cover", position: "top" })
    .png()
    .toBuffer();
  const screen = await sharp({
      create: {
        width: screenW, height: screenH, channels: 4,
        background: { r: 250, g: 243, b: 234, alpha: 1 }, // cream
      },
    })
    .composite([{ input: innerScreen, left: 0, top: topInset }])
    .png()
    .toBuffer();

  // 3. Mask the screen with rounded-corner shape so it fits behind the bezel
  const maskBuf = await sharp(Buffer.from(screenMaskSvg(deviceW, deviceH)), { density: 144 })
    .resize(deviceW, deviceH)
    .toColourspace("b-w")
    .toBuffer();

  // Build a deviceW × deviceH transparent canvas, place screen at (bezel,bezel), apply mask
  const screenLayer = await sharp({
      create: { width: deviceW, height: deviceH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
    })
    .composite([{ input: screen, left: bezel, top: bezel }])
    .png()
    .toBuffer();

  const maskedScreen = await sharp(screenLayer)
    .joinChannel(maskBuf)
    .png()
    .toBuffer();

  // 4. Device frame (bezel + island) on top
  const frame = await sharp(Buffer.from(deviceFrameSvg(deviceW, deviceH)), { density: 144 })
    .resize(deviceW, deviceH)
    .png()
    .toBuffer();

  // 5. Composite all together
  const final = await sharp(bg)
    .composite([
      { input: maskedScreen, left: deviceX, top: deviceY },
      { input: frame,        left: deviceX, top: deviceY },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();

  return final;
}

async function main() {
  const outRoot = join(ROOT, "exports", "app-store");
  await mkdir(outRoot, { recursive: true });

  for (const dev of DEVICES) {
    const dir = join(outRoot, dev.id);
    await mkdir(dir, { recursive: true });
    for (const scene of SCENES) {
      const buf = await composeOne(dev.w, dev.h, scene);
      const out = join(dir, `${scene.file}.png`);
      await sharp(buf).resize(dev.w, dev.h).png({ compressionLevel: 9 }).toFile(out);
      console.log("✓", out);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
