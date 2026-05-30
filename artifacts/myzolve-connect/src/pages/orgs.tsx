import { useState } from "react";
import { Link } from "wouter";
import {
  useListMyOrgs,
  useListOrgPlans,
  useCreateOrg,
  type Org,
  type OrgPlan,
  type CreateOrgBodyPlan,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Building2, Plus, Users, ArrowRight, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatPrice(plan: OrgPlan): string {
  const amount = (plan.unitAmount / 100).toLocaleString("en-US", {
    style: "currency",
    currency: (plan.currency || "usd").toUpperCase(),
    minimumFractionDigits: 0,
  });
  if (plan.perSeat) return `${amount}/seat / year`;
  if (plan.billingType === "one_time") return `${amount} one-time`;
  return `${amount} / year`;
}

function OrgCard({ org }: { org: Org }) {
  const accent = org.accentColor || undefined;
  return (
    <Link href={`/orgs/${org.id}`}>
      <Card className="rounded-2xl hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardContent className="p-5 flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden border shrink-0"
            style={accent ? { borderColor: accent } : undefined}
          >
            {org.logoUrl ? (
              <img src={org.logoUrl} alt={org.name} className="w-full h-full object-cover" />
            ) : (
              <Building2 className="w-6 h-6" style={accent ? { color: accent } : undefined} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold truncate">{org.name}</p>
              <Badge
                variant={org.isActive ? "secondary" : "outline"}
                className="rounded-full text-[10px] capitalize"
              >
                {org.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Users className="w-3 h-3" />
              {org.seatsUsed ?? 0}
              {org.seatLimit > 0 ? ` / ${org.seatLimit}` : ""} seats · {org.planName}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}

export default function OrgsPage() {
  const { toast } = useToast();
  const { data: orgsData, isLoading } = useListMyOrgs();
  const { data: plansData } = useListOrgPlans();
  const createOrg = useCreateOrg();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [plan, setPlan] = useState<CreateOrgBodyPlan | null>(null);

  const orgs = orgsData?.orgs ?? [];
  const plans = plansData?.plans ?? [];

  function handleCreate() {
    if (!name.trim() || !plan) return;
    createOrg.mutate(
      { data: { name: name.trim(), plan } },
      {
        onSuccess: () => {
          toast({
            title: "Organization created",
            description: "Next, complete checkout to activate your seats.",
          });
          setOpen(false);
          setName("");
          setPlan(null);
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Could not create the organization. Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  }

  return (
    <div className="max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Organizations</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Bring your community together and give every member MyZolve Plus.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full">
              <Plus className="w-4 h-4 mr-1" /> New
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Create an organization</DialogTitle>
              <DialogDescription>
                Choose a plan that fits your community. You'll complete payment after creating it.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="org-name">Organization name</Label>
                <Input
                  id="org-name"
                  placeholder="e.g. Smith Family Reunion"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Plan</Label>
                <div className="grid gap-2">
                  {plans.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlan(p.id)}
                      className={`text-left rounded-xl border p-3 transition-colors ${
                        plan === p.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{p.name}</span>
                        {plan === p.id && <Check className="w-4 h-4 text-primary" />}
                      </div>
                      {p.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                      )}
                      <p className="text-xs font-medium mt-1">{formatPrice(p)}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                className="rounded-full w-full"
                onClick={handleCreate}
                disabled={!name.trim() || !plan || createOrg.isPending}
              >
                {createOrg.isPending ? "Creating..." : "Create Organization"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : orgs.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardHeader className="text-center py-12">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <CardTitle>No organizations yet</CardTitle>
            <CardDescription className="max-w-sm mx-auto">
              Create an organization to invite members, apply your branding, and give everyone
              MyZolve Plus.
            </CardDescription>
            <div className="pt-4">
              <Button className="rounded-full" onClick={() => setOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> Create your first organization
              </Button>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {orgs.map((org) => (
            <OrgCard key={org.id} org={org} />
          ))}
        </div>
      )}
    </div>
  );
}
