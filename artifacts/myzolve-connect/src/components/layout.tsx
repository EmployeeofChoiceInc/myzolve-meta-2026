import { Link, useLocation } from "wouter";
import { Heart, Home, Users, Bell, Settings, LogOut, Menu, Check, Compass, MessageCircle, Star, Flag, X as XIcon, UserPlus2, Search, Building2 } from "lucide-react";
import { useClerk, useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useUnreadCount,
  useMessageInbox,
  useNotifications,
  useMarkNotificationRead,
  useMyPlusStatus,
  useAcceptConnection,
  useDeclineConnection,
  type Notification,
} from "@/hooks/use-api";
import { PlusBadge } from "@/components/plus-badge";
import { displayEmail } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  useReviewCopilotPost,
  useAcceptCopilotGrant,
  useDeclineCopilotGrant,
  getListNotificationsQueryKey,
  getGetNotificationUnreadCountQueryKey,
  getGetLatestWrapupQueryKey,
  getListCopilotGrantsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const notificationTypeLabel: Record<string, string> = {
  new_contribution: "Support received",
  repayment_logged: "Return logged",
  request_completed: "Request completed",
  new_comment: "New comment",
  reaction_received: "Reaction",
  dispute_opened: "Dispute opened",
  dispute_resolved: "Dispute resolved",
  member_joined: "Member joined",
  circle_invitation: "Circle invitation",
  ownership_transferred: "Ownership transferred",
  direct_message: "New message",
  copilot_invite_received: "Co-pilot invitation",
  copilot_post_made: "Posted on your behalf",
  wrapup_weekly: "Weekly wrap-up",
  wrapup_monthly: "Monthly wrap-up",
  connection_request_received: "Connection request",
  connection_request_accepted: "Connected",
};

const COPILOT_ENTITY_TYPES = new Set([
  "support_request",
  "comment",
  "gratitude_note",
  "circle_post",
]);
type CopilotEntityType =
  | "support_request"
  | "comment"
  | "gratitude_note"
  | "circle_post";

