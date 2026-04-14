import { useParams, Link, useLocation } from "wouter";
import { 
  useGetCircle, 
  useGetCircleStats, 
  useUpdateCircle,
  useDeleteCircle,
  getGetCircleQueryKey,
  getListCirclesQueryKey,
  useListCircleConnections,
  useCreateCircleConnection,
} from "@workspace/api-client-react";
import { Heart, HandHeart, Sparkles, BookOpen, Users, Settings, Trash2, UserPlus, Link2, AlertTriangle, ClipboardList, Shield, ChevronDown, ChevronRight, PenSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  usePlaceholderMembers,
  useCreatePlaceholderMember,
  useDisputes,
  useResolveDispute,
  useAuditLogs,
} from "@/hooks/use-api";

interface DisputeResolution {
  disputeId: number;
  resolution: "resolved" | "dismissed";
}

const circleSettingsSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(1000).optional(),
  privacyMode: z.enum(["private", "hidden", "open", "community"]).optional(),
});

const placeholderSchema = z.object({
  displayName: z.string().min(1, "Name is required").max(100),
  relationship: z.string().max(100).optional(),
  email: z.string().email().optional().or(z.literal("")),
  notes: z.string().max(500).optional(),
});

const connectionSchema = z.object({
  receiverCircleId: z.coerce.number().int().positive("Enter a valid circle ID"),
  message: z.string().max(500).optional(),
  permissionScope: z.enum(["service_only", "referral", "support_sharing"]).default("service_only"),
});

