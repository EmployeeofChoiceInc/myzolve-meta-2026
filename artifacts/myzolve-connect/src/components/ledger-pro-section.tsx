import { useEffect, useState } from "react";
import { Download, FileText, Sparkles, Lock, Calendar } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

import { PlusBadge } from "@/components/plus-badge";
import { usePaywall } from "@/components/paywall-dialog";
import {
  useLedgerPro,
  useLedgerProYears,
  useExportLedger,
  useMyPlusStatus,
} from "@/hooks/use-api";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(0)}`;
  }
}

export function LedgerProSection({ circleId }: { circleId: number }) {
  const { toast } = useToast();
  const paywall = usePaywall();
  const { data: status } = useMyPlusStatus();
  const isPlus = !!status?.isPlus;

  const yearsQ = useLedgerProYears(circleId, isPlus);
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    if (yearsQ.data && year == null) {
      setYear(yearsQ.data.defaultYear ?? new Date().getUTCFullYear());
    }
  }, [yearsQ.data, year]);

  const dataQ = useLedgerPro(circleId, year, isPlus);
  const exportM = useExportLedger(circleId);
  const [exportingYear, setExportingYear] = useState<number | null>(null);

  if (!isPlus) {
    return (
      <Card className="rounded-3xl border-[#F5E6CC] bg-[#FFF8EC] shadow-none" data-testid="ledger-pro-upsell">
        <CardHeader>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-[#B47A2A]" />
            <CardTitle>Care Ledger Pro</CardTitle>
            <PlusBadge size="sm" variant="soft" />
          </div>
          <CardDescription>
            Yearly recap, per-member breakdowns, and downloadable PDF / CSV exports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-foreground/80 space-y-2 mb-4">
            <li className="flex items-start gap-2"><Calendar className="w-4 h-4 mt-0.5 text-[#B47A2A] shrink-0" /> Pick any year and see a month-by-month view.</li>
            <li className="flex items-start gap-2"><FileText className="w-4 h-4 mt-0.5 text-[#B47A2A] shrink-0" /> One-click PDF and CSV export for record-keeping.</li>
            <li className="flex items-start gap-2"><Sparkles className="w-4 h-4 mt-0.5 text-[#B47A2A] shrink-0" /> See who you've supported the most this year — and who showed up for you.</li>
          </ul>
          <Button onClick={() => paywall.open("ledger_pro")} className="bg-[#B47A2A] hover:bg-[#8E5F1E] rounded-full" data-testid="ledger-pro-upsell-cta">
            Learn about Plus
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (yearsQ.isLoading || (yearsQ.data && !year)) {
    return <Skeleton className="h-48 rounded-3xl" />;
  }

  if (yearsQ.error || !yearsQ.data) {
    if (paywall.handleApiError(yearsQ.error)) {
      return null;
    }
    return (
      <Card className="rounded-3xl border-border/50 shadow-none">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Couldn't load Ledger Pro just now.
        </CardContent>
      </Card>
    );
  }

  const years = yearsQ.data.years;
  const data = dataQ.data;

  function handleExport() {
    if (year == null) return;
    setExportingYear(year);
    exportM.mutate(year, {
      onSuccess: (res) => {
        setExportingYear(null);
        // Open both files in new tabs (browser may block second; user can re-click).
        window.open(res.pdfUrl, "_blank", "noopener");
        toast({
          title: "Export ready",
          description: "PDF and CSV are downloading.",
        });
        // Trigger CSV download via anchor.
        const a = document.createElement("a");
        a.href = res.csvUrl;
        a.download = `ledger-${year}.csv`;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      },
      onError: (err) => {
        setExportingYear(null);
        if (paywall.handleApiError(err)) return;
        toast({ title: "Export failed", variant: "destructive" });
      },
    });
  }

  const exporting = exportingYear !== null;

  return (
    <Card className="rounded-3xl border-border/50 shadow-none" data-testid="ledger-pro-section">
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#B47A2A]" />
            <CardTitle>Care Ledger Pro</CardTitle>
            <PlusBadge size="sm" variant="soft" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-full" onClick={handleExport} disabled={exporting} data-testid="ledger-pro-export">
              <Download className="w-4 h-4 mr-2" /> {exporting ? "Generating…" : "Download PDF + CSV"}
            </Button>
          </div>
        </div>
        <CardDescription className="mt-1">
          {data?.softMessage ?? "Pick a year to see the recap."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Year picker */}
        {years.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {years.map((y) => {
              const selected = y === year;
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => setYear(y)}
                  data-testid={`ledger-pro-year-${y}`}
                  className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selected
                      ? "bg-[#B47A2A] text-white"
                      : "bg-muted text-foreground hover:bg-muted/70"
                  }`}
                >
                  {y}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No ledger entries yet.</p>
        )}

        {dataQ.isLoading ? (
          <Skeleton className="h-32 rounded-2xl" />
        ) : data ? (
          <>
            {/* Totals */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="You gave" amount={data.totalGiven} currency={data.currency} accent="primary" />
              <Stat label="You received" amount={data.totalReceived} currency={data.currency} accent="secondary" />
              <Stat label="Repaid" amount={data.totalRepaid} currency={data.currency} />
              <Stat label="Forgiven" amount={data.totalForgiven} currency={data.currency} />
            </div>

            {/* Monthly bars */}
            {data.months.length > 0 && (
              <div>
                <p className="text-xs uppercase font-medium text-muted-foreground tracking-wide mb-2">By month</p>
                <MonthlyBars months={data.months} currency={data.currency} />
              </div>
            )}

            {/* Top supported / supporters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PeopleList title="Who you supported most" people={data.topSupported} currency={data.currency} accent="primary" />
              <PeopleList title="Who supported you" people={data.topSupporters} currency={data.currency} accent="secondary" />
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  amount,
  currency,
  accent,
}: {
  label: string;
  amount: number;
  currency: string;
  accent?: "primary" | "secondary";
}) {
  const colorClass =
    accent === "primary" ? "text-primary" : accent === "secondary" ? "text-secondary" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${colorClass}`}>{formatMoney(amount, currency)}</p>
    </div>
  );
}

function MonthlyBars({ months, currency }: { months: { month: number; given: number; received: number }[]; currency: string }) {
  const maxAmt = Math.max(
    1,
    ...months.flatMap((m) => [m.given, m.received]),
  );
  return (
    <div className="grid grid-cols-12 gap-2 items-end h-32">
      {Array.from({ length: 12 }, (_, i) => {
        const m = months.find((x) => x.month === i + 1);
        const givenH = m ? Math.max(2, (m.given / maxAmt) * 96) : 2;
        const recvH = m ? Math.max(2, (m.received / maxAmt) * 96) : 2;
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="flex items-end gap-0.5 h-24">
              <div className="w-2 bg-primary/80 rounded-sm" style={{ height: givenH }} title={m ? `Gave ${formatMoney(m.given, currency)}` : undefined} />
              <div className="w-2 bg-secondary/80 rounded-sm" style={{ height: recvH }} title={m ? `Received ${formatMoney(m.received, currency)}` : undefined} />
            </div>
            <span className="text-[10px] text-muted-foreground">{MONTH_LABELS[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

function PeopleList({
  title,
  people,
  currency,
  accent,
}: {
  title: string;
  people: { name: string; amount: number; count: number }[];
  currency: string;
  accent: "primary" | "secondary";
}) {
  if (!people || people.length === 0) {
    return (
      <div className="rounded-2xl border border-border/50 p-4">
        <p className="text-xs uppercase font-medium text-muted-foreground tracking-wide mb-2">{title}</p>
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      </div>
    );
  }
  const colorClass = accent === "primary" ? "text-primary" : "text-secondary";
  return (
    <div className="rounded-2xl border border-border/50 p-4">
      <p className="text-xs uppercase font-medium text-muted-foreground tracking-wide mb-2">{title}</p>
      <ul className="space-y-2">
        {people.slice(0, 5).map((p, i) => (
          <li key={`${p.name}-${i}`} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold ${colorClass}`}>
                {p.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm truncate">{p.name}</span>
            </div>
            <div className="text-right shrink-0">
              <p className={`text-sm font-semibold ${colorClass}`}>{formatMoney(p.amount, currency)}</p>
              <p className="text-[10px] text-muted-foreground">{p.count} {p.count === 1 ? "entry" : "entries"}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
