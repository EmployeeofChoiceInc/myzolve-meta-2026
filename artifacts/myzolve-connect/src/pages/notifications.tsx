import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNotifications, useMarkNotificationRead, useMarkAllRead, type Notification } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { Link } from "wouter";

const notificationTypeLabel: Record<string, string> = {
  new_request: "New request",
  support_received: "Support received",
  repayment_due: "Return support reminder",
  repayment_received: "Support returned",
  service_match: "Service matched",
  new_comment: "New comment",
  reaction_received: "Reaction",
  gratitude_received: "Gratitude note",
  dispute_opened: "Dispute opened",
  dispute_resolved: "Dispute resolved",
  member_joined: "New member",
  circle_update: "Circle update",
};

function NotificationItem({ notification, onRead }: { notification: Notification; onRead: (id: number) => void }) {
  const entityPath = (() => {
    if (notification.targetEntityType === "support_request" && notification.targetEntityId) {
      return `/requests/${notification.targetEntityId}`;
    }
    if (notification.targetEntityType === "service_post" && notification.targetEntityId) {
      return `/services/${notification.targetEntityId}`;
    }
    return null;
  })();

  const content = (
    <Card className={`rounded-2xl transition-all border-border/50 ${!notification.isRead ? "bg-primary/3 border-primary/20" : "bg-card"}`}>
      <CardContent className="p-4 flex gap-3">
        <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${!notification.isRead ? "bg-primary" : "bg-transparent"}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                {notificationTypeLabel[notification.notificationType] ?? notification.notificationType}
              </p>
              <p className="text-sm font-medium leading-snug">{notification.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notification.body}</p>
            </div>
            {!notification.isRead && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRead(notification.id); }}
              >
                <Check className="w-4 h-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground/60 mt-1.5">
            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
          </p>
        </div>
      </CardContent>
    </Card>
  );

  if (entityPath) {
    return <Link href={entityPath}>{content}</Link>;
  }
  return content;
}

export default function NotificationsPage() {
  const { data, isLoading } = useNotifications(50);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();
  const { toast } = useToast();

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const handleMarkRead = (id: number) => {
    markRead.mutate(id, {
      onError: () => toast({ title: "Failed to mark as read", variant: "destructive" }),
    });
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => toast({ title: "All notifications marked as read" }),
      onError: () => toast({ title: "Failed to mark all as read", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6" />
            Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-sm text-muted-foreground mt-1">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="rounded-full gap-2" onClick={handleMarkAllRead}>
            <CheckCheck className="w-4 h-4" />
            Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-muted/30 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bell className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No notifications yet</p>
          <p className="text-xs mt-1">When something happens in your circles, you'll see it here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n: Notification) => (
            <NotificationItem key={n.id} notification={n} onRead={handleMarkRead} />
          ))}
        </div>
      )}
    </div>
  );
}
