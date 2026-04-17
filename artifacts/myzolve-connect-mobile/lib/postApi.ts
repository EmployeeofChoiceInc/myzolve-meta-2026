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

export const MAX_POST_IMAGE_BYTES = 10 * 1024 * 1024;

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
    mutationFn: (data: { title?: string; body: string; imageObjectPath?: string }) =>
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

export function useCircleMediaUpload(circleId: number) {
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
      }>("/api/storage/circle-media/request-url", {
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
