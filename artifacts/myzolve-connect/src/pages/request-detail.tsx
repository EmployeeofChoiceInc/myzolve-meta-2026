import { useParams, Link } from "wouter";
import {
  useGetSupportRequest,
  useCreateContribution,
  useConfirmReceipt,
  useCreateRepayment,
  getGetSupportRequestQueryKey
} from "@workspace/api-client-react";
import { ArrowLeft, HandHeart, CheckCircle2, Clock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  const [offerOpen, setOfferOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);

  const [offerForm, setOfferForm] = useState<{
    amount: string;
    contributionType: "loan" | "gift" | "installment" | "partial_support" | "pledge";
    note: string;
  }>({
    amount: "",
    contributionType: "loan",
    note: "",
  });

  const [returnForm, setReturnForm] = useState({
    amount: "",
    note: "",
  });

  if (isLoading) return <div className="p-8 animate-pulse flex flex-col gap-4"><div className="h-8 bg-muted w-1/3 rounded"></div><div className="h-64 bg-muted rounded-3xl"></div></div>;
  if (!requestData) return <div>Request not found</div>;

  const { contributions, repaymentPlan, ...request } = requestData;
  const percentFunded = request.amountRequested > 0 ? Math.min(100, Math.round(((request.amountFunded ?? 0) / request.amountRequested) * 100)) : 0;

  const isCreator = user?.fullName === request.createdByName;

  const handleConfirmReceipt = () => {
    confirmReceipt.mutate({ requestId }, {
      onSuccess: () => {
        toast({ title: "Receipt confirmed", description: "The support has been marked as received." });
        queryClient.invalidateQueries({ queryKey: getGetSupportRequestQueryKey(requestId) });
      }
    });
  };

  const handleOfferSupport = () => {
    if (!offerForm.amount) {
      toast({ title: "Please enter an amount.", variant: "destructive" });
      return;
    }
    createContribution.mutate(
      {
        requestId,
        data: {
          amount: parseFloat(offerForm.amount),
          contributionType: offerForm.contributionType,
          note: offerForm.note || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Support offered!", description: "Your generosity means a lot." });
          queryClient.invalidateQueries({ queryKey: getGetSupportRequestQueryKey(requestId) });
          setOfferOpen(false);
          setOfferForm({ amount: "", contributionType: "loan", note: "" });
        },
        onError: () => {
          toast({ title: "Could not offer support. Please try again.", variant: "destructive" });
        },
      }
    );
  };

  const handleReturnSupport = () => {
    if (!returnForm.amount) {
      toast({ title: "Please enter an amount.", variant: "destructive" });
      return;
    }
    createRepayment.mutate(
      {
        data: {
          requestId,
          amount: parseFloat(returnForm.amount),
          note: returnForm.note || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Return logged", description: "Thank you for completing the circle." });
          queryClient.invalidateQueries({ queryKey: getGetSupportRequestQueryKey(requestId) });
          setReturnOpen(false);
          setReturnForm({ amount: "", note: "" });
        },
        onError: () => {
          toast({ title: "Could not log return. Please try again.", variant: "destructive" });
        },
      }
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "fully_funded": return "bg-secondary/10 text-secondary";
      case "completed": return "bg-muted text-muted-foreground";
      default: return "bg-primary/10 text-primary";
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
                {request.status.replace("_", " ")}
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
                <div className="text-foreground font-medium capitalize">{request.repaymentStyle?.replace("_", " ")}</div>
              </div>
            </div>
            <Progress value={percentFunded} className="h-3 bg-primary/10" />

            {request.dueDate && (
              <div className="mt-4 text-sm text-muted-foreground flex items-center">
                <Clock className="w-4 h-4 mr-1.5" /> Needed by {format(new Date(request.dueDate), "MMMM d, yyyy")}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {!isCreator && request.status !== "completed" && request.status !== "fully_funded" && (
              <Button size="lg" className="rounded-full flex-1" onClick={() => setOfferOpen(true)}>
                <HandHeart className="w-5 h-5 mr-2" /> Offer Support
              </Button>
            )}

            {isCreator && (request.status === "partially_funded" || request.status === "fully_funded") && (
              <Button size="lg" variant="secondary" className="rounded-full flex-1" onClick={handleConfirmReceipt} disabled={confirmReceipt.isPending}>
                <CheckCircle2 className="w-5 h-5 mr-2" /> Confirm Receipt
              </Button>
            )}

            {isCreator && request.repaymentExpected && (request.status === "fully_funded" || request.status === "completed") && (
              <Button size="lg" variant="outline" className="rounded-full flex-1" onClick={() => setReturnOpen(true)}>
                <RotateCcw className="w-5 h-5 mr-2" /> Return Support
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
                      <p className="text-xs text-muted-foreground">{format(new Date(contribution.createdAt), "MMM d, yyyy")}</p>
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

      {/* Offer Support Dialog */}
      <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Offer support</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="offer-amount">Amount ($) <span className="text-destructive">*</span></Label>
              <Input
                id="offer-amount"
                type="number"
                placeholder="0.00"
                value={offerForm.amount}
                onChange={(e) => setOfferForm({ ...offerForm, amount: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type of support</Label>
              <Select value={offerForm.contributionType} onValueChange={(v) => setOfferForm({ ...offerForm, contributionType: v as typeof offerForm.contributionType })}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="loan">Loan (return expected)</SelectItem>
                  <SelectItem value="gift">Gift (no return needed)</SelectItem>
                  <SelectItem value="installment">Installment</SelectItem>
                  <SelectItem value="pledge">Pledge</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="offer-note">A kind word (optional)</Label>
              <Textarea
                id="offer-note"
                placeholder="Leave a warm message..."
                value={offerForm.note}
                onChange={(e) => setOfferForm({ ...offerForm, note: e.target.value })}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOfferOpen(false)} className="rounded-full">Cancel</Button>
            <Button onClick={handleOfferSupport} disabled={createContribution.isPending} className="rounded-full">
              {createContribution.isPending ? "Offering..." : "Offer support"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return Support Dialog */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Return support</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-muted-foreground text-sm">Every bit returned helps keep the circle strong. Return what you can, when you can.</p>
            <div className="space-y-1.5">
              <Label htmlFor="return-amount">Amount ($) <span className="text-destructive">*</span></Label>
              <Input
                id="return-amount"
                type="number"
                placeholder="0.00"
                value={returnForm.amount}
                onChange={(e) => setReturnForm({ ...returnForm, amount: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="return-note">A note (optional)</Label>
              <Textarea
                id="return-note"
                placeholder="Thank you..."
                value={returnForm.note}
                onChange={(e) => setReturnForm({ ...returnForm, note: e.target.value })}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReturnOpen(false)} className="rounded-full">Cancel</Button>
            <Button onClick={handleReturnSupport} disabled={createRepayment.isPending} className="rounded-full" variant="secondary">
              {createRepayment.isPending ? "Logging..." : "Log return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
