import { useState } from "react";
import { UserCheck, User as UserIcon, ChevronDown, Check, Flag } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useCopilot, useCopilotGrantsForCircle } from "@/lib/copilot";
import { objectPathToUrl } from "@/hooks/use-api";

interface SwitcherProps {
  circleId: number;
  className?: string;
}

/**
 * Inline picker shown above composers (wall, request, comment) that lets a
 * helper choose to post on someone's behalf. Renders nothing when the user
 * has no active co-pilot grants in this circle, preserving the solo flow.
 */
export function CopilotSwitcher({ circleId, className }: SwitcherProps) {
  const grants = useCopilotGrantsForCircle(circleId);
  const { actingFor, setActingFor } = useCopilot();
  const [open, setOpen] = useState(false);

  if (grants.length === 0) return null;

  const currentTargetId = actingFor[circleId] ?? null;
  const currentGrant = currentTargetId
    ? grants.find((g) => g.grantorUserId === currentTargetId) ?? null
    : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${
          currentGrant
            ? "border-primary bg-primary/5"
            : "border-border bg-card hover:bg-muted/40"
        } ${className ?? ""}`}
        data-testid="copilot-switcher-trigger"
      >
        <div className={`shrink-0 ${currentGrant ? "text-primary" : "text-muted-foreground"}`}>
          {currentGrant ? <UserCheck className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Posting as</p>
          <p className="text-sm font-semibold truncate">
            {currentGrant ? `Helper for ${currentGrant.grantorName ?? "this member"}` : "Myself"}
          </p>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>Who are you posting for?</DialogTitle>
            <DialogDescription>
              Pick yourself or someone who's asked you to help.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setActingFor(circleId, null);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
                !currentTargetId ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
              }`}
              data-testid="copilot-pick-self"
            >
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-foreground">
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Myself</p>
                <p className="text-xs text-muted-foreground">Post in your own name</p>
              </div>
              {!currentTargetId ? <Check className="w-4 h-4 text-primary shrink-0" /> : null}
            </button>

            {grants.map((g) => {
              const active = currentTargetId === g.grantorUserId;
              const avatarUrl = objectPathToUrl(g.grantorAvatarObjectPath ?? null);
              const label = g.grantorName ?? "Member";
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setActingFor(circleId, g.grantorUserId);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
                    active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                  }`}
                  data-testid={`copilot-pick-grant-${g.id}`}
                >
                  <Avatar className="w-9 h-9">
                    {avatarUrl ? <AvatarImage src={avatarUrl} alt={label} /> : null}
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {label.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{label}</p>
                    <p className="text-xs text-muted-foreground">They've asked you to help</p>
                  </div>
                  {active ? <Check className="w-4 h-4 text-primary shrink-0" /> : null}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end pt-3">
            <Button variant="outline" className="rounded-full" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface AttributionProps {
  helperName: string;
  forName: string;
  review?: string | null;
  size?: "compact" | "normal";
}

/**
 * Compact pill shown on cards/detail screens to make it obvious the post
 * was made by a helper on someone's behalf. Includes pending/flagged states.
 */
export function CopilotAttribution({
  helperName,
  forName,
  review,
  size = "normal",
}: AttributionProps) {
  const isFlagged = review === "flagged";
  const isPending = !review || review === "pending";

  const tone = isFlagged
    ? "text-destructive bg-destructive/10"
    : isPending
      ? "text-muted-foreground bg-muted"
      : "text-primary bg-primary/10";

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tone} ${
        size === "compact" ? "mt-1" : "mt-2"
      }`}
    >
      {isFlagged ? <Flag className="w-3 h-3" /> : <UserCheck className="w-3 h-3" />}
      <span className="truncate">
        {helperName} posted for {forName}
        {isFlagged ? " · flagged" : isPending ? " · pending review" : ""}
      </span>
    </div>
  );
}
