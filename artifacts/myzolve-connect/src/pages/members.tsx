import { useParams, Link } from "wouter";
import { 
  useListCircleMembers, 
  useListCircleInvitations,
  useRevokeInvitation,
  useUpdateCircleMember,
  useRemoveCircleMember,
  getListCircleInvitationsQueryKey,
  getListCircleMembersQueryKey,
  getSearchCircleSkillsQueryKey,
  useGetCircle,
  useCreateCircleInvitation,
  useSearchCircleSkills,
  useGetCircleContinuityContent,
  getGetCircleContinuityContentQueryKey,
  useCreateCircleContinuityLocation,
  useUpdateCircleContinuityLocation,
  useDeleteCircleContinuityLocation,
  useCreateCircleContinuityNote,
  useUpdateCircleContinuityNote,
  useDeleteCircleContinuityNote,
  customFetch,
  type CircleContinuityLocation,
  type CircleContinuityNote,
  type CircleContinuityPacket,
  type CircleInvitation,
  type CircleMember,
} from "@workspace/api-client-react";
import { useJoinRequests, useApproveJoinRequest, useDeclineJoinRequest, useMyPlusStatus } from "@/hooks/use-api";
import { ArrowLeft, UserPlus, Mail, ShieldAlert, Link2, Copy, MoreHorizontal, UserMinus, Shield, UserCheck, FileDown, MapPin, NotebookPen, Pencil, Trash2, X } from "lucide-react";
import { RolePickerDialog } from "@/components/role-picker-dialog";
import { PlusBadge } from "@/components/plus-badge";
import { rolePillClasses, ROLE_LABELS, isPlusGatedRole, type AssignableRole, type CircleRole } from "@/lib/circle-roles";
import { usePaywall } from "@/components/paywall-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { displayEmail } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { downloadContinuityPacketPdf } from "@/lib/continuity-packet-pdf";

const inviteFormSchema = z.object({
  invitedEmail: z.string().email("Please enter a valid email").optional().or(z.literal("")),
  role: z.enum(["member", "admin", "guest"]),
  customMessage: z.string().optional(),
});

