import { db } from "@workspace/db";
import { deviceTokensTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { logger } from "./logger";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100;

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ExpoPushMessage {
  to: string;
  sound: "default";
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: "default" | "high";
  channelId?: string;
}

interface ExpoTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

function isExpoToken(token: string): boolean {
  return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
}

async function sendChunk(messages: ExpoPushMessage[]): Promise<ExpoTicket[]> {
  const res = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    throw new Error(`Expo push request failed: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { data?: ExpoTicket[] };
  return json.data ?? [];
}

export async function sendPushToTokens(tokens: string[], payload: PushPayload): Promise<void> {
  const valid = Array.from(new Set(tokens.filter(isExpoToken)));
  if (valid.length === 0) return;

  const messages: ExpoPushMessage[] = valid.map((to) => ({
    to,
    sound: "default",
    title: payload.title,
    body: payload.body,
    data: payload.data,
    priority: "high",
    channelId: "default",
  }));

  const invalidTokens: string[] = [];

  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    const chunk = messages.slice(i, i + CHUNK_SIZE);
    try {
      const tickets = await sendChunk(chunk);
      tickets.forEach((ticket, idx) => {
        if (ticket.status === "error") {
          const err = ticket.details?.error;
          if (err === "DeviceNotRegistered") {
            invalidTokens.push(chunk[idx].to);
          } else {
            logger.warn({ err, message: ticket.message }, "expo push ticket error");
          }
        }
      });
    } catch (err) {
      logger.error({ err }, "failed to send expo push chunk");
    }
  }

  if (invalidTokens.length > 0) {
    try {
      await db.delete(deviceTokensTable).where(inArray(deviceTokensTable.token, invalidTokens));
    } catch (err) {
      logger.error({ err }, "failed to prune invalid device tokens");
    }
  }
}

export async function dispatchPushToUser(userId: number, payload: PushPayload): Promise<void> {
  try {
    const rows = await db
      .select({ token: deviceTokensTable.token })
      .from(deviceTokensTable)
      .where(eq(deviceTokensTable.userId, userId));
    if (rows.length === 0) return;
    await sendPushToTokens(
      rows.map((r) => r.token),
      payload,
    );
  } catch (err) {
    logger.error({ err, userId }, "failed to dispatch push notification");
  }
}
