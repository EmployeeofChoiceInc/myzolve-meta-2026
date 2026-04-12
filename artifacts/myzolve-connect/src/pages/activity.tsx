import { useParams, Link } from "wouter";
import { useGetCircleActivity } from "@workspace/api-client-react";
import { ArrowLeft, Users, HandHeart, Sparkles, ArrowLeftRight, Heart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";

export default function ActivityPage() {
  const { id } = useParams<{ id: string }>();
  const circleId = parseInt(id!);

  const { data: activity, isLoading } = useGetCircleActivity(circleId);

  const getActivityIcon = (type: string) => {
    switch(type) {
      case 'member_joined': return <Users className="w-5 h-5 text-muted-foreground" />;
      case 'request_posted': return <HandHeart className="w-5 h-5 text-primary" />;
      case 'service_posted': return <Sparkles className="w-5 h-5 text-accent-foreground" />;
      case 'repayment_made': return <ArrowLeftRight className="w-5 h-5 text-secondary" />;
      default: return <Heart className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <Link href={`/circles/${circleId}`} className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Circle
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Circle Activity</h1>
        <p className="text-muted-foreground mt-1">See what's happening in your trusted circle.</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted/50 rounded-2xl animate-pulse" />)}
        </div>
      ) : activity?.length === 0 ? (
        <Card className="rounded-3xl bg-card border-border/50 shadow-none py-16">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center text-muted-foreground mb-4">
              <Heart className="w-8 h-8 opacity-50" />
            </div>
            <h3 className="font-semibold text-xl mb-2">It's quiet here</h3>
            <p className="text-muted-foreground max-w-sm">
              Your circle hasn't posted any activity yet. Be the first to share a request or offer a service!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative space-y-4 before:absolute before:inset-0 before:ml-6 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
          {activity?.map((item) => (
            <div key={item.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-12 h-12 rounded-full border-4 border-background bg-card shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                {getActivityIcon(item.activityType)}
              </div>
              
              <Card className="w-[calc(100%-4rem)] md:w-[calc(50%-3rem)] rounded-2xl border-border/50 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4 sm:p-5 flex flex-col">
                  <span className="text-xs font-medium text-muted-foreground mb-1">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </span>
                  <p className="text-foreground leading-relaxed">
                    <span className="font-semibold">{item.actorName}</span> {item.summaryText}
                  </p>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
