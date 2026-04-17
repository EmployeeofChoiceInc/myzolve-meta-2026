import { customFetch } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

export interface DirectMessage {
  id: number;
  senderUserId: number;
  recipientUserId: number;
  body: string;
  createdAt: string;
  readAt: string | null;
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

export function useMarkThreadRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (partnerId: number) =>
      customFetch(`/api/messages/${partnerId}/read`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