export default function MembersPage() {
  const { id } = useParams<{ id: string }>();
  const circleId = parseInt(id!);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [roleDialogMember, setRoleDialogMember] = useState<CircleMember | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [packetLoading, setPacketLoading] = useState(false);
  const [locationDraft, setLocationDraft] = useState("");
  const [editingLocationId, setEditingLocationId] = useState<number | null>(null);
  const [noteTitleDraft, setNoteTitleDraft] = useState("");
  const [noteBodyDraft, setNoteBodyDraft] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);

  const { data: circle } = useGetCircle(circleId, {
    query: { enabled: !!circleId, queryKey: ["circle", circleId] as const }
  });

  const { data: members, isLoading: membersLoading } = useListCircleMembers(circleId, {
    query: { enabled: !!circleId, queryKey: getListCircleMembersQueryKey(circleId) }
  });
  const normalizedSearch = searchTerm.trim();
  const {
    data: searchResults,
    isLoading: searchLoading,
    isError: searchError,
  } = useSearchCircleSkills(
    circleId,
    { q: normalizedSearch },
    {
      query: {
        enabled: circleId > 0 && normalizedSearch.length > 0,
        queryKey: getSearchCircleSkillsQueryKey(circleId, { q: normalizedSearch }),
      },
    },
  );
  const visibleMembers = normalizedSearch ? searchResults ?? [] : members ?? [];
  const totalSkills = members?.reduce((total, member) => total + (member.skills?.length ?? 0), 0) ?? 0;
  const totalResources = members?.reduce((total, member) => total + (member.resources?.length ?? 0), 0) ?? 0;

  const { data: invitations, isLoading: invitationsLoading } = useListCircleInvitations(circleId, {
    query: { enabled: !!circleId, queryKey: getListCircleInvitationsQueryKey(circleId) }
  });

  const createInvitation = useCreateCircleInvitation();
  const revokeInvitation = useRevokeInvitation();
  const updateMember = useUpdateCircleMember();
  const removeMember = useRemoveCircleMember();
  const approveJoinRequest = useApproveJoinRequest(circleId);
  const declineJoinRequest = useDeclineJoinRequest(circleId);

  const myRole = circle?.myRole;
  const isAdminOrOwner = myRole === "owner" || myRole === "admin";

  const {
    data: continuityContent,
    isLoading: continuityContentLoading,
    isError: continuityContentError,
  } = useGetCircleContinuityContent(circleId, {
    query: {
      enabled: circleId > 0 && isAdminOrOwner,
      queryKey: getGetCircleContinuityContentQueryKey(circleId),
    },
  });
  const createContinuityLocation = useCreateCircleContinuityLocation();
  const updateContinuityLocation = useUpdateCircleContinuityLocation();
  const deleteContinuityLocation = useDeleteCircleContinuityLocation();
  const createContinuityNote = useCreateCircleContinuityNote();
  const updateContinuityNote = useUpdateCircleContinuityNote();
  const deleteContinuityNote = useDeleteCircleContinuityNote();

  const { data: joinRequests } = useJoinRequests(circleId, isAdminOrOwner);
  const { data: plusStatus } = useMyPlusStatus();
  const ownerHasPlus = !!plusStatus?.isPlus;
  const paywall = usePaywall();

  function handleRevokeInvitation(invitationId: number) {
    revokeInvitation.mutate(
      { invitationId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCircleInvitationsQueryKey(circleId) });
          toast({ title: "Invitation revoked" });
        },
        onError: () => {
          toast({ title: "Could not revoke invitation", variant: "destructive" });
        },
      }
    );
  }

  function handleRemoveMember(memberId: number, displayName: string | null) {
    removeMember.mutate(
      { circleId, memberId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCircleMembersQueryKey(circleId) });
          toast({ title: "Member removed", description: `${displayName ?? "Member"} has been removed from the circle.` });
        },
        onError: () => {
          toast({ title: "Could not remove member", variant: "destructive" });
        },
      }
    );
  }

  const inviteForm = useForm<z.infer<typeof inviteFormSchema>>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      invitedEmail: "",
      role: "member",
      customMessage: "",
    },
  });

  function onSubmitInvite(values: z.infer<typeof inviteFormSchema>) {
    const payload = {
      role: values.role,
      customMessage: values.customMessage,
      ...(values.invitedEmail ? { invitedEmail: values.invitedEmail } : {}),
    };
    createInvitation.mutate({
      circleId,
      data: payload
    }, {
      onSuccess: (data: CircleInvitation & { inviteLink?: string }) => {
        queryClient.invalidateQueries({ queryKey: getListCircleInvitationsQueryKey(circleId) });
        inviteForm.reset();
        const link = data?.inviteLink ? `${window.location.origin}${data.inviteLink}` : null;
        setInviteLink(link);
        if (values.invitedEmail) {
          toast({ title: "Invitation sent", description: "They will receive an invitation link." });
        } else {
          toast({ title: "Invite link created", description: "Copy the link below to share it." });
        }
      },
      onError: () => {
        toast({ title: "Error", description: "Could not create invitation.", variant: "destructive" });
      }
    });
  }

  function onConfirmChangeRole(role: AssignableRole) {
    if (!roleDialogMember) return;
    updateMember.mutate(
      // The orval-generated role enum doesn't yet include the Plus
      // sub-roles (host/treasurer/scribe). The server accepts them.
      { circleId, memberId: roleDialogMember.id, data: { role: role as never } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCircleMembersQueryKey(circleId) });
          setRoleDialogMember(null);
          toast({ title: "Role updated", description: `${roleDialogMember.displayName ?? "Member"}'s role has been updated.` });
        },
        onError: (err: unknown) => {
          if (!paywall.handleApiError(err)) {
            toast({ title: "Could not update role", variant: "destructive" });
          }
        },
      }
    );
  }

  function copyLink() {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      toast({ title: "Copied!", description: "Invite link copied to clipboard." });
    }
  }

  async function downloadPacket() {
    setPacketLoading(true);
    try {
      const packet = await customFetch<CircleContinuityPacket>(
        `/api/circles/${circleId}/continuity-packet`,
      );
      await downloadContinuityPacketPdf(packet);
      toast({ title: "Continuity packet downloaded" });
    } catch {
      toast({
        title: "Could not download the continuity packet",
        variant: "destructive",
      });
    } finally {
      setPacketLoading(false);
    }
  }

  function refreshContinuityContent() {
    void queryClient.invalidateQueries({
      queryKey: getGetCircleContinuityContentQueryKey(circleId),
    });
  }

  function saveLocation() {
    const location = locationDraft.trim();
    if (!location) return;
    const onSuccess = () => {
      refreshContinuityContent();
      setLocationDraft("");
      setEditingLocationId(null);
      toast({ title: editingLocationId ? "Location updated" : "Location saved" });
    };
    const onError = () =>
      toast({ title: "Could not save location", variant: "destructive" });

    if (editingLocationId !== null) {
      updateContinuityLocation.mutate(
        { circleId, continuityLocationId: editingLocationId, data: { location } },
        { onSuccess, onError },
      );
    } else {
      createContinuityLocation.mutate(
        { circleId, data: { location } },
        { onSuccess, onError },
      );
    }
  }

  function editLocation(location: CircleContinuityLocation) {
    setEditingLocationId(location.id);
    setLocationDraft(location.location);
  }

  function removeLocation(locationId: number) {
    deleteContinuityLocation.mutate(
      { circleId, continuityLocationId: locationId },
      {
        onSuccess: () => {
          refreshContinuityContent();
          if (editingLocationId === locationId) {
            setEditingLocationId(null);
            setLocationDraft("");
          }
          toast({ title: "Location removed" });
        },
        onError: () => toast({ title: "Could not remove location", variant: "destructive" }),
      },
    );
  }

  function saveContinuityNote() {
    const body = noteBodyDraft.trim();
    if (!body) return;
    const data = { title: noteTitleDraft.trim() || null, body };
    const onSuccess = () => {
      refreshContinuityContent();
      setNoteTitleDraft("");
      setNoteBodyDraft("");
      setEditingNoteId(null);
      toast({ title: editingNoteId ? "Continuity note updated" : "Continuity note saved" });
    };
    const onError = () =>
      toast({ title: "Could not save continuity note", variant: "destructive" });

    if (editingNoteId !== null) {
      updateContinuityNote.mutate(
        { circleId, continuityNoteId: editingNoteId, data },
        { onSuccess, onError },
      );
    } else {
      createContinuityNote.mutate(
        { circleId, data: { title: data.title ?? undefined, body } },
        { onSuccess, onError },
      );
    }
  }

  function editContinuityNote(note: CircleContinuityNote) {
    setEditingNoteId(note.id);
    setNoteTitleDraft(note.title ?? "");
    setNoteBodyDraft(note.body);
  }

  function removeContinuityNote(noteId: number) {
    deleteContinuityNote.mutate(
      { circleId, continuityNoteId: noteId },
      {
        onSuccess: () => {
          refreshContinuityContent();
          if (editingNoteId === noteId) {
            setEditingNoteId(null);
            setNoteTitleDraft("");
            setNoteBodyDraft("");
          }
          toast({ title: "Continuity note removed" });
        },
        onError: () =>
          toast({ title: "Could not remove continuity note", variant: "destructive" }),
      },
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <Link href={`/circles/${circleId}`} className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Circle
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Circle Members</h1>
          <p className="text-muted-foreground mt-1">The people in this trusted space.</p>
        </div>
        
        {isAdminOrOwner && (
          <Button
            variant="outline"
            className="rounded-full"
            onClick={downloadPacket}
            disabled={packetLoading}
            data-testid="download-circle-continuity-packet"
          >
            <FileDown className="mr-2 h-4 w-4" />
            {packetLoading ? "Preparing PDF..." : "Download Continuity Packet"}
          </Button>
        )}

        {isAdminOrOwner && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setInviteLink(null); }}>
            <DialogTrigger asChild>
              <Button className="rounded-full">
                <UserPlus className="mr-2 w-4 h-4" /> Invite Someone
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-3xl">
              <DialogHeader>
                <DialogTitle>Invite to Circle</DialogTitle>
                <DialogDescription>
                  Enter an email to send a personal invite, or leave it blank to generate a shareable link.
                </DialogDescription>
              </DialogHeader>

              {inviteLink ? (
                <div className="space-y-4 pt-4">
                  <div className="bg-secondary/5 rounded-2xl p-4">
                    <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-secondary" /> Shareable Invite Link
                    </p>
                    <p className="text-xs text-muted-foreground break-all mb-3">{inviteLink}</p>
                    <Button onClick={copyLink} className="rounded-full w-full" size="sm">
                      <Copy className="mr-2 w-3.5 h-3.5" /> Copy Link
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">This link expires in 7 days.</p>
                  <Button variant="outline" className="rounded-full w-full" onClick={() => setInviteLink(null)}>
                    Create Another Invite
                  </Button>
                </div>
              ) : (
                <Form {...inviteForm}>
                  <form onSubmit={inviteForm.handleSubmit(onSubmitInvite)} className="space-y-4 pt-4">
                    <FormField
                      control={inviteForm.control}
                      name="invitedEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                          <FormControl>
                            <Input placeholder="friend@example.com" type="email" {...field} className="rounded-xl" />
                          </FormControl>
                          <FormDescription className="text-xs">Leave blank to get a shareable link instead.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={inviteForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger className="rounded-xl">
                                <SelectValue placeholder="Select a role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="member">Member</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="guest">Guest (view only)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={inviteForm.control}
                      name="customMessage"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Personal Message <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Join our circle to share support..." 
                              className="resize-none rounded-xl" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="pt-4 flex justify-end">
                      <Button type="submit" disabled={createInvitation.isPending} className="rounded-full">
                        {createInvitation.isPending ? "Creating..." : "Create Invite"}
                      </Button>
                    </div>
                  </form>
                </Form>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-3xl border-border/50 shadow-none">
            <CardHeader className="pb-4">
              <CardTitle>Active Members</CardTitle>
              <p className="text-sm text-muted-foreground" data-testid="circle-capacity-summary">
                {totalSkills} skills · {totalResources} resources across members
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-2 border-b border-border/50 p-4 sm:px-6">
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search skills or resources"
                  aria-label="Search circle skills and resources"
                  data-testid="input-circle-capacity-search"
                />
                <p className="text-xs text-muted-foreground">
                  Search this circle only, such as “first aid” or “truck”.
                </p>
              </div>
              {membersLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading members...</div>
              ) : normalizedSearch && searchLoading ? (
                <div className="p-8 text-center text-muted-foreground">Searching skills and resources...</div>
              ) : normalizedSearch && searchError ? (
                <div className="p-8 text-center text-destructive">Could not search this circle right now.</div>
              ) : visibleMembers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  {normalizedSearch ? "No members match that search." : "No active members yet."}
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {visibleMembers.map((member) => {
                    const profileHref = member.userId
                      ? `/profile/${member.userId}?circleId=${circleId}`
                      : null;
                    const avatar = (
                      <Avatar className="h-10 w-10 border cursor-pointer">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {member.displayName?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                    );
                    return (
                    <div key={member.id} className="p-4 sm:px-6 flex items-center justify-between gap-4">
                      <div className="flex min-w-0 flex-1 items-center gap-4">
                          {profileHref ? <Link href={profileHref}>{avatar}</Link> : avatar}
                        <div className="min-w-0">
                          {profileHref ? (
                            <Link href={profileHref}>
                              <p className="font-medium text-foreground hover:underline cursor-pointer">{member.displayName}</p>
                            </Link>
                          ) : (
                            <p className="font-medium text-foreground">{member.displayName}</p>
                          )}
                          {displayEmail(member.email) ? (
                            <p className="text-sm text-muted-foreground">{displayEmail(member.email)}</p>
                          ) : null}
                          {((member.skills?.length ?? 0) > 0 || (member.resources?.length ?? 0) > 0) && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {member.skills?.map((skill) => (
                                <Badge key={`skill-${skill.id}`} variant="secondary" className="rounded-full text-xs">
                                  Skill · {skill.label}
                                </Badge>
                              ))}
                              {member.resources?.map((resource) => (
                                <Badge
                                  key={`resource-${resource.id}`}
                                  variant={resource.isAvailable ? "outline" : "secondary"}
                                  className="rounded-full text-xs"
                                >
                                  Resource · {resource.label}{resource.isAvailable ? "" : " · unavailable"}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`rounded-full px-2.5 py-0.5 capitalize border-transparent ${rolePillClasses(member.role)}`}
                          data-testid={`member-role-${member.id}`}
                        >
                          {ROLE_LABELS[member.role as CircleRole] ?? member.role}
                        </Badge>
                        {isPlusGatedRole(member.role) ? <PlusBadge size="sm" /> : null}
                        {isAdminOrOwner && member.role !== 'owner' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" data-testid={`member-actions-${member.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-2xl">
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer"
                                onClick={() => setRoleDialogMember(member)}
                              >
                                <Shield className="h-4 w-4" /> Change Role
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                                onClick={() => handleRemoveMember(member.id, member.displayName)}
                                disabled={removeMember.isPending}
                              >
                                <UserMinus className="h-4 w-4" /> Remove from Circle
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {isAdminOrOwner && (
            <Card className="rounded-3xl border-border/50 shadow-none">
              <CardHeader>
                <CardTitle>Saved continuity details</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Reusable locations and notes appear in future circle packets.
                </p>
              </CardHeader>
              <CardContent className="space-y-8">
                {continuityContentLoading ? (
                  <p className="text-sm text-muted-foreground">Loading saved packet details...</p>
                ) : continuityContentError ? (
                  <p className="text-sm text-destructive">
                    Could not load saved packet details. Refresh the page to try again.
                  </p>
                ) : (
                  <>
                    <section className="space-y-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold">Meeting locations</h3>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          value={locationDraft}
                          onChange={(event) => setLocationDraft(event.target.value)}
                          placeholder="Address, venue, or meeting instructions"
                          maxLength={500}
                          aria-label="Saved meeting location"
                          data-testid="input-continuity-location"
                        />
                        <div className="flex gap-2">
                          <Button
                            onClick={saveLocation}
                            disabled={!locationDraft.trim() || createContinuityLocation.isPending || updateContinuityLocation.isPending}
                          >
                            {editingLocationId !== null ? "Save changes" : "Add location"}
                          </Button>
                          {editingLocationId !== null && (
                            <Button
                              variant="outline"
                              onClick={() => { setEditingLocationId(null); setLocationDraft(""); }}
                              aria-label="Cancel location edit"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {continuityContent?.locations.length ? (
                        <div className="divide-y rounded-xl border">
                          {continuityContent.locations.map((location) => (
                            <div key={location.id} className="flex items-center gap-3 p-3">
                              <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm">{location.location}</p>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => editLocation(location)}
                                aria-label={`Edit location ${location.location}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => removeLocation(location.id)}
                                disabled={deleteContinuityLocation.isPending}
                                aria-label={`Remove location ${location.location}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No saved locations yet.</p>
                      )}
                    </section>

                    <section className="space-y-3 border-t pt-6">
                      <div className="flex items-center gap-2">
                        <NotebookPen className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold">Continuity notes</h3>
                      </div>
                      <Input
                        value={noteTitleDraft}
                        onChange={(event) => setNoteTitleDraft(event.target.value)}
                        placeholder="Title (optional)"
                        maxLength={120}
                        aria-label="Continuity note title"
                      />
                      <Textarea
                        value={noteBodyDraft}
                        onChange={(event) => setNoteBodyDraft(event.target.value)}
                        placeholder="Important context to carry forward for the circle..."
                        maxLength={5000}
                        rows={4}
                        aria-label="Continuity note"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={saveContinuityNote}
                          disabled={!noteBodyDraft.trim() || createContinuityNote.isPending || updateContinuityNote.isPending}
                        >
                          {editingNoteId !== null ? "Save changes" : "Add note"}
                        </Button>
                        {editingNoteId !== null && (
                          <Button
                            variant="outline"
                            onClick={() => { setEditingNoteId(null); setNoteTitleDraft(""); setNoteBodyDraft(""); }}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                      {continuityContent?.notes.length ? (
                        <div className="space-y-3">
                          {continuityContent.notes.map((note) => (
                            <div key={note.id} className="rounded-xl border p-3">
                              <div className="flex items-start gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium">{note.title || "Continuity note"}</p>
                                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{note.body}</p>
                                  <p className="mt-2 text-xs text-muted-foreground">Added by {note.authorName}</p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => editContinuityNote(note)}
                                  aria-label={`Edit note ${note.title || note.id}`}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive"
                                  onClick={() => removeContinuityNote(note.id)}
                                  disabled={deleteContinuityNote.isPending}
                                  aria-label={`Remove note ${note.title || note.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No continuity notes yet.</p>
                      )}
                    </section>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="rounded-3xl border-border/50 shadow-none bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center text-lg"><Mail className="w-5 h-5 mr-2" /> Pending Invites</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {invitationsLoading ? (
                <div className="p-6 text-center text-muted-foreground text-sm">Loading...</div>
              ) : !isAdminOrOwner ? (
                <div className="p-6 text-center text-muted-foreground text-sm">Only admins can view pending invitations.</div>
              ) : invitations?.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">No pending invitations.</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {invitations?.map((inv) => (
                    <div key={inv.id} className="p-4 sm:px-6">
                      <p className="font-medium text-sm text-foreground truncate">
                        {inv.invitedEmail ?? <span className="text-muted-foreground italic">Link invite</span>}
                      </p>
                      <div className="flex justify-between items-center mt-2">
                        <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-transparent capitalize">
                          {inv.role}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleRevokeInvitation(inv.id)}
                          disabled={revokeInvitation.isPending}
                        >
                          {revokeInvitation.isPending ? "Revoking..." : "Revoke"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          {isAdminOrOwner && joinRequests && joinRequests.length > 0 && (
            <Card className="rounded-3xl border-border/50 shadow-none bg-card">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center text-lg">
                  <UserCheck className="w-5 h-5 mr-2 text-primary" /> Join Requests
                  <span className="ml-auto text-xs font-normal text-muted-foreground">{joinRequests.length} pending</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/50">
                  {joinRequests.map((req) => (
                    <div key={req.id} className="p-4 sm:px-6 space-y-3">
                      <div>
                        <p className="font-medium text-sm text-foreground">{req.requesterName}</p>
                        {req.requesterEmail && (
                          <p className="text-xs text-muted-foreground">{req.requesterEmail}</p>
                        )}
                        {req.note && (
                          <p className="text-xs text-muted-foreground mt-1 italic">"{req.note}"</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="rounded-full flex-1 h-8 text-xs"
                          disabled={approveJoinRequest.isPending}
                          onClick={() =>
                            approveJoinRequest.mutate(req.id, {
                              onSuccess: () => toast({ title: `${req.requesterName} approved and added to circle` }),
                              onError: () => toast({ title: "Could not approve request", variant: "destructive" }),
                            })
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full flex-1 h-8 text-xs"
                          disabled={declineJoinRequest.isPending}
                          onClick={() =>
                            declineJoinRequest.mutate(req.id, {
                              onSuccess: () => toast({ title: "Request declined" }),
                              onError: () => toast({ title: "Could not decline request", variant: "destructive" }),
                            })
                          }
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-3xl border-border/50 shadow-none bg-accent/5">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">Trust & Safety</p>
                  Only invite people you know and trust. MyZolve Connect is designed for tight-knit communities, not public networks.
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {roleDialogMember ? (
        <RolePickerDialog
          open={!!roleDialogMember}
          onOpenChange={(v) => { if (!v) setRoleDialogMember(null); }}
          currentRole={roleDialogMember.role}
          memberName={roleDialogMember.displayName ?? "this member"}
          ownerHasPlus={ownerHasPlus}
          saving={updateMember.isPending}
          onConfirm={onConfirmChangeRole}
          onPlusGated={() => {
            setRoleDialogMember(null);
            paywall.open("circle_role");
          }}
        />
      ) : null}
    </div>
  );
}
