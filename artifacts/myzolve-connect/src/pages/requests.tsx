import { useParams, Link } from "wouter";
import { useListSupportRequests, useCreateSupportRequest, getListSupportRequestsQueryKey } from "@workspace/api-client-react";
import { HandHeart, Plus, ArrowLeft, Zap } from "lucide-react";
import { CopilotSwitcher, CopilotAttribution } from "@/components/copilot-switcher";
import { useActingForInCircle } from "@/lib/copilot";
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
import { useToast } from "@/hooks/use-toast";
import { usePlaceholderMembers } from "@/hooks/use-api";

export default function RequestsPage() {
  const { id } = useParams<{ id: string }>();
  const circleId = parseInt(id!);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: requests, isLoading } = useListSupportRequests(circleId);
  const createRequest = useCreateSupportRequest();
  const { data: placeholders } = usePlaceholderMembers(circleId);
  const actingForUserId = useActingForInCircle(circleId);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    amountRequested: "",
    urgencyLevel: "normal",
    category: "other",
    repaymentExpected: false,
    repaymentStyle: "discuss_later",
    onBehalfOfPlaceholderId: "",
    dueDate: "",
  });

  const handleOpen = () => setOpen(true);

  const handleSubmit = () => {
    if (!form.title || !form.amountRequested) {
      toast({ title: "Please fill in the required fields.", variant: "destructive" });
      return;
    }
    createRequest.mutate(
      {
        circleId,
        data: {
          title: form.title,
          description: form.description || undefined,
          amountRequested: parseFloat(form.amountRequested),
          urgencyLevel: form.urgencyLevel as "low" | "normal" | "important" | "urgent" | "emergency",
          category: form.category,
          repaymentExpected: form.repaymentExpected,
          repaymentStyle: form.repaymentStyle as "flexible" | "one_time" | "installments" | "no_repayment" | "gift" | "discuss_later",
          requestType: "money",
          visibilityScope: "whole_circle",
          onBehalfOfPlaceholderId: form.onBehalfOfPlaceholderId ? parseInt(form.onBehalfOfPlaceholderId) : undefined,
          dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
          ...(actingForUserId ? { actingForUserId } : {}),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Support request shared with your circle." });
          queryClient.invalidateQueries({ queryKey: getListSupportRequestsQueryKey(circleId) });
          setOpen(false);
          setForm({ title: "", description: "", amountRequested: "", urgencyLevel: "normal", category: "other", repaymentExpected: false, repaymentStyle: "discuss_later", onBehalfOfPlaceholderId: "", dueDate: "" });
        },
        onError: () => {
          toast({ title: "Could not create request. Please try again.", variant: "destructive" });
        },
      },
    );
  };

  const getUrgencyColor = (level: string) => {
    switch (level) {
      case "emergency": return "bg-destructive/10 text-destructive border-destructive/20";
      case "urgent": return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      case "important": return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      default: return "bg-secondary/10 text-secondary border-secondary/20";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "fully_funded": return "bg-secondary/10 text-secondary";
      case "completed": return "bg-muted text-muted-foreground";
      default: return "bg-primary/10 text-primary";
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

        <Button className="rounded-full" onClick={handleOpen}>
          <Plus className="mr-2 w-4 h-4" /> New Request
        </Button>
      </div>

      {/* Emergency / Urgent banner */}
      {!isLoading && requests && requests.filter(r => r.urgencyLevel === "emergency" || r.urgencyLevel === "urgent").length > 0 && (
        <div className="rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-destructive text-sm mb-1">Urgent support needed</p>
              <p className="text-sm text-muted-foreground">
                {requests.filter(r => r.urgencyLevel === "emergency").length > 0
                  ? "There are emergency requests in your circle that need immediate attention."
                  : "Someone in your circle has marked a request as urgent."}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {requests
              .filter(r => r.urgencyLevel === "emergency" || r.urgencyLevel === "urgent")
              .slice(0, 3)
              .map(r => (
                <Link key={r.id} href={`/requests/${r.id}`}>
                  <Button size="sm" variant="destructive" className="rounded-full h-8 text-xs gap-1.5">
                    <HandHeart className="w-3.5 h-3.5" />
                    Help: {r.title.length > 28 ? r.title.slice(0, 28) + "…" : r.title}
                  </Button>
                </Link>
              ))}
          </div>
        </div>
      )}

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
            <Button className="rounded-full" onClick={handleOpen}>Make a Request</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {requests?.map((req) => {
            const percentFunded = req.amountRequested > 0 ? Math.min(100, Math.round(((req.amountFunded ?? 0) / req.amountRequested) * 100)) : 0;

            return (
              <Link key={req.id} href={`/requests/${req.id}`}>
                <Card className="rounded-3xl hover:shadow-md transition-all cursor-pointer h-full border-border/50 flex flex-col hover:-translate-y-1">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={`rounded-full px-2.5 font-medium ${getStatusColor(req.status)} border-transparent`}>
                          {req.status.replace("_", " ")}
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
                    {req.actingForName ? (
                      <CopilotAttribution
                        helperName={req.createdByName || "A helper"}
                        forName={req.actingForName}
                        review={req.copilotReview}
                        size="compact"
                      />
                    ) : null}
                  </CardHeader>

                  <CardContent className="pb-4 flex-1">
                    <p className="text-muted-foreground text-sm line-clamp-2 mb-4">
                      {req.description}
                    </p>

                    <div className="space-y-2 mt-auto">
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-primary">${req.amountFunded ?? 0} <span className="text-muted-foreground font-normal">supported</span></span>
                        <span className="text-foreground">Goal: ${req.amountRequested}</span>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Ask for support</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <CopilotSwitcher circleId={circleId} />
            {placeholders && placeholders.length > 0 && (
              <div className="space-y-1.5">
                <Label>Requesting on behalf of (optional)</Label>
                <Select
                  value={form.onBehalfOfPlaceholderId}
                  onValueChange={(v) => setForm({ ...form, onBehalfOfPlaceholderId: v === "self" ? "" : v })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Myself" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">Myself</SelectItem>
                    {placeholders.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.displayName}{p.relationship ? ` — ${p.relationship}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="title">What do you need help with? <span className="text-destructive">*</span></Label>
              <Input
                id="title"
                placeholder="Brief description of your need"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Tell your circle more (optional)</Label>
              <Textarea
                id="description"
                placeholder="Share as much or as little as you're comfortable with."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="rounded-xl min-h-[100px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="amount">Amount needed ($) <span className="text-destructive">*</span></Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={form.amountRequested}
                  onChange={(e) => setForm({ ...form, amountRequested: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>How urgent?</Label>
                <Select value={form.urgencyLevel} onValueChange={(v) => setForm({ ...form, urgencyLevel: v })}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="important">Important</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(form.urgencyLevel === "urgent" || form.urgencyLevel === "emergency") && (
              <div className="space-y-1.5">
                <Label htmlFor="due-date">
                  When do you need this by?{" "}
                  <span className="text-muted-foreground font-normal text-xs">
                    ({form.urgencyLevel === "emergency" ? "required for emergency" : "recommended for urgent"})
                  </span>
                </Label>
                <Input
                  id="due-date"
                  type="date"
                  value={form.dueDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Repayment expectation</Label>
              <Select value={form.repaymentStyle} onValueChange={(v) => setForm({ ...form, repaymentStyle: v, repaymentExpected: v !== "gift" && v !== "no_repayment" })}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gift">This is a gift (no return expected)</SelectItem>
                  <SelectItem value="discuss_later">We can discuss later</SelectItem>
                  <SelectItem value="flexible">Return when you can</SelectItem>
                  <SelectItem value="one_time">One-time return</SelectItem>
                  <SelectItem value="installments">In installments</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-full">Cancel</Button>
            <Button onClick={handleSubmit} disabled={createRequest.isPending} className="rounded-full">
              {createRequest.isPending ? "Sharing..." : "Share with circle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
