import { customFetch } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface CirclePost {
  id: number;
  circleId: number;
  authorUserId: number;
  authorName: string;
  authorAvatarObjectPath: string | null;
  title: string | null;
  body: string;
  imageObjectPath: string | null;
  createdAt: string;
  actingForUserId?: number | null;
  actingForName?: string | null;
  actingForAvatarObjectPath?: string | null;
  copilotReview?: string | null;
}

export interface UserProfile {
  id: number;
  displayName: string;
  firstName: string | null;
  bio: string | null;
  location: string | null;
  avatarObjectPath: string | null;
  commonCircleCount: number;
  sharedCircles: { id: number; name: string }[];
  memberSince: string;
}

// Per-file ceilings the client enforces *before* attempting an upload.
// The server applies the same caps; these client values keep us from
// even trying when we know we'll be rejected.
export const MAX_FREE_MEDIA_BYTES = 10 * 1024 * 1024;
export const MAX_PLUS_MEDIA_BYTES = 50 * 1024 * 1024;
export const MAX_POST_IMAGE_BYTES = MAX_FREE_MEDIA_BYTES; // back-compat alias
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

// Per-post cap on photos. Plus members get 8; free members get 3.
export const FREE_PHOTO_CAP = 3;
export const PLUS_PHOTO_CAP = 8;

export const MAX_VOICE_DURATION_MS = 2 * 60 * 1000;
export const MAX_VIDEO_DURATION_MS = 30 * 1000;

export type AttachmentKind = "photo" | "voice" | "video";

export interface CircleAttachment {
  id: number;
  circleId: number;
  uploadedByUserId: number;
  targetEntityType: string;
  targetEntityId: number;
  kind: AttachmentKind;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  storageKey: string;
  downloadUrl: string;
  status: string;
  createdAt: string;
}

export function useCirclePosts(circleId: number) {
  return useQuery({
    queryKey: ["circle-posts", circleId],
    queryFn: () =>
      customFetch<CirclePost[]>(`/api/circles/${circleId}/posts?limit=50&offset=0`),
    enabled: !!circleId,
  });
}

export function useCreateCirclePost(circleId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title?: string;
      body: string;
      imageObjectPath?: string;
      actingForUserId?: number;
    }) =>
      customFetch<CirclePost>(`/api/circles/${circleId}/posts`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["circle-posts", circleId] }),
  });
}

