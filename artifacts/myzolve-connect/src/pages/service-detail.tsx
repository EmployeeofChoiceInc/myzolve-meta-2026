import { useParams, Link } from "wouter";
import { 
  useGetServicePost, 
  useMatchServicePost, 
  useCompleteServicePost,
  getGetServicePostQueryKey,
  useGetMe,
} from "@workspace/api-client-react";
import { ArrowLeft, Sparkles, MapPin, CheckCircle2, UserPlus, MessageCircle, Send, Heart, HandHeart, Star, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useState } from "react";
import { useComments, useCreateComment, useReactions, useToggleReaction } from "@/hooks/use-api";

const REACTION_ICONS: Record<string, React.ReactNode> = {
  heart: <Heart className="w-3.5 h-3.5" />,
  support: <HandHeart className="w-3.5 h-3.5" />,
  thank_you: <Star className="w-3.5 h-3.5" />,
  got_it: <Smile className="w-3.5 h-3.5" />,
};

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const serviceId = parseInt(id!);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: me } = useGetMe();
  const { data: service, isLoading } = useGetServicePost(serviceId, {
    query: { enabled: !!serviceId, queryKey: getGetServicePostQueryKey(serviceId) }
  });

  const matchService = useMatchServicePost();
  const completeService = useCompleteServicePost();

  const circleId = service?.circleId ?? 0;
  const [commentBody, setCommentBody] = useState("");

  const { data: comments } = useComments(circleId, "service_post", serviceId);
  const { data: reactions } = useReactions(circleId, "service_post", serviceId);
  const createComment = useCreateComment(circleId, "service_post", serviceId);
  const toggleReaction = useToggleReaction(circleId, "service_post", serviceId);

  if (isLoading) return <div className="p-8 animate-pulse flex flex-col gap-4"><div className="h-8 bg-muted w-1/3 rounded"></div><div className="h-64 bg-muted rounded-3xl"></div></div>;
  if (!service) return <div>Service not found</div>;

  const isCreator = me?.id !== undefined && service.createdByUserId === me.id;

  const handleMatch = () => {
    matchService.mutate({ serviceId, data: { note: "I'm interested!" } }, {
      onSuccess: () => {
        toast({ title: "Interest shared", description: "The poster has been notified." });
        queryClient.invalidateQueries({ queryKey: getGetServicePostQueryKey(serviceId) });
      }
    });
  };

  const handleComplete = () => {
    completeService.mutate({ serviceId }, {
      onSuccess: () => {
        toast({ title: "Service completed", description: "Marked as completed." });
        queryClient.invalidateQueries({ queryKey: getGetServicePostQueryKey(serviceId) });
      }
    });
  };

  const handlePostComment = () => {
    if (!commentBody.trim()) return;
    createComment.mutate(
      { body: commentBody.trim() },
      {
        onSuccess: () => {
          setCommentBody("");
          toast({ title: "Comment added" });
        },
        onError: () => {
          toast({ title: "Could not post comment.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <Link href={`/circles/${service.circleId}/services`} className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Services
        </Link>
      </div>

      <Card className="rounded-3xl border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="pb-4 bg-muted/30 border-b border-border/50">
          <div className="flex justify-between items-start mb-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={`rounded-full px-3 py-1 font-medium border-transparent ${
                service.serviceType === "offer" ? "bg-secondary/10 text-secondary" :
                service.serviceType === "request" ? "bg-primary/10 text-primary" :
                service.serviceType === "barter_offer" ? "bg-amber-500/10 text-amber-600" :
                "bg-purple-500/10 text-purple-600"
              }`}>
                {service.serviceType === "offer" ? "Offering" :
                 service.serviceType === "request" ? "Requesting" :
                 service.serviceType === "barter_offer" ? "Barter: Offering" :
                 "Barter: Seeking"}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1 font-medium bg-background">
                {service.category}
              </Badge>
              {service.status !== "open" && (
                <Badge variant="secondary" className="rounded-full px-3 py-1 font-medium">
                  {service.status}
                </Badge>
              )}
            </div>
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold">{service.title}</CardTitle>
          <CardDescription className="text-base mt-2 text-foreground/80 flex items-center justify-between">
            <span>Posted by <span className="font-medium">{service.createdByName}</span></span>
            <span className="text-sm text-muted-foreground">{format(new Date(service.createdAt), "MMM d, yyyy")}</span>
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-6 space-y-8">
          <div>
            <h3 className="font-semibold text-lg mb-2">Details</h3>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{service.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border rounded-2xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Location</p>
              <div className="flex items-center font-medium capitalize text-foreground">
                <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
                {service.locationMode.replace("_", " ")}
              </div>
            </div>
            <div className="bg-card border rounded-2xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Exchange</p>
              <div className="flex items-center font-medium capitalize text-accent-foreground">
                <Sparkles className="w-4 h-4 mr-2" />
                {service.exchangePreference.replace("_", " ")}
              </div>
            </div>
          </div>

          {service.availability && (
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-2">Availability</h3>
              <p className="text-foreground bg-muted/50 p-4 rounded-2xl text-sm">{service.availability}</p>
            </div>
          )}

          {/* Reactions */}
          {circleId > 0 && (
            <div className="flex gap-2 flex-wrap pt-2">
              {(["heart", "support", "thank_you", "got_it"] as const).map((type) => {
                const count = reactions?.counts?.[type] ?? 0;
                const mine = reactions?.myReactions?.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleReaction.mutate(type)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${mine ? "bg-primary/10 border-primary/20 text-primary" : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"}`}
                  >
                    {REACTION_ICONS[type]}
                    <span className="capitalize">{type.replace("_", " ")}</span>
                    {count > 0 && <span className="ml-0.5 text-xs opacity-70">{count}</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border/50">
            {!isCreator && service.status === "open" && (
              <Button size="lg" className="rounded-full w-full" onClick={handleMatch} disabled={matchService.isPending}>
                <UserPlus className="w-5 h-5 mr-2" /> {
                  service.serviceType === "offer" ? "I'm interested" :
                  service.serviceType === "request" ? "I can help" :
                  service.serviceType === "barter_offer" ? "Let's trade" :
                  "I have what you need"
                }
              </Button>
            )}
            
            {isCreator && service.status === "open" && (
              <Button size="lg" variant="secondary" className="rounded-full w-full" onClick={handleComplete} disabled={completeService.isPending}>
                <CheckCircle2 className="w-5 h-5 mr-2" /> Mark as Complete
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Comments Section */}
      {circleId > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
            Comments {comments && comments.length > 0 && <span className="text-sm font-normal text-muted-foreground">({comments.length})</span>}
          </h3>

          <div className="flex gap-3 items-start">
            <div className="flex-1">
              <Textarea
                placeholder="Leave a comment or ask a question..."
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                className="rounded-2xl resize-none min-h-[80px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePostComment();
                }}
              />
            </div>
            <Button
              size="icon"
              className="rounded-full mt-1 shrink-0"
              onClick={handlePostComment}
              disabled={!commentBody.trim() || createComment.isPending}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          {comments && comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map((comment) => (
                <Card key={comment.id} className="rounded-2xl border-border/50 shadow-none">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                        {(comment.authorName ?? "?")[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-sm">{comment.authorName}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{format(new Date(comment.createdAt), "MMM d")}</span>
                    </div>
                    <p className="text-sm text-foreground/90 leading-relaxed">{comment.body}</p>
                    {comment.replyCount > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">{comment.replyCount} {comment.replyCount === 1 ? "reply" : "replies"}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">No comments yet. Be the first to say something.</p>
          )}
        </div>
      )}
    </div>
  );
}
