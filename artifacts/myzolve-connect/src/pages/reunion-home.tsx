import { useState, useRef, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import {
  useOrgHome,
  useUpdateOrgProfile,
  usePostOrgAnnouncement,
  useDeleteOrgAnnouncement,
  usePostOrgEvent,
  useDeleteOrgEvent,
  objectPathToUrl,
  type OrgAnnouncement,
  type OrgEvent,
  type OrgHomeCircle,
  type OrgHomeMember,
} from "@/hooks/use-api";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Building2,
  Megaphone,
  CalendarDays,
  Users,
  Layers,
  MapPin,
  Settings,
  Plus,
  Trash2,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function initial(name: string | null | undefined): string {
  return (name ?? "?").charAt(0).toUpperCase();
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Countdown chips to the headline event date. */
function Countdown({ target, accent }: { target: string; accent?: string }) {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium backdrop-blur">
        <Sparkles className="w-4 h-4" /> Happening now
      </div>
    );
  }
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const parts = [
    { label: days === 1 ? "day" : "days", value: days },
    { label: hours === 1 ? "hour" : "hours", value: hours },
  ];
  return (
    <div className="flex items-center gap-2">
      {parts.map((p) => (
        <div
          key={p.label}
          className="rounded-2xl bg-white/15 px-4 py-2 text-center backdrop-blur"
          style={accent ? { boxShadow: `0 0 0 1px ${accent}33` } : undefined}
        >
          <div className="text-2xl font-bold leading-none">{p.value}</div>
          <div className="text-[11px] uppercase tracking-wide opacity-80">
            {p.label}
          </div>
        </div>
      ))}
      <div className="ml-1 text-sm opacity-90">until the big day</div>
    </div>
  );
}

