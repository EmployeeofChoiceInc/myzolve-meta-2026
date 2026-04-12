import { useParams, Link } from "wouter";
import { 
  useGetSupportRequest, 
  useCreateContribution, 
  useConfirmReceipt, 
  useCreateRepayment,
  getGetSupportRequestQueryKey
} from "@workspace/api-client-react";
import { ArrowLeft, HandHeart, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const requestId = parseInt(id!);
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: requestData, isLoading } = useGetSupportRequest(requestId, {
    query: { enabled: !!requestId, queryKey: getGetSupportRequestQueryKey(requestId) }
  });

  const createContribution = useCreateContribution();
  const confirmReceipt = useConfirmReceipt();
  const createRepayment = useCreateRepayment();

  if (isLoading) return <div className="p-8 animate-pulse flex flex-col gap-4"><div className="h-8 bg-muted w-1/3 rounded"></div><div className="h-64 bg-muted rounded-3xl"></div></div>;
  if (!requestData) return <div>Request not found</div>;

  const { contributions, repaymentPlan, ...request } = requestData;
  const percentFunded = request.amountRequested > 0 ? Math.min(100, Math.round(((request.amountFunded ?? 0) / request.amountRequested) * 100)) : 0;
  
  const isCreator = request.createdByName === user?.fullName;

  const handleConfirmReceipt = () => {
    confirmReceipt.mutate({ requestId }, {
      onSuccess: () => {
        toast({ title: "Receipt Confirmed", description: "The support has been marked as received." });
        queryClient.invalidateQueries({ queryKey: getGetSupportRequestQueryKey(requestId) });
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'fully_funded': return 'bg-secondary/10 text-secondary';
      case 'completed': return 'bg-muted text-muted-foreground';
      default: return 'bg-primary/10 text-primary';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <Link href={`/circles/${request.circleId}/requests`} className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Requests
        </Link>
      </div>

      <Card className="rounded-3xl border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="pb-4 bg-muted/30 border-b border-border/50">
          <div className="flex justify-between items-start mb-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className={`rounded-full px-3 py-1 font-medium ${getStatusColor(request.status)} border-transparent`}>
                {request.status.replace('_', ' ')}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1 font-medium bg-background">
                {request.category}
              </Badge>
            </div>
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold">{request.title}</CardTitle>
          <CardDescription className="text-base mt-2 text-foreground/80">
            Requested by <span className="font-medium">{request.createdByName}</span>
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-6 space-y-8">
          <div>
            <h3 className="font-semibold text-lg mb-2">About this request</h3>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{request.description}</p>
          </div>

          <div className="bg-card border rounded-2xl p-6">
            <div className="flex justify-between items-end mb-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Support Progress</p>
                <div className="text-3xl font-bold text-primary">
                  ${request.amountFunded ?? 0} <span className="text-lg text-muted-foreground font-normal">of ${request.amountRequested}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-muted-foreground mb-1">Repayment</p>
                <div className="text-foreground font-medium capitalize">{request.repaymentStyle.replace('_', ' ')}</div>
              </div>
            </div>
            <Progress value={percentFunded} className="h-3 bg-primary/10" />
            
            {request.dueDate && (
              <div className="mt-4 text-sm text-muted-foreground flex items-center">
                <Clock className="w-4 h-4 mr-1.5" /> Needed by {format(new Date(request.dueDate), 'MMMM d, yyyy')}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {!isCreator && request.status !== 'completed' && request.status !== 'fully_funded' && (
              <Button size="lg" className="rounded-full flex-1">
                <HandHeart className="w-5 h-5 mr-2" /> Offer Support
              </Button>
            )}
            
            {isCreator && (request.status === 'partially_funded' || request.status === 'fully_funded') && (
              <Button size="lg" variant="secondary" className="rounded-full flex-1" onClick={handleConfirmReceipt} disabled={confirmReceipt.isPending}>
                <CheckCircle2 className="w-5 h-5 mr-2" /> Confirm Receipt
              </Button>
            )}
            
            {request.repaymentExpected && request.status === 'fully_funded' && (
              <Button size="lg" variant="outline" className="rounded-full flex-1">
                Return Support
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contributions List */}
      {contributions && contributions.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Support Received</h3>
          <div className="space-y-3">
            {contributions.map((contribution) => (
              <Card key={contribution.id} className="rounded-2xl border-border/50 shadow-none">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                      <HandHeart className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium">{contribution.contributorName}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(contribution.createdAt), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${contribution.amount}</p>
                    <p className="text-xs text-muted-foreground capitalize">{contribution.contributionType}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
