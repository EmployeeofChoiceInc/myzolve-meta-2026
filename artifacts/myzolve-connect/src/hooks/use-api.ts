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
  actingForUserId?: number | null;
  actingForName?: string | null;
  actingForAvatarObjectPath?: string | null;
  copilotReview?: string | null;
  targetEntityType: string;
  targetEntityId: number;
  parentCommentId: number | null;
  body: string;
  status: string;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
  replies?: Comment[];
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
    mutationFn: (data: { body: string; parentCommentId?: number; actingForUserId?: number }) =>
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
      customFetch<AuditLog[]>(`/api/circles/${circleId}/audit?limit=50&offset=0`),
    enabled: !!circleId,
  });
}

export interface Attachment {
  id: number;
  circleId: number;
  uploadedByUserId: number;
  targetEntityType: string;
  targetEntityId: number;
  kind?: "photo" | "voice" | "video";
  fileName: string;
  fileSize: number;
  mimeType: string;
  durationMs?: number | null;
  width?: number | null;
  height?: number | null;
  storageKey: string;
  downloadUrl: string;
  status: string;
  createdAt: string;
}

export function useAttachments(circleId: number, entityType: string, entityId: number) {
  return useQuery({
    queryKey: ["attachments", circleId, entityType, entityId],
    queryFn: () =>
      customFetch<Attachment[]>(`/api/circles/${circleId}/attachments/${entityType}/${entityId}`),
    enabled: !!circleId && !!entityId,
  });
}

export function useRequestUploadUrl() {
  return useMutation({
    mutationFn: (data: { name: string; size: number; contentType: string; circleId: number }) =>
      customFetch<{ uploadURL: string; objectPath: string }>("/api/storage/uploads/request-url", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export function useCreateAttachment(circleId: number, entityType: string, entityId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      kind?: "photo" | "voice" | "video";
      fileName: string;
      fileSize: number;
      mimeType: string;
      storageKey: string;
      durationMs?: number;
      width?: number;
      height?: number;
    }) =>
      customFetch<Attachment>(`/api/circles/${circleId}/attachments/${entityType}/${entityId}`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attachments", circleId, entityType, entityId] });
    },
  });
}

export function useCreateGratitudeNote(circleId: number) {
  return useMutation({
    mutationFn: (data: { message: string; targetEntityType: string; targetEntityId: number; recipientUserIds: number[] }) =>
      customFetch(`/api/circles/${circleId}/gratitude`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  });
}

export interface DiscoverableCircle {
  id: number;
  name: string;
  circleType: string;
  description: string | null;
  currency: string;
  privacyMode: string;
  ownerId: number;
  creatorName: string;
  memberCount: number;
  isMember: boolean;
  joinRequestStatus: string | null;
  createdAt: string;
}

export interface JoinRequest {
  id: number;
  circleId: number;
  userId: number;
  requesterName: string;
  requesterEmail: string | null;
  note: string | null;
  status: string;
  createdAt: string;
}

export function useDiscoverCircles() {
  return useQuery({
    queryKey: ["circles", "discover"],
    queryFn: () => customFetch<DiscoverableCircle[]>("/api/circles/discover"),
  });
}

export function useCreateJoinRequest(circleId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { note?: string }) =>
      customFetch(`/api/circles/${circleId}/join-request`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["circles", "discover"] });
    },
  });
}

export function useJoinRequests(circleId: number, enabled = true) {
  return useQuery({
    queryKey: ["join-requests", circleId],
    queryFn: () =>
      customFetch<JoinRequest[]>(`/api/circles/${circleId}/join-requests`),
    enabled: !!circleId && enabled,
  });
}

export function useApproveJoinRequest(circleId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: number) =>
      customFetch(`/api/circles/${circleId}/join-requests/${requestId}/approve`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["join-requests", circleId] });
      qc.invalidateQueries({ queryKey: [`/api/circles/${circleId}/members`] });
    },
  });
}

export function useDeclineJoinRequest(circleId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: number) =>
      customFetch(`/api/circles/${circleId}/join-requests/${requestId}/decline`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["join-requests", circleId] });
    },
  });
}

