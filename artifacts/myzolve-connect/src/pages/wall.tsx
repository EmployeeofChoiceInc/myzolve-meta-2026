import { useParams, Link } from "wouter";
import {
  useCirclePosts,
  useCreateCirclePost,
  useDeleteCirclePost,
  useReactions,
  useToggleReaction,
  useComments,
  useCreateComment,
  type CirclePost,
} from "@/hooks/use-api";
import { useGetCircle, getGetCircleQueryKey } from "@workspace/api-client-react";
import { ArrowLeft, PenSquare, Trash2, Heart, MessageSquare, ChevronDown, ChevronUp, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";

const REACTION_TYPES = [
  { type: "heart", label: "❤️" },
  { type: "support", label: "🤝" },
  { type: "thank_you", label: "🙏" },
  { type: "got_it", label: "👍" },
];

function ReactionBar({ circleId, postId }: { circleId: number; postId: number }) {
  const { data: reactions } = useReactions(circleId, "circle_post", postId);
  const toggleReaction = useToggleReaction(circleId, "circle_post", postId);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {REACTION_TYPES.map((r) => {
        const count = reactions?.counts[r.type] ?? 0;
        const isActive = reactions?.myReactions.includes(r.type);
        return (
          <button
            key={r.type}
            onClick={() => toggleReaction.mutate(r.type)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-colors ${
              isActive
                ? "bg-primary/15 text-primary font-medium"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            <span>{r.label}</span>
            {count > 0 && <span>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

function CommentsSection({ circleId, postId }: { circleId: number; postId: number }) {
  const [expanded, setExpanded] = useState(false);
  const [commentText, setCommentText] = useState("");
  const { data: comments } = useComments(circleId, "circle_post", postId);
  const createComment = useCreateComment(circleId, "circle_post", postId);

  function handleSubmit() {
    if (!commentText.trim()) return;
    createComment.mutate(
      { body: commentText.trim() },
      {
        onSuccess: () => setCommentText(""),
      },
    );
  }

  const commentCount = comments?.length ?? 0;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        {commentCount > 0 ? `${commentCount} comment${commentCount !== 1 ? "s" : ""}` : "Add a comment"}
        {commentCount > 0 && (expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
      </button>

      {expanded && (
        <div className="space-y-3 pl-2 border-l-2 border-border/40">
          {comments?.map((c) => (
            <div key={c.id} className="flex gap-2">
              <Avatar className="w-7 h-7 shrink-0">
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                  {c.authorName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-xs font-medium text-foreground">{c.authorName}</p>
                <p className="text-sm text-foreground/80">{c.body}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              className="rounded-xl text-sm h-9"
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmit()}
            />
            <Button
              size="sm"
              className="rounded-full h-9 w-9 p-0 shrink-0"
              disabled={!commentText.trim() || createComment.isPending}
              onClick={handleSubmit}
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PostCard({
  post,
  circleId,
  myUserId,
  isAdmin,
}: {
  post: CirclePost;
  circleId: number;
  myUserId: number | null | undefined;
  isAdmin: boolean;
}) {
  const deletePost = useDeleteCirclePost(circleId);
  const { toast } = useToast();

  const canDelete = post.authorUserId === myUserId || isAdmin;

  function handleDelete() {
    deletePost.mutate(post.id, {
      onSuccess: () => toast({ title: "Post removed" }),
      onError: () => toast({ title: "Could not remove post", variant: "destructive" }),
    });
  }

  return (
    <Card className="rounded-3xl border-border/50 shadow-none">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href={`/profile/${post.authorUserId}`}>
              <Avatar className="w-9 h-9 cursor-pointer">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                  {post.authorName.charAt(0)}
                </AvatarFallback>
              </Avatar>
            </Link>
            <div>
              <Link href={`/profile/${post.authorUserId}`}>
                <p className="text-sm font-semibold hover:underline cursor-pointer">{post.authorName}</p>
              </Link>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              disabled={deletePost.isPending}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>

        {post.title && <h3 className="font-semibold text-foreground">{post.title}</h3>}
        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{post.body}</p>

        <div className="space-y-3 pt-1">
          <ReactionBar circleId={circleId} postId={post.id} />
          <CommentsSection circleId={circleId} postId={post.id} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function WallPage() {
  const { id } = useParams<{ id: string }>();
  const circleId = parseInt(id!);
  const { userId: clerkId } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: circle } = useGetCircle(circleId, {
    query: { enabled: !!circleId, queryKey: getGetCircleQueryKey(circleId) },
  });
  const { data: posts, isLoading } = useCirclePosts(circleId);
  const createPost = useCreateCirclePost(circleId);

  const [newPostOpen, setNewPostOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const isAdmin = circle?.myRole === "owner" || circle?.myRole === "admin";

  // We need the numeric DB userId; the api-client-react getMe returns it
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const meData = queryClient.getQueryData<{ id: number }>(["/api/me"]);
  if (meData?.id && myUserId === null) setMyUserId(meData.id);

  function handleCreatePost() {
    if (!body.trim()) return;
    createPost.mutate(
      { title: title.trim() || undefined, body: body.trim() },
      {
        onSuccess: () => {
          setNewPostOpen(false);
          setTitle("");
          setBody("");
          toast({ title: "Post shared" });
        },
        onError: () => toast({ title: "Could not share post", variant: "destructive" }),
      },
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-2">
        <Link href={`/circles/${circleId}`} className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Circle
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Circle Wall</h1>
          <p className="text-muted-foreground mt-1 text-sm">Updates, thoughts, and announcements from your circle.</p>
        </div>
        <Button className="rounded-full gap-2" onClick={() => setNewPostOpen(true)}>
          <PenSquare className="w-4 h-4" /> New Post
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="rounded-3xl border-border/50 shadow-none">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-9 h-9 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !posts || posts.length === 0 ? (
        <Card className="rounded-3xl border-border/50 shadow-none">
          <CardContent className="p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto">
              <Heart className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold">Nothing posted yet</p>
              <p className="text-sm text-muted-foreground mt-1">Be the first to share an update with your circle.</p>
            </div>
            <Button className="rounded-full" onClick={() => setNewPostOpen(true)}>
              <PenSquare className="w-4 h-4 mr-2" /> Write a post
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              circleId={circleId}
              myUserId={myUserId}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      <Dialog open={newPostOpen} onOpenChange={setNewPostOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-3xl">
          <DialogHeader>
            <DialogTitle>New Post</DialogTitle>
            <DialogDescription>Share something with your circle.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Title (optional)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl"
            />
            <Textarea
              placeholder="What's on your mind?"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              className="resize-none rounded-xl"
            />
            <div className="flex justify-end gap-3">
              <Button variant="outline" className="rounded-full" onClick={() => setNewPostOpen(false)}>
                Cancel
              </Button>
              <Button
                className="rounded-full"
                disabled={!body.trim() || createPost.isPending}
                onClick={handleCreatePost}
              >
                {createPost.isPending ? "Posting..." : "Share with circle"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
