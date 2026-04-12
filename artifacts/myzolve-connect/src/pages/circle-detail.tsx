import { useParams, Link, useLocation } from "wouter";
import { 
  useGetCircle, 
  useGetCircleStats, 
  useUpdateCircle,
  useDeleteCircle,
  getGetCircleQueryKey,
  getListCirclesQueryKey,
} from "@workspace/api-client-react";
import { Heart, HandHeart, Sparkles, BookOpen, Users, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

const circleSettingsSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(1000).optional(),
});

export default function CircleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const circleId = parseInt(id!);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const initialized = useRef(false);
  
  const { data: circle, isLoading: circleLoading } = useGetCircle(circleId, { 
    query: { enabled: !!circleId, queryKey: getGetCircleQueryKey(circleId) } 
  });
  
  const { data: stats, isLoading: statsLoading } = useGetCircleStats(circleId, {
    query: { enabled: !!circleId, queryKey: ["circle-stats", circleId] as const }
  });

  const updateCircle = useUpdateCircle();
  const deleteCircle = useDeleteCircle();

  const form = useForm<z.infer<typeof circleSettingsSchema>>({
    resolver: zodResolver(circleSettingsSchema),
    defaultValues: { name: "", description: "" },
  });

  useEffect(() => {
    if (circle && !initialized.current) {
      form.reset({
        name: circle.name || "",
        description: circle.description || "",
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
      </div>

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
    </div>
  );
}