export interface CirclePost {
  id: number;
  circleId: number;
  authorUserId: number;
  authorName: string;
  authorAvatarObjectPath: string | null;
  actingForUserId?: number | null;
  actingForName?: string | null;
  actingForAvatarObjectPath?: string | null;
  copilotReview?: string | null;
  title: string | null;
  body: string;
  imageObjectPath: string | null;
  status: string;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionSummary {
  id: number;
  status: "pending" | "accepted" | "declined";
  direction: "incoming" | "outgoing";
}

export interface UserProfile {
  id: number;
  displayName: string;
  firstName: string | null;
  pronouns: string | null;
  bio: string | null;
  location: string | null;
  avatarObjectPath: string | null;
  commonCircleCount: number;
  sharedCircles: Array<{ id: number; name: string; isShared: boolean }>;
  connection: ConnectionSummary | null;
  canMessage: boolean;
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
    mutationFn: (data: { title?: string; body: string; imageObjectPath?: string; actingForUserId?: number }) =>
      customFetch<CirclePost>(`/api/circles/${circleId}/posts`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["circle-posts", circleId] });
    },
  });
}

export function useDeleteCirclePost(circleId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: number) =>
      customFetch(`/api/circles/${circleId}/posts/${postId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["circle-posts", circleId] });
    },
  });
}

export function useUserProfile(userId: number | null) {
  return useQuery({
    queryKey: ["user-profile", userId],
    queryFn: () => customFetch<UserProfile>(`/api/users/${userId}/profile`),
    enabled: !!userId,
  });
}

export interface MeProfile {
  id: number;
  clerkId: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  timezone: string | null;
  bio: string | null;
  location: string | null;
  pronouns: string | null;
  phone: string | null;
  phoneDiscoverable: boolean;
  profileShowCirclesDefault: boolean;
  avatarObjectPath: string | null;
  createdAt: string;
}

export function useMe() {
  return useQuery({
    queryKey: ["/api/me"],
    queryFn: () => customFetch<MeProfile>("/api/me"),
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      data: Partial<
        Pick<
          MeProfile,
          | "displayName"
          | "firstName"
          | "lastName"
          | "timezone"
          | "bio"
          | "location"
          | "avatarObjectPath"
          | "pronouns"
          | "phone"
          | "phoneDiscoverable"
          | "profileShowCirclesDefault"
        >
      >,
    ) =>
      customFetch<MeProfile>("/api/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (updated) => {
      qc.setQueryData(["/api/me"], updated);
    },
  });
}

export function useAvatarUpload() {
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      const { uploadURL, objectPath } = await customFetch<{ uploadURL: string; objectPath: string }>(
        "/api/storage/avatar/request-url",
        {
          method: "POST",
          body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
        },
      );
      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      return objectPath;
    },
  });
}

/**
 * Converts a stored objectPath (e.g. /objects/abc123) to a serving URL via
 * /api/storage/user-media/* — auth-gated, suitable for avatars and wall post images.
 */
export function objectPathToUrl(objectPath: string | null | undefined): string | undefined {
  if (!objectPath) return undefined;
  const stripped = objectPath.startsWith("/objects/") ? objectPath.slice("/objects/".length) : objectPath;
  return `/api/storage/user-media/${stripped}`;
}

export interface DirectMessage {
  id: number;
  senderUserId: number;
  recipientUserId: number;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface MessageThread {
  partnerId: number;
  partnerName: string;
  partnerAvatarObjectPath: string | null;
  lastMessage: {
    id: number;
    body: string;
    senderUserId: number;
    createdAt: string;
  };
  unreadCount: number;
}

export interface ThreadDetail {
  partner: {
    id: number;
    displayName: string;
    avatarObjectPath: string | null;
  };
  messages: DirectMessage[];
}

export function useMessageInbox() {
  return useQuery({
    queryKey: ["messages", "inbox"],
    queryFn: () => customFetch<MessageThread[]>("/api/messages"),
    refetchInterval: 30000,
  });
}

export function useMessageThread(userId: number | null) {
  return useQuery({
    queryKey: ["messages", "thread", userId],
    queryFn: () => customFetch<ThreadDetail>(`/api/messages/${userId}`),
    enabled: !!userId,
    refetchInterval: 15000,
  });
}

export function useSendMessage(partnerId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      customFetch<DirectMessage>(`/api/messages/${partnerId}`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}

export function useMarkThreadRead(partnerId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      customFetch(`/api/messages/${partnerId}/read`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      qc.invalidateQueries({ queryKey: ["notifications", "unread-count"] });
    },
  });
}

export function useCircleMediaUpload(circleId: number) {
  return useMutation({
    mutationFn: async (file: File): Promise<string> => {
      const { uploadURL, objectPath } = await customFetch<{ uploadURL: string; objectPath: string }>(
        "/api/storage/circle-media/request-url",
        {
          method: "POST",
          body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type, circleId }),
        },
      );
      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      return objectPath;
    },
  });
}

// ---------------------------------------------------------------------------
// Plus suite — status, plan management, verification, ledger pro, media
// ---------------------------------------------------------------------------

export type PlusSource = "direct" | "family" | "org" | "comp" | "none";
export type PlanKind = "solo" | "family";

export interface PlusStatus {
  isPlus: boolean;
  source: PlusSource;
  planKind: PlanKind;
  familyCircleId?: number | null;
  familyCircleMemberCount?: number | null;
  familyCircleMemberCap: number;
  gifterUserId?: number | null;
  gifterName?: string | null;
  gifterCircleId?: number | null;
  graceUntil?: string | null;
  orgId?: number | null;
  orgName?: string | null;
  compExpiresAt?: string | null;
}

export const PLUS_STATUS_KEY = ["/api/me/plus-status"] as const;

export function useMyPlusStatus() {
  return useQuery({
    queryKey: PLUS_STATUS_KEY,
    queryFn: () => customFetch<PlusStatus>("/api/me/plus-status"),
    staleTime: 60_000,
  });
}

export function useUpdateMyPlusPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { planKind: PlanKind; familyCircleId?: number | null }) =>
      customFetch<PlusStatus>("/api/me/plus-plan", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (status) => {
      qc.setQueryData(PLUS_STATUS_KEY, status);
      qc.invalidateQueries({ queryKey: ["/api/me"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Admin — complimentary access ("comp") management (program admins only)
// ---------------------------------------------------------------------------

export interface Comp {
  id: number;
  targetType: "user" | "org";
  userId: number | null;
  orgId: number | null;
  userEmail: string | null;
  userName: string | null;
  orgName: string | null;
  reason: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  grantedByUserId: number | null;
  grantedByName: string | null;
  active: boolean;
  createdAt: string;
}

export const COMPS_KEY = ["/api/admin/comps"] as const;

/**
 * Probe that resolves when the caller is a program admin and rejects (403)
 * otherwise. Used to gate the admin page and nav link.
 */
export function useAdminCheck() {
  return useQuery({
    queryKey: ["/api/admin/check"],
    queryFn: () => customFetch<{ ok: boolean }>("/api/admin/check"),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useComps(enabled = true) {
  return useQuery({
    queryKey: COMPS_KEY,
    queryFn: () => customFetch<Comp[]>("/api/admin/comps"),
    enabled,
    retry: false,
  });
}

export function useGrantUserComp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      email: string;
      durationDays?: number | null;
      reason?: string | null;
    }) =>
      customFetch<Comp>("/api/admin/comps/user", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COMPS_KEY });
    },
  });
}

export function useGrantOrgComp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      orgId?: number;
      ownerEmail?: string;
      durationDays?: number | null;
      reason?: string | null;
    }) =>
      customFetch<Comp>("/api/admin/comps/org", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COMPS_KEY });
    },
  });
}

export function useRevokeComp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<Comp>(`/api/admin/comps/${id}/revoke`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: COMPS_KEY });
    },
  });
}

export interface ApplyVerificationBody {
  legalName: string;
  orgType: "nonprofit" | "religious" | "school" | "neighborhood" | "other";
  description: string;
  contactEmail: string;
  supportingUrl?: string | null;
}

export function useApplyCircleVerification(circleId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ApplyVerificationBody) =>
      customFetch(`/api/circles/${circleId}/verification`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["circles"] });
    },
  });
}

// ---- Ledger Pro ----------------------------------------------------------

export interface LedgerProMonth {
  month: number;
  given: number;
  received: number;
  repaid: number;
  forgiven: number;
}

export interface LedgerProPerson {
  userId?: number | null;
  name: string;
  avatarObjectPath?: string | null;
  amount: number;
  count: number;
}

export interface LedgerProView {
  circleId: number;
  circleName: string;
  year: number;
  currency: string;
  totalGiven: number;
  totalReceived: number;
  totalRepaid: number;
  totalForgiven: number;
  netBalance: number;
  entryCount: number;
  months: LedgerProMonth[];
  topSupported: LedgerProPerson[];
  topSupporters: LedgerProPerson[];
  availableYears: number[];
  softMessage: string;
}

export interface LedgerExport {
  circleId: number;
  year: number;
  pdfUrl: string;
  csvUrl: string;
  expiresAt: string;
}

export function useLedgerProYears(circleId: number, enabled = true) {
  return useQuery({
    queryKey: ["ledger-pro-years", circleId],
    queryFn: () =>
      customFetch<{ years: number[]; defaultYear: number }>(
        `/api/circles/${circleId}/ledger/pro/years`,
      ),
    enabled: !!circleId && enabled,
    retry: false,
  });
}

export function useLedgerPro(circleId: number, year: number | null, enabled = true) {
  return useQuery({
    queryKey: ["ledger-pro", circleId, year],
    queryFn: () =>
      customFetch<LedgerProView>(
        `/api/circles/${circleId}/ledger/pro?year=${year}`,
      ),
    enabled: !!circleId && !!year && enabled,
    retry: false,
  });
}

export function useExportLedger(circleId: number) {
  return useMutation({
    mutationFn: (year: number) =>
      customFetch<LedgerExport>(`/api/circles/${circleId}/ledger/export`, {
        method: "POST",
        body: JSON.stringify({ year }),
      }),
  });
}

// ---- Rich media uploads (voice / video) ----------------------------------

export interface RichMediaUploadResult {
  storageKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  durationMs?: number;
}

export function useUploadCircleMedia(circleId: number) {
  return useMutation({
    mutationFn: async (input: { file: File | Blob; fileName: string; mimeType: string }) => {
      const { file, fileName, mimeType } = input;
      const size = file.size;
      const { uploadURL, objectPath } = await customFetch<{
        uploadURL: string;
        objectPath: string;
      }>("/api/storage/circle-media/request-url", {
        method: "POST",
        body: JSON.stringify({ name: fileName, size, contentType: mimeType, circleId }),
      });
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": mimeType },
      });
      if (!putRes.ok) throw new Error("Upload failed");
      return {
        storageKey: objectPath,
        fileName,
        fileSize: size,
        mimeType,
      } satisfies RichMediaUploadResult;
    },
  });
}

export interface MyOwnedCircle {
  id: number;
  name: string;
  ownerId: number;
}

// ── User search / connections / blocks (Task #95) ───────────────────────────

export interface UserSearchResult {
  id: number;
  displayName: string;
  firstName: string | null;
  avatarObjectPath: string | null;
  location: string | null;
  pronouns: string | null;
  connection: ConnectionSummary | null;
}

export interface UserConnection {
  id: number;
  status: "pending" | "accepted" | "declined";
  direction: "incoming" | "outgoing";
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
  otherUser: {
    id: number;
    displayName: string;
    firstName: string | null;
    avatarObjectPath: string | null;
    pronouns: string | null;
  };
}

export interface UserBlock {
  id: number;
  blockedUser: {
    id: number;
    displayName: string;
    avatarObjectPath: string | null;
  };
  createdAt: string;
}

export interface CircleVisibilityEntry {
  circleId: number;
  circleName: string;
  showOnProfile: boolean;
}

export function useSearchUsers(query: string, opts?: { enabled?: boolean }) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ["users-search", trimmed],
    queryFn: () =>
      customFetch<UserSearchResult[]>(
        `/api/users/search?q=${encodeURIComponent(trimmed)}`,
      ),
    enabled: trimmed.length >= 2 && opts?.enabled !== false,
  });
}

export function useMyConnections(
  status: "pending" | "accepted" | "declined" | "all" = "accepted",
  direction: "incoming" | "outgoing" | "both" = "both",
) {
  return useQuery({
    queryKey: ["user-connections", status, direction],
    queryFn: () =>
      customFetch<UserConnection[]>(
        `/api/user-connections?status=${status}&direction=${direction}`,
      ),
  });
}

function invalidateConnectionRelated(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["user-connections"] });
  qc.invalidateQueries({ queryKey: ["user-profile"] });
  qc.invalidateQueries({ queryKey: ["users-search"] });
  qc.invalidateQueries({ queryKey: ["notifications"] });
}

export function useRequestConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ receiverUserId, message }: { receiverUserId: number; message?: string }) =>
      customFetch<UserConnection>("/api/user-connections", {
        method: "POST",
        body: JSON.stringify({ receiverUserId, ...(message ? { message } : {}) }),
      }),
    onSuccess: () => invalidateConnectionRelated(qc),
  });
}

export function useAcceptConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: number) =>
      customFetch<UserConnection>(`/api/user-connections/${connectionId}/accept`, {
        method: "POST",
      }),
    onSuccess: () => invalidateConnectionRelated(qc),
  });
}

export function useDeclineConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: number) =>
      customFetch<UserConnection>(`/api/user-connections/${connectionId}/decline`, {
        method: "POST",
      }),
    onSuccess: () => invalidateConnectionRelated(qc),
  });
}

export function useRemoveConnection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: number) =>
      customFetch(`/api/user-connections/${connectionId}`, { method: "DELETE" }),
    onSuccess: () => invalidateConnectionRelated(qc),
  });
}

export function useMyBlocks() {
  return useQuery({
    queryKey: ["user-blocks"],
    queryFn: () => customFetch<UserBlock[]>("/api/user-blocks"),
  });
}

export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) =>
      customFetch<UserBlock>(`/api/user-blocks/${userId}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-blocks"] });
      invalidateConnectionRelated(qc);
    },
  });
}