export default function ReunionHomePage() {
  const { id } = useParams<{ id: string }>();
  const orgId = Number(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data, isLoading, error } = useOrgHome(orgId);
  const updateProfile = useUpdateOrgProfile(orgId);
  const postAnnouncement = usePostOrgAnnouncement(orgId);
  const deleteAnnouncement = useDeleteOrgAnnouncement(orgId);
  const postEvent = usePostOrgEvent(orgId);
  const deleteEvent = useDeleteOrgEvent(orgId);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const [coverUploading, setCoverUploading] = useState(false);

  // Compose state
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");

  const [eventOpen, setEventOpen] = useState(false);
  const [evTitle, setEvTitle] = useState("");
  const [evDesc, setEvDesc] = useState("");
  const [evLocation, setEvLocation] = useState("");
  const [evStart, setEvStart] = useState("");
  const [evEnd, setEvEnd] = useState("");

  // Welcome / hero-date editing
  const [editHero, setEditHero] = useState(false);
  const [welcome, setWelcome] = useState("");
  const [heroDate, setHeroDate] = useState("");

  const org = data?.org;
  const accent = org?.accentColor || undefined;

  const heroStyle = useMemo<React.CSSProperties>(() => {
    if (org?.coverImageUrl) {
      return {
        backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.72), rgba(0,0,0,0.25)), url(${org.coverImageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    }
    const base = accent || "#2563eb";
    return {
      backgroundImage: `linear-gradient(135deg, ${base}, ${base}cc 60%, #0f172a)`,
    };
  }, [org?.coverImageUrl, accent]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto w-full animate-pulse">
        <div className="h-56 bg-muted rounded-3xl mb-6" />
        <div className="h-40 bg-muted rounded-2xl" />
      </div>
    );
  }

  if (error || !org || !data) {
    return (
      <div className="max-w-3xl mx-auto w-full">
        <Card className="rounded-2xl">
          <CardHeader className="text-center py-12">
            <CardTitle>This space isn't available</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              You may not be a member of this organization, or it no longer
              exists.
            </p>
            <div className="pt-4">
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => setLocation("/orgs")}
              >
                Back to Organizations
              </Button>
            </div>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const canManage = data.canManage;

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    try {
      const { uploadURL, objectPath } = await customFetch<{
        uploadURL: string;
        objectPath: string;
      }>(`/api/orgs/${orgId}/logo/request-url`, {
        method: "POST",
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });
      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      updateProfile.mutate(
        { coverImageObjectPath: objectPath },
        {
          onSuccess: () => toast({ title: "Cover photo updated" }),
          onError: () =>
            toast({ title: "Could not save cover", variant: "destructive" }),
        },
      );
    } catch {
      toast({ title: "Could not upload cover", variant: "destructive" });
    } finally {
      setCoverUploading(false);
    }
  }

  function openHeroEdit() {
    setWelcome(org?.welcomeMessage ?? "");
    setHeroDate(
      org?.heroEventDate
        ? new Date(org.heroEventDate).toISOString().slice(0, 10)
        : "",
    );
    setEditHero(true);
  }

  function saveHero() {
    updateProfile.mutate(
      {
        welcomeMessage: welcome.trim() || null,
        heroEventDate: heroDate ? new Date(heroDate).toISOString() : null,
      },
      {
        onSuccess: () => {
          toast({ title: "Home updated" });
          setEditHero(false);
        },
        onError: () =>
          toast({ title: "Could not save", variant: "destructive" }),
      },
    );
  }

  function submitAnnouncement() {
    if (!annBody.trim()) return;
    postAnnouncement.mutate(
      { title: annTitle.trim() || null, body: annBody.trim() },
      {
        onSuccess: () => {
          setAnnTitle("");
          setAnnBody("");
          setAnnounceOpen(false);
        },
        onError: () =>
          toast({ title: "Could not post", variant: "destructive" }),
      },
    );
  }

  function submitEvent() {
    if (!evTitle.trim() || !evStart) return;
    postEvent.mutate(
      {
        title: evTitle.trim(),
        description: evDesc.trim() || null,
        location: evLocation.trim() || null,
        startsAt: new Date(evStart).toISOString(),
        endsAt: evEnd ? new Date(evEnd).toISOString() : null,
      },
      {
        onSuccess: () => {
          setEvTitle("");
          setEvDesc("");
          setEvLocation("");
          setEvStart("");
          setEvEnd("");
          setEventOpen(false);
        },
        onError: () =>
          toast({ title: "Could not create event", variant: "destructive" }),
      },
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div
        className="relative rounded-3xl overflow-hidden text-white p-6 sm:p-8 mb-6"
        style={heroStyle}
      >
        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center overflow-hidden shrink-0 border border-white/25">
              {org.logoUrl ? (
                <img
                  src={org.logoUrl}
                  alt={org.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Building2 className="w-8 h-8" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold drop-shadow-sm">
                  {org.name}
                </h1>
                {org.comped && (
                  <Badge className="rounded-full bg-white/20 text-white border-0">
                    Complimentary
                  </Badge>
                )}
              </div>
              <p className="text-sm opacity-90 mt-0.5">
                {data.memberCount}{" "}
                {data.memberCount === 1 ? "member" : "members"} · {org.planName}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canManage && (
                <>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleCoverChange}
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-full bg-white/20 hover:bg-white/30 text-white border-0"
                    onClick={() => coverInputRef.current?.click()}
                    disabled={coverUploading}
                  >
                    <ImageIcon className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">
                      {coverUploading ? "Uploading..." : "Cover"}
                    </span>
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-full bg-white/20 hover:bg-white/30 text-white border-0"
                    onClick={() => setLocation(`/orgs/${orgId}/manage`)}
                  >
                    <Settings className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Manage</span>
                  </Button>
                </>
              )}
            </div>
          </div>

          {org.welcomeMessage && (
            <p className="text-base sm:text-lg max-w-2xl opacity-95 leading-relaxed">
              {org.welcomeMessage}
            </p>
          )}

          {org.heroEventDate && (
            <div className="flex flex-col gap-2">
              <Countdown target={org.heroEventDate} accent={accent} />
              <p className="text-xs opacity-80">
                {formatLongDate(org.heroEventDate)}
              </p>
            </div>
          )}

          {canManage && (
            <button
              onClick={openHeroEdit}
              className="text-xs underline opacity-80 hover:opacity-100 w-fit"
            >
              Edit welcome &amp; date
            </button>
          )}
        </div>
      </div>

      {/* Hero edit panel */}
      {editHero && (
        <Card className="rounded-2xl mb-6">
          <CardHeader>
            <CardTitle className="text-base">Welcome &amp; headline date</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="welcome">Welcome message</Label>
              <Textarea
                id="welcome"
                value={welcome}
                onChange={(e) => setWelcome(e.target.value)}
                placeholder="A warm note for everyone who arrives here…"
                rows={3}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="hero-date">Headline date (e.g. reunion day)</Label>
              <Input
                id="hero-date"
                type="date"
                value={heroDate}
                onChange={(e) => setHeroDate(e.target.value)}
                className="w-fit"
              />
            </div>
            <div className="flex gap-2">
              <Button
                className="rounded-full"
                onClick={saveHero}
                disabled={updateProfile.isPending}
              >
                Save
              </Button>
              <Button
                variant="ghost"
                className="rounded-full"
                onClick={() => setEditHero(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* ── Main column ──────────────────────────────────────────────────── */}
        <div className="md:col-span-2 flex flex-col gap-6">
          {/* Announcements */}
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Megaphone className="w-5 h-5" /> Announcements
              </CardTitle>
              {canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setAnnounceOpen((v) => !v)}
                >
                  <Plus className="w-4 h-4 mr-1" /> Post
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {announceOpen && canManage && (
                <div className="flex flex-col gap-2 rounded-xl border p-3 bg-muted/30">
                  <Input
                    placeholder="Title (optional)"
                    value={annTitle}
                    onChange={(e) => setAnnTitle(e.target.value)}
                  />
                  <Textarea
                    placeholder="Share news with everyone…"
                    value={annBody}
                    onChange={(e) => setAnnBody(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="rounded-full"
                      onClick={submitAnnouncement}
                      disabled={postAnnouncement.isPending || !annBody.trim()}
                    >
                      Post announcement
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full"
                      onClick={() => setAnnounceOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {data.announcements.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No announcements yet.
                </p>
              ) : (
                data.announcements.map((a: OrgAnnouncement) => (
                  <div
                    key={a.id}
                    className="rounded-xl border p-3 flex flex-col gap-1.5"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={objectPathToUrl(a.authorAvatarObjectPath)}
                          alt={a.authorName ?? ""}
                        />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {initial(a.authorName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        {a.title && (
                          <p className="font-semibold text-sm">{a.title}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {a.authorName ?? "Organizer"} ·{" "}
                          {formatDateTime(a.createdAt)}
                        </p>
                      </div>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive shrink-0"
                          onClick={() => deleteAnnouncement.mutate(a.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed pl-11">
                      {a.body}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Circles / sub-spaces */}
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Layers className="w-5 h-5" /> Circles
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.circles.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No circles in this space yet.
                </p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {data.circles.map((c: OrgHomeCircle) => (
                    <button
                      key={c.id}
                      onClick={() => setLocation(`/circles/${c.id}`)}
                      className="text-left rounded-xl border p-3 hover:bg-muted/50 transition-colors flex items-start gap-3"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                        style={{
                          backgroundColor: c.accentColor || accent || "#2563eb",
                        }}
                      >
                        {initial(c.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{c.name}</p>
                        {c.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {c.description}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Side column ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-6">
          {/* Events */}
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="w-5 h-5" /> Upcoming
              </CardTitle>
              {canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setEventOpen((v) => !v)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {eventOpen && canManage && (
                <div className="flex flex-col gap-2 rounded-xl border p-3 bg-muted/30">
                  <Input
                    placeholder="Event title"
                    value={evTitle}
                    onChange={(e) => setEvTitle(e.target.value)}
                  />
                  <Textarea
                    placeholder="Details (optional)"
                    value={evDesc}
                    onChange={(e) => setEvDesc(e.target.value)}
                    rows={2}
                  />
                  <Input
                    placeholder="Location (optional)"
                    value={evLocation}
                    onChange={(e) => setEvLocation(e.target.value)}
                  />
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Starts</Label>
                    <Input
                      type="datetime-local"
                      value={evStart}
                      onChange={(e) => setEvStart(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">Ends (optional)</Label>
                    <Input
                      type="datetime-local"
                      value={evEnd}
                      onChange={(e) => setEvEnd(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="rounded-full"
                      onClick={submitEvent}
                      disabled={postEvent.isPending || !evTitle.trim() || !evStart}
                    >
                      Add event
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full"
                      onClick={() => setEventOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {data.events.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2 text-center">
                  No upcoming events.
                </p>
              ) : (
                data.events.map((ev: OrgEvent) => (
                  <div
                    key={ev.id}
                    className="rounded-xl border p-3 flex flex-col gap-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm">{ev.title}</p>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive shrink-0 -mt-1 -mr-1"
                          onClick={() => deleteEvent.mutate(ev.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs font-medium text-primary">
                      {formatDateTime(ev.startsAt)}
                    </p>
                    {ev.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {ev.location}
                      </p>
                    )}
                    {ev.description && (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                        {ev.description}
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* People */}
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5" /> People ({data.memberCount})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {data.members.map((m: OrgHomeMember) => (
                  <button
                    key={m.userId}
                    onClick={() => setLocation(`/profile/${m.userId}`)}
                    className="flex flex-col items-center gap-1 w-16"
                    title={m.displayName ?? ""}
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage
                        src={objectPathToUrl(m.avatarObjectPath)}
                        alt={m.displayName ?? ""}
                      />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {initial(m.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-[11px] text-center truncate w-full">
                      {m.displayName ?? "Member"}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
