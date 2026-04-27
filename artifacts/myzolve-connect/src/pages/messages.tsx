import { useEffect, useRef, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import {
  useMessageInbox,
  useMessageThread,
  useSendMessage,
  useMarkThreadRead,
  useMe,
  useMyBlocks,
  useBlockUser,
  useUnblockUser,
  objectPathToUrl,
} from "@/hooks/use-api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, formatDistanceToNow, isToday } from "date-fns";
import { Send, ArrowLeft, MessageCircle, MoreVertical, ShieldOff, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatMsgTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "h:mm a");
  return formatDistanceToNow(d, { addSuffix: true });
}

function InboxItem({ thread, isActive }: { thread: import("@/hooks/use-api").MessageThread; isActive: boolean }) {
  const avatarUrl = objectPathToUrl(thread.partnerAvatarObjectPath);
  return (
    <Link href={`/messages/${thread.partnerId}`}>
      <div className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-colors ${isActive ? "bg-primary/10" : "hover:bg-muted"}`}>
        <Avatar className="w-10 h-10 shrink-0">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
            {thread.partnerName[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-sm font-medium truncate ${thread.unreadCount > 0 ? "text-foreground" : "text-foreground/80"}`}>
              {thread.partnerName}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {formatMsgTime(thread.lastMessage.createdAt)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className={`text-xs truncate ${thread.unreadCount > 0 ? "text-foreground/90 font-medium" : "text-muted-foreground"}`}>
              {thread.lastMessage.body}
            </p>
            {thread.unreadCount > 0 && (
              <Badge className="h-4 min-w-4 px-1 text-[10px] rounded-full bg-primary shrink-0">
                {thread.unreadCount}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function ThreadView({ partnerId, myId }: { partnerId: number; myId: number }) {
  const { data, isLoading } = useMessageThread(partnerId);
  const sendMessage = useSendMessage(partnerId);
  const markRead = useMarkThreadRead(partnerId);
  const { data: myBlocks } = useMyBlocks();
  const blockMut = useBlockUser();
  const unblockMut = useUnblockUser();
  const isBlockedByMe = !!myBlocks?.some((b) => b.blockedUser.id === partnerId);
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Mark thread as read when opened
  useEffect(() => {
    markRead.mutate();
  }, [partnerId]);

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages]);

  function handleSend() {
    const trimmed = body.trim();
    if (!trimmed) return;
    sendMessage.mutate(trimmed, {
      onSuccess: () => setBody(""),
      onError: () => toast({ title: "Could not send message. Please try again.", variant: "destructive" }),
    });
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col p-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className={`h-10 w-3/4 rounded-2xl ${i % 2 === 0 ? "" : "self-end"}`} />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center text-muted-foreground">
        <div>
          <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Could not load conversation.</p>
          <p className="text-xs mt-1">You may not share a circle with this person.</p>
        </div>
      </div>
    );
  }

  const { partner, messages } = data;
  const avatarUrl = objectPathToUrl(partner.avatarObjectPath);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Thread header */}
      <div className="flex items-center gap-3 p-4 border-b bg-card/50">
        <Link href="/messages" className="md:hidden">
          <Button variant="ghost" size="icon" className="rounded-full w-8 h-8 mr-1">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <Avatar className="w-9 h-9">
          <AvatarImage src={avatarUrl} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
            {partner.displayName[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <Link href={`/profile/${partner.id}`}>
          <span className="font-semibold hover:underline cursor-pointer">{partner.displayName}</span>
        </Link>
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full w-8 h-8"
                data-testid="button-thread-menu"
                aria-label="Conversation options"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isBlockedByMe ? (
                <DropdownMenuItem
                  data-testid={`button-unblock-${partner.id}`}
                  onClick={() =>
                    unblockMut.mutate(partner.id, {
                      onSuccess: () =>
                        toast({ title: `${partner.displayName} unblocked` }),
                      onError: () =>
                        toast({
                          title: "Could not unblock. Please try again.",
                          variant: "destructive",
                        }),
                    })
                  }
                >
                  <ShieldOff className="w-4 h-4 mr-2" />
                  Unblock {partner.displayName}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  data-testid={`button-block-${partner.id}`}
                  className="text-destructive focus:text-destructive"
                  onClick={() => {
                    if (
                      !window.confirm(
                        `Block ${partner.displayName}? They won't be able to message or comment on your posts.`,
                      )
                    )
                      return;
                    blockMut.mutate(partner.id, {
                      onSuccess: () =>
                        toast({ title: `${partner.displayName} blocked` }),
                      onError: () =>
                        toast({
                          title: "Could not block. Please try again.",
                          variant: "destructive",
                        }),
                    });
                  }}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Block {partner.displayName}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12">
            <MessageCircle className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm font-medium">Start the conversation</p>
            <p className="text-xs mt-1">Say hello to {partner.displayName}</p>
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.senderUserId === myId;
          return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                isMine
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted text-foreground rounded-bl-md"
              }`}>
                <p>{msg.body}</p>
                <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/60 text-right" : "text-muted-foreground"}`}>
                  {formatMsgTime(msg.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className="p-3 border-t bg-card/50">
        <div className="flex items-end gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`Message ${partner.displayName}…`}
            className="resize-none rounded-2xl text-sm min-h-[40px] max-h-32"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            size="icon"
            className="rounded-full shrink-0 w-10 h-10"
            onClick={handleSend}
            disabled={!body.trim() || sendMessage.isPending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const params = useParams<{ userId?: string }>();
  const activeParnerId = params.userId ? parseInt(params.userId) : null;
  const [, navigate] = useLocation();
  const { data: threads, isLoading: inboxLoading } = useMessageInbox();
  const { data: me } = useMe();
  const myId = me?.id ?? 0;

  const hasThread = activeParnerId !== null;

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Messages</h1>
        <p className="text-muted-foreground text-sm mt-1">Private conversations with circle members</p>
      </div>

      <div className="flex h-[calc(100dvh-220px)] min-h-[400px] border rounded-3xl overflow-hidden bg-card shadow-none">
        {/* Inbox sidebar */}
        <div className={`w-full md:w-[300px] shrink-0 border-r flex flex-col ${hasThread ? "hidden md:flex" : "flex"}`}>
          <div className="p-4 border-b">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Conversations</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {inboxLoading ? (
              <div className="space-y-2 p-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-28 rounded" />
                      <Skeleton className="h-3 w-40 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : threads && threads.length > 0 ? (
              threads.map((t) => (
                <InboxItem key={t.partnerId} thread={t} isActive={t.partnerId === activeParnerId} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
                <MessageCircle className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm font-medium">No messages yet</p>
                <p className="text-xs mt-1">Open a member profile to start a conversation</p>
              </div>
            )}
          </div>
        </div>

        {/* Thread panel */}
        <div className={`flex-1 flex flex-col min-w-0 ${hasThread ? "flex" : "hidden md:flex"}`}>
          {activeParnerId && myId ? (
            <ThreadView partnerId={activeParnerId} myId={myId} />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
              <MessageCircle className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-medium">Select a conversation</p>
              <p className="text-sm mt-1">Choose from the left, or open a member profile and tap Message</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
