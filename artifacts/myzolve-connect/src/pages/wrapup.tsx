import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Sparkles,
  Heart,
  HandHeart,
  MessageCircle,
  Smile,
  Star,
  CalendarDays,
  ChevronDown,
} from "lucide-react";
import {
  useGetLatestWrapup,
  useListWrapups,
  useMarkWrapupRead,
  getGetLatestWrapupQueryKey,
  getListWrapupsQueryKey,
  type Wrapup,
  type WrapupMomentKind,
  WrapupKind,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { objectPathToUrl } from "@/hooks/use-api";

const MOMENT_META: Record<
  WrapupMomentKind,
  { icon: typeof Heart; tone: string }
> = {
  request_fulfilled: { icon: HandHeart, tone: "bg-primary/10 text-primary" },
  gratitude_received: { icon: Heart, tone: "bg-secondary/10 text-secondary" },
  gratitude_sent: { icon: Heart, tone: "bg-secondary/10 text-secondary" },
  top_comment: { icon: MessageCircle, tone: "bg-accent text-accent-foreground" },
  reaction_received: { icon: Smile, tone: "bg-orange-500/10 text-orange-600" },
};

function useKindFromQuery(): "weekly" | "monthly" | null {
  const [location] = useLocation();
  return useMemo(() => {
    const idx = location.indexOf("?");
    if (idx === -1) return null;
    const params = new URLSearchParams(location.slice(idx + 1));
    const v = params.get("kind");
    if (v === "monthly") return "monthly";
    if (v === "weekly") return "weekly";
    return null;
  }, [location]);
}

export default function WrapupPage() {
  const requestedKind = useKindFromQuery();
  const queryClient = useQueryClient();

  // Pre-fetch both kinds so we can pick whichever is unread for the initial view.
  const { data: weeklyLatest } = useGetLatestWrapup({ kind: "weekly" });
  const { data: monthlyLatest } = useGetLatestWrapup({ kind: "monthly" });

  const [kind, setKind] = useState<"weekly" | "monthly">("weekly");
  const [defaulted, setDefaulted] = useState(false);

  // Apply the URL kind immediately whenever it changes.
  useEffect(() => {
    if (requestedKind) {
      setKind(requestedKind);
      setDefaulted(true);
    }
  }, [requestedKind]);

  // Apply the unread-aware default once, on first load, only if no URL kind is set.
  useEffect(() => {
    if (defaulted) return;
    if (requestedKind) return;
    if (weeklyLatest === undefined || monthlyLatest === undefined) return;
    if (weeklyLatest && !weeklyLatest.readAt) {
      setKind("weekly");
    } else if (monthlyLatest && !monthlyLatest.readAt) {
      setKind("monthly");
    }
    setDefaulted(true);
  }, [defaulted, requestedKind, weeklyLatest, monthlyLatest]);

  const latest = kind === "weekly" ? weeklyLatest : monthlyLatest;
  const isLoading = latest === undefined;
  const { data: weeklyHistory } = useListWrapups({ kind: "weekly", limit: 8 });
  const { data: monthlyHistory } = useListWrapups({ kind: "monthly", limit: 8 });
  const markRead = useMarkWrapupRead();
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);

  function refreshAfterRead(targetKind: "weekly" | "monthly") {
    queryClient.invalidateQueries({
      queryKey: getGetLatestWrapupQueryKey({ kind: targetKind }),
    });
    queryClient.invalidateQueries({
      queryKey: getListWrapupsQueryKey({ kind: targetKind, limit: 8 }),
    });
  }

  function markWrapupRead(w: Wrapup) {
    if (w.readAt) return;
    markRead.mutate(
      { wrapupId: w.id },
      { onSuccess: () => refreshAfterRead(w.kind) },
    );
  }

  useEffect(() => {
    if (latest) markWrapupRead(latest);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest?.id]);

  // History merges both kinds, newest first, excluding the currently visible latest.
  const history = useMemo<Wrapup[]>(() => {
    const all = [...(weeklyHistory ?? []), ...(monthlyHistory ?? [])];
    return all
      .filter((w) => w.id !== latest?.id)
      .sort((a, b) => parseISO(b.periodEnd).getTime() - parseISO(a.periodEnd).getTime());
  }, [weeklyHistory, monthlyHistory, latest?.id]);

  function toggleHistory(w: Wrapup) {
    if (expandedHistoryId === w.id) {
      setExpandedHistoryId(null);
    } else {
      setExpandedHistoryId(w.id);
      markWrapupRead(w);
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-3xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Wrap-ups</h1>
          <p className="text-muted-foreground mt-1">
            A gentle look back at moments of care from your circles.
          </p>
        </div>
        <div className="inline-flex rounded-full border border-border bg-card p-1" role="tablist">
          {(["weekly", "monthly"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => {
                setDefaulted(true);
                setKind(k);
              }}
              className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
                kind === k
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`wrapup-tab-${k}`}
            >
              {k === "weekly" ? "Weekly" : "Monthly"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="h-48 rounded-3xl bg-muted/40 animate-pulse" />
          <div className="h-32 rounded-3xl bg-muted/40 animate-pulse" />
        </div>
      ) : !latest ? (
        <EmptyState kind={kind} />
      ) : (
        <CurrentWrapupCard wrapup={latest} />
      )}

      {history.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-4">Earlier wrap-ups</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Both weekly and monthly recaps. Tap one to open it.
          </p>
          <div className="space-y-3">
            {history.map((w) => {
              const isOpen = expandedHistoryId === w.id;
              const isUnread = !w.readAt;
              return (
                <Card
                  key={w.id}
                  className="rounded-2xl border-border/50 shadow-none overflow-hidden"
                  data-testid={`wrapup-history-${w.id}`}
                >
                  <button
                    type="button"
                    onClick={() => toggleHistory(w)}
                    aria-expanded={isOpen}
                    className="w-full text-left"
                    data-testid={`wrapup-history-toggle-${w.id}`}
                  >
                    <div className="p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <CalendarDays className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">
                            {w.content.periodLabel}
                          </p>
                          <Badge
                            variant="outline"
                            className="rounded-full text-[10px] uppercase tracking-wide"
                          >
                            {w.kind === "weekly" ? "Weekly" : "Monthly"}
                          </Badge>
                          {isUnread && (
                            <span
                              className="w-2 h-2 rounded-full bg-orange-500"
                              aria-label="unread"
                            />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(parseISO(w.periodStart), "MMM d")} —{" "}
                          {format(parseISO(w.periodEnd), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-muted-foreground">Moments</p>
                          <p className="text-sm font-semibold">
                            {w.content.topMoments.length}
                          </p>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-muted-foreground transition-transform ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </div>
                    </div>
                  </button>
                  {isOpen && (
                    <div
                      className="border-t border-border/40 p-4 sm:p-6 bg-muted/10"
                      data-testid={`wrapup-history-content-${w.id}`}
                    >
                      <CurrentWrapupCard wrapup={w} />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function CurrentWrapupCard({ wrapup }: { wrapup: Wrapup }) {
  const { content } = wrapup;
  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border-border/50 shadow-sm bg-gradient-to-br from-primary/5 via-card to-secondary/5">
        <CardContent className="p-8 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <Badge variant="outline" className="rounded-full bg-card text-xs">
              {content.periodLabel}
            </Badge>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold leading-tight">
            {content.greeting}
          </h2>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <StatBox
              label="Support given"
              value={`$${content.supportGiven.toFixed(0)}`}
              tone="primary"
            />
            <StatBox
              label="Support received"
              value={`$${content.supportReceived.toFixed(0)}`}
              tone="secondary"
            />
          </div>
        </CardContent>
      </Card>

      {content.topMoments.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-3">Top moments</h3>
          <div className="space-y-3">
            {content.topMoments.map((m, idx) => {
              const meta = MOMENT_META[m.kind];
              const Icon = meta?.icon ?? Star;
              return (
                <Card
                  key={idx}
                  className="rounded-2xl border-border/50 shadow-none"
                  data-testid={`wrapup-moment-${idx}`}
                >
                  <CardContent className="p-4 flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        meta?.tone ?? "bg-muted text-foreground"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{m.headline}</p>
                      {m.detail ? (
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {m.detail}
                        </p>
                      ) : null}
                      {(m.circleName || m.otherPersonName) && (
                        <p className="text-[11px] text-muted-foreground mt-1.5">
                          {[m.circleName, m.otherPersonName]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {content.exchangedWith.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-3">People you exchanged care with</h3>
          <Card className="rounded-2xl border-border/50 shadow-none">
            <CardContent className="p-4 flex flex-wrap gap-3">
              {content.exchangedWith.map((p, idx) => {
                const url = objectPathToUrl(p.avatarObjectPath ?? null);
                return (
                  <div
                    key={`${p.userId ?? "x"}-${idx}`}
                    className="flex items-center gap-2 rounded-full bg-muted/50 px-3 py-1.5"
                  >
                    <Avatar className="w-7 h-7">
                      {url ? <AvatarImage src={url} alt={p.name} /> : null}
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {p.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{p.name}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
      )}

      <Card className="rounded-3xl border-secondary/30 bg-secondary/5 shadow-none">
        <CardContent className="p-6 flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
              A small prompt
            </p>
            <p className="text-base font-medium mt-1 leading-relaxed">
              {content.prompt}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "secondary";
}) {
  const colour =
    tone === "primary" ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary";
  return (
    <div className={`rounded-2xl ${colour} px-4 py-3`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function EmptyState({ kind }: { kind: "weekly" | "monthly" }) {
  const [, navigate] = useLocation();
  return (
    <Card className="rounded-3xl border-border/50 shadow-none">
      <CardContent className="p-10 text-center">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center mb-4">
          <Sparkles className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-semibold mb-1">
          {kind === "weekly"
            ? "Your first wrap-up will arrive on Sunday."
            : "Your first monthly wrap-up will arrive at month's end."}
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          We send a fresh recap of your circle's care moments {kind === "weekly" ? "every week" : "every month"}.
          Check back here soon.
        </p>
        <Button
          variant="outline"
          className="rounded-full mt-6"
          onClick={() => navigate("/dashboard")}
        >
          Back to home
        </Button>
        {/* Mention the second kind exists so users know about it */}
        <p className="text-xs text-muted-foreground mt-6">
          Tip: switch to{" "}
          <span className="font-medium text-foreground">
            {kind === "weekly" ? WrapupKind.monthly : WrapupKind.weekly}
          </span>{" "}
          above to see the other view.
        </p>
      </CardContent>
    </Card>
  );
}
