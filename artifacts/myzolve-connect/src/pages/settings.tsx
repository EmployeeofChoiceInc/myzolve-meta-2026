import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  useMe,
  useUpdateMe,
  useAvatarUpload,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  useMyPlusStatus,
  useMyCircleVisibility,
  useUpdateCircleVisibility,
  useMyBlocks,
  useUnblockUser,
  objectPathToUrl,
} from "@/hooks/use-api";
import { Camera, Star, ChevronRight, UserCheck, UserPlus, Trash2, Users, Sparkles, Check, X as XIcon, Inbox, ShieldOff, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";
import { PlusBadge } from "@/components/plus-badge";
import { MemberCapacityManager } from "@/components/member-capacity-manager";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useCopilot } from "@/lib/copilot";
import { useTutorial as useTutorialHook } from "@/lib/tutorial-context";
import {
  useListCircles,
  useListCircleMembers,
  getListCircleMembersQueryKey,
  useInviteCopilot,
  useRevokeCopilotGrant,
  useAcceptCopilotGrant,
  useDeclineCopilotGrant,
  getListCopilotGrantsQueryKey,
  type CopilotGrant,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const profileFormSchema = z.object({
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  displayName: z.string().min(2, "Display name must be at least 2 characters").max(100),
  timezone: z.string().min(1, "Please pick a timezone"),
  bio: z.string().max(500).optional(),
  location: z.string().max(200).optional(),
  pronouns: z.string().max(50).optional(),
  phone: z.string().max(40).optional(),
  phoneDiscoverable: z.boolean().optional(),
  profileShowCirclesDefault: z.boolean().optional(),
});

const NOTIFICATION_TYPES = [
  { key: "new_request", label: "New support requests", description: "When someone in your circle posts a request" },
  { key: "support_received", label: "Support received", description: "When someone offers you support" },
  { key: "repayment_received", label: "Support returned", description: "When someone returns support to you" },
  { key: "new_comment", label: "New comments", description: "When someone comments on your request or post" },
  { key: "reaction_received", label: "Reactions", description: "When someone reacts to your posts" },
  { key: "gratitude_received", label: "Gratitude notes", description: "When someone sends you a gratitude message" },
  { key: "dispute_opened", label: "Disputes", description: "When a dispute is raised in your circle" },
  { key: "dispute_resolved", label: "Dispute resolved", description: "When a dispute you raised is resolved" },
  { key: "member_joined", label: "New members", description: "When someone joins your circle" },
  { key: "circle_update", label: "Circle updates", description: "Role changes and important circle updates" },
  { key: "copilot_invite_received", label: "Co-pilot invitations", description: "When someone invites you to be their co-pilot" },
  { key: "copilot_post_made", label: "Posted on your behalf", description: "When your co-pilot posts something for you" },
  { key: "wrapup_weekly", label: "Weekly wrap-up", description: "A gentle weekly recap of care moments" },
  { key: "wrapup_monthly", label: "Monthly wrap-up", description: "A monthly recap of care moments" },
] as const;

function NotificationPreferencesCard() {
  const { data: prefs, isLoading } = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();
  const { toast } = useToast();

  const getEnabled = (key: string) => {
    if (!prefs) return true;
    const found = prefs.find((p) => p.notificationType === key);
    return found ? found.enabled : true;
  };

  const handleToggle = (key: string, enabled: boolean) => {
    updatePrefs.mutate([{ notificationType: key, enabled }], {
      onError: () => toast({ title: "Failed to update preference", variant: "destructive" }),
    });
  };

  if (isLoading) {
    return (
      <Card className="rounded-3xl border-border/50 shadow-sm">
        <CardContent className="p-8 animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-muted/40 rounded-xl" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl border-border/50 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>Choose what you want to be notified about. You can change these any time.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {NOTIFICATION_TYPES.map((type) => (
          <div key={type.key} className="flex items-center justify-between py-3 border-b border-border/40 last:border-0">
            <div className="flex-1 min-w-0 pr-4">
              <p className="font-medium text-sm">{type.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{type.description}</p>
            </div>
            <Switch
              checked={getEnabled(type.key)}
              onCheckedChange={(enabled) => handleToggle(type.key, enabled)}
              disabled={updatePrefs.isPending}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { data: profile, isLoading } = useMe();
  const updateMe = useUpdateMe();
  const avatarUpload = useAvatarUpload();
  const { toast } = useToast();
  const initialized = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const form = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      displayName: "",
      timezone: "UTC",
      bio: "",
      location: "",
      pronouns: "",
      phone: "",
      phoneDiscoverable: false,
      profileShowCirclesDefault: true,
    },
  });

  useEffect(() => {
    if (profile && !initialized.current) {
      form.reset({
        firstName: profile.firstName ?? "",
        lastName: profile.lastName ?? "",
        displayName: profile.displayName ?? "",
        timezone: profile.timezone ?? "UTC",
        bio: profile.bio ?? "",
        location: profile.location ?? "",
        pronouns: profile.pronouns ?? "",
        phone: profile.phone ?? "",
        phoneDiscoverable: profile.phoneDiscoverable ?? false,
        profileShowCirclesDefault: profile.profileShowCirclesDefault ?? true,
      });
      initialized.current = true;
    }
  }, [profile, form]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    avatarUpload.mutate(file, {
      onSuccess: (objectPath) => {
        updateMe.mutate(
          { avatarObjectPath: objectPath },
          {
            onSuccess: () => toast({ title: "Photo updated" }),
            onError: () => {
              toast({ title: "Could not save photo", variant: "destructive" });
              setAvatarPreview(null);
            },
          },
        );
      },
      onError: () => {
        toast({ title: "Could not upload photo", variant: "destructive" });
        setAvatarPreview(null);
      },
    });
  }

  function onSubmit(values: z.infer<typeof profileFormSchema>) {
    const payload = {
      displayName: values.displayName,
      timezone: values.timezone,
      ...(values.firstName ? { firstName: values.firstName } : {}),
      ...(values.lastName ? { lastName: values.lastName } : {}),
      ...(values.bio !== undefined ? { bio: values.bio } : {}),
      ...(values.location !== undefined ? { location: values.location } : {}),
      ...(values.pronouns !== undefined ? { pronouns: values.pronouns } : {}),
      ...(values.phone !== undefined ? { phone: values.phone } : {}),
      ...(values.phoneDiscoverable !== undefined ? { phoneDiscoverable: values.phoneDiscoverable } : {}),
      ...(values.profileShowCirclesDefault !== undefined ? { profileShowCirclesDefault: values.profileShowCirclesDefault } : {}),
    };
    updateMe.mutate(payload, {
      onSuccess: () => {
        toast({ title: "Profile updated", description: "Your changes have been saved successfully." });
      },
      onError: () => {
        toast({ title: "Error", description: "Could not update profile.", variant: "destructive" });
      },
    });
  }

  if (isLoading) {
    return (
      <div className="p-8 animate-pulse">
        <div className="h-8 bg-muted w-1/4 rounded mb-8" />
        <div className="h-96 bg-muted rounded-3xl max-w-2xl" />
      </div>
    );
  }

  const initials = (profile?.displayName ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const avatarSrc = avatarPreview ?? objectPathToUrl(profile?.avatarObjectPath);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your personal profile and preferences.</p>
      </div>

      <Card className="rounded-3xl border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle>Personal Profile</CardTitle>
          <CardDescription>This is how you will appear to your trusted circles.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex items-center gap-4">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <Avatar className="w-20 h-20 border-2 border-border">
                {avatarSrc && <AvatarImage src={avatarSrc} alt={profile?.displayName} />}
                <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">{initials}</AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white" />
              </div>
              {avatarUpload.isPending && (
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium">Profile photo</p>
              <p className="text-xs text-muted-foreground">Click to upload. JPG, PNG, or WebP up to 5 MB.</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Jane" {...field} className="rounded-xl" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} className="rounded-xl" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Jane D." {...field} className="rounded-xl" />
                    </FormControl>
                    <CardDescription className="text-xs mt-1">
                      This is what others will see when you post requests or offer support.
                    </CardDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select a timezone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                        <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                        <SelectItem value="Europe/London">London (GMT)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Bio <span className="text-muted-foreground font-normal">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="A little about yourself..."
                        className="resize-none rounded-xl"
                        rows={3}
                        maxLength={500}
                        {...field}
                      />
                    </FormControl>
                    <CardDescription className="text-xs mt-1">Visible to circle members who view your profile.</CardDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Location <span className="text-muted-foreground font-normal">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="City, Country" {...field} className="rounded-xl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="pronouns"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Pronouns <span className="text-muted-foreground font-normal">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="she/her, he/him, they/them..." {...field} className="rounded-xl" data-testid="input-pronouns" />
                    </FormControl>
                    <CardDescription className="text-xs mt-1">Shown on your profile so people know how to refer to you.</CardDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3 rounded-2xl border border-border/40 p-4 bg-muted/20">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Phone number <span className="text-muted-foreground font-normal">(optional)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="+1 555 123 4567"
                          {...field}
                          className="rounded-xl"
                          data-testid="input-phone"
                        />
                      </FormControl>
                      <CardDescription className="text-xs mt-1">
                        We never share your phone number. It's only used if you choose to be findable by it below.
                      </CardDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phoneDiscoverable"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-4 pt-2">
                      <div className="flex-1">
                        <FormLabel className="text-sm">Let people find me by my phone number</FormLabel>
                        <CardDescription className="text-xs mt-0.5">
                          When on, others can search for you using your exact phone number.
                        </CardDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={!!field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-phone-discoverable"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="profileShowCirclesDefault"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-4 rounded-2xl border border-border/40 p-4">
                    <div className="flex-1">
                      <FormLabel className="text-sm">Show my circles on my profile by default</FormLabel>
                      <CardDescription className="text-xs mt-0.5">
                        You can fine-tune which circles show below.
                      </CardDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={!!field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-profile-show-circles-default"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="pt-4 border-t border-border/50 flex justify-end">
                <Button type="submit" disabled={updateMe.isPending} className="rounded-full">
                  {updateMe.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <MemberCapacityManager />

      <PlusSummaryCard />

      <ProfileVisibilitySection />

      <BlockedUsersSection />

      <CopilotSection />

      <NotificationPreferencesCard />

      <ShowTourAgainCard />
    </div>
  );
}

function ShowTourAgainCard() {
  // Lazy import to keep this file self-contained at the bottom; the provider
  // is mounted at the app root so `useTutorial()` is always available here.
  const { start } = useTutorialHook();
  return (
    <Card className="rounded-3xl border-border/50 shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-medium">Show me around again</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Replay the quick walkthrough of the main parts of the app.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-full shrink-0"
            onClick={start}
            data-testid="button-replay-tutorial"
          >
            Replay tour
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CopilotSection() {
  const { grantsAsHelper, grantsAsGrantor, pendingInvitesAsHelper, isLoading } = useCopilot();
  const [inviteOpen, setInviteOpen] = useState(false);
  const revoke = useRevokeCopilotGrant();
  const accept = useAcceptCopilotGrant();
  const decline = useDeclineCopilotGrant();
  const qc = useQueryClient();
  const { toast } = useToast();

  function refresh() {
    qc.invalidateQueries({ queryKey: getListCopilotGrantsQueryKey() });
  }

  function handleRevoke(grant: CopilotGrant) {
    if (!confirm("Remove this co-pilot connection?")) return;
    revoke.mutate(
      { grantId: grant.id },
      {
        onSuccess: () => {
          toast({ title: "Connection removed" });
          refresh();
        },
        onError: () =>
          toast({ title: "Could not remove connection", variant: "destructive" }),
      },
    );
  }

  function handleAccept(grant: CopilotGrant) {
    accept.mutate(
      { grantId: grant.id },
      {
        onSuccess: () => {
          toast({ title: "Invitation accepted" });
          refresh();
        },
        onError: () =>
          toast({ title: "Could not accept invitation", variant: "destructive" }),
      },
    );
  }

  function handleDecline(grant: CopilotGrant) {
    decline.mutate(
      { grantId: grant.id },
      {
        onSuccess: () => {
          toast({ title: "Invitation declined" });
          refresh();
        },
        onError: () =>
          toast({ title: "Could not decline invitation", variant: "destructive" }),
      },
    );
  }

  return (
    <Card className="rounded-3xl border-border/50 shadow-sm" data-testid="settings-copilot-section">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-primary" />
              Co-pilot
            </CardTitle>
            <CardDescription className="mt-1">
              Let someone you trust post on your behalf, or help someone in your circle.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => setInviteOpen(true)}
            data-testid="button-invite-copilot"
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            Invite
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-12 bg-muted/40 rounded-xl animate-pulse" />
            <div className="h-12 bg-muted/40 rounded-xl animate-pulse" />
          </div>
        ) : (
          <>
            {pendingInvitesAsHelper.length > 0 && (
              <div data-testid="copilot-pending-invites">
                <div className="flex items-center gap-2 mb-2">
                  <Inbox className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Pending invitations</p>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Someone has asked you to be their co-pilot.
                </p>
                <div className="space-y-2">
                  {pendingInvitesAsHelper.map((g) => {
                    const url = objectPathToUrl(g.grantorAvatarObjectPath ?? null);
                    const label = g.grantorName ?? "Member";
                    const busy = accept.isPending || decline.isPending;
                    return (
                      <div
                        key={g.id}
                        className="flex items-center gap-3 p-3 rounded-2xl border border-border/40 bg-primary/5"
                        data-testid={`copilot-pending-${g.id}`}
                      >
                        <Avatar className="w-9 h-9">
                          {url ? <AvatarImage src={url} alt={label} /> : null}
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {label.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{label}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {g.circleName ?? `Circle #${g.circleId}`}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="rounded-full h-8 text-xs gap-1"
                          disabled={busy}
                          onClick={() => handleAccept(g)}
                          data-testid={`button-accept-grant-${g.id}`}
                        >
                          <Check className="w-3 h-3" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full h-8 text-xs gap-1 text-muted-foreground"
                          disabled={busy}
                          onClick={() => handleDecline(g)}
                          data-testid={`button-decline-grant-${g.id}`}
                        >
                          <XIcon className="w-3 h-3" />
                          Decline
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <CopilotGrantList
              title="People who help you"
              description="They can post on your behalf in their circle."
              empty="Nobody is helping you yet."
              grants={grantsAsGrantor}
              showLabel={(g) => g.helperName ?? "Helper"}
              avatarPath={(g) => g.helperAvatarObjectPath}
              onRevoke={handleRevoke}
            />
            <CopilotGrantList
              title="People you help"
              description="You can post on their behalf in their circle."
              empty="You're not helping anyone yet."
              grants={grantsAsHelper}
              showLabel={(g) => g.grantorName ?? "Member"}
              avatarPath={(g) => g.grantorAvatarObjectPath}
              onRevoke={handleRevoke}
            />
          </>
        )}
      </CardContent>
      <InviteCopilotDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </Card>
  );
}

function CopilotGrantList({
  title,
  description,
  empty,
  grants,
  showLabel,
  avatarPath,
  onRevoke,
}: {
  title: string;
  description: string;
  empty: string;
  grants: CopilotGrant[];
  showLabel: (g: CopilotGrant) => string;
  avatarPath: (g: CopilotGrant) => string | null | undefined;
  onRevoke: (g: CopilotGrant) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-4 h-4 text-muted-foreground" />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{description}</p>
      {grants.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-3">{empty}</p>
      ) : (
        <div className="space-y-2">
          {grants.map((g) => {
            const url = objectPathToUrl(avatarPath(g) ?? null);
            const label = showLabel(g);
            return (
              <div
                key={g.id}
                className="flex items-center gap-3 p-3 rounded-2xl border border-border/40"
                data-testid={`copilot-grant-${g.id}`}
              >
                <Avatar className="w-9 h-9">
                  {url ? <AvatarImage src={url} alt={label} /> : null}
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {label.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{label}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {g.circleName ?? `Circle #${g.circleId}`}
                    {g.status !== "active" ? ` · ${g.status}` : ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                  onClick={() => onRevoke(g)}
                  title="Remove connection"
                  data-testid={`button-revoke-grant-${g.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function InviteCopilotDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: circles } = useListCircles();
  const [circleId, setCircleId] = useState<string>("");
  const [helperId, setHelperId] = useState<string>("");
  const numericCircleId = circleId ? Number(circleId) : null;
  const { data: members } = useListCircleMembers(numericCircleId ?? 0, {
    query: {
      enabled: !!numericCircleId,
      queryKey: getListCircleMembersQueryKey(numericCircleId ?? 0),
    },
  });
  const invite = useInviteCopilot();
  const { toast } = useToast();
  const qc = useQueryClient();

  function handleClose(v: boolean) {
    if (!v) {
      setCircleId("");
      setHelperId("");
    }
    onOpenChange(v);
  }

  function handleInvite() {
    if (!numericCircleId || !helperId) {
      toast({ title: "Pick a circle and a member.", variant: "destructive" });
      return;
    }
    invite.mutate(
      { circleId: numericCircleId, data: { helperUserId: Number(helperId) } },
      {
        onSuccess: () => {
          toast({ title: "Invitation sent." });
          qc.invalidateQueries({ queryKey: getListCopilotGrantsQueryKey() });
          handleClose(false);
        },
        onError: () =>
          toast({ title: "Could not send invitation.", variant: "destructive" }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle>Invite a co-pilot</DialogTitle>
          <DialogDescription>
            Pick a circle, then pick someone there who can post on your behalf.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Circle</Label>
            <Select value={circleId} onValueChange={setCircleId}>
              <SelectTrigger className="rounded-xl" data-testid="select-invite-circle">
                <SelectValue placeholder="Pick a circle" />
              </SelectTrigger>
              <SelectContent>
                {(circles ?? []).map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {numericCircleId ? (
            <div className="space-y-1.5">
              <Label>Helper</Label>
              <Select value={helperId} onValueChange={setHelperId}>
                <SelectTrigger className="rounded-xl" data-testid="select-invite-helper">
                  <SelectValue placeholder="Pick a member" />
                </SelectTrigger>
                <SelectContent>
                  {(members ?? [])
                    .filter((m) => !!m.userId)
                    .map((m) => (
                      <SelectItem key={m.userId!} value={String(m.userId)}>
                        {m.displayName ?? `Member #${m.userId}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" className="rounded-full" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button
            className="rounded-full"
            onClick={handleInvite}
            disabled={invite.isPending}
            data-testid="button-send-copilot-invite"
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            {invite.isPending ? "Sending..." : "Send invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlusSummaryCard() {
  const { data: status } = useMyPlusStatus();
  const isPlus = !!status?.isPlus;

  return (
    <Link href="/plus" data-testid="settings-plus-row">
      <Card className="rounded-3xl border-border/50 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#F5E6CC] text-[#B47A2A] flex items-center justify-center shrink-0">
            <Star className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-base">MyZolve Connect Plus</p>
              {isPlus ? <PlusBadge size="sm" /> : null}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isPlus
                ? status?.source === "family"
                  ? `Plus via ${status?.gifterName ?? "family"}`
                  : status?.planKind === "family"
                    ? "Family plan — share Plus with your circle"
                    : "Solo plan — Plus is active"
                : "Bigger circles, voice notes, video, ledger pro, and more."}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}

function ProfileVisibilitySection() {
  const { data: visibility, isLoading } = useMyCircleVisibility();
  const update = useUpdateCircleVisibility();
  const { toast } = useToast();

  function handleToggle(circleId: number, showOnProfile: boolean) {
    update.mutate(
      { circleId, showOnProfile },
      {
        onError: () =>
          toast({ title: "Could not update visibility", variant: "destructive" }),
      },
    );
  }

  return (
    <Card className="rounded-3xl border-border/50 shadow-sm" data-testid="settings-profile-visibility">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-primary" />
          Which circles show on my profile
        </CardTitle>
        <CardDescription>
          Choose which circles people can see on your public profile. Hidden circles still work as
          normal — only their badge is removed from your profile.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-12 bg-muted/40 rounded-xl animate-pulse" />
            <div className="h-12 bg-muted/40 rounded-xl animate-pulse" />
          </div>
        ) : !visibility || visibility.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You're not in any circles yet. Once you join one, you can choose whether to show it here.
          </p>
        ) : (
          <div className="space-y-1">
            {visibility.map((entry) => (
              <div
                key={entry.circleId}
                className="flex items-center justify-between py-3 border-b border-border/40 last:border-0"
                data-testid={`circle-visibility-row-${entry.circleId}`}
              >
                <div className="flex items-center gap-2 min-w-0 pr-4">
                  {entry.showOnProfile ? (
                    <Eye className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <p className="font-medium text-sm truncate">{entry.circleName}</p>
                </div>
                <Switch
                  checked={entry.showOnProfile}
                  onCheckedChange={(checked) => handleToggle(entry.circleId, checked)}
                  disabled={update.isPending}
                  data-testid={`circle-visibility-toggle-${entry.circleId}`}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BlockedUsersSection() {
  const { data: blocks, isLoading } = useMyBlocks();
  const unblock = useUnblockUser();
  const { toast } = useToast();

  function handleUnblock(userId: number) {
    if (!confirm("Unblock this person? They'll be able to see your profile and contact you again.")) return;
    unblock.mutate(userId, {
      onSuccess: () => toast({ title: "Unblocked" }),
      onError: () => toast({ title: "Could not unblock", variant: "destructive" }),
    });
  }

  return (
    <Card className="rounded-3xl border-border/50 shadow-sm" data-testid="settings-blocked-users">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <ShieldOff className="w-5 h-5 text-primary" />
          Blocked people
        </CardTitle>
        <CardDescription>
          Blocked people can't message you, comment on your posts, or find your profile.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-12 bg-muted/40 rounded-xl animate-pulse" />
            <div className="h-12 bg-muted/40 rounded-xl animate-pulse" />
          </div>
        ) : !blocks || blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven't blocked anyone.</p>
        ) : (
          <div className="space-y-2">
            {blocks.map((b) => {
              const name = b.blockedUser.displayName;
              const initials = name
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              return (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-border/40"
                  data-testid={`blocked-row-${b.blockedUser.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="w-9 h-9 border border-border/60">
                      {b.blockedUser.avatarObjectPath && (
                        <AvatarImage src={objectPathToUrl(b.blockedUser.avatarObjectPath) ?? undefined} />
                      )}
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-medium truncate">{name}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={unblock.isPending}
                    onClick={() => handleUnblock(b.blockedUser.id)}
                    data-testid={`button-unblock-${b.blockedUser.id}`}
                  >
                    Unblock
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
