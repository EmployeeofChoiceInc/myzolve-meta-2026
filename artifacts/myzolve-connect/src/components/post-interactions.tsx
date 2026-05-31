import { useState } from "react";
import { Link } from "wouter";
import {
  useReactions,
  useToggleReaction,
  useComments,
  useCreateComment,
} from "@/hooks/use-api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  ChevronUp,
  ChevronDown,
  Send,
} from "lucide-react";
import { CopilotSwitcher, CopilotAttribution } from "@/components/copilot-switcher";
import { useActingForInCircle } from "@/lib/copilot";
import { formatDistanceToNow } from "date-fns";

const REACTION_TYPES = [
  { type: "heart", label: "❤️" },
  { type: "support", label: "🤝" },
  { type: "thank_you", label: "🙏" },
  { type: "got_it", label: "👍" },
];

export function ReactionBar({
  circleId,
  postId,
}: {
  circleId: number;
  postId: number;
}) {
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

export function CommentsSection({
  circleId,
  postId,
}: {
  circleId: number;
  postId: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [commentText, setCommentText] = useState("");
  const { data: comments } = useComments(circleId, "circle_post", postId);
  const createComment = useCreateComment(circleId, "circle_post", postId);
  const actingForUserId = useActingForInCircle(circleId);

  function handleSubmit() {
    if (!commentText.trim()) return;
    createComment.mutate(
      {
        body: commentText.trim(),
        ...(actingForUserId ? { actingForUserId } : {}),
      },
      { onSuccess: () => setCommentText("") },
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
        {commentCount > 0
          ? `${commentCount} comment${commentCount !== 1 ? "s" : ""}`
          : "Add a comment"}
        {commentCount > 0 &&
          (expanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          ))}
      </button>

      {expanded && (
        <div className="space-y-3 pl-2 border-l-2 border-border/40">
          {comments?.map((c) => (
            <div key={c.id} className="flex gap-2">
              <Link href={`/profile/${c.authorUserId ?? ""}`}>
                <Avatar className="w-7 h-7 shrink-0 cursor-pointer">
                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                    {c.authorName.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div>
                <Link href={`/profile/${c.authorUserId ?? ""}`}>
                  <p className="text-xs font-medium text-foreground hover:underline cursor-pointer">
                    {c.authorName}
                  </p>
                </Link>
                <p className="text-sm text-foreground/80">{c.body}</p>
                {c.actingForName ? (
                  <CopilotAttribution
                    helperName={c.authorName}
                    forName={c.actingForName}
                    review={c.copilotReview}
                    size="compact"
                  />
                ) : null}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatDistanceToNow(new Date(c.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
          ))}
          <CopilotSwitcher circleId={circleId} className="mb-1" />
          <div className="flex gap-2">
            <Input
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              className="rounded-xl text-sm h-9"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
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