function NotificationDrawer() {
  const { data: unreadData } = useUnreadCount();
  const unreadCount = unreadData?.unreadCount ?? 0;
  const { data: notifData } = useNotifications(20);
  const notifications = notifData?.notifications ?? [];
  const markRead = useMarkNotificationRead();
  const review = useReviewCopilotPost();
  const acceptGrant = useAcceptCopilotGrant();
  const declineGrant = useDeclineCopilotGrant();
  const acceptConnection = useAcceptConnection();
  const declineConnection = useDeclineConnection();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [reviewing, setReviewing] = useState<{
    id: number;
    decision: "approved" | "flagged";
  } | null>(null);
  const [respondingGrantNotifId, setRespondingGrantNotifId] = useState<number | null>(null);
  const [respondingConnNotifId, setRespondingConnNotifId] = useState<number | null>(null);

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetNotificationUnreadCountQueryKey() });
  }

  function respondToInvite(notification: Notification, action: "accept" | "decline") {
    const grantId = notification.targetEntityId;
    if (!grantId) {
      setLocation("/settings");
      return;
    }
    setRespondingGrantNotifId(notification.id);
    const mutation = action === "accept" ? acceptGrant : declineGrant;
    mutation.mutate(
      { grantId },
      {
        onSuccess: () => {
          markRead.mutate(notification.id, { onSuccess: invalidateAll });
          qc.invalidateQueries({ queryKey: getListCopilotGrantsQueryKey() });
          setRespondingGrantNotifId(null);
          toast({
            title: action === "accept" ? "Invitation accepted" : "Invitation declined",
            description:
              action === "accept"
                ? "You can now post on their behalf."
                : "We let them know.",
          });
        },
        onError: () => {
          setRespondingGrantNotifId(null);
          toast({
            title:
              action === "accept"
                ? "Could not accept invitation."
                : "Could not decline invitation.",
            variant: "destructive",
          });
        },
      },
    );
  }

  function handleTap(n: Notification) {
    if (!n.isRead) {
      markRead.mutate(n.id, { onSuccess: invalidateAll });
    }
    if (n.notificationType === "copilot_invite_received") {
      setLocation("/settings");
      return;
    }
    if (
      n.notificationType === "connection_request_received" ||
      n.notificationType === "connection_request_accepted"
    ) {
      setLocation("/connections");
      return;
    }
    if (n.notificationType === "wrapup_weekly") {
      setLocation("/wrapup");
      qc.invalidateQueries({ queryKey: getGetLatestWrapupQueryKey({ kind: "weekly" }) });
      return;
    }
    if (n.notificationType === "wrapup_monthly") {
      setLocation("/wrapup?kind=monthly");
      qc.invalidateQueries({ queryKey: getGetLatestWrapupQueryKey({ kind: "monthly" }) });
      return;
    }
    if (n.targetEntityType === "support_request" && n.targetEntityId) {
      setLocation(`/requests/${n.targetEntityId}`);
    } else if (n.targetEntityType === "circle" && n.targetEntityId) {
      setLocation(`/circles/${n.targetEntityId}`);
    } else if (
      (n.targetEntityType === "circle_post" || n.targetEntityType === "comment") &&
      n.circleId
    ) {
      setLocation(`/circles/${n.circleId}/wall`);
    } else if (n.targetEntityType === "gratitude_note" && n.circleId) {
      setLocation(`/circles/${n.circleId}`);
    }
  }

  function submitReview(
    notificationId: number,
    entityType: CopilotEntityType,
    entityId: number,
    decision: "approved" | "flagged",
  ) {
    setReviewing({ id: notificationId, decision });
    review.mutate(
      { entityType, entityId, data: { review: decision } },
      {
        onSuccess: () => {
          markRead.mutate(notificationId, { onSuccess: invalidateAll });
          setReviewing(null);
          toast({
            title: decision === "approved" ? "Approved" : "Flagged",
            description:
              decision === "approved"
                ? "Thanks — the post stays as-is."
                : "Got it — the post has been flagged for review.",
          });
        },
        onError: () => {
          setReviewing(null);
          toast({ title: "Could not save review.", variant: "destructive" });
        },
      },
    );
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full text-muted-foreground hover:text-foreground"
          data-tutorial-target="nav-notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center rounded-full bg-orange-500 border-card border-2">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[340px] sm:w-[400px] p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="flex items-center justify-between">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="rounded-full">{unreadCount} new</Badge>
            )}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Bell className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">You're all caught up.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {notifications.map((n) => {
                const isCopilotPost =
                  n.notificationType === "copilot_post_made" &&
                  !!n.targetEntityType &&
                  COPILOT_ENTITY_TYPES.has(n.targetEntityType) &&
                  !!n.targetEntityId;
                const isCopilotInvite =
                  n.notificationType === "copilot_invite_received" &&
                  !!n.targetEntityId;
                const isConnectionRequest =
                  n.notificationType === "connection_request_received" &&
                  !!n.targetEntityId;
                const isReviewing = reviewing?.id === n.id;
                const isRespondingInvite = respondingGrantNotifId === n.id;
                const isRespondingConn = respondingConnNotifId === n.id;
                return (
                  <div
                    key={n.id}
                    className={`p-4 transition-colors ${!n.isRead ? "bg-primary/3" : "bg-background"}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${!n.isRead ? "bg-primary" : "bg-transparent"}`} />
                      <div className="flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => handleTap(n)}
                          className="text-left w-full"
                          data-testid={`notification-tap-${n.id}`}
                        >
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">
                            {notificationTypeLabel[n.notificationType] ?? n.notificationType}
                          </p>
                          <p className="text-sm font-medium leading-snug">{n.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </p>
                        </button>
                        {isCopilotPost && (
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full h-8 text-xs gap-1"
                              disabled={isReviewing}
                              onClick={() =>
                                submitReview(
                                  n.id,
                                  n.targetEntityType as CopilotEntityType,
                                  n.targetEntityId!,
                                  "approved",
                                )
                              }
                              data-testid={`copilot-approve-${n.id}`}
                            >
                              <Check className="w-3 h-3" />
                              Looks good
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full h-8 text-xs gap-1 text-destructive hover:text-destructive"
                              disabled={isReviewing}
                              onClick={() =>
                                submitReview(
                                  n.id,
                                  n.targetEntityType as CopilotEntityType,
                                  n.targetEntityId!,
                                  "flagged",
                                )
                              }
                              data-testid={`copilot-flag-${n.id}`}
                            >
                              <Flag className="w-3 h-3" />
                              Flag
                            </Button>
                          </div>
                        )}
                        {isCopilotInvite && (
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              className="rounded-full h-8 text-xs gap-1"
                              disabled={isRespondingInvite}
                              onClick={() => respondToInvite(n, "accept")}
                              data-testid={`copilot-accept-invite-${n.id}`}
                            >
                              <Check className="w-3 h-3" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full h-8 text-xs gap-1 text-muted-foreground"
                              disabled={isRespondingInvite}
                              onClick={() => respondToInvite(n, "decline")}
                              data-testid={`copilot-decline-invite-${n.id}`}
                            >
                              <XIcon className="w-3 h-3" />
                              Decline
                            </Button>
                          </div>
                        )}
                        {isConnectionRequest && (
                          <div className="flex gap-2 mt-3">
                            <Button
                              size="sm"
                              className="rounded-full h-8 text-xs gap-1"
                              disabled={isRespondingConn}
                              onClick={() => {
                                setRespondingConnNotifId(n.id);
                                acceptConnection.mutate(n.targetEntityId!, {
                                  onSuccess: () => {
                                    markRead.mutate(n.id, { onSuccess: invalidateAll });
                                    setRespondingConnNotifId(null);
                                    toast({ title: "You're now connected" });
                                  },
                                  onError: () => {
                                    setRespondingConnNotifId(null);
                                    toast({ title: "Could not accept", variant: "destructive" });
                                  },
                                });
                              }}
                              data-testid={`connection-accept-${n.id}`}
                            >
                              <Check className="w-3 h-3" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full h-8 text-xs gap-1 text-muted-foreground"
                              disabled={isRespondingConn}
                              onClick={() => {
                                setRespondingConnNotifId(n.id);
                                declineConnection.mutate(n.targetEntityId!, {
                                  onSuccess: () => {
                                    markRead.mutate(n.id, { onSuccess: invalidateAll });
                                    setRespondingConnNotifId(null);
                                    toast({ title: "Request declined" });
                                  },
                                  onError: () => {
                                    setRespondingConnNotifId(null);
                                    toast({ title: "Could not decline", variant: "destructive" });
                                  },
                                });
                              }}
                              data-testid={`connection-decline-${n.id}`}
                            >
                              <XIcon className="w-3 h-3" />
                              Decline
                            </Button>
                          </div>
                        )}
                      </div>
                      {!n.isRead && (
                        <button
                          className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                          onClick={() => markRead.mutate(n.id, { onSuccess: invalidateAll })}
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { user } = useUser();
  const { data: inbox } = useMessageInbox();
  const unreadMessages = (inbox ?? []).reduce((acc, t) => acc + t.unreadCount, 0);
  const { data: plusStatus } = useMyPlusStatus();
  const isPlus = !!plusStatus?.isPlus;

  type NavItem = {
    icon: typeof Home;
    label: string;
    href: string;
    badge?: number;
    plus?: boolean;
  };

  const navItems: NavItem[] = [
    { icon: Home, label: "Home", href: "/dashboard" },
    { icon: Users, label: "My Circles", href: "/circles" },
    { icon: Compass, label: "Find a Circle", href: "/discover" },
    { icon: Search, label: "Find People", href: "/find-people" },
    { icon: UserPlus2, label: "Connections", href: "/connections" },
    { icon: MessageCircle, label: "Messages", href: "/messages", badge: unreadMessages },
    { icon: Star, label: "Plus", href: "/plus", plus: true },
    { icon: Building2, label: "Organizations", href: "/orgs" },
  ];

  const NavLinks = () => (
    <>
      {navItems.map((item) => {
        const active =
          (location.startsWith(item.href) && item.href !== "/dashboard") ||
          location === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
              active
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            data-testid={`nav-${item.href.replace(/\//g, "")}`}
            data-tutorial-target={
              item.href === "/dashboard" ? "nav-dashboard" : undefined
            }
          >
            <div className="relative">
              <item.icon className={`w-5 h-5 ${item.plus ? "text-[#B47A2A]" : ""}`} />
              {(item.badge ?? 0) > 0 && (
                <span className="absolute -top-1 -right-1 h-3.5 min-w-3.5 px-0.5 text-[9px] font-bold flex items-center justify-center rounded-full bg-primary text-primary-foreground">
                  {(item.badge ?? 0) > 9 ? "9+" : item.badge}
                </span>
              )}
            </div>
            {item.label}
            {item.plus && isPlus ? <PlusBadge size="sm" className="ml-auto" /> : null}
            {(item.badge ?? 0) > 0 && (
              <Badge className="ml-auto h-4 min-w-4 px-1 text-[10px] rounded-full bg-primary">
                {(item.badge ?? 0) > 9 ? "9+" : item.badge}
              </Badge>
            )}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 border-b bg-card">
        <Link href="/dashboard" className="flex items-center gap-2 text-primary font-semibold text-lg">
          <Heart className="w-6 h-6 fill-current" />
          MyZolve Connect
        </Link>
        <div className="flex items-center gap-2">
          <NotificationDrawer />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] sm:w-[320px] p-6 bg-card border-r-0">
              <nav className="flex flex-col gap-2 mt-8">
                <NavLinks />
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-[280px] shrink-0 border-r bg-card p-6">
        <Link href="/dashboard" className="flex items-center gap-2 text-primary font-semibold text-xl mb-10 px-2">
          <Heart className="w-7 h-7 fill-current" />
          MyZolve Connect
        </Link>
        <nav className="flex flex-col gap-2 flex-1">
          <NavLinks />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full">
        {/* Top bar for desktop with user menu */}
        <header className="hidden md:flex items-center justify-end p-6">
          <div className="flex items-center gap-4">
            <NotificationDrawer />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-10 w-10 rounded-full"
                  data-tutorial-target="nav-settings"
                >
                  <Avatar className="h-10 w-10 border border-muted">
                    <AvatarImage src={user?.imageUrl} alt={user?.fullName || "User"} />
                    <AvatarFallback className="bg-primary/10 text-primary">{user?.firstName?.charAt(0) || "U"}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.fullName}</p>
                    {displayEmail(user?.primaryEmailAddress?.emailAddress) ? (
                      <p className="text-xs leading-none text-muted-foreground">
                        {displayEmail(user?.primaryEmailAddress?.emailAddress)}
                      </p>
                    ) : null}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="cursor-pointer w-full flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        
        <div className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
