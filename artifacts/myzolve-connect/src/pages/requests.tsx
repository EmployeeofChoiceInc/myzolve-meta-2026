import { useParams, Link } from "wouter";
import { useListSupportRequests } from "@workspace/api-client-react";
import { HandHeart, Plus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function RequestsPage() {
  const { id } = useParams<{ id: string }>();
  const circleId = parseInt(id!);

  const { data: requests, isLoading } = useListSupportRequests({ circleId });

  const getUrgencyColor = (level: string) => {
    switch(level) {
      case 'critical': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'high': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      default: return 'bg-secondary/10 text-secondary border-secondary/20';
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'fully_funded': return 'bg-secondary/10 text-secondary';
      case 'completed': return 'bg-muted text-muted-foreground';
      default: return 'bg-primary/10 text-primary';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-2">
        <Link href={`/circles/${circleId}`} className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Circle
        </Link>
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Support Requests</h1>
          <p className="text-muted-foreground mt-1">Offer a hand or ask for what you need.</p>
        </div>
        
        <Button className="rounded-full">
          <Plus className="mr-2 w-4 h-4" /> New Request
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2].map(i => (
            <div key={i} className="h-64 bg-muted/50 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : requests?.length === 0 ? (
        <Card className="rounded-3xl bg-card border-border/50 shadow-none py-16">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-primary/5 rounded-full flex items-center justify-center text-primary mb-4">
              <HandHeart className="w-8 h-8 opacity-50" />
            </div>
            <h3 className="font-semibold text-xl mb-2">No support requests right now</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Your circle is all caught up. Feel free to ask for support when you need it.
            </p>
            <Button className="rounded-full">Make a Request</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {requests?.map((req) => {
            const percentFunded = req.amount > 0 ? Math.min(100, Math.round((req.fundedAmount / req.amount) * 100)) : 0;
            
            return (
              <Link key={req.id} href={`/requests/${req.id}`}>
                <Card className="rounded-3xl hover:shadow-md transition-all cursor-pointer h-full border-border/50 flex flex-col hover:-translate-y-1">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={`rounded-full px-2.5 font-medium ${getStatusColor(req.status)} border-transparent`}>
                          {req.status.replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline" className={`rounded-full px-2.5 font-medium ${getUrgencyColor(req.urgencyLevel)}`}>
                          {req.urgencyLevel}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {req.category}
                      </div>
                    </div>
                    <CardTitle className="text-xl leading-tight">{req.title}</CardTitle>
                    <CardDescription className="text-sm">
                      Requested by <span className="font-medium text-foreground">{req.createdByName || "A member"}</span>
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="pb-4 flex-1">
                    <p className="text-muted-foreground text-sm line-clamp-2 mb-4">
                      {req.description}
                    </p>
                    
                    <div className="space-y-2 mt-auto">
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-primary">${req.fundedAmount} <span className="text-muted-foreground font-normal">supported</span></span>
                        <span className="text-foreground">Goal: ${req.amount}</span>
                      </div>
                      <Progress value={percentFunded} className="h-2 bg-primary/10" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