export default function CircleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const circleId = parseInt(id!);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [placeholderOpen, setPlaceholderOpen] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(false);
  const initialized = useRef(false);
  
  const { data: circle, isLoading: circleLoading } = useGetCircle(circleId, { 
    query: { enabled: !!circleId, queryKey: getGetCircleQueryKey(circleId) } 
  });
  
  const { data: stats, isLoading: statsLoading } = useGetCircleStats(circleId, {
    query: { enabled: !!circleId, queryKey: ["circle-stats", circleId] as const }
  });

  const { data: placeholders } = usePlaceholderMembers(circleId);
  const { data: disputes } = useDisputes(circleId);
  const { data: auditLogs } = useAuditLogs(circleId);
  const { data: connections } = useListCircleConnections(circleId, {
    query: { enabled: !!circleId, queryKey: ["circle-connections", circleId] as const }
  });

  const updateCircle = useUpdateCircle();
  const deleteCircle = useDeleteCircle();
  const createPlaceholder = useCreatePlaceholderMember(circleId);
  const resolveDispute = useResolveDispute(circleId);
  const createConnection = useCreateCircleConnection();

  const form = useForm<z.infer<typeof circleSettingsSchema>>({
    resolver: zodResolver(circleSettingsSchema),
    defaultValues: { name: "", description: "", privacyMode: "private" },
  });

  const placeholderForm = useForm<z.infer<typeof placeholderSchema>>({
    resolver: zodResolver(placeholderSchema),
    defaultValues: { displayName: "", relationship: "", email: "", notes: "" },
  });

  const connectionForm = useForm<z.infer<typeof connectionSchema>>({
    resolver: zodResolver(connectionSchema),
    defaultValues: { receiverCircleId: 0, message: "", permissionScope: "service_only" as const },
  });

  useEffect(() => {
    if (circle && !initialized.current) {
      form.reset({
        name: circle.name || "",
        description: circle.description || "",
        privacyMode: (circle.privacyMode as "private" | "hidden" | "open" | "community") || "private",
      });
      initialized.current = true;
    }
  }, [circle, form]);

  function onSubmitSettings(values: z.infer<typeof circleSettingsSchema>) {
    updateCircle.mutate(
      { circleId, data: values },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetCircleQueryKey(circleId), updated);
          queryClient.invalidateQueries({ queryKey: getListCirclesQueryKey() });
          setSettingsOpen(false);
          toast({ title: "Circle updated" });
        },
        onError: () => {
          toast({ title: "Could not update circle", variant: "destructive" });
        },
      }
    );
  }

  function handleDeleteCircle() {
    deleteCircle.mutate(
      { circleId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCirclesQueryKey() });
          toast({ title: "Circle removed", description: "The circle has been permanently removed." });
          navigate("/circles");
        },
        onError: () => {
          toast({ title: "Could not remove circle", variant: "destructive" });
        },
      }
    );
  }

  function onSubmitPlaceholder(values: z.infer<typeof placeholderSchema>) {
    createPlaceholder.mutate(
      {
        displayName: values.displayName,
        relationship: values.relationship || undefined,
        email: values.email || undefined,
        notes: values.notes || undefined,
      },
      {
        onSuccess: () => {
          toast({ title: "Placeholder member added" });
          setPlaceholderOpen(false);
          placeholderForm.reset();
        },
        onError: () => {
          toast({ title: "Could not add placeholder member", variant: "destructive" });
        },
      }
    );
  }

  function onSubmitConnection(values: z.infer<typeof connectionSchema>) {
    createConnection.mutate(
      { circleId, data: { receiverCircleId: values.receiverCircleId, permissionScope: values.permissionScope, message: values.message || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Connection request sent" });
          setConnectionOpen(false);
          connectionForm.reset();
          queryClient.invalidateQueries({ queryKey: ["circle-connections", circleId] });
        },
        onError: () => {
          toast({ title: "Could not send connection request", variant: "destructive" });
        },
      }
    );
  }

  const [disputeDialog, setDisputeDialog] = useState<{ id: number; reason: string } | null>(null);
  const [disputeResolution, setDisputeResolution] = useState<"resolved" | "dismissed">("resolved");
  const [disputeNote, setDisputeNote] = useState("");

  function openDisputeDialog(d: { id: number; reason: string }) {
    setDisputeDialog(d);
    setDisputeResolution("resolved");
    setDisputeNote("");
  }

  function handleSubmitDisputeResolution() {
    if (!disputeDialog) return;
    resolveDispute.mutate(
      { disputeId: disputeDialog.id, resolution: disputeResolution, resolutionNote: disputeNote.trim() },
      {
        onSuccess: () => {
          toast({ title: disputeResolution === "resolved" ? "Dispute resolved" : "Dispute dismissed" });
          setDisputeDialog(null);
        },
        onError: () => toast({ title: "Could not update dispute", variant: "destructive" }),
      }
    );
  }

  const CIRCLE_TYPE_LABELS: Record<string, string> = {
    family: "Family",
    chosen_family: "Chosen Family",
    friends: "Friends",
    caregiving_circle: "Caregiving Circle",
    neighborhood_circle: "Neighborhood Circle",
    other: "Other"
  };

  if (circleLoading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <Skeleton className="h-32 w-full rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!circle) return <div>Circle not found</div>;

  const isAdmin = circle.myRole === 'owner' || circle.myRole === 'admin';
  const isOwner = circle.myRole === 'owner';

  const openDisputes = disputes?.filter((d) => d.status === "open") ?? [];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-card border border-border/50 rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between gap-6 items-start">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-3">
              <span className="bg-primary/10 text-primary text-sm font-medium px-3 py-1 rounded-full">
                {CIRCLE_TYPE_LABELS[circle.circleType] || circle.circleType}
              </span>
              <span className="text-muted-foreground text-sm flex items-center">
                <Users className="w-4 h-4 mr-1" /> {circle.memberCount || 1} members
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-3">{circle.name}</h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              {circle.description || "A trusted space for mutual support."}
            </p>
          </div>
          
          <div className="flex gap-3">
            {isAdmin && (
              <Button variant="outline" className="rounded-full bg-card" onClick={() => setSettingsOpen(true)}>
                <Settings className="w-4 h-4 mr-2" /> Settings
              </Button>
            )}
            <Link href={`/circles/${circle.id}/requests`}>
              <Button className="rounded-full">Ask for support</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl shadow-none border-border/50 bg-card">
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center">
              <HandHeart className="w-4 h-4 mr-2 text-primary" /> Open Requests
            </div>
            <div className="text-3xl font-bold">{statsLoading ? "-" : stats?.openRequests || 0}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-none border-border/50 bg-card">
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center">
              <Heart className="w-4 h-4 mr-2 text-secondary" /> Support Given
            </div>
            <div className="text-3xl font-bold">{statsLoading ? "-" : `$${stats?.totalSupportGiven || 0}`}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-none border-border/50 bg-card">
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center">
              <Sparkles className="w-4 h-4 mr-2 text-accent-foreground" /> Active Services
            </div>
            <div className="text-3xl font-bold">{statsLoading ? "-" : stats?.activeServices || 0}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-none border-border/50 bg-card">
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground mb-2 flex items-center">
              <BookOpen className="w-4 h-4 mr-2 text-muted-foreground" /> Completed
            </div>
            <div className="text-3xl font-bold">{statsLoading ? "-" : stats?.completedRequests || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href={`/circles/${circle.id}/requests`}>
          <Card className="rounded-3xl hover:shadow-md transition-shadow cursor-pointer h-full border-border/50 group">
            <CardHeader>
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-4 group-hover:scale-105 transition-transform">
                <HandHeart className="w-6 h-6" />
              </div>
              <CardTitle>Support Requests</CardTitle>
              <CardDescription>Ask for financial or material support from your circle.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        
        <Link href={`/circles/${circle.id}/services`}>
          <Card className="rounded-3xl hover:shadow-md transition-shadow cursor-pointer h-full border-border/50 group">
            <CardHeader>
              <div className="w-12 h-12 bg-accent rounded-2xl flex items-center justify-center text-accent-foreground mb-4 group-hover:scale-105 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <CardTitle>Service Exchange</CardTitle>
              <CardDescription>Offer your time or request a helping hand.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        
        <Link href={`/circles/${circle.id}/ledger`}>
          <Card className="rounded-3xl hover:shadow-md transition-shadow cursor-pointer h-full border-border/50 group">
            <CardHeader>
              <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center text-secondary mb-4 group-hover:scale-105 transition-transform">
                <BookOpen className="w-6 h-6" />
              </div>
              <CardTitle>Soft Ledger</CardTitle>
              <CardDescription>A gentle record of support given and returned.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        
        <Link href={`/circles/${circle.id}/members`}>
          <Card className="rounded-3xl hover:shadow-md transition-shadow cursor-pointer h-full border-border/50 group">
            <CardHeader>
              <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center text-foreground mb-4 group-hover:scale-105 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <CardTitle>Members</CardTitle>
              <CardDescription>View and invite people to your circle.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        
        <Link href={`/circles/${circle.id}/activity`}>
          <Card className="rounded-3xl hover:shadow-md transition-shadow cursor-pointer h-full border-border/50 group">
            <CardHeader>
              <div className="w-12 h-12 bg-primary/5 rounded-2xl flex items-center justify-center text-primary mb-4 group-hover:scale-105 transition-transform">
                <Heart className="w-6 h-6" />
              </div>
              <CardTitle>Activity</CardTitle>
              <CardDescription>See what's happening in your trusted circle.</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href={`/circles/${circle.id}/wall`}>
          <Card className="rounded-3xl hover:shadow-md transition-shadow cursor-pointer h-full border-border/50 group">
            <CardHeader>
              <div className="w-12 h-12 bg-secondary/20 rounded-2xl flex items-center justify-center text-secondary-foreground mb-4 group-hover:scale-105 transition-transform">
                <PenSquare className="w-6 h-6" />
              </div>
              <CardTitle>Circle Wall</CardTitle>
              <CardDescription>Updates, announcements, and posts from your circle.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      {/* Placeholder Members */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Placeholder Members</h2>
            <p className="text-sm text-muted-foreground">People you support who haven't joined yet</p>
          </div>
          <Button variant="outline" className="rounded-full gap-2" onClick={() => setPlaceholderOpen(true)}>
            <UserPlus className="w-4 h-4" /> Add Placeholder
          </Button>
        </div>
        {placeholders && placeholders.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {placeholders.map((p) => (
              <Card key={p.id} className="rounded-2xl border-border/50 shadow-none">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                    {p.displayName[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.displayName}</p>
                    {p.relationship && <p className="text-xs text-muted-foreground">{p.relationship}</p>}
                  </div>
                  <Badge variant="outline" className="rounded-full text-xs capitalize shrink-0">
                    {p.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="rounded-2xl border-border/50 shadow-none border-dashed">
            <CardContent className="p-6 text-center text-muted-foreground text-sm">
              No placeholder members yet. Add someone who needs support but hasn't joined.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Cross-circle Connections */}
      {isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Circle Connections</h2>
              <p className="text-sm text-muted-foreground">Trusted connections to other circles</p>
            </div>
            <Button variant="outline" className="rounded-full gap-2" onClick={() => setConnectionOpen(true)}>
              <Link2 className="w-4 h-4" /> Connect Circle
            </Button>
          </div>
          {connections && connections.length > 0 ? (
            <div className="space-y-3">
              {connections.map((conn) => (
                <Card key={conn.id} className="rounded-2xl border-border/50 shadow-none">
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-secondary/10 text-secondary flex items-center justify-center">
                        <Link2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {conn.initiatorCircleId === circleId ? `→ Circle #${conn.receiverCircleId}` : `← Circle #${conn.initiatorCircleId}`}
                        </p>
                        <p className="text-xs text-muted-foreground capitalize">{conn.permissionScope?.replace("_", " ")}</p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`rounded-full text-xs capitalize ${conn.status === "approved" ? "border-secondary/30 text-secondary bg-secondary/10" : conn.status === "declined" ? "text-destructive border-destructive/30" : "bg-muted"}`}
                    >
                      {conn.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="rounded-2xl border-border/50 shadow-none border-dashed">
              <CardContent className="p-6 text-center text-muted-foreground text-sm">
                No circle connections yet. Connect with a trusted circle to share services and referrals.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Admin Section: Disputes + Audit Log */}
      {isAdmin && (
        <div className="border border-border/50 rounded-3xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-6 text-left bg-muted/30 hover:bg-muted/50 transition-colors"
            onClick={() => setAdminExpanded(!adminExpanded)}
          >
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-semibold">Circle Administration</p>
                <p className="text-sm text-muted-foreground">
                  {openDisputes.length > 0 ? `${openDisputes.length} open dispute${openDisputes.length > 1 ? "s" : ""}` : "Disputes and audit log"}
                </p>
              </div>
              {openDisputes.length > 0 && (
                <Badge variant="destructive" className="rounded-full ml-2">{openDisputes.length}</Badge>
              )}
            </div>
            {adminExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </button>

          {adminExpanded && (
            <div className="p-6 space-y-8 border-t border-border/50">
              {/* Disputes */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-medium">Disputes</h3>
                </div>
                {disputes && disputes.length > 0 ? (
                  <div className="space-y-2">
                    {disputes.slice(0, 10).map((d) => (
                      <div key={d.id} className="flex items-start justify-between gap-3 p-3 bg-muted/30 rounded-2xl">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{d.reason}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {d.targetEntityType.replace("_", " ")} #{d.targetEntityId} · {format(new Date(d.createdAt), "MMM d")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="outline"
                            className={`rounded-full text-xs capitalize ${d.status === "open" ? "border-destructive/30 text-destructive bg-destructive/5" : "bg-muted"}`}
                          >
                            {d.status}
                          </Badge>
                          {d.status === "open" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full text-xs h-7 px-3"
                              onClick={() => openDisputeDialog({ id: d.id, reason: d.reason })}
                            >
                              Review
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">No disputes. The circle is in harmony.</p>
                )}
              </div>

              {/* Audit Log */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <ClipboardList className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-medium">Recent Activity Log</h3>
                </div>
                {auditLogs && auditLogs.length > 0 ? (
                  <div className="space-y-1.5">
                    {auditLogs.slice(0, 15).map((log) => (
                      <div key={log.id} className="flex items-center gap-3 py-2 px-3 bg-muted/20 rounded-xl text-sm">
                        <span className="font-mono text-xs text-muted-foreground shrink-0">{format(new Date(log.createdAt), "MMM d HH:mm")}</span>
                        <span className="font-medium text-foreground/80 truncate">{log.action.replace(/_/g, " ")}</span>
                        {log.targetEntityType && (
                          <span className="text-muted-foreground text-xs shrink-0 ml-auto">{log.targetEntityType} #{log.targetEntityId}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">No activity recorded yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Placeholder Member Dialog */}
      <Dialog open={placeholderOpen} onOpenChange={setPlaceholderOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-3xl">
          <DialogHeader>
            <DialogTitle>Add Placeholder Member</DialogTitle>
            <DialogDescription>Add someone you support who hasn't joined the app yet.</DialogDescription>
          </DialogHeader>
          <Form {...placeholderForm}>
            <form onSubmit={placeholderForm.handleSubmit(onSubmitPlaceholder)} className="space-y-4 pt-2">
              <FormField control={placeholderForm.control} name="displayName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="Grandma Rosa" {...field} className="rounded-xl" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={placeholderForm.control} name="relationship" render={({ field }) => (
                <FormItem>
                  <FormLabel>Relationship <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl><Input placeholder="Grandmother, neighbor, friend..." {...field} className="rounded-xl" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={placeholderForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl><Input type="email" placeholder="so we can invite them later" {...field} className="rounded-xl" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="rounded-full flex-1" onClick={() => setPlaceholderOpen(false)}>Cancel</Button>
                <Button type="submit" className="rounded-full flex-1" disabled={createPlaceholder.isPending}>
                  {createPlaceholder.isPending ? "Adding..." : "Add Member"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Circle Connection Dialog */}
      {isAdmin && (
        <Dialog open={connectionOpen} onOpenChange={setConnectionOpen}>
          <DialogContent className="sm:max-w-[420px] rounded-3xl">
            <DialogHeader>
              <DialogTitle>Connect with Another Circle</DialogTitle>
              <DialogDescription>Send a connection request to a trusted circle to share services and referrals.</DialogDescription>
            </DialogHeader>
            <Form {...connectionForm}>
              <form onSubmit={connectionForm.handleSubmit(onSubmitConnection)} className="space-y-4 pt-2">
                <FormField control={connectionForm.control} name="receiverCircleId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Circle ID <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input type="number" placeholder="Circle ID to connect with" {...field} className="rounded-xl" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={connectionForm.control} name="permissionScope" render={({ field }) => (
                  <FormItem>
                    <FormLabel>What to share</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Choose what to share" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="service_only">Services only — share skills and offers</SelectItem>
                        <SelectItem value="referral">Referrals — vouch for members</SelectItem>
                        <SelectItem value="support_sharing">Full support — share financial requests</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={connectionForm.control} name="message" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl><Textarea placeholder="Why you'd like to connect..." {...field} className="rounded-xl resize-none" rows={2} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" className="rounded-full flex-1" onClick={() => setConnectionOpen(false)}>Cancel</Button>
                  <Button type="submit" className="rounded-full flex-1" disabled={createConnection.isPending}>
                    {createConnection.isPending ? "Sending..." : "Send Request"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-3xl">
          <DialogHeader>
            <DialogTitle>Circle Settings</DialogTitle>
            <DialogDescription>Update your circle's name and description.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitSettings)} className="space-y-4 pt-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Circle Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Our Family Circle" {...field} className="rounded-xl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="A brief description of your circle..." 
                        className="resize-none rounded-xl" 
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="privacyMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visibility</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Choose visibility" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="private">Private — invite-only, not searchable</SelectItem>
                        <SelectItem value="hidden">Hidden — link-only, not searchable</SelectItem>
                        <SelectItem value="open">Open — anyone can find and request to join</SelectItem>
                        <SelectItem value="community">Community — discoverable, admin reviews requests</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-between items-center pt-2">
                {isOwner && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive rounded-full gap-1.5"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove Circle
                  </Button>
                )}
                <div className="flex gap-3 ml-auto">
                  <Button type="button" variant="outline" className="rounded-full" onClick={() => setSettingsOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateCircle.isPending} className="rounded-full">
                    {updateCircle.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-[360px] rounded-3xl">
          <DialogHeader>
            <DialogTitle>Remove this circle?</DialogTitle>
            <DialogDescription>
              This will permanently remove <strong>{circle.name}</strong> and all its data. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" className="rounded-full" onClick={() => setConfirmDelete(false)}>
              Keep Circle
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              disabled={deleteCircle.isPending}
              onClick={handleDeleteCircle}
            >
              {deleteCircle.isPending ? "Removing..." : "Yes, Remove"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dispute resolution dialog */}
      <Dialog open={!!disputeDialog} onOpenChange={(open) => { if (!open) setDisputeDialog(null); }}>
        <DialogContent className="sm:max-w-[440px] rounded-3xl">
          <DialogHeader>
            <DialogTitle>Review Dispute</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {disputeDialog?.reason}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <p className="text-sm font-medium mb-2">Outcome</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDisputeResolution("resolved")}
                  className={`flex-1 py-2 px-3 rounded-2xl border text-sm font-medium transition-colors ${disputeResolution === "resolved" ? "border-secondary bg-secondary/10 text-secondary" : "border-border text-muted-foreground hover:bg-muted"}`}
                >
                  Mark Resolved
                </button>
                <button
                  type="button"
                  onClick={() => setDisputeResolution("dismissed")}
                  className={`flex-1 py-2 px-3 rounded-2xl border text-sm font-medium transition-colors ${disputeResolution === "dismissed" ? "border-muted-foreground bg-muted text-foreground" : "border-border text-muted-foreground hover:bg-muted"}`}
                >
                  Dismiss
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Admin Note (optional)</label>
              <Textarea
                placeholder="Briefly note what was decided or why this is being dismissed..."
                value={disputeNote}
                onChange={(e) => setDisputeNote(e.target.value)}
                className="rounded-2xl resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 rounded-full" onClick={() => setDisputeDialog(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1 rounded-full"
                onClick={handleSubmitDisputeResolution}
                disabled={resolveDispute.isPending}
              >
                {resolveDispute.isPending ? "Saving..." : disputeResolution === "resolved" ? "Mark Resolved" : "Dismiss Dispute"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