export function useDeleteCirclePost(circleId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: number) =>
      customFetch(`/api/circles/${circleId}/posts/${postId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["circle-posts", circleId] }),
  });
}

export function useUserProfile(userId: number | null) {
  return useQuery({
    queryKey: ["user-profile", userId],
    queryFn: () => customFetch<UserProfile>(`/api/users/${userId}/profile`),
    enabled: !!userId,
  });
}

export interface LocalPostImage {
  uri: string;
  name: string;
  size: number;
  contentType: string;
}

export interface LocalAvatarImage {
  uri: string;
  name: string;
  size: number;
  contentType: string;
}

export interface LocalMediaFile {
  uri: string;
  name: string;
  size: number;
  contentType: string;
  kind: AttachmentKind;
  durationMs?: number;
  width?: number;
  height?: number;
}

export class PlusRequiredError extends Error {
  reason: string;
  constructor(reason: string, message: string) {
    super(message);
    this.name = "PlusRequiredError";
    this.reason = reason;
  }
}

export function useAvatarUpload() {
  return useMutation({
    mutationFn: async (file: LocalAvatarImage): Promise<string> => {
      const blob = await (await fetch(file.uri)).blob();
      const size = file.size > 0 ? file.size : blob.size;
      if (!size) {
        throw new Error("Could not determine image size");
      }
      if (size > MAX_AVATAR_BYTES) {
        throw new Error("Image is larger than 5 MB");
      }

      const { uploadURL, objectPath } = await customFetch<{
        uploadURL: string;
        objectPath: string;
      }>("/api/storage/avatar/request-url", {
        method: "POST",
        body: JSON.stringify({
          name: file.name,
          size,
          contentType: file.contentType,
        }),
      });

      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": file.contentType },
      });
      if (!putRes.ok) {
        throw new Error(`Upload failed (${putRes.status})`);
      }
      return objectPath;
    },
  });
}

export function useCircleBannerUpload(circleId: number) {
  return useMutation({
    mutationFn: async (file: LocalPostImage): Promise<string> => {
      const blob = await (await fetch(file.uri)).blob();
      const size = file.size > 0 ? file.size : blob.size;
      if (!size) {
        throw new Error("Could not determine image size");
      }
      if (size > MAX_POST_IMAGE_BYTES) {
        throw new Error("Image is larger than 10 MB");
      }

      const { uploadURL, objectPath } = await customFetch<{
        uploadURL: string;
        objectPath: string;
      }>("/api/storage/circle-banner/request-url", {
        method: "POST",
        body: JSON.stringify({
          name: file.name,
          size,
          contentType: file.contentType,
          circleId,
        }),
      });

      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: blob,
        headers: { "Content-Type": file.contentType },
      });
      if (!putRes.ok) {
        throw new Error(`Upload failed (${putRes.status})`);
      }
      return objectPath;
    },
  });
}

/**
 * Single-photo wall upload, kept for compatibility with the existing
 * `imageObjectPath` posting flow.
 */
export function useCircleMediaUpload(circleId: number) {
  return useMutation({
    mutationFn: async (file: LocalPostImage): Promise<string> => {
      return uploadCircleMediaToStorage(circleId, {
        ...file,
        kind: "photo",
      });
    },
  });
}

/**
 * Low-level helper used by the multi-attachment composer flows. Throws a
 * `PlusRequiredError` when the server gates voice/video uploads behind
 * the Plus paywall so the UI can pop the upsell sheet.
 */
export async function uploadCircleMediaToStorage(
  circleId: number,
  file: LocalMediaFile,
): Promise<string> {
  const blob = await (await fetch(file.uri)).blob();
  const size = file.size > 0 ? file.size : blob.size;
  if (!size) {
    throw new Error("Could not determine file size");
  }
  if (size > MAX_PLUS_MEDIA_BYTES) {
    throw new Error("Files must be under 50 MB.");
  }

  let uploadURL: string;
  let objectPath: string;
  try {
    const json = await customFetch<{ uploadURL: string; objectPath: string }>(
      `/api/storage/circle-media/request-url`,
      {
        method: "POST",
        body: JSON.stringify({
          name: file.name,
          size,
          contentType: file.contentType,
          circleId,
          kind: file.kind,
        }),
      },
    );
    uploadURL = json.uploadURL;
    objectPath = json.objectPath;
  } catch (err) {
    const status = (err as { status?: number } | undefined)?.status;
    const data = (err as { data?: { reason?: string; message?: string } } | undefined)?.data;
    if (status === 402) {
      throw new PlusRequiredError(
        data?.reason ?? "plus_required",
        data?.message ?? "MyZolve Connect Plus is required for this feature.",
      );
    }
    throw err;
  }

  const putRes = await fetch(uploadURL, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": file.contentType },
  });
  if (!putRes.ok) {
    throw new Error(`Upload failed (${putRes.status})`);
  }
  return objectPath;
}

export interface AttachmentTarget {
  circleId: number;
  entityType:
    | "support_request"
    | "service_post"
    | "repayment"
    | "circle_post"
    | "comment"
    | "gratitude_note";
  entityId: number;
}

export function useEntityAttachments(target: AttachmentTarget | null) {
  return useQuery({
    queryKey: target
      ? ["entity-attachments", target.circleId, target.entityType, target.entityId]
      : ["entity-attachments", "noop"],
    queryFn: () =>
      customFetch<CircleAttachment[]>(
        `/api/circles/${target!.circleId}/attachments/${target!.entityType}/${target!.entityId}`,
      ),
    enabled: !!target,
  });
}

/**
 * Records an already-uploaded media object as an attachment on the given
 * entity. Throws `PlusRequiredError` on 402 so the UI can surface the
 * paywall instead of a generic failure.
 */
export async function recordEntityAttachment(
  target: AttachmentTarget,
  payload: {
    kind: AttachmentKind;
    fileName: string;
    fileSize?: number;
    mimeType?: string;
    durationMs?: number;
    width?: number;
    height?: number;
    storageKey: string;
  },
): Promise<CircleAttachment> {
  try {
    return await customFetch<CircleAttachment>(
      `/api/circles/${target.circleId}/attachments/${target.entityType}/${target.entityId}`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  } catch (err) {
    const status = (err as { status?: number } | undefined)?.status;
    const data = (err as { data?: { reason?: string; message?: string; error?: string } } | undefined)
      ?.data;
    if (status === 402) {
      throw new PlusRequiredError(
        data?.reason ?? "plus_required",
        data?.message ?? "MyZolve Connect Plus is required for this feature.",
      );
    }
    throw err;
  }
}
