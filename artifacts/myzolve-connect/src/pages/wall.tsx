import { useParams, Link } from "wouter";
import {
  useMe,
  useCirclePosts,
  useCreateCirclePost,
  useDeleteCirclePost,
  useReactions,
  useToggleReaction,
  useComments,
  useCreateComment,
  useCircleMediaUpload,
  useUploadCircleMedia,
  useAttachments,
  useMyPlusStatus,
  objectPathToUrl,
  type CirclePost,
} from "@/hooks/use-api";
import { useGetCircle, getGetCircleQueryKey, customFetch } from "@workspace/api-client-react";
import {
  ArrowLeft,
  PenSquare,
  Trash2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Send,
  Heart,
  ImagePlus,
  X,
  Video as VideoIcon,
} from "lucide-react";
import { VoiceRecorder } from "@/components/voice-recorder";
import { MediaAttachmentList } from "@/components/media-attachment-display";
import { PlusBadge } from "@/components/plus-badge";
import { usePaywall } from "@/components/paywall-dialog";
import { CopilotSwitcher, CopilotAttribution } from "@/components/copilot-switcher";
import { useActingForInCircle } from "@/lib/copilot";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef } from "react";
import { formatDistanceToNow } from "date-fns";

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
        {commentCount > 0 ? `${commentCount} comment${commentCount !== 1 ? "s" : ""}` : "Add a comment"}
        {commentCount > 0 && (expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
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
                  <p className="text-xs font-medium text-foreground hover:underline cursor-pointer">{c.authorName}</p>
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
                  {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
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

function PostCard({
  post,
  circleId,
  myUserId,
  isAdmin,
}: {
  post: CirclePost;
  circleId: number;
  myUserId: number | undefined;
  isAdmin: boolean;
}) {
  const deletePost = useDeleteCirclePost(circleId);
  const { toast } = useToast();
  const canDelete = myUserId !== undefined && (post.authorUserId === myUserId || isAdmin);
  const imageUrl = objectPathToUrl(post.imageObjectPath);
  const authorAvatarUrl = objectPathToUrl(post.authorAvatarObjectPath);
  const { data: attachments } = useAttachments(circleId, "circle_post", post.id);

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
                {authorAvatarUrl && <AvatarImage src={authorAvatarUrl} alt={post.authorName} />}
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

        {post.actingForName ? (
          <CopilotAttribution
            helperName={post.authorName}
            forName={post.actingForName}
            review={post.copilotReview}
          />
        ) : null}

        {post.title && <h3 className="font-semibold text-foreground">{post.title}</h3>}
        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{post.body}</p>

        {imageUrl && (
          <img
            src={imageUrl}
            alt="Post attachment"
            className="rounded-2xl w-full object-cover max-h-80"
          />
        )}

        <MediaAttachmentList attachments={attachments} circleId={circleId} />

        <div className="space-y-3 pt-1">
          <ReactionBar circleId={circleId} postId={post.id} />
          <CommentsSection circleId={circleId} postId={post.id} />
        </div>
      </CardContent>
    </Card>
  );
}

type PendingPhoto = { id: string; file: File; previewUrl: string };
type PendingVoice = { file: File; durationMs: number; previewUrl: string };
type PendingVideo = { file: File; previewUrl: string };

const MAX_FREE_MEDIA_BYTES = 10 * 1024 * 1024;
const MAX_PLUS_MEDIA_BYTES = 50 * 1024 * 1024;
const MAX_PHOTOS_FREE = 3;
const MAX_PHOTOS_PLUS = 8;
const MAX_VIDEO_DURATION_MS = 30 * 1000;

function formatMb(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

async function readVideoDurationMs(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const ms = isFinite(v.duration) ? Math.round(v.duration * 1000) : null;
      URL.revokeObjectURL(url);
      resolve(ms);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    v.src = url;
  });
}

function ComposeDialog({
  open,
  onOpenChange,
  circleId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  circleId: number;
}) {
  const createPost = useCreateCirclePost(circleId);
  const circleMediaUpload = useCircleMediaUpload(circleId);
  const uploadCircleMedia = useUploadCircleMedia(circleId);
  const actingForUserId = useActingForInCircle(circleId);
  const { toast } = useToast();
  const paywall = usePaywall();
  const openPaywall = paywall.open;
  const { data: plusStatus } = useMyPlusStatus();
  const isPlus = !!plusStatus?.isPlus;

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [voice, setVoice] = useState<PendingVoice | null>(null);
  const [video, setVideo] = useState<PendingVideo | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetAll() {
    setTitle("");
    setBody("");
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPhotos([]);
    if (voice) URL.revokeObjectURL(voice.previewUrl);
    setVoice(null);
    if (video) URL.revokeObjectURL(video.previewUrl);
    setVideo(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
  }

  function handleClose(v: boolean) {
    if (!v) resetAll();
    onOpenChange(v);
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (photoInputRef.current) photoInputRef.current.value = "";
    if (files.length === 0) return;

    const cap = isPlus ? MAX_PHOTOS_PLUS : MAX_PHOTOS_FREE;
    const sizeCap = isPlus ? MAX_PLUS_MEDIA_BYTES : MAX_FREE_MEDIA_BYTES;

    const tooBig = files.find((f) => f.size > sizeCap);
    if (tooBig) {
      toast({
        title: "Photo too large",
        description: `Each photo must be under ${formatMb(sizeCap)}.`,
        variant: "destructive",
      });
      return;
    }

    const remaining = cap - photos.length;
    if (remaining <= 0) {
      if (!isPlus) openPaywall("extra_photos");
      else toast({ title: `Up to ${cap} photos per post.`, variant: "destructive" });
      return;
    }

    const accepted = files.slice(0, remaining);
    const rejected = files.length - accepted.length;

    setPhotos((prev) => [
      ...prev,
      ...accepted.map((file) => ({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);

    if (rejected > 0) {
      if (!isPlus) openPaywall("extra_photos");
      else toast({ title: `Up to ${cap} photos per post.`, description: `Skipped ${rejected}.`, variant: "destructive" });
    }
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }

  async function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!isPlus) {
      openPaywall("video");
      return;
    }

    if (file.size > MAX_PLUS_MEDIA_BYTES) {
      toast({
        title: "Video too large",
        description: `Videos must be under ${formatMb(MAX_PLUS_MEDIA_BYTES)}.`,
        variant: "destructive",
      });
      return;
    }

    const durationMs = await readVideoDurationMs(file);
    if (durationMs != null && durationMs > MAX_VIDEO_DURATION_MS) {
      toast({
        title: "Video too long",
        description: `Videos must be 30 seconds or less.`,
        variant: "destructive",
      });
      return;
    }

    if (video) URL.revokeObjectURL(video.previewUrl);
    setVideo({ file, previewUrl: URL.createObjectURL(file) });
  }

  function clearVideo() {
    if (video) URL.revokeObjectURL(video.previewUrl);
    setVideo(null);
  }

  function handleVoiceCapture(file: File, durationMs: number) {
    if (!isPlus) {
      openPaywall("voice_note");
      return;
    }
    if (voice) URL.revokeObjectURL(voice.previewUrl);
    setVoice({ file, durationMs, previewUrl: URL.createObjectURL(file) });
  }

  function clearVoice() {
    if (voice) URL.revokeObjectURL(voice.previewUrl);
    setVoice(null);
  }

  async function handleCreate() {
    if (!body.trim() || submitting) return;

    if (!isPlus) {
      if (photos.length > 1) {
        openPaywall("extra_photos");
        return;
      }
      if (voice) {
        openPaywall("voice_note");
        return;
      }
      if (video) {
        openPaywall("video");
        return;
      }
    }

    setSubmitting(true);
    try {
      // Pre-upload everything BEFORE creating the post so a failed
      // upload doesn't leave behind a half-baked text-only post.
      let firstPhotoObjectPath: string | undefined;
      if (photos.length > 0) {
        firstPhotoObjectPath = await new Promise<string>((resolve, reject) => {
          circleMediaUpload.mutate(photos[0].file, { onSuccess: resolve, onError: reject });
        });
      }

      const extraUploads: { file: File; storageKey: string }[] = [];
      for (const p of photos.slice(1)) {
        const { storageKey } = await uploadCircleMedia.mutateAsync({
          file: p.file,
          fileName: p.file.name,
          mimeType: p.file.type || "image/jpeg",
        });
        extraUploads.push({ file: p.file, storageKey });
      }

      let voiceUpload: { storageKey: string } | undefined;
      if (voice) {
        voiceUpload = await uploadCircleMedia.mutateAsync({
          file: voice.file,
          fileName: voice.file.name,
          mimeType: voice.file.type || "audio/webm",
        });
      }

      let videoUpload: { storageKey: string } | undefined;
      if (video) {
        videoUpload = await uploadCircleMedia.mutateAsync({
          file: video.file,
          fileName: video.file.name,
          mimeType: video.file.type || "video/mp4",
        });
      }

      // All media is uploaded. Now create the post.
      const newPost = await new Promise<CirclePost>((resolve, reject) => {
        createPost.mutate(
          {
            title: title.trim() || undefined,
            body: body.trim(),
            imageObjectPath: firstPhotoObjectPath,
            ...(actingForUserId ? { actingForUserId } : {}),
          },
          { onSuccess: resolve, onError: reject },
        );
      });

      for (const u of extraUploads) {
        await postAttachment(circleId, newPost.id, {
          kind: "photo",
          fileName: u.file.name,
          fileSize: u.file.size,
          mimeType: u.file.type || "image/jpeg",
          storageKey: u.storageKey,
        });
      }

      if (voice && voiceUpload) {
        await postAttachment(circleId, newPost.id, {
          kind: "voice",
          fileName: voice.file.name,
          fileSize: voice.file.size,
          mimeType: voice.file.type || "audio/webm",
          durationMs: voice.durationMs,
          storageKey: voiceUpload.storageKey,
        });
      }

      if (video && videoUpload) {
        await postAttachment(circleId, newPost.id, {
          kind: "video",
          fileName: video.file.name,
          fileSize: video.file.size,
          mimeType: video.file.type || "video/mp4",
          storageKey: videoUpload.storageKey,
        });
      }

      toast({ title: "Post shared" });
      onOpenChange(false);
      resetAll();
    } catch (err) {
      if (!paywall.handleApiError(err)) {
        toast({ title: "Could not share post", variant: "destructive" });
      }
    } finally {
      setSubmitting(false);
    }
  }

  const isBusy = submitting;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px] rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Post</DialogTitle>
          <DialogDescription>Share something with your circle.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <CopilotSwitcher circleId={circleId} />
          <Input
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="rounded-xl"
            data-testid="input-post-title"
          />
          <Textarea
            placeholder="What's on your mind?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="resize-none rounded-xl"
            data-testid="input-post-body"
          />

          {photos.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p) => (
                <div key={p.id} className="relative">
                  <img
                    src={p.previewUrl}
                    alt="Preview"
                    className="rounded-2xl w-full aspect-square object-cover"
                  />
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 rounded-full"
                    onClick={() => removePhoto(p.id)}
                    disabled={isBusy}
                    data-testid={`remove-photo-${p.id}`}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          {video ? (
            <div className="relative">
              <video src={video.previewUrl} controls className="rounded-2xl w-full max-h-60 bg-black" />
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7 rounded-full"
                onClick={clearVideo}
                disabled={isBusy}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : null}

          {voice ? (
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-3 flex items-center gap-3">
              <audio src={voice.previewUrl} controls className="flex-1 h-9" />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive"
                onClick={clearVoice}
                disabled={isBusy}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <VoiceRecorder onCapture={handleVoiceCapture} disabled={isBusy} />
          )}

          <div className="flex flex-wrap gap-3 text-sm">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              disabled={isBusy}
              data-testid="add-photo"
            >
              <ImagePlus className="w-4 h-4" /> Add photo
              {photos.length > 0 && !isPlus ? <PlusBadge size="sm" /> : null}
            </button>
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              disabled={isBusy}
              data-testid="add-video"
            >
              <VideoIcon className="w-4 h-4" /> Add video
              {!isPlus ? <PlusBadge size="sm" /> : null}
            </button>
          </div>

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePhotoSelect}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleVideoSelect}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" className="rounded-full" onClick={() => handleClose(false)} disabled={isBusy}>
              Cancel
            </Button>
            <Button
              className="rounded-full"
              disabled={!body.trim() || isBusy}
              onClick={handleCreate}
              data-testid="button-share-post"
            >
              {isBusy ? "Posting..." : "Share with circle"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

async function postAttachment(
  circleId: number,
  postId: number,
  data: {
    kind: "photo" | "voice" | "video";
    fileName: string;
    fileSize: number;
    mimeType: string;
    storageKey: string;
    durationMs?: number;
  },
) {
  await customFetch(`/api/circles/${circleId}/attachments/circle_post/${postId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export default function WallPage() {
  const { id } = useParams<{ id: string }>();
  const circleId = parseInt(id!);

  const { data: me } = useMe();
  const { data: circle } = useGetCircle(circleId, {
    query: { enabled: !!circleId, queryKey: getGetCircleQueryKey(circleId) },
  });
  const { data: posts, isLoading } = useCirclePosts(circleId);
  const [newPostOpen, setNewPostOpen] = useState(false);

  const isAdmin = circle?.myRole === "owner" || circle?.myRole === "admin";

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-2">
        <Link
          href={`/circles/${circleId}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm font-medium transition-colors"
        >
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
              myUserId={me?.id}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      )}

      <ComposeDialog open={newPostOpen} onOpenChange={setNewPostOpen} circleId={circleId} />
    </div>
  );
}
