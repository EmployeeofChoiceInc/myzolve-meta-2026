import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface Notification {
  id: number;
  circleId: number | null;
  notificationType: string;
  targetEntityType: string | null;
  targetEntityId: number | null;
  title: string;
  body: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface Comment {
  id: number;
  circleId: number;
  authorUserId: number;
  authorName: string;
  targetEntityType: string;
  targetEntityId: number;
  parentCommentId: number | null;
  body: string;
  status: string;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Reactions {
  counts: Record<string, number>;
  myReactions: string[];
  total: number;
}

export interface Dispute {
  id: number;
  circleId: number;
  raisedByUserId: number;
  raisedByName: string;
  targetEntityType: string;
  targetEntityId: number;
  reason: string;
  status: string;
  resolvedByUserId: number | null;
  resolvedByName: string | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface PlaceholderMember {
  id: number;
  circleId: number;
  addedByUserId: number;
  displayName: string;
  relationship: string | null;
  notes: string | null;
  email: string | null;
  status: string;
  claimedByUserId: number | null;
  claimedAt: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: number;
  actorUserId: number | null;
  actorName: string;
  action: string;
  targetEntityType: string | null;
  targetEntityId: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationPreference {
  notificationType: string;
  enabled: boolean;
}

export function useNotifications(limit = 20) {
  return useQuery({
    queryKey: ["notifications", limit],
    queryFn: () =>
      customFetch<{ notifications: Notification[]; unreadCount: number }>(
        `/api/notifications?limit=${limit}&offset=0`,
      ),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () =>
      customFetch<{ unreadCount: number }>("/api/notifications/unread-count"),
    refetchInterval: 30000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: number) =>
      customFetch(`/api/notifications/${notificationId}/read`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      customFetch("/api/notifications/read-all", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ["notifications", "preferences"],
    queryFn: () =>
      customFetch<NotificationPreference[]>("/api/notifications/preferences"),
  });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (preferences: Array<{ notificationType: string; enabled: boolean }>) =>
      customFetch("/api/notifications/preferences", {
        method: "PUT",
        body: JSON.stringify({ preferences }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", "preferences"] });
    },
  });
}

export function useComments(circleId: number, entityType: string, entityId: number) {
  return useQuery({
    queryKey: ["comments", circleId, entityType, entityId],
    queryFn: () =>
      customFetch<Comment[]>(
        `/api/circles/${circleId}/comments/${entityType}/${entityId}?limit=50&offset=0`,
      ),
    enabled: !!circleId && !!entityId,
  });
}

export function useCreateComment(circleId: number, entityType: string, entityId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { body: string; parentCommentId?: number }) =>
      customFetch<Comment>(
        `/api/circles/${circleId}/comments/${entityType}/${entityId}`,
        { method: "POST", body: JSON.stringify(data) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", circleId, entityType, entityId] });
    },
  });
}

export function useDeleteComment(circleId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId: number) =>
      customFetch(`/api/circles/${circleId}/comments/${commentId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", circleId] });
    },
  });
}

export function useReactions(circleId: number, entityType: string, entityId: number) {
  return useQuery({
    queryKey: ["reactions", circleId, entityType, entityId],
    queryFn: () =>
      customFetch<Reactions>(
        `/api/circles/${circleId}/reactions/${entityType}/${entityId}`,
      ),
    enabled: !!circleId && !!entityId,
  });
}

export function useToggleReaction(circleId: number, entityType: string, entityId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reactionType: string) =>
      customFetch<{ toggled: boolean; reactionType: string }>(
        `/api/circles/${circleId}/reactions/${entityType}/${entityId}`,
        { method: "POST", body: JSON.stringify({ reactionType }) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reactions", circleId, entityType, entityId] });
    },
  });
}

export function useDisputes(circleId: number) {
  return useQuery({
    queryKey: ["disputes", circleId],
    queryFn: () =>
      customFetch<Dispute[]>(`/api/circles/${circleId}/disputes?limit=50&offset=0`),
    enabled: !!circleId,
  });
}

export function useCreateDispute(circleId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { targetEntityType: string; targetEntityId: number; reason: string }) =>
      customFetch<Dispute>(`/api/circles/${circleId}/disputes`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["disputes", circleId] });
    },
  });
}

export function useResolveDispute(circleId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ disputeId, resolution, resolutionNote }: { disputeId: number; resolution: string; resolutionNote: string }) =>
      customFetch<Dispute>(`/api/circles/${circleId}/disputes/${disputeId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ resolution, resolutionNote }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["disputes", circleId] });
    },
  });
}

export function usePlaceholderMembers(circleId: number) {
  return useQuery({
    queryKey: ["placeholder-members", circleId],
    queryFn: () =>
      customFetch<PlaceholderMember[]>(`/api/circles/${circleId}/placeholder-members?limit=100&offset=0`),
    enabled: !!circleId,
  });
}

export function useCreatePlaceholderMember(circleId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { displayName: string; relationship?: string; notes?: string; email?: string }) =>
      customFetch<PlaceholderMember>(`/api/circles/${circleId}/placeholder-members`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["placeholder-members", circleId] });
    },
  });
}

export function useAuditLogs(circleId: number) {
  return useQuery({
    queryKey: ["audit-logs", circleId],
    queryFn: () =>
      customFetch<AuditLog[]>(`/api/circles/${circleId}/audit-logs?limit=50&offset=0`),
    enabled: !!circleId,
  });
}
