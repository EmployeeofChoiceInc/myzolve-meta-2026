import { Link, useLocation } from "wouter";
import { Heart, Home, Users, Bell, Settings, LogOut, Menu, Check, Compass, MessageCircle } from "lucide-react";
import { useClerk, useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUnreadCount, useMessageInbox, useNotifications, useMarkNotificationRead } from "@/hooks/use-api";
import { formatDistanceToNow } from "date-fns";

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
};

function NotificationDrawer() {
  const { data: unreadData } = useUnreadCount();
  const unreadCount = unreadData?.unreadCount ?? 0;
  const { data: notifData } = useNotifications(20);
  const notifications = notifData?.notifications ?? [];
  const markRead = useMarkNotificationRead();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full text-muted-foreground hover:text-foreground">
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
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 transition-colors ${!n.isRead ? "bg-primary/3" : "bg-background"}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${!n.isRead ? "bg-primary" : "bg-transparent"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">
                        {notificationTypeLabel[n.notificationType] ?? n.notificationType}
                      </p>
                      <p className="text-sm font-medium leading-snug">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {!n.isRead && (
                      <button
                        className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                        onClick={() => markRead.mutate(n.id)}
                        title="Mark as read"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
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

  type NavItem = {
    icon: typeof Home;
    label: string;
    href: string;
    badge?: number;
  };

  const navItems: NavItem[] = [
    { icon: Home, label: "Home", href: "/dashboard" },
    { icon: Users, label: "My Circles", href: "/circles" },
    { icon: Compass, label: "Find a Circle", href: "/discover" },
    { icon: MessageCircle, label: "Messages", href: "/messages", badge: unreadMessages },
  ];

  const NavLinks = () => (
    <>
      {navItems.map((item) => (
        <Link key={item.href} href={item.href} className={`relative flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${location.startsWith(item.href) && item.href !== "/dashboard" ? "bg-primary/10 text-primary font-medium" : location === item.href ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
          <div className="relative">
            <item.icon className="w-5 h-5" />
            {(item.badge ?? 0) > 0 && (
              <span className="absolute -top-1 -right-1 h-3.5 min-w-3.5 px-0.5 text-[9px] font-bold flex items-center justify-center rounded-full bg-primary text-primary-foreground">
                {(item.badge ?? 0) > 9 ? "9+" : item.badge}
              </span>
            )}
          </div>
          {item.label}
          {(item.badge ?? 0) > 0 && (
            <Badge className="ml-auto h-4 min-w-4 px-1 text-[10px] rounded-full bg-primary">
              {(item.badge ?? 0) > 9 ? "9+" : item.badge}
            </Badge>
          )}
        </Link>
      ))}
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
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
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
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.primaryEmailAddress?.emailAddress}
                    </p>
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
