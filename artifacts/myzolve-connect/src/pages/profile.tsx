import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import {
  useUserProfile,
  objectPathToUrl,
  useRequestConnection,
  useAcceptConnection,
  useDeclineConnection,
  useRemoveConnection,
  useBlockUser,
  useUnblockUser,
  useMyBlocks,
  useMe,
} from "@/hooks/use-api";
import {
  ArrowLeft,
  MapPin,
  Users,
  Calendar,
  MessageCircle,
  UserPlus,
  Check,
  Clock,
  MoreHorizontal,
  Shield,
  ShieldOff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const targetUserId = parseInt(userId!);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: me } = useMe();
  const { data: profile, isLoading, isError } = useUserProfile(
    isNaN(targetUserId) ? null : targetUserId,
  );
  const { data: myBlocks } = useMyBlocks();

  const requestConnection = useRequestConnection();
  const acceptConnection = useAcceptConnection();
  const declineConnection = useDeclineConnection();
  const removeConnection = useRemoveConnection();
  const blockUser = useBlockUser();
  const unblockUser = useUnblockUser();

  const [connectMessage, setConnectMessage] = useState("");
  const [connectOpen, setConnectOpen] = useState(false);
  const [confirmBlockOpen, setConfirmBlockOpen] = useState(false);
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);

  const isMe = me?.id === targetUserId;
  const isBlockedByMe = !!myBlocks?.some((b) => b.blockedUser.id === targetUserId);

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-500">
        <Skeleton className="h-8 w-32 rounded-xl" />
        <Card className="rounded-3xl border-border/50 shadow-none">
          <CardContent className="p-8 space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="w-20 h-20 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <Skeleton className="h-16 w-full rounded-xl" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-500">
        <Button variant="ghost" className="rounded-full gap-2" onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <Card className="rounded-3xl border-border/50 shadow-none">
          <CardContent className="p-8 text-center text-muted-foreground">
            <p className="font-medium">Profile not available</p>
            <p className="text-sm mt-1">
              We couldn't load this profile. They may have removed their account.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const initials = profile.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const avatarSrc = objectPathToUrl(profile.avatarObjectPath);
  const conn = profile.connection;

  // Renders the primary connection action button next to Message.
  function renderConnectButton() {
    if (isMe) return null;
    if (!conn) {
      return (
        <Button
          className="rounded-full gap-2 mb-1"
          onClick={() => setConnectOpen(true)}
          disabled={requestConnection.isPending}
          data-testid="button-connect"
        >
          <UserPlus className="w-4 h-4" /> Connect
        </Button>
      );
    }
    if (conn.status === "pending" && conn.direction === "outgoing") {
      return (
        <Button
          variant="outline"
          className="rounded-full gap-2 mb-1"
          onClick={() => removeConnection.mutate(conn.id, {
            onSuccess: () => toast({ title: "Request canceled" }),
          })}
          data-testid="button-cancel-request"
        >
          <Clock className="w-4 h-4" /> Pending
        </Button>
      );
    }
    if (conn.status === "pending" && conn.direction === "incoming") {
      return (
        <div className="flex gap-2 mb-1">
          <Button
            className="rounded-full gap-2"
            onClick={() => acceptConnection.mutate(conn.id, {
              onSuccess: () => toast({ title: "You're now connected" }),
            })}
            data-testid="button-accept-request"
          >
            <Check className="w-4 h-4" /> Accept
          </Button>
          <Button
            variant="outline"
            className="rounded-full gap-2"
            onClick={() => declineConnection.mutate(conn.id)}
            data-testid="button-decline-request"
          >
            <X className="w-4 h-4" /> Decline
          </Button>
        </div>
      );
    }
    if (conn.status === "accepted") {
      return (
        <Button
          variant="outline"
          className="rounded-full gap-2 mb-1"
          onClick={() => setConfirmDisconnectOpen(true)}
          data-testid="button-connected"
        >
          <Check className="w-4 h-4" /> Connected
        </Button>
      );
    }
    return null;
  }

  return (
    <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-500">
      <Button
        variant="ghost"
        className="rounded-full gap-2 -ml-2"
        onClick={() => window.history.back()}
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </Button>

      <Card className="rounded-3xl border-border/50 shadow-none overflow-hidden">
        <div className="h-20 bg-gradient-to-br from-primary/20 to-secondary/20" />
        <CardContent className="p-6 pt-0">
          <div className="flex items-end justify-between gap-4 -mt-10 mb-4 flex-wrap">
            <Avatar className="w-20 h-20 border-4 border-background shadow-sm">
              {avatarSrc && <AvatarImage src={avatarSrc} alt={profile.displayName} />}
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-2 flex-wrap">
              {renderConnectButton()}
              {!isMe && profile.canMessage && (
                <Button
                  className="rounded-full gap-2 mb-1"
                  variant="outline"
                  onClick={() => navigate(`/messages/${profile.id}`)}
                  data-testid="button-message"
                >
                  <MessageCircle className="w-4 h-4" />
                  Message
                </Button>
              )}
              {!isMe && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full mb-1"
                      data-testid="button-profile-menu"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-2xl">
                    {isBlockedByMe ? (
                      <DropdownMenuItem
                        onClick={() => unblockUser.mutate(profile.id, {
                          onSuccess: () => toast({ title: "User unblocked" }),
                        })}
                        data-testid="menuitem-unblock"
                      >
                        <ShieldOff className="w-4 h-4 mr-2" /> Unblock
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem
                          onClick={() => setConfirmBlockOpen(true)}
                          className="text-destructive focus:text-destructive"
                          data-testid="menuitem-block"
                        >
                          <Shield className="w-4 h-4 mr-2" /> Block
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled>
                          Report (coming soon)
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground">
                  {profile.displayName}
                </h1>
                {profile.pronouns && (
                  <span className="text-sm text-muted-foreground">
                    ({profile.pronouns})
                  </span>
                )}
              </div>
              {profile.firstName && (
                <p className="text-muted-foreground text-sm">{profile.firstName}</p>
              )}
            </div>

            {profile.bio && (
              <p className="text-sm text-foreground/80 leading-relaxed">{profile.bio}</p>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {profile.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> {profile.location}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Member since {format(new Date(profile.memberSince), "MMMM yyyy")}
              </span>
            </div>

            {profile.sharedCircles.length > 0 && (
              <div className="pt-2 space-y-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Circles
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.sharedCircles.map((c) => (
                    <Link key={c.id} href={`/circles/${c.id}`}>
                      <Badge
                        variant={c.isShared ? "secondary" : "outline"}
                        className="rounded-full cursor-pointer hover:bg-secondary/80 transition-colors"
                      >
                        {c.name}
                        {c.isShared && profile.commonCircleCount > 0 && (
                          <span className="ml-1 opacity-60">· in common</span>
                        )}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Send connection-request dialog */}
      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Send a connection request</DialogTitle>
            <DialogDescription>
              Add a short note so {profile.firstName || profile.displayName} knows
              who you are. They'll have the chance to accept or pass.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Hey! We met at the community garden — would love to stay in touch."
            value={connectMessage}
            onChange={(e) => setConnectMessage(e.target.value)}
            rows={4}
            maxLength={280}
            data-testid="input-connect-message"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                requestConnection.mutate(
                  { receiverUserId: profile.id, message: connectMessage || undefined },
                  {
                    onSuccess: () => {
                      toast({ title: "Connection request sent" });
                      setConnectMessage("");
                      setConnectOpen(false);
                    },
                    onError: (e: unknown) => {
                      toast({
                        title: "Could not send request",
                        description: (e as Error)?.message ?? "Please try again.",
                        variant: "destructive",
                      });
                    },
                  },
                );
              }}
              disabled={requestConnection.isPending}
              data-testid="button-send-connect"
            >
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block confirmation */}
      <AlertDialog open={confirmBlockOpen} onOpenChange={setConfirmBlockOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Block this person?</AlertDialogTitle>
            <AlertDialogDescription>
              They won't be able to find you, message you, or see your profile.
              You can unblock them anytime from Settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                blockUser.mutate(profile.id, {
                  onSuccess: () => toast({ title: "Blocked" }),
                })
              }
              data-testid="button-confirm-block"
            >
              Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disconnect confirmation */}
      <AlertDialog open={confirmDisconnectOpen} onOpenChange={setConfirmDisconnectOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this connection?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll still be able to send a new request later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep connected</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                conn &&
                removeConnection.mutate(conn.id, {
                  onSuccess: () => toast({ title: "Disconnected" }),
                })
              }
              data-testid="button-confirm-disconnect"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
