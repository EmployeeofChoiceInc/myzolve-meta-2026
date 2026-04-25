import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Apple, Smartphone, Heart, BookOpen, ShieldCheck, Mic, RotateCw } from "lucide-react";
import { ApiError } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlusBadge } from "@/components/plus-badge";
import { useMyPlusStatus } from "@/hooks/use-api";
import { useQueryClient } from "@tanstack/react-query";
import { PLUS_STATUS_KEY } from "@/hooks/use-api";

export type PaywallReason =
  | "generic"
  | "circle_member_cap"
  | "circle_role"
  | "circle_verification"
  | "ledger_pro"
  | "voice_note"
  | "video"
  | "extra_photos"
  | "rich_media"
  | "circle_customization"
  | "plan_change";

const REASON_COPY: Record<PaywallReason, { title: string; body: string }> = {
  generic: {
    title: "MyZolve Connect Plus",
    body: "Unlock the warmest parts of Connect — bigger circles, richer moments, and tools made for the people who keep showing up.",
  },
  circle_member_cap: {
    title: "Bigger circles with Plus",
    body: "Free circles cap at the original size. With Plus, invite as many loved ones as you want.",
  },
  circle_role: {
    title: "Sub-roles with Plus",
    body: "Host, treasurer, and scribe roles let trusted members co-run the circle. They unlock with Plus.",
  },
  circle_verification: {
    title: "Verified circle with Plus",
    body: "Apply for the verified badge so members know your circle is invested. Available with Plus.",
  },
  ledger_pro: {
    title: "Care Ledger Pro",
    body: "See per-member breakdowns and download yearly recaps as PDF or CSV. Available with Plus.",
  },
  voice_note: {
    title: "Voice notes with Plus",
    body: "Send richer updates — record a voice note and post it straight to the wall.",
  },
  video: {
    title: "Short videos with Plus",
    body: "Share short videos with the people who matter most.",
  },
  extra_photos: {
    title: "More photos with Plus",
    body: "Free posts cap at 3 photos. Plus lets you share up to 8 in one moment.",
  },
  rich_media: {
    title: "Rich media with Plus",
    body: "Voice notes, videos, and extra photos are part of MyZolve Connect Plus.",
  },
  circle_customization: {
    title: "Customize your circle with Plus",
    body: "Choose a banner, accent color, and welcome message — all part of Plus.",
  },
  plan_change: {
    title: "Subscribe to switch plans",
    body: "Switching to a family plan requires an active Plus subscription.",
  },
};

type PaywallContextValue = {
  open: (reason?: PaywallReason) => void;
  close: () => void;
  handleApiError: (err: unknown) => boolean;
};

const PaywallContext = createContext<PaywallContextValue | null>(null);

export function usePaywall(): PaywallContextValue {
  const ctx = useContext(PaywallContext);
  if (!ctx) {
    throw new Error("usePaywall must be used within <PaywallProvider/>");
  }
  return ctx;
}

/**
 * Inspect an unknown thrown value and extract a `plus_required` reason
 * (or null if it isn't a plus-required error). Centralized so every
 * caller does the same thing.
 */
export function readPlusRequiredReason(err: unknown): PaywallReason | null {
  if (!err || typeof err !== "object") return null;
  if (!(err instanceof ApiError)) return null;
  if (err.status !== 402) return null;
  const data = err.data as { error?: string; reason?: string } | null;
  if (!data || data.error !== "plus_required") return null;
  const reason = (data.reason ?? "generic") as PaywallReason;
  if (reason in REASON_COPY) return reason;
  return "generic";
}

const VALUE_PROPS: { icon: typeof Heart; title: string; body: string }[] = [
  { icon: Heart, title: "Bigger circles", body: "No member cap on Plus circles." },
  { icon: BookOpen, title: "Care Ledger Pro", body: "Yearly recaps + PDF/CSV exports." },
  { icon: Mic, title: "Voice & video moments", body: "Photos, voice notes, and short videos on the wall." },
  { icon: ShieldCheck, title: "Verified badge", body: "A small badge that builds trust in your circle." },
];

export function PaywallProvider({ children }: { children: React.ReactNode }) {
  const [openState, setOpenState] = useState<{ open: boolean; reason: PaywallReason }>({
    open: false,
    reason: "generic",
  });
  const qc = useQueryClient();

  const open = useCallback((reason: PaywallReason = "generic") => {
    setOpenState({ open: true, reason });
  }, []);

  const close = useCallback(() => {
    setOpenState((s) => ({ ...s, open: false }));
  }, []);

  const handleApiError = useCallback(
    (err: unknown): boolean => {
      const reason = readPlusRequiredReason(err);
      if (reason) {
        open(reason);
        return true;
      }
      return false;
    },
    [open],
  );

  const value = useMemo(
    () => ({ open, close, handleApiError }),
    [open, close, handleApiError],
  );

  const handleRefresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: PLUS_STATUS_KEY });
  }, [qc]);

  const copy = REASON_COPY[openState.reason];

  return (
    <PaywallContext.Provider value={value}>
      {children}
      <Dialog open={openState.open} onOpenChange={(o) => (o ? null : close())}>
        <DialogContent className="max-w-md" data-testid="paywall-dialog">
          <DialogHeader>
            <div className="mb-2"><PlusBadge size="md" /></div>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.body}</DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            {VALUE_PROPS.map((v) => (
              <div key={v.title} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#F5E6CC] text-[#B47A2A] flex items-center justify-center shrink-0">
                  <v.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight">{v.title}</p>
                  <p className="text-xs text-muted-foreground leading-snug">{v.body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-[#F5E6CC] bg-[#FFF8EC] p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#B47A2A] text-white flex items-center justify-center shrink-0">
                <Apple className="w-4 h-4" />
              </div>
              <div className="text-sm">
                <p className="font-semibold mb-1">Subscribe in the iPhone app</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Plus is purchased through the App Store on your iPhone. Once you subscribe there, Plus turns on
                  here and on every other device automatically.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              className="text-muted-foreground"
              onClick={handleRefresh}
              data-testid="paywall-refresh"
            >
              <RotateCw className="w-4 h-4 mr-2" /> Refresh status
            </Button>
            <Button onClick={close} data-testid="paywall-close">
              <Smartphone className="w-4 h-4 mr-2" /> Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PaywallContext.Provider>
  );
}

export function useIsPlus(): { isPlus: boolean; status: ReturnType<typeof useMyPlusStatus>["data"] } {
  const { data } = useMyPlusStatus();
  return { isPlus: !!data?.isPlus, status: data };
}
