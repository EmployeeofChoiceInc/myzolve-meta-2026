import { Button } from "@/components/ui/button";
import { TUTORIAL_STEPS, type TutorialStep } from "@workspace/tutorial-content";
import {
  Calendar,
  HandHeart,
  LayoutDashboard,
  MessageSquareHeart,
  PartyPopper,
  Sparkles,
  UserCircle,
  X as XIcon,
} from "lucide-react";
import { useEffect, useLayoutEffect, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";

// Web tutorial overlay.  Renders a translucent backdrop plus a floating card
// for the current step.  When the step has a `webAnchorId` AND a matching
// `data-tutorial-target="<id>"` element exists in the DOM, the card is
// positioned next to that element and a soft "spotlight" frame is drawn
// around it so the focused area pops.  Otherwise the card centers on screen.

const ICONS: Record<TutorialStep["lucideIcon"], ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  MessageSquareHeart,
  HandHeart,
  Calendar,
  Sparkles,
  UserCircle,
  PartyPopper,
};

type AnchorRect = { top: number; left: number; width: number; height: number };

type Props = {
  open: boolean;
  onClose: () => void;
};

export function TutorialOverlay({ open, onClose }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null);

  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  const step = TUTORIAL_STEPS[stepIndex];
  const isLast = stepIndex === TUTORIAL_STEPS.length - 1;

  // Recompute anchor position whenever the step changes, the window resizes,
  // or scroll moves.  We use useLayoutEffect to avoid a paint flicker.
  useLayoutEffect(() => {
    if (!open || !step?.webAnchorId) {
      setAnchorRect(null);
      return;
    }
    function compute() {
      const id = step?.webAnchorId;
      if (!id) {
        setAnchorRect(null);
        return;
      }
      const el = document.querySelector(`[data-tutorial-target="${id}"]`);
      if (!el) {
        setAnchorRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setAnchorRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    }
    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [open, step]);

  // ESC = skip.  Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !step) return null;

  const Icon = ICONS[step.lucideIcon];

  // Card position: prefer below the anchor, but flip above if there isn't
  // room.  Default to centered when no anchor.
  const cardWidth = 360;
  const cardMargin = 16;
  let cardStyle: React.CSSProperties;
  if (anchorRect) {
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const spaceBelow = viewportH - (anchorRect.top + anchorRect.height);
    const placeBelow = spaceBelow > 260 || spaceBelow > anchorRect.top;
    const top = placeBelow
      ? anchorRect.top + anchorRect.height + cardMargin
      : Math.max(cardMargin, anchorRect.top - 260 - cardMargin);
    let left = anchorRect.left + anchorRect.width / 2 - cardWidth / 2;
    left = Math.max(cardMargin, Math.min(left, viewportW - cardWidth - cardMargin));
    cardStyle = { position: "fixed", top, left, width: cardWidth };
  } else {
    cardStyle = {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: cardWidth,
    };
  }

  function next() {
    if (isLast) {
      onClose();
    } else {
      setStepIndex((i) => Math.min(TUTORIAL_STEPS.length - 1, i + 1));
    }
  }

  function back() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Guided tour"
      data-testid="tutorial-overlay"
    >
      {/* Translucent backdrop. Click-to-skip would be nice but matches the
          "skip is always available via the explicit button" rule below. */}
      <div
        className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-[1px]"
        aria-hidden="true"
      />

      {/* Spotlight frame around the anchored element so the focused area pops. */}
      {anchorRect ? (
        <div
          aria-hidden="true"
          className="fixed z-[61] rounded-2xl ring-2 ring-primary ring-offset-2 ring-offset-background pointer-events-none transition-all"
          style={{
            top: anchorRect.top - 6,
            left: anchorRect.left - 6,
            width: anchorRect.width + 12,
            height: anchorRect.height + 12,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.0)",
          }}
        />
      ) : null}

      {/* Step card */}
      <div
        style={cardStyle}
        className="z-[62] rounded-3xl bg-card border border-border shadow-xl p-6 max-w-[calc(100vw-32px)]"
      >
        {/* Top: progress + skip */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 flex gap-1">
            {TUTORIAL_STEPS.map((s, i) => (
              <div
                key={s.id}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= stepIndex ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
          {!isLast ? (
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-muted-foreground hover:text-foreground rounded-full p-1"
              aria-label="Skip tour"
              data-testid="button-tutorial-skip"
            >
              <span className="sr-only">Skip tour</span>
              <XIcon className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 text-primary mx-auto mb-4">
          <Icon className="w-7 h-7" />
        </div>

        <h2 className="text-xl font-semibold text-center mb-2 tracking-tight">
          {step.title}
        </h2>
        <p className="text-sm text-muted-foreground text-center leading-relaxed mb-5">
          {step.body}
        </p>

        <div className="flex gap-2">
          {stepIndex > 0 ? (
            <Button
              type="button"
              variant="ghost"
              className="rounded-full flex-1"
              onClick={back}
              data-testid="button-tutorial-back"
            >
              Back
            </Button>
          ) : null}
          <Button
            type="button"
            className="rounded-full flex-1"
            onClick={next}
            data-testid={isLast ? "button-tutorial-done" : "button-tutorial-next"}
          >
            {isLast ? "Done" : "Next"}
          </Button>
        </div>

        {!isLast ? (
          <p className="text-[11px] text-muted-foreground text-center mt-3">
            Step {stepIndex + 1} of {TUTORIAL_STEPS.length}
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
