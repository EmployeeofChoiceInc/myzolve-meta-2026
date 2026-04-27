import { useState } from "react";
import { Link } from "wouter";
import {
  useSearchUsers,
  objectPathToUrl,
  useRequestConnection,
} from "@/hooks/use-api";
import { Search, UserPlus, Check, Clock, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function FindPeoplePage() {
  const [query, setQuery] = useState("");
  const { toast } = useToast();
  const { data: results, isLoading, isFetching } = useSearchUsers(query);
  const requestConnection = useRequestConnection();

  const trimmed = query.trim();
  const hasQuery = trimmed.length >= 2;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6 animate-in fade-in duration-500">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Find people</h1>
        <p className="text-sm text-muted-foreground">
          Search for someone by name, exact email, or exact phone number to send
          them a connection request.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try a name, email, or phone…"
          className="pl-9 rounded-full h-11"
          data-testid="input-find-people"
          autoFocus
        />
      </div>

      {!hasQuery && (
        <Card className="rounded-3xl border-dashed border-border/50 shadow-none">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Type at least two characters to start searching.
          </CardContent>
        </Card>
      )}

      {hasQuery && (isLoading || isFetching) && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {hasQuery && !isLoading && results?.length === 0 && (
        <Card className="rounded-3xl border-border/50 shadow-none">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">No matches yet</p>
            <p>
              Phone numbers only show up for people who've turned on phone
              discoverability in their settings.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {results?.map((u) => {
          const initials = u.displayName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
          const avatarSrc = objectPathToUrl(u.avatarObjectPath);
          const conn = u.connection;

          let actionButton: React.ReactNode = null;
          if (!conn) {
            actionButton = (
              <Button
                size="sm"
                className="rounded-full gap-1.5"
                onClick={() =>
                  requestConnection.mutate(
                    { receiverUserId: u.id },
                    {
                      onSuccess: () =>
                        toast({ title: `Request sent to ${u.firstName || u.displayName}` }),
                    },
                  )
                }
                disabled={requestConnection.isPending}
                data-testid={`button-connect-${u.id}`}
              >
                <UserPlus className="w-3.5 h-3.5" /> Connect
              </Button>
            );
          } else if (conn.status === "pending" && conn.direction === "outgoing") {
            actionButton = (
              <Badge variant="outline" className="rounded-full gap-1">
                <Clock className="w-3 h-3" /> Pending
              </Badge>
            );
          } else if (conn.status === "pending" && conn.direction === "incoming") {
            actionButton = (
              <Badge variant="secondary" className="rounded-full">
                Awaiting your reply
              </Badge>
            );
          } else if (conn.status === "accepted") {
            actionButton = (
              <Badge variant="secondary" className="rounded-full gap-1">
                <Check className="w-3 h-3" /> Connected
              </Badge>
            );
          }

          return (
            <Card
              key={u.id}
              className="rounded-2xl border-border/50 shadow-none hover:bg-muted/40 transition-colors"
            >
              <CardContent className="p-4 flex items-center gap-4">
                <Link href={`/profile/${u.id}`}>
                  <Avatar className="w-12 h-12 cursor-pointer">
                    {avatarSrc && <AvatarImage src={avatarSrc} alt={u.displayName} />}
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/profile/${u.id}`}>
                    <p className="font-medium truncate cursor-pointer hover:underline">
                      {u.displayName}
                      {u.pronouns && (
                        <span className="text-xs text-muted-foreground ml-1.5">
                          ({u.pronouns})
                        </span>
                      )}
                    </p>
                  </Link>
                  {u.location && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" /> {u.location}
                    </p>
                  )}
                </div>
                <div className="shrink-0">{actionButton}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
