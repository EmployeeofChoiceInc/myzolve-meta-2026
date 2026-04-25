export type MediaKind = "photo" | "voice" | "video";

export interface MediaPolicy {
  kind: MediaKind;
  maxBytes: number;
  allowedMimePrefix: "image/" | "audio/" | "video/";
}

interface PendingUpload {
  userId: number;
  circleId: number;
  expiresAt: Date;
  mediaPolicy?: MediaPolicy;
}

const pendingUploads = new Map<string, PendingUpload>();

function cleanupExpiredUploads() {
  const now = new Date();
  for (const [key, entry] of pendingUploads) {
    if (entry.expiresAt < now) pendingUploads.delete(key);
  }
}

export function registerPendingUpload(
  objectPath: string,
  userId: number,
  circleId: number,
  mediaPolicy?: MediaPolicy,
): void {
  cleanupExpiredUploads();
  pendingUploads.set(objectPath, {
    userId,
    circleId,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    mediaPolicy,
  });
}

export function validateAndConsumePendingUpload(
  objectPath: string,
  userId: number,
  circleId?: number,
): boolean {
  cleanupExpiredUploads();
  const entry = pendingUploads.get(objectPath);
  if (!entry) return false;
  if (entry.userId !== userId) return false;
  if (circleId !== undefined && entry.circleId !== circleId) return false;
  if (entry.expiresAt < new Date()) return false;
  pendingUploads.delete(objectPath);
  return true;
}

/**
 * Validate + consume an upload token *and* require it to carry a media policy
 * matching `expectedKind`. Returns the policy on success, or `null` if the
 * token doesn't exist, doesn't belong to the caller, has expired, or wasn't
 * issued under a matching media policy.
 *
 * Used by attachment record creation to make sure callers can only attach
 * media that was issued through the policy-enforcing media URL endpoint
 * (not the generic uploads endpoint, which has no media caps).
 */
export function validateAndConsumeMediaUpload(
  objectPath: string,
  userId: number,
  circleId: number,
  expectedKind: MediaKind,
): MediaPolicy | null {
  cleanupExpiredUploads();
  const entry = pendingUploads.get(objectPath);
  if (!entry) return null;
  if (entry.userId !== userId) return null;
  if (entry.circleId !== circleId) return null;
  if (entry.expiresAt < new Date()) return null;
  if (!entry.mediaPolicy) return null;
  if (entry.mediaPolicy.kind !== expectedKind) return null;
  pendingUploads.delete(objectPath);
  return entry.mediaPolicy;
}
