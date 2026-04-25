import { logger } from "./logger";

export type EmailResult =
  | { ok: true; transport: "resend" | "log"; messageId?: string }
  | { ok: false; error: string };

const FROM_DEFAULT = "MyZolve Connect <noreply@myzolve.app>";

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<EmailResult> {
  const resendKey = process.env["RESEND_API_KEY"];
  const from = process.env["EMAIL_FROM"] ?? FROM_DEFAULT;

  if (resendKey) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
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

  logger.warn(
    { to: params.to, subject: params.subject },
    "Email transport not configured (RESEND_API_KEY missing); skipping send",
  );
  return { ok: true, transport: "log" };
}
