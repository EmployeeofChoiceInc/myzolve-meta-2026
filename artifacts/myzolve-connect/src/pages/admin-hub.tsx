import { useState } from "react";
import { useLocation } from "wouter";
import {
  ShieldAlert,
  ShieldCheck,
  Gift,
  Building2,
  User,
  Ban,
  Clock,
  Inbox,
  Mail,
  MapPin,
  Users,
  Calendar,
  StickyNote,
  Trash2,
  Search,
  CheckCircle,
  XCircle,
  Infinity as InfinityIcon,
  ExternalLink,
} from "lucide-react";
import { ApiError } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  useAdminCheck,
  useComps,
  useGrantUserComp,
  useGrantOrgComp,
  useRevokeComp,
  useVerificationQueue,
  useVerificationDecision,
  useCircleBuilderApplications,
  useReviewCircleBuilderApplication,
  useAdminUserSearch,
  useAdminDeleteUser,
  type Comp,
  type VerificationApplication,
  type CircleBuilderApplication,
  type AdminUser,
} from "@/hooks/use-api";

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="text-center py-16 text-muted-foreground">
      <Icon className="w-10 h-10 mx-auto mb-3 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ── Verifications section ────────────────────────────────────────────────────

function VerificationCard({ app }: { app: VerificationApplication }) {
  const decide = useVerificationDecision();
  const { toast } = useToast();
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  async function approve() {
    try {
      await decide.mutateAsync({ circleId: app.circleId, decision: "approve" });
      toast({ title: "Circle verified ✓", description: `${app.circleName} is now verified.` });
    } catch (e) {
      toast({ title: "Failed", description: String(e), variant: "destructive" });
    }
  }

  async function reject() {
    if (!rejectReason.trim()) {
      toast({ title: "Reason required", description: "Enter a reason before rejecting.", variant: "destructive" });
      return;
    }
    try {
      await decide.mutateAsync({ circleId: app.circleId, decision: "reject", reason: rejectReason.trim() });
      toast({ title: "Application rejected", description: "The owner has been notified." });
      setShowReject(false);
      setRejectReason("");
    } catch (e) {
      toast({ title: "Failed", description: String(e), variant: "destructive" });
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-lg">{app.circleName}</h3>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
            {app.ownerName && (
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> {app.ownerName}
              </span>
            )}
            {app.ownerEmail && (
              <a href={`mailto:${app.ownerEmail}`} className="flex items-center gap-1 hover:text-foreground">
                <Mail className="w-3.5 h-3.5" /> {app.ownerEmail}
              </a>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Applied {formatDate(app.appliedAt)}
            </span>
          </div>
        </div>
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Pending
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        {app.legalName && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Org name</p>
            <p>{app.legalName}</p>
          </div>
        )}
        {app.orgType && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Org type</p>
            <p className="capitalize">{app.orgType.replace(/_/g, " ")}</p>
          </div>
        )}
        {app.contactEmail && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Contact</p>
            <a href={`mailto:${app.contactEmail}`} className="text-primary hover:underline">{app.contactEmail}</a>
          </div>
        )}
        {app.supportingUrl && (
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Supporting URL</p>
            <a href={app.supportingUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
              {app.supportingUrl} <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>

      {app.description && (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Description</p>
          <p className="text-sm whitespace-pre-wrap">{app.description}</p>
        </div>
      )}

      {showReject && (
        <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <StickyNote className="w-3.5 h-3.5" /> Rejection reason (required)
          </label>
          <Textarea
            rows={2}
            maxLength={500}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Insufficient information provided about the organization."
            disabled={decide.isPending}
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        <Button size="sm" onClick={approve} disabled={decide.isPending || showReject} className="gap-1.5">
          <CheckCircle className="w-4 h-4" /> Approve
        </Button>
        {showReject ? (
          <>
            <Button size="sm" variant="destructive" onClick={reject} disabled={decide.isPending} className="gap-1.5">
              <XCircle className="w-4 h-4" /> Confirm reject
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowReject(false); setRejectReason(""); }}>
              Cancel
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setShowReject(true)} disabled={decide.isPending}>
            Reject…
          </Button>
        )}
      </div>
    </div>
  );
}

function VerificationsSection() {
  const { data, isLoading, error } = useVerificationQueue();

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error) return <p className="text-sm text-destructive">Could not load verification queue.</p>;

  const queue = data ?? [];
  return (
    <div>
      <SectionHeader
        title={`Verification queue ${queue.length > 0 ? `(${queue.length})` : ""}`}
        description="Review circle verification applications. Approved circles display a verified badge to all members."
      />
      {queue.length === 0 ? (
        <EmptyState icon={ShieldCheck} message="No pending verification applications." />
      ) : (
        <div className="space-y-4">
          {queue.map((app) => (
            <VerificationCard key={app.circleId} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Circle Builders section ──────────────────────────────────────────────────

const CB_STATUS_STYLES: Record<CircleBuilderApplication["status"], string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  declined: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

const CB_FILTERS: Array<{ label: string; value: "all" | CircleBuilderApplication["status"] }> = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Declined", value: "declined" },
];

function CBApplicationCard({ app }: { app: CircleBuilderApplication }) {
  const review = useReviewCircleBuilderApplication();
  const { toast } = useToast();
  const [note, setNote] = useState(app.reviewNote ?? "");

  async function setStatus(status: CircleBuilderApplication["status"]) {
    try {
      await review.mutateAsync({ id: app.id, status, reviewNote: note.trim() || null });
      toast({ title: `Marked ${status}` });
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    }
  }

  async function saveNote() {
    try {
      await review.mutateAsync({ id: app.id, status: app.status, reviewNote: note.trim() || null });
      toast({ title: "Note saved" });
    } catch {
      toast({ title: "Couldn't save note", variant: "destructive" });
    }
  }

  const noteChanged = note.trim() !== (app.reviewNote ?? "");

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-lg">{app.name}</h3>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
            <a href={`mailto:${app.email}`} className="flex items-center gap-1 hover:text-foreground">
              <Mail className="w-3.5 h-3.5" /> {app.email}
            </a>
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {app.location}</span>
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {app.networkSize}</span>
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDate(app.createdAt)}</span>
          </div>
        </div>
        <Badge className={CB_STATUS_STYLES[app.status]}>{app.status}</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        {[
          { label: "Community served", value: app.communityServed },
          { label: "Willing to host within 60 days", value: app.willingToHost ? "Yes" : "No" },
          { label: "Why they want to build", value: app.motivation },
          { label: "Desired impact", value: app.desiredImpact },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
            <p className="whitespace-pre-wrap">{value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2 pt-2 border-t border-border">
        <label className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
          <StickyNote className="w-3.5 h-3.5" /> Review note
        </label>
        <Textarea
          rows={2}
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Record why this was approved or declined…"
          disabled={review.isPending}
        />
        {(app.reviewedByName || app.reviewedAt) && (
          <p className="text-xs text-muted-foreground">
            Last reviewed{app.reviewedByName ? ` by ${app.reviewedByName}` : ""}{app.reviewedAt ? ` on ${formatDate(app.reviewedAt)}` : ""}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        <Button size="sm" onClick={() => setStatus("approved")} disabled={review.isPending || app.status === "approved"}>Approve</Button>
        <Button size="sm" variant="outline" onClick={() => setStatus("declined")} disabled={review.isPending || app.status === "declined"}>Decline</Button>
        <Button size="sm" variant="secondary" onClick={saveNote} disabled={review.isPending || !noteChanged}>Save note</Button>
        {app.status !== "pending" && (
          <Button size="sm" variant="ghost" onClick={() => setStatus("pending")} disabled={review.isPending}>Reset to pending</Button>
        )}
      </div>
    </div>
  );
}

function CircleBuildersSection() {
  const { data, isLoading, error } = useCircleBuilderApplications();
  const [filter, setFilter] = useState<"all" | CircleBuilderApplication["status"]>("all");

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (error) return <p className="text-sm text-destructive">Could not load applications.</p>;

  const apps = data ?? [];
  const filtered = filter === "all" ? apps : apps.filter((a) => a.status === filter);

  return (
    <div>
      <SectionHeader
        title="Circle Builder applications"
        description="Review submissions to the 100 Circle Initiative."
      />
      <div className="flex flex-wrap gap-2 mb-6">
        {CB_FILTERS.map((f) => {
          const count = f.value === "all" ? apps.length : apps.filter((a) => a.status === f.value).length;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={Inbox} message={`No applications${filter !== "all" ? ` marked ${filter}` : " yet"}.`} />
      ) : (
        <div className="space-y-4">
          {filtered.map((app) => (
            <CBApplicationCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Comps section ────────────────────────────────────────────────────────────

function parseDuration(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function GrantUserForm() {
  const grant = useGrantUserComp();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [duration, setDuration] = useState("");
  const [reason, setReason] = useState("");

  async function submit() {
    try {
      await grant.mutateAsync({ email: email.trim(), durationDays: parseDuration(duration), reason: reason.trim() || null });
      toast({ title: "Comp granted", description: `${email} now has free Plus.` });
      setEmail(""); setDuration(""); setReason("");
    } catch (e) {
      const msg = e instanceof ApiError ? ((e.data as { message?: string })?.message ?? e.message) : "Could not grant comp.";
      toast({ title: "Failed", description: msg, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wide text-muted-foreground">User email</label>
        <Input type="email" placeholder="person@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={grant.isPending} />
        <p className="text-xs text-muted-foreground">User must have signed in at least once.</p>
      </div>
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wide text-muted-foreground">Duration (days) — blank = indefinite</label>
        <Input type="number" min={1} placeholder="e.g. 365" value={duration} onChange={(e) => setDuration(e.target.value)} disabled={grant.isPending} />
      </div>
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wide text-muted-foreground">Reason (optional)</label>
        <Textarea rows={2} maxLength={2000} placeholder="Why is this comp being granted?" value={reason} onChange={(e) => setReason(e.target.value)} disabled={grant.isPending} />
      </div>
      <Button onClick={submit} disabled={grant.isPending || !email.trim()} className="gap-1.5">
        <Gift className="w-4 h-4" /> Grant free Plus to user
      </Button>
    </div>
  );
}

function GrantOrgForm() {
  const grant = useGrantOrgComp();
  const { toast } = useToast();
  const [ownerEmail, setOwnerEmail] = useState("");
  const [orgId, setOrgId] = useState("");
  const [duration, setDuration] = useState("");
  const [reason, setReason] = useState("");

  async function submit() {
    try {
      await grant.mutateAsync({
        orgId: orgId.trim() ? Number(orgId.trim()) : undefined,
        ownerEmail: !orgId.trim() && ownerEmail.trim() ? ownerEmail.trim() : undefined,
        durationDays: parseDuration(duration),
        reason: reason.trim() || null,
      });
      toast({ title: "Org comp granted", description: "The reunion/org now has free access for all members." });
      setOwnerEmail(""); setOrgId(""); setDuration(""); setReason("");
    } catch (e) {
      const msg = e instanceof ApiError ? ((e.data as { message?: string })?.message ?? e.message) : "Could not grant org comp.";
      toast({ title: "Failed", description: msg, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wide text-muted-foreground">Owner email</label>
        <Input type="email" placeholder="owner@example.com" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} disabled={grant.isPending || !!orgId.trim()} />
      </div>
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wide text-muted-foreground">…or Org ID</label>
        <Input type="number" min={1} placeholder="e.g. 12" value={orgId} onChange={(e) => setOrgId(e.target.value)} disabled={grant.isPending} />
      </div>
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wide text-muted-foreground">Duration (days) — blank = indefinite</label>
        <Input type="number" min={1} placeholder="e.g. 365" value={duration} onChange={(e) => setDuration(e.target.value)} disabled={grant.isPending} />
      </div>
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wide text-muted-foreground">Reason (optional)</label>
        <Textarea rows={2} maxLength={2000} placeholder="Why is this comp being granted?" value={reason} onChange={(e) => setReason(e.target.value)} disabled={grant.isPending} />
      </div>
      <Button onClick={submit} disabled={grant.isPending || (!orgId.trim() && !ownerEmail.trim())} className="gap-1.5">
        <Building2 className="w-4 h-4" /> Grant free access to org
      </Button>
    </div>
  );
}

function CompRow({ comp }: { comp: Comp }) {
  const revoke = useRevokeComp();
  const { toast } = useToast();

  const status = comp.revokedAt ? "revoked" : comp.active ? "active" : "expired";
  const statusStyle =
    status === "active" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
    : status === "revoked" ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
    : "bg-muted text-muted-foreground";

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
          {comp.targetType === "user" ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">
            {comp.targetType === "user"
              ? comp.userName || comp.userEmail || `User #${comp.userId}`
              : comp.orgName || `Org #${comp.orgId}`}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {comp.targetType === "user" ? comp.userEmail : "Whole organization"}
            {comp.reason ? ` · ${comp.reason}` : ""}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            {comp.expiresAt
              ? <><Clock className="w-3 h-3" /> Ends {formatDate(comp.expiresAt)}</>
              : <><InfinityIcon className="w-3 h-3" /> No end date</>}
            {comp.grantedByName ? ` · by ${comp.grantedByName}` : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge className={statusStyle}>{status}</Badge>
        {status === "active" && (
          <Button
            size="sm" variant="outline"
            onClick={async () => {
              try { await revoke.mutateAsync(comp.id); toast({ title: "Comp revoked" }); }
              catch { toast({ title: "Failed to revoke", variant: "destructive" }); }
            }}
            disabled={revoke.isPending}
            className="gap-1.5"
          >
            <Ban className="w-3.5 h-3.5" /> Revoke
          </Button>
        )}
      </div>
    </div>
  );
}

function CompsSection() {
  const { data: comps, isLoading } = useComps();
  return (
    <div>
      <SectionHeader
        title="Complimentary access"
        description="Grant free Plus to an individual or a whole reunion/org. Comps can have an end date or run indefinitely."
      />
      <div className="rounded-2xl border border-border bg-card p-5 mb-8">
        <Tabs defaultValue="user">
          <TabsList className="mb-4">
            <TabsTrigger value="user"><User className="w-4 h-4 mr-1.5" /> Individual user</TabsTrigger>
            <TabsTrigger value="org"><Building2 className="w-4 h-4 mr-1.5" /> Reunion / org</TabsTrigger>
          </TabsList>
          <TabsContent value="user"><GrantUserForm /></TabsContent>
          <TabsContent value="org"><GrantOrgForm /></TabsContent>
        </Tabs>
      </div>

      <h3 className="text-base font-semibold mb-3">All comps</h3>
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : !comps || comps.length === 0 ? (
        <EmptyState icon={Gift} message="No comps granted yet." />
      ) : (
        <div className="space-y-2">
          {comps.map((c) => <CompRow key={c.id} comp={c} />)}
        </div>
      )}
    </div>
  );
}

// ── Users section ────────────────────────────────────────────────────────────

function UserRow({ user }: { user: AdminUser }) {
  const deleteUser = useAdminDeleteUser();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);

  async function doDelete() {
    try {
      await deleteUser.mutateAsync(user.id);
      toast({ title: "User deleted", description: `${user.displayName} has been anonymized and removed.` });
      setConfirming(false);
    } catch (e) {
      toast({ title: "Delete failed", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
    }
  }

  const planLabel = user.planKind === "plus" ? "Plus" : user.planKind === "family" ? "Family" : "Free";

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-semibold text-muted-foreground">
          {(user.displayName ?? "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">{user.displayName}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email ?? "No email"}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Joined {formatDate(user.createdAt)} · {planLabel}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {confirming ? (
          <>
            <span className="text-xs text-destructive font-medium">Delete this user?</span>
            <Button size="sm" variant="destructive" onClick={doDelete} disabled={deleteUser.isPending} className="gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Confirm
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setConfirming(true)} className="gap-1.5 text-destructive hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </Button>
        )}
      </div>
    </div>
  );
}

function UsersSection() {
  const [query, setQuery] = useState("");
  const { data: results, isLoading, error } = useAdminUserSearch(query);

  return (
    <div>
      <SectionHeader
        title="User management"
        description="Search any user by name or email. Deleting a user anonymizes their account, revokes all sessions, and transfers or removes their circles."
      />
      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9"
          placeholder="Name or email (min 2 chars)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {query.trim().length < 2 ? (
        <p className="text-sm text-muted-foreground">Type at least 2 characters to search.</p>
      ) : isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : error ? (
        <p className="text-sm text-destructive">Search failed. Please try again.</p>
      ) : !results || results.length === 0 ? (
        <EmptyState icon={Search} message={`No users found matching "${query}".`} />
      ) : (
        <div className="space-y-2">
          {results.map((u) => <UserRow key={u.id} user={u} />)}
        </div>
      )}
    </div>
  );
}

// ── Page shell ───────────────────────────────────────────────────────────────

export default function AdminHubPage() {
  const { isLoading: checking, error: checkError } = useAdminCheck();
  const isForbidden = checkError instanceof ApiError && checkError.status === 403;

  if (checking) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (isForbidden) {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-6">
        <div className="w-16 h-16 bg-muted text-muted-foreground rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold mb-3">Not authorized</h1>
        <p className="text-muted-foreground">This page is only available to MyZolve program admins.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ShieldAlert className="w-7 h-7 text-primary" /> Admin
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">MyZolve internal tools — verifications, circle builders, comps, and user management.</p>
      </div>

      <Tabs defaultValue="verifications">
        <TabsList className="mb-8 flex flex-wrap h-auto gap-1">
          <TabsTrigger value="verifications" className="gap-1.5"><ShieldCheck className="w-4 h-4" /> Verifications</TabsTrigger>
          <TabsTrigger value="circle-builders" className="gap-1.5"><Users className="w-4 h-4" /> Circle Builders</TabsTrigger>
          <TabsTrigger value="comps" className="gap-1.5"><Gift className="w-4 h-4" /> Comps</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5"><User className="w-4 h-4" /> Users</TabsTrigger>
        </TabsList>

        <TabsContent value="verifications"><VerificationsSection /></TabsContent>
        <TabsContent value="circle-builders"><CircleBuildersSection /></TabsContent>
        <TabsContent value="comps"><CompsSection /></TabsContent>
        <TabsContent value="users"><UsersSection /></TabsContent>
      </Tabs>
    </div>
  );
}
