import { Link } from "wouter";
import {
  useMyConnections,
  useAcceptConnection,
  useDeclineConnection,
  useRemoveConnection,
  objectPathToUrl,
  type UserConnection,
} from "@/hooks/use-api";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, X, MessageCircle, UserPlus2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

function ConnectionRow({
  connection,
  onAccept,
  onDecline,
  onRemove,
  busy,
  primaryAction,
}: {
  connection: UserConnection;
  onAccept?: () => void;
  onDecline?: () => void;
  onRemove?: () => void;
  busy?: boolean;
  primaryAction?: "respond" | "cancel" | "manage";
}) {
  const initials = connection.otherUser.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const avatarSrc = objectPathToUrl(connection.otherUser.avatarObjectPath);

  return (
    <Card className="rounded-2xl border-border/50 shadow-none">
      <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <Link href={`/profile/${connection.otherUser.id}`}>
          <Avatar className="w-12 h-12 cursor-pointer">
            {avatarSrc && (
              <AvatarImage src={avatarSrc} alt={connection.otherUser.displayName} />
            )}
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/profile/${connection.otherUser.id}`}>
            <p className="font-medium truncate cursor-pointer hover:underline">
              {connection.otherUser.displayName}
              {connection.otherUser.pronouns && (
                <span className="text-xs text-muted-foreground ml-1.5">
                  ({connection.otherUser.pronouns})
                </span>
              )}
            </p>
          </Link>
          {connection.message && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
              "{connection.message}"
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {format(new Date(connection.createdAt), "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {primaryAction === "respond" && (
            <>
              <Button
                size="sm"
                className="rounded-full gap-1.5"
                onClick={onAccept}
                disabled={busy}
                data-testid={`button-accept-${connection.id}`}
              >
                <Check className="w-3.5 h-3.5" /> Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full gap-1.5"
                onClick={onDecline}
                disabled={busy}
                data-testid={`button-decline-${connection.id}`}
              >
                <X className="w-3.5 h-3.5" /> Decline
              </Button>
            </>
          )}
          {primaryAction === "cancel" && (
            <>
              <Badge variant="outline" className="rounded-full gap-1">
                <Clock className="w-3 h-3" /> Pending
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full"
                onClick={onRemove}
                disabled={busy}
                data-testid={`button-cancel-${connection.id}`}
              >
                Cancel
              </Button>
            </>
          )}
          {primaryAction === "manage" && (
            <>
              <Link href={`/messages/${connection.otherUser.id}`}>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full gap-1.5"
                  data-testid={`button-message-${connection.id}`}
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Message
                </Button>
              </Link>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full"
                onClick={onRemove}
                disabled={busy}
                data-testid={`button-disconnect-${connection.id}`}
              >
                Disconnect
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ConnectionsPage() {
  const { toast } = useToast();
  const accepted = useMyConnections("accepted", "both");
  const incoming = useMyConnections("pending", "incoming");
  const outgoing = useMyConnections("pending", "outgoing");

  const acceptMut = useAcceptConnection();
  const declineMut = useDeclineConnection();
  const removeMut = useRemoveConnection();

  const incomingCount = incoming.data?.length ?? 0;
  const outgoingCount = outgoing.data?.length ?? 0;
  const acceptedCount = accepted.data?.length ?? 0;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Connections</h1>
          <p className="text-sm text-muted-foreground">
            People you've chosen to stay in touch with.
          </p>
        </div>
        <Link href="/find-people">
          <Button variant="outline" className="rounded-full gap-2">
            <UserPlus2 className="w-4 h-4" /> Find people
          </Button>
        </Link>
      </div>

      <Tabs defaultValue={incomingCount > 0 ? "incoming" : "accepted"}>
        <TabsList className="rounded-full">
          <TabsTrigger value="accepted" className="rounded-full" data-testid="tab-connected">
            Connected
            {acceptedCount > 0 && (
              <Badge className="ml-2 h-5 px-1.5 text-xs rounded-full">
                {acceptedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="incoming" className="rounded-full" data-testid="tab-incoming">
            Incoming
            {incomingCount > 0 && (
              <Badge className="ml-2 h-5 px-1.5 text-xs rounded-full">
                {incomingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="outgoing" className="rounded-full" data-testid="tab-outgoing">
            Sent
            {outgoingCount > 0 && (
              <Badge className="ml-2 h-5 px-1.5 text-xs rounded-full">
                {outgoingCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accepted" className="mt-4 space-y-3">
          {accepted.isLoading ? (
            <Skeleton className="h-20 rounded-2xl" />
          ) : acceptedCount === 0 ? (
            <Card className="rounded-3xl border-dashed border-border/50 shadow-none">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">
                  Build your circle of connections.
                </p>
                <p>Connect with people across all your groups in one place.</p>
              </CardContent>
            </Card>
          ) : (
            accepted.data!.map((c) => (
              <ConnectionRow
                key={c.id}
                connection={c}
                primaryAction="manage"
                onRemove={() =>
                  removeMut.mutate(c.id, {
                    onSuccess: () => toast({ title: "Disconnected" }),
                  })
                }
                busy={removeMut.isPending}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="incoming" className="mt-4 space-y-3">
          {incoming.isLoading ? (
            <Skeleton className="h-20 rounded-2xl" />
          ) : incomingCount === 0 ? (
            <Card className="rounded-3xl border-dashed border-border/50 shadow-none">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No requests waiting on you right now.
              </CardContent>
            </Card>
          ) : (
            incoming.data!.map((c) => (
              <ConnectionRow
                key={c.id}
                connection={c}
                primaryAction="respond"
                onAccept={() =>
                  acceptMut.mutate(c.id, {
                    onSuccess: () => toast({ title: "You're now connected" }),
                  })
                }
                onDecline={() =>
                  declineMut.mutate(c.id, {
                    onSuccess: () => toast({ title: "Request declined" }),
                  })
                }
                busy={acceptMut.isPending || declineMut.isPending}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="outgoing" className="mt-4 space-y-3">
          {outgoing.isLoading ? (
            <Skeleton className="h-20 rounded-2xl" />
          ) : outgoingCount === 0 ? (
            <Card className="rounded-3xl border-dashed border-border/50 shadow-none">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                You haven't sent any pending requests.
              </CardContent>
            </Card>
          ) : (
            outgoing.data!.map((c) => (
              <ConnectionRow
                key={c.id}
                connection={c}
                primaryAction="cancel"
                onRemove={() =>
                  removeMut.mutate(c.id, {
                    onSuccess: () => toast({ title: "Request canceled" }),
                  })
                }
                busy={removeMut.isPending}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
