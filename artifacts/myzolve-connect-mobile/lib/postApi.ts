import { customFetch } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface CirclePost {
  id: number;
  circleId: number;
  authorUserId: number;
  authorName: string;
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
    mutationFn: (data: { title?: string; body: string }) =>
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
