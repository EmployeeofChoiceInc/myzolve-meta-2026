/**
 * Capture real screenshots from the running Expo web app for the App Store
 * marketing pipeline. Auths via Clerk Backend SDK (sign-in token), seeds a
 * small demo dataset directly in the DB, then drives Playwright at iPhone-
 * portrait viewport to grab one PNG per featured screen.
 *
 *   Output: tmp/captures/<scene>.png
 *
 * Run via: node scripts/capture-app-store-shots.mjs
 */
import { chromium } from "playwright";
import { createClerkClient } from "@clerk/backend";
import { mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "tmp", "captures");

const EXPO_URL = process.env.EXPO_URL ||
  "https://c12dff99-e6e2-47f8-bc4c-c703057c15a7-00-2ib2irwlsa6ao.expo.janeway.replit.dev";

const SECRET = process.env.CLERK_SECRET_KEY;
if (!SECRET) {
  console.error("CLERK_SECRET_KEY not set"); process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set"); process.exit(1);
}

const clerk = createClerkClient({ secretKey: SECRET });

async function findOrCreateClerkUser() {
  // Try to use the first Clerk user that has a real email, so we don't churn.
  const { data } = await clerk.users.getUserList({ limit: 50 });
  const real = data.find((u) =>
    u.emailAddresses?.[0]?.emailAddress &&
    !u.emailAddresses[0].emailAddress.endsWith("@unknown.com")
  );
  if (real) return real;
  // Fallback: create a fresh demo user
  return clerk.users.createUser({
    emailAddress: ["app-store-shots@myzolve-connect.test"],
    firstName: "Rosa",
    lastName: "Santos",
    skipPasswordRequirement: true,
  });
}

