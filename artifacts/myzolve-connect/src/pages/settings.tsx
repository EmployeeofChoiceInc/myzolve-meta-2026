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
  objectPathToUrl,
} from "@/hooks/use-api";
import { Camera } from "lucide-react";

const profileFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  displayName: z.string().min(2, "Display name must be at least 2 characters"),
  timezone: z.string().min(1, "Timezone is required"),
  bio: z.string().max(500).optional(),
  location: z.string().max(200).optional(),
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
    updateMe.mutate(values, {
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
                      <FormLabel>First Name</FormLabel>
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

              <div className="pt-4 border-t border-border/50 flex justify-end">
                <Button type="submit" disabled={updateMe.isPending} className="rounded-full">
                  {updateMe.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <NotificationPreferencesCard />
    </div>
  );
}
