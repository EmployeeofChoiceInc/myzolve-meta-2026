import { logger } from "./logger";
// Gmail sending uses the Replit "google-mail" connector (Gmail integration).
// The SDK handles OAuth identity, token refresh, and auth headers automatically.
import { ReplitConnectors } from "@replit/connectors-sdk";

export type EmailResult =
  | { ok: true; transport: "gmail" | "resend" | "log"; messageId?: string }
  | { ok: false; error: string };

const FROM_DEFAULT = "MyZolve Connect <noreply@myzolve.app>";

let connectorsClient: ReplitConnectors | null = null;
function getConnectors(): ReplitConnectors {
  if (!connectorsClient) connectorsClient = new ReplitConnectors();
  return connectorsClient;
}

/**
 * Build an RFC 2822 message and base64url-encode it for the Gmail API.
 */
function buildRawGmailMessage(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): string {
  const boundary = `mzc_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2)}`;
  // Encode subject as UTF-8 per RFC 2047 so non-ASCII renders correctly.
  const encodedSubject = `=?UTF-8?B?${Buffer.from(params.subject, "utf-8").toString(
    "base64",
  )}?=`;
  const headers = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    ...(params.replyTo ? [`Reply-To: ${params.replyTo}`] : []),
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const body = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    params.text,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    params.html,
    "",
    `--${boundary}--`,
    "",
  ];
  const message = `${headers.join("\r\n")}\r\n\r\n${body.join("\r\n")}`;
  return Buffer.from(message, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sendViaGmail(params: {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<EmailResult> {
  const raw = buildRawGmailMessage(params);
  const resp = await getConnectors().proxy(
    "google-mail",
    "/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    },
  );
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => "");
    logger.warn(
      { status: resp.status, body: errBody, to: params.to, subject: params.subject },
      "Gmail email send failed",
    );
    return {
      ok: false,
      error: `Gmail ${resp.status}: ${errBody.slice(0, 200)}`,
    };
  }
  const data = (await resp.json().catch(() => ({}))) as { id?: string };
  return { ok: true, transport: "gmail", messageId: data.id };
}

async function sendViaResend(
  resendKey: string,
  params: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    replyTo?: string;
  },
): Promise<EmailResult> {
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: params.from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      }),
    });
    if (!r.ok) {
      const body = await r.text();
      logger.warn(
        { status: r.status, body, to: params.to, subject: params.subject },
        "Resend email send failed",
      );
      return { ok: false, error: `Resend ${r.status}: ${body.slice(0, 200)}` };
    }
    const data = (await r.json().catch(() => ({}))) as { id?: string };
    return { ok: true, transport: "resend", messageId: data.id };
  } catch (err) {
    logger.warn({ err, to: params.to }, "Resend email transport threw");
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<EmailResult> {
  // Prefer Gmail when the address to send from is configured. The Gmail
  // connector sends as the connected Google account, so EMAIL_FROM should be
  // that account's address (e.g. "MyZolve Connect <info@employeeofchoice.com>").
  const from = process.env["EMAIL_FROM"] ?? FROM_DEFAULT;
  const resendKey = process.env["RESEND_API_KEY"];
  const useGmail = process.env["EMAIL_TRANSPORT"] !== "resend";

  if (useGmail) {
    try {
      return await sendViaGmail({ ...params, from });
    } catch (err) {
      logger.warn(
        { err, to: params.to },
        "Gmail email transport threw; falling back",
      );
      if (resendKey) return sendViaResend(resendKey, { ...params, from });
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  if (resendKey) {
    return sendViaResend(resendKey, { ...params, from });
  }

  logger.warn(
    { to: params.to, subject: params.subject },
    "Email transport not configured; skipping send",
  );
  return { ok: true, transport: "log" };
}
