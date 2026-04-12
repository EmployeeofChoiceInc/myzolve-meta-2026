import { useParams, Link } from "wouter";
import { 
  useGetServicePost, 
  useMatchServicePost, 
  useCompleteServicePost,
  getGetServicePostQueryKey
} from "@workspace/api-client-react";
import { ArrowLeft, Sparkles, MapPin, CheckCircle2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const serviceId = parseInt(id!);
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: service, isLoading } = useGetServicePost(serviceId, {
    query: { enabled: !!serviceId, queryKey: getGetServicePostQueryKey(serviceId) }
  });

  const matchService = useMatchServicePost();
  const completeService = useCompleteServicePost();

  if (isLoading) return <div className="p-8 animate-pulse flex flex-col gap-4"><div className="h-8 bg-muted w-1/3 rounded"></div><div className="h-64 bg-muted rounded-3xl"></div></div>;
  if (!service) return <div>Service not found</div>;

  const isCreator = service.createdByName === user?.fullName; // Rough check

  const handleMatch = () => {
    matchService.mutate({ serviceId, data: { message: "I'm interested!" } }, {
      onSuccess: () => {
        toast({ title: "Interest Shared", description: "The poster has been notified." });
        queryClient.invalidateQueries({ queryKey: getGetServicePostQueryKey(serviceId) });
      }
    });
  };

  const handleComplete = () => {
    completeService.mutate({ serviceId }, {
      onSuccess: () => {
        toast({ title: "Service Completed", description: "Marked as completed." });
        queryClient.invalidateQueries({ queryKey: getGetServicePostQueryKey(serviceId) });
      }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <Link href={`/circles/${service.circleId}/services`} className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Services
        </Link>
      </div>

      <Card className="rounded-3xl border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="pb-4 bg-muted/30 border-b border-border/50">
          <div className="flex justify-between items-start mb-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={`rounded-full px-3 py-1 font-medium border-transparent ${service.serviceType === 'offer' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'}`}>
                {service.serviceType === 'offer' ? 'Offering' : 'Requesting'}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1 font-medium bg-background">
                {service.category}
              </Badge>
              {service.status !== 'active' && (
                <Badge variant="secondary" className="rounded-full px-3 py-1 font-medium">
                  {service.status}
                </Badge>
              )}
            </div>
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold">{service.title}</CardTitle>
          <CardDescription className="text-base mt-2 text-foreground/80 flex items-center justify-between">
            <span>Posted by <span className="font-medium">{service.createdByName}</span></span>
            <span className="text-sm text-muted-foreground">{format(new Date(service.createdAt), 'MMM d, yyyy')}</span>
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-6 space-y-8">
          <div>
            <h3 className="font-semibold text-lg mb-2">Details</h3>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{service.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card border rounded-2xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Location</p>
              <div className="flex items-center font-medium capitalize text-foreground">
                <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
                {service.locationMode.replace('_', ' ')}
              </div>
            </div>
            <div className="bg-card border rounded-2xl p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Exchange</p>
              <div className="flex items-center font-medium capitalize text-accent-foreground">
                <Sparkles className="w-4 h-4 mr-2" />
                {service.exchangePreference}
              </div>
            </div>
          </div>

          {service.availability && (
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-2">Availability</h3>
              <p className="text-foreground bg-muted/50 p-4 rounded-2xl text-sm">{service.availability}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border/50">
            {!isCreator && service.status === 'active' && (
              <Button size="lg" className="rounded-full w-full" onClick={handleMatch} disabled={matchService.isPending}>
                <UserPlus className="w-5 h-5 mr-2" /> {service.serviceType === 'offer' ? "I'm interested" : "I can help"}
              </Button>
            )}
            
            {isCreator && service.status === 'active' && (
              <Button size="lg" variant="secondary" className="rounded-full w-full" onClick={handleComplete} disabled={completeService.isPending}>
                <CheckCircle2 className="w-5 h-5 mr-2" /> Mark as Complete
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
