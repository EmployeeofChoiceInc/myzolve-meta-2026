import { useState } from "react";
import { ShieldAlert, Inbox, Mail, MapPin, Users, Calendar } from "lucide-react";
import { ApiError } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import {
  useCircleBuilderApplications,
  useReviewCircleBuilderApplication,
  type CircleBuilderApplication,
} from "@/hooks/use-api";

const STATUS_STYLES: Record<
  CircleBuilderApplication["status"],
  string
> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  declined: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

const FILTERS: Array<{ label: string; value: "all" | CircleBuilderApplication["status"] }> = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Declined", value: "declined" },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ApplicationCard({ app }: { app: CircleBuilderApplication }) {
  const review = useReviewCircleBuilderApplication();
  const { toast } = useToast();

  async function setStatus(status: CircleBuilderApplication["status"]) {
    try {
      await review.mutateAsync({ id: app.id, status });
      toast({ title: `Marked ${status}` });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  return (
    <div
      className="bg-card border border-card-border rounded-3xl p-6 space-y-4"
      data-testid={`card-application-${app.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{app.name}</h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Mail className="w-3.5 h-3.5" />
              <a href={`mailto:${app.email}`} className="hover:text-foreground">
                {app.email}
              </a>
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {app.location}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {app.networkSize}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(app.createdAt)}
            </span>
          </div>
        </div>
        <Badge className={STATUS_STYLES[app.status]} data-testid={`badge-status-${app.id}`}>
          {app.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <Field label="Community served" value={app.communityServed} />
        <Field
          label="Willing to host within 60 days"
          value={app.willingToHost ? "Yes" : "No"}
        />
        <Field label="Why they want to build a circle" value={app.motivation} />
        <Field label="Desired impact" value={app.desiredImpact} />
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-card-border">
        <Button
          size="sm"
          onClick={() => setStatus("approved")}
          disabled={review.isPending || app.status === "approved"}
          data-testid={`button-approve-${app.id}`}
        >
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setStatus("declined")}
          disabled={review.isPending || app.status === "declined"}
          data-testid={`button-decline-${app.id}`}
        >
          Decline
        </Button>
        {app.status !== "pending" && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setStatus("pending")}
            disabled={review.isPending}
            data-testid={`button-reset-${app.id}`}
          >
            Reset to pending
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
        {label}
      </p>
      <p className="text-foreground whitespace-pre-wrap">{value}</p>
    </div>
  );
}

export default function AdminCircleBuildersPage() {
  const { data, isLoading, error } = useCircleBuilderApplications();
  const [filter, setFilter] = useState<"all" | CircleBuilderApplication["status"]>(
    "all",
  );

  const isForbidden = error instanceof ApiError && error.status === 403;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner />
      </div>
    );
  }

  if (isForbidden) {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-6">
        <div className="w-16 h-16 bg-muted text-muted-foreground rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold mb-3">Not authorized</h1>
        <p className="text-muted-foreground">
          This page is only available to the MyZolve admin team.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-6">
        <h1 className="text-2xl font-bold mb-3">Couldn't load applications</h1>
        <p className="text-muted-foreground">
          {error instanceof Error ? error.message : "Please try again later."}
        </p>
      </div>
    );
  }

  const applications = data ?? [];
  const filtered =
    filter === "all"
      ? applications
      : applications.filter((a) => a.status === filter);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Circle Builder applications</h1>
        <p className="text-muted-foreground mt-1">
          Review submissions to the 100 Circle Initiative.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map((f) => {
          const count =
            f.value === "all"
              ? applications.length
              : applications.filter((a) => a.status === f.value).length;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              data-testid={`filter-${f.value}`}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                filter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card border border-card-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">
          <Inbox className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No applications{filter !== "all" ? ` marked ${filter}` : " yet"}.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((app) => (
            <ApplicationCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}