export function useUnblockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) =>
      customFetch(`/api/user-blocks/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-blocks"] });
      invalidateConnectionRelated(qc);
    },
  });
}

export function useMyCircleVisibility() {
  return useQuery({
    queryKey: ["my-circle-visibility"],
    queryFn: () =>
      customFetch<CircleVisibilityEntry[]>("/api/me/circle-visibility"),
  });
}

export function useUpdateCircleVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ circleId, showOnProfile }: { circleId: number; showOnProfile: boolean }) =>
      customFetch<{ circleId: number; showOnProfile: boolean }>(
        `/api/me/circles/${circleId}/visibility`,
        { method: "PATCH", body: JSON.stringify({ showOnProfile }) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-circle-visibility"] });
      qc.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });
}

// --- Circle Builder Program (100 Circle Initiative) ---

export interface CircleBuilderApplicationInput {
  name: string;
  email: string;
  location: string;
  communityServed: string;
  networkSize: string;
  motivation: string;
  desiredImpact: string;
  willingToHost: boolean;
}

export interface CircleBuilderApplication extends CircleBuilderApplicationInput {
  id: number;
  status: "pending" | "approved" | "declined";
  reviewedByUserId: number | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export function useSubmitCircleBuilderApplication() {
  return useMutation({
    mutationFn: (input: CircleBuilderApplicationInput) =>
      customFetch<{ id: number }>("/api/circle-builder/applications", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

export function useCircleBuilderApplications(enabled = true) {
  return useQuery({
    queryKey: ["circle-builder-applications"],
    queryFn: () =>
      customFetch<CircleBuilderApplication[]>(
        "/api/circle-builder/applications",
      ),
    enabled,
  });
}

export function useReviewCircleBuilderApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      reviewNote,
    }: {
      id: number;
      status: "pending" | "approved" | "declined";
      reviewNote?: string | null;
    }) =>
      customFetch<CircleBuilderApplication>(
        `/api/circle-builder/applications/${id}`,
        { method: "PATCH", body: JSON.stringify({ status, reviewNote }) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["circle-builder-applications"] });
    },
  });
}

// ── Reunion Home ──────────────────────────────────────────────────────────────

export interface OrgHomeOrg {
  id: number;
  name: string;
  status: string;
  isActive: boolean;
  comped: boolean;
  planName: string;
  accentColor: string | null;
  logoUrl: string | null;
  welcomeMessage: string | null;
  coverImageUrl: string | null;
  heroEventDate: string | null;
  seatLimit: number;
  seatsUsed: number | null;
  myRole: string | null;
}

export interface OrgAnnouncement {
  id: number;
  title: string | null;
  body: string;
  createdAt: string;
  authorName: string | null;
  authorAvatarObjectPath: string | null;
}

export interface OrgEventRsvpCounts {
  going: number;
  maybe: number;
  cant: number;
}

export interface OrgEventRsvpAttendee {
  userId: number;
  displayName: string | null;
  avatarObjectPath: string | null;
  status: "going" | "maybe" | "cant";
}

export interface OrgEvent {
  id: number;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  rsvpCounts: OrgEventRsvpCounts;
  myRsvp: "going" | "maybe" | "cant" | null;
  rsvps: OrgEventRsvpAttendee[];
}

export interface OrgHomeCircle {
  id: number;
  name: string;
  description: string | null;
  privacyMode: string;
  accentColor: string | null;
  memberCount: number;
  isMember: boolean;
}

export interface OrgMainCirclePost {
  id: number;
  authorName: string | null;
  authorAvatarObjectPath: string | null;
  title: string | null;
  body: string;
  imageObjectPath: string | null;
  createdAt: string;
}

export interface OrgMainCircleCareDate {
  id: number;
  name: string;
  kind: string;
  eventDate: string;
  nextOccurrence: string;
  isAnnual: boolean;
}

export interface OrgMainCircle {
  id: number;
  name: string;
  memberCount: number;
  recentPosts: OrgMainCirclePost[];
  upcomingCareDates: OrgMainCircleCareDate[];
}

export interface OrgHomeMember {
  userId: number;
  role: string;
  displayName: string | null;
  avatarObjectPath: string | null;
}

export interface OrgHome {
  org: OrgHomeOrg;
  canManage: boolean;
  announcements: OrgAnnouncement[];
  events: OrgEvent[];
  mainCircle: OrgMainCircle;
  subCircles: OrgHomeCircle[];
  memberCount: number;
  members: OrgHomeMember[];
}

function orgHomeKey(orgId: number) {
  return ["org-home", orgId] as const;
}

export function useOrgHome(orgId: number) {
  return useQuery({
    queryKey: orgHomeKey(orgId),
    queryFn: () => customFetch<OrgHome>(`/api/orgs/${orgId}/home`),
    enabled: Number.isFinite(orgId) && orgId > 0,
    retry: false,
  });
}

export function useCreateSubCircle(orgId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string | null;
      accentColor?: string | null;
    }) =>
      customFetch<OrgHomeCircle>(`/api/orgs/${orgId}/circles`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgHomeKey(orgId) });
    },
  });
}

export function useRsvpOrgEvent(orgId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { eventId: number; status: "going" | "maybe" | "cant" }) =>
      customFetch<{
        eventId: number;
        myRsvp: "going" | "maybe" | "cant";
        rsvpCounts: OrgEventRsvpCounts;
      }>(`/api/orgs/${orgId}/events/${data.eventId}/rsvp`, {
        method: "POST",
        body: JSON.stringify({ status: data.status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgHomeKey(orgId) });
    },
  });
}

export function useUpdateOrgProfile(orgId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name?: string;
      accentColor?: string | null;
      logoObjectPath?: string | null;
      coverImageObjectPath?: string | null;
      welcomeMessage?: string | null;
      heroEventDate?: string | null;
    }) =>
      customFetch(`/api/orgs/${orgId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgHomeKey(orgId) });
    },
  });
}

export function usePostOrgAnnouncement(orgId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title?: string | null; body: string }) =>
      customFetch<OrgAnnouncement>(`/api/orgs/${orgId}/announcements`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgHomeKey(orgId) });
    },
  });
}

export function useDeleteOrgAnnouncement(orgId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (announcementId: number) =>
      customFetch(`/api/orgs/${orgId}/announcements/${announcementId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgHomeKey(orgId) });
    },
  });
}

export function usePostOrgEvent(orgId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string | null;
      location?: string | null;
      startsAt: string;
      endsAt?: string | null;
    }) =>
      customFetch<OrgEvent>(`/api/orgs/${orgId}/events`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgHomeKey(orgId) });
    },
  });
}

export function useDeleteOrgEvent(orgId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: number) =>
      customFetch(`/api/orgs/${orgId}/events/${eventId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orgHomeKey(orgId) });
    },
  });
}
