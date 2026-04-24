import { useParams, Link } from "wouter";
import { 
  useListCircleMembers, 
  useListCircleInvitations,
  useRevokeInvitation,
  useUpdateCircleMember,
  useRemoveCircleMember,
  getListCircleInvitationsQueryKey,
  getListCircleMembersQueryKey,
  useGetCircle,
  useCreateCircleInvitation,
  type CircleInvitation
} from "@workspace/api-client-react";
import { useJoinRequests, useApproveJoinRequest, useDeclineJoinRequest } from "@/hooks/use-api";
import { ArrowLeft, UserPlus, Mail, ShieldAlert, Link2, Copy, MoreHorizontal, UserMinus, Shield, UserCheck } from "lucide-react";
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

const inviteFormSchema = z.object({
  invitedEmail: z.string().email("Please enter a valid email").optional().or(z.literal("")),
  role: z.enum(["member", "admin", "guest"]),
  customMessage: z.string().optional(),
});

const changeRoleFormSchema = z.object({
  role: z.enum(["member", "admin", "guest"]),
});

type CircleMember = {
  id: number;
  userId: number;
  displayName: string | null;
  email: string | null;
  role: string;
};

export default function MembersPage() {
  const { id } = useParams<{ id: string }>();
  const circleId = parseInt(id!);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [roleDialogMember, setRoleDialogMember] = useState<CircleMember | null>(null);

  const { data: circle } = useGetCircle(circleId, {
    query: { enabled: !!circleId, queryKey: ["circle", circleId] as const }
  });

  const { data: members, isLoading: membersLoading } = useListCircleMembers(circleId, {
    query: { enabled: !!circleId, queryKey: ["circle-members", circleId] as const }
  });
  
  const { data: invitations, isLoading: invitationsLoading } = useListCircleInvitations(circleId, {
    query: { enabled: !!circleId, queryKey: ["circle-invitations", circleId] as const }
  });

  const createInvitation = useCreateCircleInvitation();
  const revokeInvitation = useRevokeInvitation();
  const updateMember = useUpdateCircleMember();
  const removeMember = useRemoveCircleMember();
  const approveJoinRequest = useApproveJoinRequest(circleId);
  const declineJoinRequest = useDeclineJoinRequest(circleId);

  const myRole = circle?.myRole;
  const isAdminOrOwner = myRole === "owner" || myRole === "admin";

  const { data: joinRequests } = useJoinRequests(circleId, isAdminOrOwner);

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

  const changeRoleForm = useForm<z.infer<typeof changeRoleFormSchema>>({
    resolver: zodResolver(changeRoleFormSchema),
    defaultValues: { role: "member" },
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
        queryClient.invalidateQueries({ queryKey: ['/api/circles', circleId, 'invitations'] });
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

  function onSubmitChangeRole(values: z.infer<typeof changeRoleFormSchema>) {
    if (!roleDialogMember) return;
    updateMember.mutate(
      { circleId, memberId: roleDialogMember.id, data: { role: values.role } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCircleMembersQueryKey(circleId) });
          setRoleDialogMember(null);
          toast({ title: "Role updated", description: `${roleDialogMember.displayName ?? "Member"}'s role has been updated.` });
        },
        onError: () => {
          toast({ title: "Could not update role", variant: "destructive" });
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
            </CardHeader>
            <CardContent className="p-0">
              {membersLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading members...</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {(members as CircleMember[] | undefined)?.map((member) => (
                    <div key={member.id} className="p-4 sm:px-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Link href={`/profile/${member.userId}`}>
                          <Avatar className="h-10 w-10 border cursor-pointer">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {member.displayName?.charAt(0) || "U"}
                            </AvatarFallback>
                          </Avatar>
                        </Link>
                        <div>
                          <Link href={`/profile/${member.userId}`}>
                            <p className="font-medium text-foreground hover:underline cursor-pointer">{member.displayName}</p>
                          </Link>
                          {displayEmail(member.email) ? (
                            <p className="text-sm text-muted-foreground">{displayEmail(member.email)}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 capitalize border-transparent ${
                          member.role === 'owner' ? 'bg-primary/10 text-primary' : 
                          member.role === 'admin' ? 'bg-secondary/10 text-secondary' : 
                          member.role === 'guest' ? 'bg-muted text-muted-foreground' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {member.role}
                        </Badge>
                        {isAdminOrOwner && member.role !== 'owner' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-2xl">
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer"
                                onClick={() => {
                                  changeRoleForm.setValue("role", member.role as "member" | "admin" | "guest");
                                  setRoleDialogMember(member);
                                }}
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
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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

      <Dialog open={!!roleDialogMember} onOpenChange={(v) => { if (!v) setRoleDialogMember(null); }}>
        <DialogContent className="sm:max-w-[360px] rounded-3xl">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Update {roleDialogMember?.displayName ?? "this member"}'s role in the circle.
            </DialogDescription>
          </DialogHeader>
          <Form {...changeRoleForm}>
            <form onSubmit={changeRoleForm.handleSubmit(onSubmitChangeRole)} className="space-y-4 pt-2">
              <FormField
                control={changeRoleForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" className="rounded-full" onClick={() => setRoleDialogMember(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMember.isPending} className="rounded-full">
                  {updateMember.isPending ? "Saving..." : "Save Role"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
