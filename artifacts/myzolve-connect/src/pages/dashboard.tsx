import { Link } from "wouter";
import { Plus, HandHeart, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useListCircles } from "@workspace/api-client-react";

export default function DashboardPage() {
  const { data: circles, isLoading } = useListCircles();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome home.</h1>
          <p className="text-muted-foreground mt-1">Here is the latest from your trusted circles.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-full bg-card">
            <HandHeart className="mr-2 w-4 h-4" /> Offer help
          </Button>
          <Button className="rounded-full">
            <Plus className="mr-2 w-4 h-4" /> Ask for support
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Quick Stats or Urgent Needs */}
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
                  <Button className="rounded-full">Create a Circle</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {circles?.map(circle => (
                  <Link key={circle.id} href={`/circles/${circle.id}`}>
                    <Card className="rounded-3xl hover:shadow-md transition-shadow cursor-pointer h-full border-border/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">{circle.name}</CardTitle>
                        <CardDescription className="capitalize text-xs font-medium">{circle.circleType.replace('_', ' ')}</CardDescription>
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
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-semibold mb-4">Gentle Reminders</h2>
            <Card className="rounded-3xl border-secondary/20 bg-secondary/5 shadow-none">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground text-center py-4">
                  You're all caught up on returning support.
                </p>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
