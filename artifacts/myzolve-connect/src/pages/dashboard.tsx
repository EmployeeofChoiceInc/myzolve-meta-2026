import { Link } from "wouter";
import { Plus, HandHeart, CalendarClock, ArrowRight, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useListCircles, useGetCircleDashboard, useListSupportRequests } from "@workspace/api-client-react";

function CircleDashboardSection({ circleId }: { circleId: number }) {
  const { data: dashboard, isLoading } = useGetCircleDashboard(circleId);
  const { data: requests } = useListSupportRequests(circleId);

  const openRequests = requests?.filter((r) => r.status !== "completed" && r.status !== "archived" && r.status !== "canceled").slice(0, 3);

  if (isLoading) return <div className="space-y-3"><div className="h-24 bg-muted/30 rounded-2xl animate-pulse" /><div className="h-24 bg-muted/30 rounded-2xl animate-pulse" /></div>;

  return (
    <div className="space-y-6">
      {dashboard && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-primary/5 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-primary">{dashboard.openRequestsCount}</div>
            <div className="text-xs text-muted-foreground mt-1">Open requests</div>
          </div>
          <div className="bg-secondary/5 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold text-secondary">{dashboard.activeServices}</div>
            <div className="text-xs text-muted-foreground mt-1">Active services</div>
          </div>
          <div className={`rounded-2xl p-4 text-center ${dashboard.urgentRequestsCount > 0 ? "bg-orange-500/5" : "bg-muted/30"}`}>
            <div className={`text-2xl font-bold ${dashboard.urgentRequestsCount > 0 ? "text-orange-600" : "text-muted-foreground"}`}>{dashboard.urgentRequestsCount}</div>
            <div className="text-xs text-muted-foreground mt-1">Urgent</div>
          </div>
        </div>
      )}

      {openRequests && openRequests.length > 0 && (
        <div className="space-y-3">
          {openRequests.map((req) => {
            const pct = req.amountRequested > 0 ? Math.min(100, Math.round(((req.amountFunded ?? 0) / req.amountRequested) * 100)) : 0;
            return (
              <Link key={req.id} href={`/requests/${req.id}`}>
                <Card className="rounded-2xl border-border/50 hover:shadow-sm transition-all cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm leading-tight truncate">{req.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{req.createdByName}</p>
                      </div>
                      <Badge variant="outline" className="rounded-full text-xs ml-2 shrink-0 bg-primary/5 text-primary border-transparent">
                        {req.urgencyLevel}
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      <Progress value={pct} className="h-1.5 bg-primary/10" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>${req.amountFunded ?? 0} supported</span>
                        <span>Goal: ${req.amountRequested}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {(!openRequests || openRequests.length === 0) && (
        <div className="text-center py-8 text-muted-foreground">
          <CalendarClock className="w-8 h-8 mx-auto mb-2 opacity-20" />
          <p className="text-sm">No open requests right now. All is well.</p>
        </div>
      )}
    </div>
  );
}

function RepaymentRemindersSection({ circleId }: { circleId: number }) {
  const { data: dashboard, isLoading } = useGetCircleDashboard(circleId);

  if (isLoading) return <div className="h-16 bg-muted/30 rounded-2xl animate-pulse" />;

  const reminders = dashboard?.pendingRepayments ?? [];

  if (reminders.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        You're all caught up on returning support.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {reminders.slice(0, 3).map((reminder) => (
        <Link key={reminder.requestId} href={`/requests/${reminder.requestId}`}>
          <div className="flex items-center justify-between text-sm p-3 bg-secondary/5 rounded-xl hover:bg-secondary/10 transition-colors cursor-pointer">
            <div>
              <p className="font-medium text-foreground truncate max-w-[180px]">{reminder.requestTitle}</p>
              <p className="text-xs text-muted-foreground">${reminder.amountOwed} to return</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { data: circles, isLoading } = useListCircles();
  const firstCircleId = circles?.[0]?.id;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome home.</h1>
          <p className="text-muted-foreground mt-1">Here is the latest from your trusted circles.</p>
        </div>
        {firstCircleId && (
          <div className="flex items-center gap-3">
            <Button variant="outline" className="rounded-full bg-card" asChild>
              <Link href={`/circles/${firstCircleId}/services`}>
                <HandHeart className="mr-2 w-4 h-4" /> Offer help
              </Link>
            </Button>
            <Button className="rounded-full" asChild>
              <Link href={`/circles/${firstCircleId}/requests`}>
                <Plus className="mr-2 w-4 h-4" /> Ask for support
              </Link>
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <section>
            <h2 className="text-lg font-semibold mb-4">Your Circles</h2>
            {isLoading ? (
              <div className="h-32 bg-muted/50 rounded-3xl animate-pulse" />
            ) : circles?.length === 0 ? (
              <Card className="rounded-3xl bg-primary/5 border-primary/10 shadow-none">
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4">
                    <HandHeart className="w-8 h-8" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">You don't have any circles yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm">Create a space for your family or friends to support each other.</p>
                  <Button className="rounded-full" asChild>
                    <Link href="/circles">Create a Circle</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {circles?.map(circle => (
                  <Link key={circle.id} href={`/circles/${circle.id}`}>
                    <Card className="rounded-3xl hover:shadow-md transition-shadow cursor-pointer h-full border-border/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">{circle.name}</CardTitle>
                        <CardDescription className="capitalize text-xs font-medium">{circle.circleType.replace("_", " ")}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {circle.description || "A trusted circle for mutual support."}
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {firstCircleId && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Open Requests</h2>
                <Link href={`/circles/${firstCircleId}/requests`} className="text-sm text-primary hover:underline flex items-center gap-1">
                  View all <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <CircleDashboardSection circleId={firstCircleId} />
            </section>
          )}

          {!firstCircleId && !isLoading && (
            <section>
              <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
              <Card className="rounded-3xl border-border/50 shadow-none">
                <CardContent className="p-6">
                  <div className="text-center py-10 text-muted-foreground">
                    <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p>It's quiet here. Activity from your circles will appear below.</p>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-semibold mb-4">Gentle Reminders</h2>
            <Card className="rounded-3xl border-secondary/20 bg-secondary/5 shadow-none">
              <CardContent className="p-6">
                {firstCircleId ? (
                  <RepaymentRemindersSection circleId={firstCircleId} />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    You're all caught up on returning support.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
