import { useParams, Link } from "wouter";
import { useGetCircle, useGetCircleStats, getGetCircleQueryKey } from "@workspace/api-client-react";
import { Heart, HandHeart, Sparkles, BookOpen, Users, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CircleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const circleId = parseInt(id!);
  
  const { data: circle, isLoading: circleLoading } = useGetCircle(circleId, { 
    query: { enabled: !!circleId, queryKey: getGetCircleQueryKey(circleId) } 
  });
  
  const { data: stats, isLoading: statsLoading } = useGetCircleStats(circleId, {
    query: { enabled: !!circleId, queryKey: ["circle-stats", circleId] as const }
  });

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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
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
              <Button variant="outline" className="rounded-full bg-card">
                <Settings className="w-4 h-4 mr-2" /> Settings
              </Button>
            )}
            <Link href={`/circles/${circle.id}/requests`}>
              <Button className="rounded-full">Ask for support</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
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

      {/* Navigation Areas */}
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
    </div>
  );
}
