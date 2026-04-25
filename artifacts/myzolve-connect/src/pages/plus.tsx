import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Star, Apple, Users, RefreshCw, ChevronRight, Sparkles, BookOpen, Heart, ShieldCheck } from "lucide-react";
import { useListCircles, getGetCircleQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

import { PlusBadge } from "@/components/plus-badge";
import { usePaywall } from "@/components/paywall-dialog";
import {
  useMyPlusStatus,
  useUpdateMyPlusPlan,
  useMe,
  PLUS_STATUS_KEY,
  type PlanKind,
} from "@/hooks/use-api";

const FAMILY_MEMBER_CAP = 6;

const VALUE_PROPS: { icon: typeof Heart; title: string; body: string }[] = [
  { icon: Users, title: "Bigger circles", body: "No member cap on your Plus circles." },
  { icon: BookOpen, title: "Care Ledger Pro", body: "Yearly recap, per-member breakdown, and PDF/CSV exports." },
  { icon: Sparkles, title: "Voice & video moments", body: "Voice notes, short videos, and extra photos on the wall." },
  { icon: ShieldCheck, title: "Verified circle", body: "Apply for a verified badge that builds trust at a glance." },
];

export default function PlusPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const paywall = usePaywall();

  const { data: status, isLoading } = useMyPlusStatus();
  const { data: me } = useMe();
  const { data: circles } = useListCircles();
  const updatePlan = useUpdateMyPlusPlan();

  const myOwnedCircles = useMemo(
    () => (circles ?? []).filter((c) => c.ownerId === me?.id),
    [circles, me],
  );

  const [pendingPlan, setPendingPlan] = useState<PlanKind | null>(null);

  async function handleRefresh() {
    await qc.invalidateQueries({ queryKey: PLUS_STATUS_KEY });
    toast({ title: "Status refreshed" });
  }

  function handleSetPlanKind(planKind: PlanKind) {
    setPendingPlan(planKind);
    updatePlan.mutate(
      { planKind, familyCircleId: planKind === "solo" ? null : undefined },
      {
        onSuccess: () => {
          toast({ title: planKind === "family" ? "Switched to Family plan" : "Switched to Solo plan" });
          setPendingPlan(null);
        },
        onError: (err) => {
          setPendingPlan(null);
          if (paywall.handleApiError(err)) return;
          toast({ title: "Could not change plan", variant: "destructive" });
        },
      },
    );
  }

  function handlePickFamilyCircle(circleId: number) {
    updatePlan.mutate(
      { planKind: "family", familyCircleId: circleId },
      {
        onSuccess: () => {
          toast({ title: "Family circle set", description: "Up to 6 members get Plus while your subscription is active." });
          qc.invalidateQueries({ queryKey: getGetCircleQueryKey(circleId) });
        },
        onError: (err) => {
          if (paywall.handleApiError(err)) return;
          toast({ title: "Could not set family circle", variant: "destructive" });
        },
      },
    );
  }

  function handleClearFamilyCircle() {
    updatePlan.mutate(
      { planKind: "family", familyCircleId: null },
      {
        onSuccess: () => toast({ title: "Family circle cleared" }),
        onError: (err) => {
          if (paywall.handleApiError(err)) return;
          toast({ title: "Could not clear family circle", variant: "destructive" });
        },
      },
    );
  }

  if (isLoading || !status) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-48 rounded-3xl" />
      </div>
    );
  }

  const isPlus = status.isPlus;
  const isDirect = status.source === "direct";
  const isFamilyRecipient = status.source === "family";

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Hero */}
      <div className="bg-card border border-border/50 rounded-3xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#F5E6CC] rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none opacity-70" />
        <div className="relative flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="max-w-xl">
            <div className="flex items-center gap-3 mb-3">
              <PlusBadge size="md" />
              {isPlus ? (
                <span className="text-xs font-semibold text-secondary bg-secondary/10 px-2.5 py-1 rounded-full">
                  Active
                </span>
              ) : (
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                  Not active
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">MyZolve Connect Plus</h1>
            <p className="text-muted-foreground mt-2 leading-relaxed">
              The warmest version of Connect — bigger circles, richer moments, and tools made for the people who keep showing up.
            </p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Button variant="outline" className="rounded-full" onClick={handleRefresh} data-testid="plus-refresh">
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh status
            </Button>
          </div>
        </div>
      </div>

      {/* Status detail */}
      <Card className="rounded-3xl border-border/50 shadow-none">
        <CardHeader>
          <CardTitle>Your plan</CardTitle>
          <CardDescription>
            {isDirect && "You have an active Plus subscription on this account."}
            {isFamilyRecipient && status.gifterName && (
              <>Plus is shared with you by <span className="font-medium text-foreground">{status.gifterName}</span> through their family circle.</>
            )}
            {!isPlus && "Subscribe in the iPhone app to unlock Plus everywhere."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isPlus ? (
            <div className="rounded-2xl border border-[#F5E6CC] bg-[#FFF8EC] p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-[#B47A2A] text-white flex items-center justify-center shrink-0">
                <Apple className="w-4 h-4" />
              </div>
              <div className="text-sm">
                <p className="font-semibold mb-1">Subscribe in the iPhone app</p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Plus is purchased through the App Store. Open MyZolve Connect on your iPhone and tap "Get Plus" on the Plus screen to start your subscription. It turns on here automatically.
                </p>
              </div>
            </div>
          ) : isFamilyRecipient ? (
            <div className="rounded-2xl border border-secondary/30 bg-secondary/10 p-4 text-sm">
              <p className="font-semibold mb-1">Plus via family</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                You're a member of a family circle owned by {status.gifterName ?? "another Plus subscriber"}. Plus stays active for you while your membership is active and their subscription is current.
                {status.graceUntil ? ` (Grace period ends ${new Date(status.graceUntil).toLocaleDateString()}.)` : null}
              </p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs uppercase font-medium text-muted-foreground mb-2 tracking-wide">Plan kind</p>
                <div className="grid grid-cols-2 gap-3">
                  <PlanCard
                    title="Just me"
                    subtitle="Plus for you"
                    icon="user"
                    selected={status.planKind === "solo"}
                    loading={pendingPlan === "solo" && updatePlan.isPending}
                    onClick={() => handleSetPlanKind("solo")}
                    testid="plan-kind-solo"
                  />
                  <PlanCard
                    title="My family"
                    subtitle={`Up to ${FAMILY_MEMBER_CAP} people in one circle`}
                    icon="users"
                    selected={status.planKind === "family"}
                    loading={pendingPlan === "family" && updatePlan.isPending}
                    onClick={() => handleSetPlanKind("family")}
                    testid="plan-kind-family"
                  />
                </div>
              </div>

              {status.planKind === "family" ? (
                <div>
                  <p className="text-xs uppercase font-medium text-muted-foreground mb-2 tracking-wide">Family circle</p>
                  {status.familyCircleId ? (
                    <div className="rounded-2xl border border-border/50 p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {circles?.find((c) => c.id === status.familyCircleId)?.name ?? `Circle #${status.familyCircleId}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {status.familyCircleMemberCount ?? 0} of {status.familyCircleMemberCap} family members
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button asChild variant="outline" size="sm" className="rounded-full">
                          <Link href={`/circles/${status.familyCircleId}/members`}>
                            Members <ChevronRight className="w-3.5 h-3.5 ml-1" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground" onClick={handleClearFamilyCircle}>
                          Change
                        </Button>
                      </div>
                    </div>
                  ) : myOwnedCircles.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border/50 p-4 text-sm text-muted-foreground">
                      You don't own any circles yet. Create one first, then designate it as your family circle.
                    </div>
                  ) : (
                    <Select onValueChange={(v) => handlePickFamilyCircle(parseInt(v, 10))}>
                      <SelectTrigger className="rounded-2xl" data-testid="family-circle-picker">
                        <SelectValue placeholder="Pick a circle…" />
                      </SelectTrigger>
                      <SelectContent>
                        {myOwnedCircles.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    Up to {FAMILY_MEMBER_CAP} active members of this circle inherit Plus while your subscription is active. Use the circle's Members page to invite or remove people.
                  </p>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {/* What's in Plus */}
      <Card className="rounded-3xl border-border/50 shadow-none">
        <CardHeader>
          <CardTitle>What's in Plus</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {VALUE_PROPS.map((v) => (
            <div key={v.title} className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#F5E6CC] text-[#B47A2A] flex items-center justify-center shrink-0">
                <v.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">{v.title}</p>
                <p className="text-xs text-muted-foreground leading-snug">{v.body}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Manage on iPhone */}
      <Card className="rounded-3xl border-border/50 shadow-none">
        <CardHeader>
          <CardTitle>Manage your subscription</CardTitle>
          <CardDescription>
            Cancel, change billing period, or restore on your iPhone — Apple manages all subscription changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center shrink-0">
                <Apple className="w-4 h-4" />
              </div>
              <div className="text-sm min-w-0">
                <p className="font-semibold">Open App Store subscriptions</p>
                <p className="text-xs text-muted-foreground">Settings → [your name] → Subscriptions on iPhone</p>
              </div>
            </div>
            <Star className="w-5 h-5 text-[#B47A2A] shrink-0" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PlanCard({
  title,
  subtitle,
  selected,
  loading,
  onClick,
  testid,
}: {
  title: string;
  subtitle: string;
  icon: "user" | "users";
  selected: boolean;
  loading?: boolean;
  onClick: () => void;
  testid?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      data-testid={testid}
      className={`text-left rounded-2xl p-4 border transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border/50 hover:bg-muted/50"
      } disabled:opacity-50`}
    >
      <p className="font-semibold text-sm mb-0.5">{title}</p>
      <p className="text-xs text-muted-foreground leading-snug">{subtitle}</p>
      {loading ? <p className="text-xs text-muted-foreground mt-2">Saving…</p> : null}
    </button>
  );
}
