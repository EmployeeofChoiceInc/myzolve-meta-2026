import { useState } from "react";
import { useLocation } from "wouter";
import { Compass, Users, Lock, UserCheck, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useDiscoverCircles, useCreateJoinRequest, type DiscoverableCircle } from "@/hooks/use-api";

const circleTypeLabel: Record<string, string> = {
  family: "Family",
  chosen_family: "Chosen Family",
  friends: "Friends",
  caregiving_circle: "Caregiving Circle",
  neighborhood_circle: "Neighborhood Circle",
  other: "Circle",
};

function CircleCard({ circle }: { circle: DiscoverableCircle }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [note, setNote] = useState("");
  const createJoinRequest = useCreateJoinRequest(circle.id);

  const alreadyMember = circle.isMember;
  const requestStatus = circle.joinRequestStatus;

  function handleRequestJoin() {
    createJoinRequest.mutate(
      { note: note.trim() || undefined },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setNote("");
          toast({
            title: "Request sent",
            description: `Your request to join ${circle.name} has been sent. The circle owner will review it shortly.`,
          });
        },
        onError: () => {
          toast({ title: "Could not send request", variant: "destructive" });
        },
      },
    );
  }

  return (
    <>
      <Card className="rounded-3xl border-border/50 shadow-none hover:shadow-md hover:border-primary/20 transition-all">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg leading-tight">{circle.name}</CardTitle>
              <CardDescription className="text-sm mt-1">
                Created by {circle.creatorName}
              </CardDescription>
            </div>
            <Badge variant="outline" className="rounded-full text-xs shrink-0 border-border/50">
              {circleTypeLabel[circle.circleType] ?? circle.circleType}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {circle.description && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
              {circle.description}
            </p>
          )}

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>{circle.memberCount} {circle.memberCount === 1 ? "member" : "members"}</span>
          </div>

          {alreadyMember ? (
            <Button
              className="rounded-full w-full"
              variant="outline"
              onClick={() => navigate(`/circles/${circle.id}`)}
            >
              <UserCheck className="w-4 h-4 mr-2" /> View Circle
            </Button>
          ) : requestStatus === "pending" ? (
            <div className="text-center text-sm text-muted-foreground bg-muted/50 rounded-2xl p-3">
              Request pending — waiting for approval
            </div>
          ) : requestStatus === "declined" ? (
            <Button
              className="rounded-full w-full"
              variant="outline"
              onClick={() => setDialogOpen(true)}
            >
              Request Again
            </Button>
          ) : (
            <Button
              className="rounded-full w-full"
              onClick={() => setDialogOpen(true)}
            >
              Request to Join
            </Button>
          )}
          <Button
            className="rounded-full w-full"
            variant="ghost"
            onClick={() => navigate(`/messages/${circle.ownerId}`)}
          >
            <MessageCircle className="w-4 h-4 mr-2" /> Message Creator
          </Button>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle>Request to Join</DialogTitle>
            <DialogDescription>
              Send a join request to {circle.name}. The circle owner will review it and let you know.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium text-foreground">
                Add a note <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                className="mt-2 rounded-xl resize-none"
                rows={3}
                placeholder="Introduce yourself or explain how you know the circle creator..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="rounded-full flex-1" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="rounded-full flex-1"
                onClick={handleRequestJoin}
                disabled={createJoinRequest.isPending}
              >
                {createJoinRequest.isPending ? "Sending..." : "Send Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function DiscoverPage() {
  const { data: circles, isLoading } = useDiscoverCircles();

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Find a Circle</h1>
            <p className="text-sm text-muted-foreground">Browse circles open to new members and request to join.</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="rounded-3xl border-border/50 shadow-none animate-pulse">
              <CardContent className="p-6 space-y-3">
                <div className="h-5 bg-muted rounded-full w-2/3" />
                <div className="h-4 bg-muted rounded-full w-1/2" />
                <div className="h-16 bg-muted rounded-2xl" />
                <div className="h-10 bg-muted rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !circles || circles.length === 0 ? (
        <Card className="rounded-3xl border-border/50 shadow-none">
          <CardContent className="p-12 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-3xl bg-muted/50 flex items-center justify-center">
              <Lock className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">No open circles yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                Circles appear here when their owners set them to "Open" or "Community" mode. Ask someone to share their invite link, or start your own circle.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {circles.map((circle) => (
            <CircleCard key={circle.id} circle={circle} />
          ))}
        </div>
      )}

      <div className="bg-muted/40 rounded-3xl p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">About circle visibility</p>
        Only circles whose owners have enabled discoverability appear here. Your personal circles remain private unless you choose to open them up in circle settings.
      </div>
    </div>
  );
}
