import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetOrgDashboard,
  getGetOrgDashboardQueryKey,
  useUpdateOrg,
  useCreateOrgCheckout,
  useCreateOrgPortal,
  useCreateOrgInvite,
  useRevokeOrgInvite,
  useRemoveOrgMember,
  customFetch,
  type OrgMember,
  type OrgInvite,
  type CreateOrgInviteBodyRole,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Users,
  CreditCard,
  Mail,
  Link as LinkIcon,
  Copy,
  Trash2,
  Upload,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { objectPathToUrl } from "@/hooks/use-api";

function origin(): string {
  return typeof window !== "undefined" ? window.location.origin : "";
}

export default function OrgDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const orgId = Number(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data, isLoading, error } = useGetOrgDashboard(orgId, {
    query: {
      enabled: Number.isFinite(orgId) && orgId > 0,
      queryKey: getGetOrgDashboardQueryKey(orgId),
    },
  });
  const updateOrg = useUpdateOrg();
  const checkout = useCreateOrgCheckout();
  const portal = useCreateOrgPortal();
  const createInvite = useCreateOrgInvite();
  const revokeInvite = useRevokeOrgInvite();
  const removeMember = useRemoveOrgMember();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [name, setName] = useState("");
  const [accentColor, setAccentColor] = useState("#2563eb");
  const [brandingInit, setBrandingInit] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<CreateOrgInviteBodyRole>("member");
  const [seats, setSeats] = useState(1);

  const org = data?.org;

  useEffect(() => {
    if (org && !brandingInit) {
      setName(org.name);
      if (org.accentColor) setAccentColor(org.accentColor);
      setBrandingInit(true);
    }
  }, [org, brandingInit]);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto w-full animate-pulse">
        <div className="h-8 bg-muted w-1/3 rounded mb-6" />
        <div className="h-64 bg-muted rounded-2xl" />
      </div>
    );
  }

  if (error || !org || !data) {
    return (
      <div className="max-w-3xl mx-auto w-full">
        <Card className="rounded-2xl">
          <CardHeader className="text-center py-12">
            <CardTitle>Organization unavailable</CardTitle>
            <CardDescription>
              You may not have admin access to this organization, or it no longer exists.
            </CardDescription>
            <div className="pt-4">
              <Button variant="outline" className="rounded-full" onClick={() => setLocation("/orgs")}>
                Back to Organizations
              </Button>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const accent = accentColor || undefined;
  const isPerSeat = org.seatLimit === 0 || org.billingType === "annual";

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const { uploadURL, objectPath } = await customFetch<{
        uploadURL: string;
        objectPath: string;
      }>(`/api/orgs/${orgId}/logo/request-url`, {
        method: "POST",
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      updateOrg.mutate(
        { orgId, data: { logoObjectPath: objectPath } },
        {
          onSuccess: () => toast({ title: "Logo updated" }),
          onError: () => toast({ title: "Could not save logo", variant: "destructive" }),
        },
      );
    } catch {
      toast({ title: "Could not upload logo", variant: "destructive" });
    } finally {
      setLogoUploading(false);
    }
  }

  function handleSaveBranding() {
    updateOrg.mutate(
      { orgId, data: { name: name.trim(), accentColor } },
      {
        onSuccess: () => toast({ title: "Branding saved" }),
        onError: () => toast({ title: "Could not save branding", variant: "destructive" }),
      },
    );
  }

  function handleCheckout() {
    checkout.mutate(
      {
        orgId,
        data: {
          seats: isPerSeat ? seats : undefined,
          successUrl: `${origin()}/orgs/${orgId}`,
          cancelUrl: `${origin()}/orgs/${orgId}`,
        },
      },
      {
        onSuccess: (res) => {
          if (res.url) window.location.href = res.url;
        },
        onError: () =>
          toast({
            title: "Online billing coming soon",
            description:
              "We're finalizing payments. Contact us and we'll help you set up your plan in the meantime.",
          }),
      },
    );
  }

  function handlePortal() {
    portal.mutate(
      { orgId, data: { returnUrl: `${origin()}/orgs/${orgId}` } },
      {
        onSuccess: (res) => {
          if (res.url) window.location.href = res.url;
        },
        onError: () =>
          toast({
            title: "Online billing coming soon",
            description: "The billing portal isn't available yet. Contact us for help with your plan.",
          }),
      },
    );
  }

  function handleInvite(asLink: boolean) {
    const body = asLink ? { role: inviteRole } : { email: inviteEmail.trim(), role: inviteRole };
    if (!asLink && !inviteEmail.trim()) return;
    createInvite.mutate(
      { orgId, data: body },
      {
        onSuccess: (invite) => {
          setInviteEmail("");
          if (asLink) {
            const url = `${origin()}/org-invite/${invite.token}`;
            void navigator.clipboard?.writeText(url);
            toast({ title: "Invite link copied", description: url });
          } else {
            toast({ title: "Invitation sent", description: `Invited ${invite.email}` });
          }
        },
        onError: (err) => {
          const raw: unknown = err.data;
          const msg =
            raw && typeof raw === "object" && "error" in raw
              ? String((raw as Record<string, unknown>).error)
              : "Could not create invite.";
          toast({ title: "Invite failed", description: msg, variant: "destructive" });
        },
      },
    );
  }

  function copyInviteLink(invite: OrgInvite) {
    const url = `${origin()}/org-invite/${invite.token}`;
    void navigator.clipboard?.writeText(url);
    toast({ title: "Link copied", description: url });
  }

  const seatsUsed = org.seatsUsed ?? 0;

  return (
    <div className="max-w-3xl mx-auto w-full">
      <button
        onClick={() => setLocation(`/orgs/${orgId}`)}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to home
      </button>

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden border shrink-0"
          style={accent ? { borderColor: accent } : undefined}
        >
          {org.logoUrl ? (
            <img src={org.logoUrl} alt={org.name} className="w-full h-full object-cover" />
          ) : (
            <Building2 className="w-8 h-8" style={accent ? { color: accent } : undefined} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold truncate">{org.name}</h1>
            <Badge
              variant={org.isActive ? "secondary" : "outline"}
              className="rounded-full capitalize"
            >
              {org.comped ? "Complimentary" : org.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {org.planName} · {seatsUsed}
            {org.seatLimit > 0 ? ` / ${org.seatLimit}` : ""} seats used
          </p>
        </div>
      </div>

      {/* Billing */}
      <Card className="rounded-2xl mb-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="w-5 h-5" /> Billing & seats
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {org.comped ? (
            <div className="flex items-center gap-2 text-sm text-secondary">
              <CheckCircle2 className="w-4 h-4" />
              Complimentary access is active — all seats are unlocked and no
              payment is needed.
            </div>
          ) : org.isActive ? (
            <>
              <div className="flex items-center gap-2 text-sm text-secondary">
                <CheckCircle2 className="w-4 h-4" />
                Your plan is active.
                {org.currentPeriodEnd
                  ? ` Renews ${new Date(org.currentPeriodEnd).toLocaleDateString()}.`
                  : ""}
              </div>
              <Button
                variant="outline"
                className="rounded-full w-fit"
                onClick={handlePortal}
                disabled={portal.isPending}
              >
                Manage billing
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Complete checkout to activate seats and unlock MyZolve Plus for your members.
              </p>
              {isPerSeat && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="seats" className="text-sm">
                    Seats
                  </Label>
                  <Input
                    id="seats"
                    type="number"
                    min={1}
                    max={1000}
                    value={seats}
                    onChange={(e) => setSeats(Math.max(1, Number(e.target.value)))}
                    className="w-24"
                  />
                </div>
              )}
              <Button
                className="rounded-full w-fit"
                style={accent ? { backgroundColor: accent } : undefined}
                onClick={handleCheckout}
                disabled={checkout.isPending}
              >
                {checkout.isPending ? "Starting checkout..." : "Complete checkout"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Branding */}
      <Card className="rounded-2xl mb-5">
        <CardHeader>
          <CardTitle className="text-lg">Branding</CardTitle>
          <CardDescription>
            Your logo and accent color appear on circles connected to this organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-name-edit">Name</Label>
            <Input
              id="org-name-edit"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="accent">Accent color</Label>
              <input
                id="accent"
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-10 w-16 rounded-md border cursor-pointer bg-transparent"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Logo</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoChange}
              />
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={logoUploading}
              >
                <Upload className="w-4 h-4 mr-1" />
                {logoUploading ? "Uploading..." : "Upload logo"}
              </Button>
            </div>
          </div>
          <Button
            className="rounded-full w-fit"
            onClick={handleSaveBranding}
            disabled={updateOrg.isPending || !name.trim()}
          >
            Save branding
          </Button>
        </CardContent>
      </Card>

      {/* Invite */}
      <Card className="rounded-2xl mb-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="w-5 h-5" /> Invite members
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              placeholder="member@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as CreateOrgInviteBodyRole)}
              className="rounded-md border bg-background px-3 text-sm h-10"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <Button
              className="rounded-full"
              onClick={() => handleInvite(false)}
              disabled={createInvite.isPending || !inviteEmail.trim()}
            >
              Send invite
            </Button>
          </div>
          <Button
            variant="outline"
            className="rounded-full w-fit"
            onClick={() => handleInvite(true)}
            disabled={createInvite.isPending}
          >
            <LinkIcon className="w-4 h-4 mr-1" /> Create shareable link
          </Button>

          {data.pendingInvites.length > 0 && (
            <>
              <Separator className="my-1" />
              <p className="text-xs font-medium text-muted-foreground">Pending invites</p>
              <div className="flex flex-col gap-2">
                {data.pendingInvites.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center gap-2 rounded-xl border p-2 px-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">
                        {inv.email ?? "Shareable link invite"}
                      </p>
                      <p className="text-[11px] text-muted-foreground capitalize">{inv.role}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Copy link"
                      onClick={() => copyInviteLink(inv)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      title="Revoke"
                      onClick={() =>
                        revokeInvite.mutate({ orgId, inviteId: inv.id })
                      }
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Members */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5" /> Members ({data.members.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {data.members.map((m: OrgMember) => (
            <div key={m.id} className="flex items-center gap-3 rounded-xl border p-2 px-3">
              <Avatar className="h-9 w-9">
                <AvatarImage src={objectPathToUrl(m.avatarObjectPath)} alt={m.displayName ?? ""} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {(m.displayName ?? "?").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{m.displayName ?? m.email}</p>
                <p className="text-[11px] text-muted-foreground capitalize">{m.role}</p>
              </div>
              {m.role !== "owner" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  title="Remove member"
                  onClick={() => removeMember.mutate({ orgId, memberId: m.id })}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
