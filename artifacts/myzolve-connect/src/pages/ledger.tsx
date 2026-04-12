import { useParams, Link } from "wouter";
import { 
  useGetCircleLedgerSummary, 
  useGetCircleLedger 
} from "@workspace/api-client-react";
import { ArrowLeft, BookOpen, ArrowDownRight, ArrowUpRight, ArrowLeftRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function LedgerPage() {
  const { id } = useParams<{ id: string }>();
  const circleId = parseInt(id!);

  const { data: summary, isLoading: summaryLoading } = useGetCircleLedgerSummary(circleId, {
    query: { enabled: !!circleId }
  });

  const { data: ledgerEntries, isLoading: entriesLoading } = useGetCircleLedger(circleId, {
    query: { enabled: !!circleId }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getEntryIcon = (kind: string) => {
    switch(kind) {
      case 'support_given': return <ArrowUpRight className="w-5 h-5 text-secondary" />;
      case 'support_received': return <ArrowDownRight className="w-5 h-5 text-primary" />;
      case 'returned': return <ArrowLeftRight className="w-5 h-5 text-muted-foreground" />;
      default: return <BookOpen className="w-5 h-5 text-foreground" />;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-2">
        <Link href={`/circles/${circleId}`} className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Circle
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Soft Ledger</h1>
        <p className="text-muted-foreground mt-1">A gentle record of support given and returned.</p>
      </div>

      {summaryLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-muted/50 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-2xl shadow-none border-border/50 bg-card">
            <CardContent className="p-6">
              <div className="text-sm font-medium text-muted-foreground mb-2">Support Given</div>
              <div className="text-2xl font-bold text-secondary">{formatCurrency(summary?.totalGiven || 0)}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-none border-border/50 bg-card">
            <CardContent className="p-6">
              <div className="text-sm font-medium text-muted-foreground mb-2">Support Received</div>
              <div className="text-2xl font-bold text-primary">{formatCurrency(summary?.totalReceived || 0)}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-none border-border/50 bg-card">
            <CardContent className="p-6">
              <div className="text-sm font-medium text-muted-foreground mb-2">Returned</div>
              <div className="text-2xl font-bold text-muted-foreground">{formatCurrency(summary?.totalReturned || 0)}</div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl shadow-none border-border/50 bg-card bg-primary/5">
            <CardContent className="p-6">
              <div className="text-sm font-medium text-primary mb-2">My Outstanding</div>
              <div className="text-2xl font-bold text-foreground">{formatCurrency(summary?.myOutstanding || 0)}</div>
              {summary?.myOutstanding > 0 && (
                <p className="text-xs text-muted-foreground mt-2">{summary.softMessage || "Take your time returning this support."}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="rounded-3xl border-border/50 shadow-none overflow-hidden">
        <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>The flow of support in your circle</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {entriesLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading ledger...</div>
          ) : ledgerEntries?.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
              <BookOpen className="w-10 h-10 mb-4 opacity-20" />
              <p>No ledger entries yet.</p>
              <p className="text-sm mt-1">Support transactions will appear here gently.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {ledgerEntries?.map((entry) => (
                <div key={entry.id} className="p-4 sm:p-6 flex items-center justify-between hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-background border flex items-center justify-center shrink-0">
                      {getEntryIcon(entry.entryKind)}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {entry.entryKind === 'returned' ? (
                          <span><span className="font-semibold">{entry.giverName}</span> returned support to <span className="font-semibold">{entry.receiverName}</span></span>
                        ) : (
                          <span><span className="font-semibold">{entry.giverName}</span> supported <span className="font-semibold">{entry.receiverName}</span></span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {entry.description || entry.entryKind.replace('_', ' ')} • {format(new Date(entry.createdAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right pl-4">
                    <Badge variant="outline" className={`rounded-full px-2.5 py-1 text-sm font-bold border-transparent ${
                      entry.entryKind === 'support_received' ? 'bg-primary/10 text-primary' : 
                      entry.entryKind === 'returned' ? 'bg-muted text-muted-foreground' : 
                      'bg-secondary/10 text-secondary'
                    }`}>
                      {formatCurrency(entry.amount)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