async function ensureDbUser(client, clerkId, email, displayName) {
  const r = await client.query(
    "SELECT id FROM users WHERE clerk_id = $1 LIMIT 1", [clerkId]);
  if (r.rows[0]) return r.rows[0].id;
  const ins = await client.query(
    `INSERT INTO users (clerk_id, email, display_name, first_name, last_name, location, bio)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [clerkId, email, displayName, "Rosa", "Santos", "Brooklyn, NY",
      "Mother of two, slow cook, quick to listen. Always has soup. Sometimes has answers."]);
  return ins.rows[0].id;
}

async function seedDemoData(meUserId) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    // Add a brief profile to me if missing
    await client.query(
      `UPDATE users SET location = COALESCE(location, $1), bio = COALESCE(bio, $2)
       WHERE id = $3`,
      ["Brooklyn, NY",
       "Mother of two, slow cook, quick to listen. Always has soup. Sometimes has answers.",
       meUserId]);

    // Make sure we have a few demo other users for messages/profile
    const others = [
      { clerkId: "demo_alice_001",  email: "alice@example.com",  name: "Alice Johnson" },
      { clerkId: "demo_ben_001",    email: "ben@example.com",    name: "Ben Rivera" },
      { clerkId: "demo_carol_001",  email: "carol@example.com",  name: "Carol Mensah" },
      { clerkId: "demo_diego_001",  email: "diego@example.com",  name: "Diego Park" },
      { clerkId: "demo_joy_001",    email: "joy@example.com",    name: "Joy Adeyemi" },
      { clerkId: "demo_tomas_001",  email: "tomas@example.com",  name: "Tomás Ortiz" },
    ];
    const otherIds = {};
    for (const o of others) {
      const r = await client.query("SELECT id FROM users WHERE clerk_id=$1",[o.clerkId]);
      if (r.rows[0]) { otherIds[o.clerkId] = r.rows[0].id; continue; }
      const ins = await client.query(
        `INSERT INTO users (clerk_id, email, display_name) VALUES ($1,$2,$3) RETURNING id`,
        [o.clerkId, o.email, o.name]);
      otherIds[o.clerkId] = ins.rows[0].id;
    }

    // Public-discoverable circles (open or approval)
    const circles = [
      { name: "Sunday Suppers",      type: "chosen_family", privacy: "open",     desc: "A small group sharing meals and check-ins on Sundays.", owner: otherIds.demo_alice_001 },
      { name: "East Side Helpers",   type: "mutual_aid",   privacy: "approval", desc: "Neighbors lending hands when life gets heavy.", owner: otherIds.demo_ben_001 },
      { name: "The Book Five",       type: "close_friends",privacy: "open",     desc: "Five friends, one slow-moving book club.", owner: otherIds.demo_carol_001 },
      { name: "Maple Street Circle", type: "neighborhood", privacy: "approval", desc: "Tools, rides, and casseroles when needed.", owner: meUserId },
    ];
    const circleIds = [];
    for (const c of circles) {
      const r = await client.query("SELECT id FROM circles WHERE name=$1",[c.name]);
      let id;
      if (r.rows[0]) {
        id = r.rows[0].id;
        await client.query("UPDATE circles SET privacy_mode=$1, description=$2, circle_type=$3 WHERE id=$4",
          [c.privacy, c.desc, c.type, id]);
      } else {
        const ins = await client.query(
          `INSERT INTO circles (name, circle_type, description, privacy_mode, owner_id, currency)
           VALUES ($1,$2,$3,$4,$5,'USD') RETURNING id`,
          [c.name, c.type, c.desc, c.privacy, c.owner]);
        id = ins.rows[0].id;
      }
      circleIds.push(id);
    }

    // Ensure I'm a member of a few circles so they appear on my profile
    const myMemberships = [circleIds[0], circleIds[2], circleIds[3]];
    for (const cid of myMemberships) {
      await client.query(
        `INSERT INTO circle_members (circle_id, user_id, role, status, joined_at)
         VALUES ($1,$2,'member','active',now())
         ON CONFLICT (circle_id, user_id) DO NOTHING`,
        [cid, meUserId]);
    }

    // Direct messages: a small inbox so the messages tab is rich
    const inboxThreads = [
      { who: otherIds.demo_alice_001, body: "I left soup on the porch — no rush.", minsAgo: 18,   read: false },
      { who: otherIds.demo_diego_001, body: "Got a ride covered for tomorrow.",     minsAgo: 100,  read: true  },
      { who: otherIds.demo_joy_001,   body: "Thank you. Truly.",                     minsAgo: 1430, read: false },
      { who: otherIds.demo_tomas_001, body: "Returning the $40 this Friday.",        minsAgo: 1500, read: true  },
      { who: otherIds.demo_ben_001,   body: "The kids loved the cookies.",           minsAgo: 2880, read: true  },
      { who: otherIds.demo_carol_001, body: "Can we move the carpool to 7:30?",      minsAgo: 4320, read: true  },
    ];
    // Clear old test messages to keep inbox stable
    await client.query(
      `DELETE FROM direct_messages WHERE
       (sender_user_id = $1 AND recipient_user_id = ANY($2::int[])) OR
       (recipient_user_id = $1 AND sender_user_id = ANY($2::int[]))`,
      [meUserId, Object.values(otherIds)]);
    for (const t of inboxThreads) {
      const ts = new Date(Date.now() - t.minsAgo * 60_000);
      await client.query(
        `INSERT INTO direct_messages (sender_user_id, recipient_user_id, body, created_at, read_at)
         VALUES ($1,$2,$3,$4,$5)`,
        [t.who, meUserId, t.body, ts, t.read ? ts : null]);
    }

    return { meUserId, circleIds, otherIds };
  } finally { await client.end(); }
}

const SCENES = [
  { id: "01-onboarding", path: "/onboarding", auth: false, settle: 2500, prep: async (page) => {
      await page.fill('[data-testid="input-name"]', "The Village").catch(() => {});
    } },
  { id: "02-sign-in",    path: "/sign-in",    auth: false, settle: 2000, prep: async (page) => {
      await page.fill('[data-testid="input-email"]', "rosa@example.com").catch(() => {});
      await page.fill('[data-testid="input-password"]', "verysecure!").catch(() => {});
    } },
  { id: "03-discover",   path: "/discover",   auth: true, settle: 6000,
    waitForText: ["Sunday Suppers", "East Side Helpers", "The Book Five", "Maple Street"] },
  { id: "04-messages",   path: "/messages",   auth: true, settle: 6000,
    waitForText: ["Alice", "Diego", "Joy", "Tomás", "Carol", "Ben"] },
  { id: "05-profile",    path: null,          auth: true, dynamic: true, settle: 4000,
    waitForText: ["Brooklyn", "Mother of two", "Sunday Suppers"] },
  { id: "06-settings",   path: "/settings",   auth: true, settle: 4000,
    waitForText: ["Notifications", "New requests"] },
];

async function main() {
  await mkdir(OUT, { recursive: true });

  console.log("→ minting Clerk sign-in token");
  const cu = await findOrCreateClerkUser();
  const email = cu.emailAddresses[0].emailAddress;
  const display = [cu.firstName, cu.lastName].filter(Boolean).join(" ") || "Rosa Santos";
  console.log("  using Clerk user:", cu.id, email);

  console.log("→ ensuring DB user + seeding demo data");
  const dbClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await dbClient.connect();
  const meId = await ensureDbUser(dbClient, cu.id, email, display);
  await dbClient.end();
  await seedDemoData(meId);
  console.log("  me db id:", meId);

  console.log("→ minting sign-in token");
  const tok = await clerk.signInTokens.createSignInToken({
    userId: cu.id, expiresInSeconds: 600,
  });

  console.log("→ launching Playwright");
  // Disable web security so cross-origin /api/* fetches from the Expo dev
   // domain to the api-server domain succeed in the captured pages.
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  });
  const viewport = { width: 440, height: 956 };
  const ctxOpts = {
    viewport,
    deviceScaleFactor: 3,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    // Block service workers so route() interceptors apply to all fetches.
    serviceWorkers: "block",
  };

  // Resolve dynamic profile path
  for (const s of SCENES) {
    if (s.dynamic && s.id === "05-profile") s.path = `/profile/${meId}`;
  }

  async function captureScene(page, scene) {
    console.log("→ capturing", scene.id, scene.path);
    await page.goto(`${EXPO_URL}${scene.path}`, { waitUntil: "networkidle" });
    if (scene.waitForText) {
      try {
        await page.waitForFunction(
          (terms) => terms.some((t) => document.body.innerText.includes(t)),
          scene.waitForText,
          { timeout: 15000 }
        );
      } catch (e) {
        console.warn(`  waitForText timed out for ${scene.id}`);
      }
    }
    await page.waitForTimeout(scene.settle ?? 1500);
    if (scene.prep) {
      try { await scene.prep(page); } catch (e) { console.warn("prep failed:", e.message); }
      await page.waitForTimeout(500);
    }
    if (scene.auth) {
      const txt = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 400));
      console.log("    text:", txt);
    }
    await page.screenshot({ path: join(OUT, `${scene.id}.png`), fullPage: false });
  }

  // Pass 1: unauthenticated scenes in a fresh context
  {
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    for (const scene of SCENES.filter((s) => !s.auth)) {
      await captureScene(page, scene);
    }
    await ctx.close();
  }

  // Pass 2: signed-in scenes in a separate context
  {
    const ctx = await browser.newContext(ctxOpts);
    // The page is loaded from the Expo dev domain (.expo.janeway.replit.dev)
    // but customFetch's baseURL points the in-app /api/* calls at the
    // api-server's domain (.janeway.replit.dev). That's a cross-origin
    // request, and the api-server doesn't whitelist the Expo origin, so
    // the browser blocks the responses with a CORS error and the React
    // Query layer never receives data. Intercept those calls and proxy
    // them through Playwright's request layer (which is not subject to
    // browser CORS), then add a permissive ACAO header on the way back.
    console.log("→ registering route interceptor");
    let routeHits = 0;
    await ctx.route("**/*", async (route) => {
      routeHits++;
      const u = route.request().url();
      if (u.includes("/api/")) console.log("    [route API]", u.slice(-80));
      if (!u.includes("/api/")) { await route.continue(); return; }
      const reqUrl = route.request().url();
      try {
        const response = await route.fetch();
        const headers = { ...response.headers() };
        headers["access-control-allow-origin"] = "*";
        headers["access-control-allow-credentials"] = "true";
        headers["access-control-allow-headers"] = "*";
        headers["access-control-allow-methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
        console.log("    [route]", response.status(), reqUrl.split("?")[0].slice(-60));
        await route.fulfill({ response, headers });
      } catch (e) {
        console.log("    [route ERR]", reqUrl.slice(-60), String(e).slice(0, 100));
        await route.continue();
      }
    });
    const page = await ctx.newPage();
    page.on("request", (req) => {
      const u = req.url();
      if (u.includes("/api/")) console.log("    [request]", req.method(), u.slice(-80));
    });
    page.on("requestfailed", (req) => {
      const u = req.url();
      if (u.includes("/api/")) console.log("    [reqfail ]", req.method(), u.slice(-80), req.failure()?.errorText);
    });
    page.on("response", (resp) => {
      const u = resp.url();
      if (u.includes("/api/")) console.log("    [response]", resp.status(), u.slice(-60));
    });
    console.log("→ signing in via Clerk ticket");
    await page.goto(`${EXPO_URL}/sign-in`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => !!window.Clerk && window.Clerk.loaded === true, { timeout: 30000 });
    const result = await page.evaluate(async (ticket) => {
      const c = window.Clerk;
      const si = await c.client.signIn.create({ strategy: "ticket", ticket });
      if (si.status !== "complete") return { ok: false, status: si.status };
      await c.setActive({ session: si.createdSessionId });
      return { ok: true };
    }, tok.token);
    if (!result.ok) {
      console.error("Clerk sign-in did not complete:", result);
      await browser.close(); process.exit(1);
    }
    page.on("console", (msg) => {
      const t = msg.text();
      if (t.includes("[authTokenGetter]") || t.includes("Error") || t.includes("error")) {
        console.log("  [console]", t.slice(0, 200));
      }
    });
    page.on("pageerror", (err) => console.log("  [pageerror]", err.message));
    // Wait for app to recognize signed-in state.
    await page.waitForFunction(() => !!window.Clerk?.session, { timeout: 15000 });
    await page.waitForTimeout(2000);
    console.log("  signed in");

    // Bypass the in-app auth bridge at the network layer: intercept every
    // /api/* request from this page and inject Authorization: Bearer <jwt>
    // pulled fresh from window.Clerk.session.getToken(). The app's own
    // useAuth().getToken() hangs on web after ticket sign-in, which prevents
    // customFetch from ever firing the underlying fetch. This interceptor
    // sidesteps that entirely.
    let cachedToken = null;
    let tokenFetchedAt = 0;
    async function getFreshToken() {
      // Reuse a token for up to 30s to avoid hammering Clerk on every request.
      if (cachedToken && Date.now() - tokenFetchedAt < 30_000) return cachedToken;
      cachedToken = await page.evaluate(async () => {
        try { return await window.Clerk.session.getToken(); }
        catch { return null; }
      });
      tokenFetchedAt = Date.now();
      return cachedToken;
    }
    await page.route("**/api/**", async (route) => {
      const req = route.request();
      const headers = { ...req.headers() };
      if (!headers["authorization"]) {
        const t = await getFreshToken();
        if (t) headers["authorization"] = `Bearer ${t}`;
      }
      await route.continue({ headers });
    });

    for (const scene of SCENES.filter((s) => s.auth)) {
      await captureScene(page, scene);
    }
    await ctx.close();
  }

  await browser.close();
  console.log("✓ all captures saved to", OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
