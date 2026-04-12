import { useParams, Link } from "wouter";
import { 
  useListCircleMembers, 
  useListCircleInvitations, 
  useCreateCircleInvitation 
} from "@workspace/api-client-react";
import { ArrowLeft, UserPlus, Mail, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const inviteFormSchema = z.object({
  invitedEmail: z.string().email("Please enter a valid email"),
  role: z.enum(["member", "admin"]),
  customMessage: z.string().optional(),
});

export default function MembersPage() {
  const { id } = useParams<{ id: string }>();
  const circleId = parseInt(id!);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: members, isLoading: membersLoading } = useListCircleMembers(circleId, {
    query: { enabled: !!circleId, queryKey: ["circle-members", circleId] as const }
  });
  
  const { data: invitations, isLoading: invitationsLoading } = useListCircleInvitations(circleId, {
    query: { enabled: !!circleId, queryKey: ["circle-invitations", circleId] as const }
  });

  const createInvitation = useCreateCircleInvitation();

  const form = useForm<z.infer<typeof inviteFormSchema>>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      invitedEmail: "",
      role: "member",
      customMessage: "",
    },
  });

  function onSubmit(values: z.infer<typeof inviteFormSchema>) {
    createInvitation.mutate({
      circleId,
      data: values
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/circles', circleId, 'invitations'] });
        setOpen(false);
        form.reset();
        toast({ title: "Invitation sent", description: "They will receive an email shortly." });
      },
      onError: () => {
        toast({ title: "Error", description: "Could not send invitation.", variant: "destructive" });
      }
    });
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
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full">
              <UserPlus className="mr-2 w-4 h-4" /> Invite Someone
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-3xl">
            <DialogHeader>
              <DialogTitle>Invite to Circle</DialogTitle>
              <DialogDescription>
                Send an invitation to join this trusted space.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="invitedEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input placeholder="friend@example.com" type="email" {...field} className="rounded-xl" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
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
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Personal Message (Optional)</FormLabel>
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
                    {createInvitation.isPending ? "Sending..." : "Send Invite"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
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
                  {members?.map((member) => (
                    <div key={member.id} className="p-4 sm:px-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-10 w-10 border">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {member.displayName?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{member.displayName}</p>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 capitalize border-transparent ${
                        member.role === 'owner' ? 'bg-primary/10 text-primary' : 
                        member.role === 'admin' ? 'bg-secondary/10 text-secondary' : 
                        'bg-muted text-muted-foreground'
                      }`}>
                        {member.role}
                      </Badge>
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
              ) : invitations?.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">No pending invitations.</div>
              ) : (
                <div className="divide-y divide-border/50">
                  {invitations?.map((inv) => (
                    <div key={inv.id} className="p-4 sm:px-6">
                      <p className="font-medium text-sm text-foreground truncate">{inv.invitedEmail}</p>
                      <div className="flex justify-between items-center mt-2">
                        <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-transparent capitalize">
                          {inv.role}
                        </Badge>
                        <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive hover:text-destructive">
                          Revoke
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
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
    </div>
  );
}
