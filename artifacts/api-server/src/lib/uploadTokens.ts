interface PendingUpload {
  userId: number;
  circleId: number;
  expiresAt: Date;
}

const pendingUploads = new Map<string, PendingUpload>();

function cleanupExpiredUploads() {
  const now = new Date();
  for (const [key, entry] of pendingUploads) {
    if (entry.expiresAt < now) pendingUploads.delete(key);
  }
}

export function registerPendingUpload(objectPath: string, userId: number, circleId: number): void {
  cleanupExpiredUploads();
  pendingUploads.set(objectPath, {
    userId,
    circleId,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
}

export function validateAndConsumePendingUpload(objectPath: string, userId: number, circleId?: number): boolean {
  cleanupExpiredUploads();
  const entry = pendingUploads.get(objectPath);
  if (!entry) return false;
  if (entry.userId !== userId) return false;
  if (circleId !== undefined && entry.circleId !== circleId) return false;
  if (entry.expiresAt < new Date()) return false;
  pendingUploads.delete(objectPath);
  return true;
}
