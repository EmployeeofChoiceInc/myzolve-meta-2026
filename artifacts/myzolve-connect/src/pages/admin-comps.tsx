import { useState } from "react";
import { ShieldAlert, Gift, Building2, User, Ban, Clock, Infinity as InfinityIcon } from "lucide-react";
import { ApiError } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  useAdminCheck,
  useComps,
  useGrantUserComp,
  useGrantOrgComp,
  useRevokeComp,
  type Comp,
} from "@/hooks/use-api";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function DurationField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs uppercase tracking-wide text-muted-foreground">
        Duration (days) — leave blank for indefinite
      </label>
      <Input
        type="number"
        min={1}
        placeholder="e.g. 365 (blank = no end date)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        data-testid="input-comp-duration"
      />
    </div>
  );
}

function ReasonField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs uppercase tracking-wide text-muted-foreground">
        Reason (optional)
      </label>
      <Textarea
        rows={2}
        maxLength={2000}
        placeholder="Why is this comp being granted?"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        data-testid="input-comp-reason"
      />
    </div>
  );
}

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
      await grant.mutateAsync({
        email: email.trim(),
        durationDays: parseDuration(duration),
        reason: reason.trim() || null,
      });
      toast({ title: "Comp granted", description: `${email} now has free Plus.` });
      setEmail("");
      setDuration("");
      setReason("");
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? ((e.data as { message?: string })?.message ?? e.message)
          : "Could not grant comp.";
      toast({ title: "Failed", description: msg, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wide text-muted-foreground">
          Ambassador / user email
        </label>
        <Input
          type="email"
          placeholder="person@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={grant.isPending}
          data-testid="input-user-email"
        />
        <p className="text-xs text-muted-foreground">
          The person must have signed in at least once before you can comp them.
        </p>
      </div>
      <DurationField value={duration} onChange={setDuration} disabled={grant.isPending} />
      <ReasonField value={reason} onChange={setReason} disabled={grant.isPending} />
      <Button
        onClick={submit}
        disabled={grant.isPending || !email.trim()}
        data-testid="button-grant-user"
      >
        <Gift className="w-4 h-4 mr-2" />
        Grant free Plus to user
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
    const trimmedOrgId = orgId.trim();
    const trimmedEmail = ownerEmail.trim();
    try {
      await grant.mutateAsync({
        orgId: trimmedOrgId ? Number(trimmedOrgId) : undefined,
        ownerEmail: !trimmedOrgId && trimmedEmail ? trimmedEmail : undefined,
        durationDays: parseDuration(duration),
        reason: reason.trim() || null,
      });
      toast({
        title: "Org comp granted",
        description: "The reunion/org now has free access for all members.",
      });
      setOwnerEmail("");
      setOrgId("");
      setDuration("");
      setReason("");
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? ((e.data as { message?: string })?.message ?? e.message)
          : "Could not grant org comp.";
      toast({ title: "Failed", description: msg, variant: "destructive" });
    }
  }

  const canSubmit = !!orgId.trim() || !!ownerEmail.trim();

  return (
    <div className="space-y-4 max-w-xl">
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wide text-muted-foreground">
          Reunion / org owner email
        </label>
        <Input
          type="email"
          placeholder="owner@example.com"
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          disabled={grant.isPending || !!orgId.trim()}
          data-testid="input-owner-email"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wide text-muted-foreground">
          …or org ID
        </label>
        <Input
          type="number"
          min={1}
          placeholder="e.g. 12"
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
          disabled={grant.isPending}
          data-testid="input-org-id"
        />
        <p className="text-xs text-muted-foreground">
          Provide an org ID, or the owner's email to look it up.
        </p>
      </div>
      <DurationField value={duration} onChange={setDuration} disabled={grant.isPending} />
      <ReasonField value={reason} onChange={setReason} disabled={grant.isPending} />
      <Button
        onClick={submit}
        disabled={grant.isPending || !canSubmit}
        data-testid="button-grant-org"
      >
        <Building2 className="w-4 h-4 mr-2" />
        Grant free access to org
      </Button>
    </div>
  );
}

function CompRow({ comp }: { comp: Comp }) {
  const revoke = useRevokeComp();
  const { toast } = useToast();

  async function doRevoke() {
    try {
      await revoke.mutateAsync(comp.id);
      toast({ title: "Comp revoked" });
    } catch {
      toast({ title: "Failed to revoke", variant: "destructive" });
    }
  }

  const isUser = comp.targetType === "user";
  const status = comp.revokedAt
    ? "revoked"
    : comp.active
      ? "active"
      : "expired";

  const statusStyle =
    status === "active"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      : status === "revoked"
        ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
        : "bg-muted text-muted-foreground";

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-card-border bg-card"
      data-testid={`comp-row-${comp.id}`}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
          {isUser ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">
            {isUser
              ? comp.userName || comp.userEmail || `User #${comp.userId}`
              : comp.orgName || `Org #${comp.orgId}`}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {isUser ? comp.userEmail : "Whole organization"}
            {comp.reason ? ` · ${comp.reason}` : ""}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            {comp.expiresAt ? (
              <>
                <Clock className="w-3 h-3" /> Ends {formatDate(comp.expiresAt)}
              </>
            ) : (
              <>
                <InfinityIcon className="w-3 h-3" /> No end date
              </>
            )}
            {comp.grantedByName ? ` · by ${comp.grantedByName}` : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge className={statusStyle}>{status}</Badge>
        {status === "active" && (
          <Button
            size="sm"
            variant="outline"
            onClick={doRevoke}
            disabled={revoke.isPending}
            data-testid={`button-revoke-${comp.id}`}
          >
            <Ban className="w-3.5 h-3.5 mr-1.5" />
            Revoke
          </Button>
        )}
      </div>
    </div>
  );
}

export default function AdminCompsPage() {
  const { isLoading: checking, error: checkError } = useAdminCheck();
  const isForbidden = checkError instanceof ApiError && checkError.status === 403;
  const { data: comps, isLoading: compsLoading } = useComps(!isForbidden && !checking);

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
        <p className="text-muted-foreground">
          This page is only available to MyZolve program admins.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gift className="w-6 h-6 text-primary" />
          Complimentary access
        </h1>
        <p className="text-muted-foreground mt-1">
          Grant free Plus to an individual ambassador, or free access to a whole
          reunion/org. Comps can have an end date or run indefinitely, and can be
          revoked at any time.
        </p>
      </div>

      <div className="rounded-2xl border border-card-border bg-card p-5">
        <Tabs defaultValue="user">
          <TabsList className="mb-4">
            <TabsTrigger value="user" data-testid="tab-user">
              <User className="w-4 h-4 mr-1.5" /> Individual user
            </TabsTrigger>
            <TabsTrigger value="org" data-testid="tab-org">
              <Building2 className="w-4 h-4 mr-1.5" /> Reunion / org
            </TabsTrigger>
          </TabsList>
          <TabsContent value="user">
            <GrantUserForm />
          </TabsContent>
          <TabsContent value="org">
            <GrantOrgForm />
          </TabsContent>
        </Tabs>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">All comps</h2>
        {compsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : !comps || comps.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            No comps granted yet.
          </p>
        ) : (
          <div className="space-y-2">
            {comps.map((c) => (
              <CompRow key={c.id} comp={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
