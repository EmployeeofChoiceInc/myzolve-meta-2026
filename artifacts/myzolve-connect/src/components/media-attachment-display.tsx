import { Mic, FileVideo, ImageIcon } from "lucide-react";

interface AttachmentLite {
  id: number;
  storageKey?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  durationMs?: number | null;
}

function attachmentUrl(att: AttachmentLite): string | undefined {
  if (!att.storageKey) return undefined;
  const stripped = att.storageKey.startsWith("/objects/")
    ? att.storageKey.slice("/objects/".length)
    : att.storageKey;
  // All authenticated user media (avatars, post images, attachments,
  // circle banners) is served via /api/storage/user-media/* — the
  // route already understands attachment ACLs.
  return `/api/storage/user-media/${stripped}`;
}

export function MediaAttachmentList({
  attachments,
}: {
  attachments: AttachmentLite[] | undefined;
  circleId?: number;
}) {
  if (!attachments || attachments.length === 0) return null;

  const photos = attachments.filter((a) => a.mimeType?.startsWith("image/"));
  const audios = attachments.filter((a) => a.mimeType?.startsWith("audio/"));
  const videos = attachments.filter((a) => a.mimeType?.startsWith("video/"));
  const others = attachments.filter(
    (a) => !a.mimeType || (!a.mimeType.startsWith("image/") && !a.mimeType.startsWith("audio/") && !a.mimeType.startsWith("video/")),
  );

  return (
    <div className="space-y-3 mt-3" data-testid="media-attachments">
      {photos.length > 0 && (
        <div className={`grid gap-2 ${photos.length === 1 ? "grid-cols-1" : "grid-cols-2 md:grid-cols-3"}`}>
          {photos.map((a) => {
            const url = attachmentUrl(a);
            return url ? (
              <a key={a.id} href={url} target="_blank" rel="noopener" className="block rounded-xl overflow-hidden bg-muted aspect-video">
                <img src={url} alt={a.fileName ?? "Photo"} className="w-full h-full object-cover" />
              </a>
            ) : null;
          })}
        </div>
      )}

      {videos.map((a) => {
        const url = attachmentUrl(a);
        return url ? (
          <video
            key={a.id}
            src={url}
            controls
            className="w-full max-h-80 rounded-xl bg-black"
            data-testid={`video-${a.id}`}
          />
        ) : null;
      })}

      {audios.map((a) => {
        const url = attachmentUrl(a);
        if (!url) return null;
        return (
          <div key={a.id} className="flex items-center gap-3 rounded-xl border border-border/50 p-3 bg-card" data-testid={`voice-${a.id}`}>
            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Mic className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium mb-1">Voice note</p>
              <audio src={url} controls className="w-full h-8" />
            </div>
          </div>
        );
      })}

      {others.map((a) => {
        const url = attachmentUrl(a);
        return (
          <a
            key={a.id}
            href={url}
            target="_blank"
            rel="noopener"
            className="flex items-center gap-3 rounded-xl border border-border/50 p-3 bg-card hover:bg-muted/50 transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
              {a.mimeType?.startsWith("image/") ? <ImageIcon className="w-4 h-4" /> : <FileVideo className="w-4 h-4" />}
            </div>
            <span className="text-sm truncate">{a.fileName ?? "Attachment"}</span>
          </a>
        );
      })}
    </div>
  );
}
