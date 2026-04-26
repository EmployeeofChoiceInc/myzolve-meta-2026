import { useState, useMemo } from "react";
import { Link, useParams } from "wouter";
import { format, isSameDay, parseISO } from "date-fns";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Plus,
  Cake,
  Heart,
  Stethoscope,
  Bell,
  Sparkles,
  Trash2,
  Pencil,
} from "lucide-react";
import {
  useListCareDates,
  useCreateCareDate,
  useUpdateCareDate,
  useDeleteCareDate,
  useListCircleMembers,
  getListCareDatesQueryKey,
  getListCircleMembersQueryKey,
  getListUpcomingCareDatesQueryKey,
  CareDateKind,
  type CareDate,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useGetCircle, getGetCircleQueryKey } from "@workspace/api-client-react";

const KIND_META: Record<
  CareDate["kind"],
  { label: string; tone: string; icon: typeof CalendarIcon }
> = {
  birthday: {
    label: "Birthday",
    tone: "bg-primary/10 text-primary",
    icon: Cake,
  },
  anniversary: {
    label: "Anniversary",
    tone: "bg-secondary/10 text-secondary",
    icon: Heart,
  },
  memorial: {
    label: "Memorial",
    tone: "bg-muted text-muted-foreground",
    icon: Sparkles,
  },
  appointment: {
    label: "Appointment",
    tone: "bg-orange-500/10 text-orange-600",
    icon: Stethoscope,
  },
  other: {
    label: "Other",
    tone: "bg-muted text-foreground",
    icon: Bell,
  },
};

interface FormState {
  name: string;
  eventDate: string;
  kind: CareDate["kind"];
  isAnnual: boolean;
  note: string;
  targetUserId: string; // "" means "no specific person"
}

const EMPTY_FORM: FormState = {
  name: "",
  eventDate: format(new Date(), "yyyy-MM-dd"),
  kind: "birthday",
  isAnnual: true,
  note: "",
  targetUserId: "",
};

export default function CircleCalendarPage() {
  const { id } = useParams<{ id: string }>();
  const circleId = parseInt(id!);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: circle } = useGetCircle(circleId, {
    query: { enabled: !!circleId, queryKey: getGetCircleQueryKey(circleId) },
  });

  const { data: careDates = [], isLoading } = useListCareDates(circleId, {
    query: {
      enabled: !!circleId,
      queryKey: getListCareDatesQueryKey(circleId),
    },
  });

  const { data: members = [] } = useListCircleMembers(circleId, {
    query: {
      enabled: !!circleId,
      queryKey: getListCircleMembersQueryKey(circleId),
    },
  });

  const createCareDate = useCreateCareDate();
  const updateCareDate = useUpdateCareDate();
  const deleteCareDate = useDeleteCareDate();

  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CareDate | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<CareDate | null>(null);

  const datesByKey = useMemo(() => {
    const map = new Map<string, CareDate[]>();
    for (const d of careDates) {
      const key = d.nextOccurrence;
      const arr = map.get(key) ?? [];
      arr.push(d);
      map.set(key, arr);
    }
    return map;
  }, [careDates]);

  const markedDays = useMemo(
    () => Array.from(datesByKey.keys()).map((s) => parseISO(s)),
    [datesByKey],
  );

  const selectedKey = format(selectedDay, "yyyy-MM-dd");
  const selectedDayDates = datesByKey.get(selectedKey) ?? [];

  const upcoming = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return [...careDates]
      .filter((d) => d.nextOccurrence >= today)
      .sort((a, b) => a.nextOccurrence.localeCompare(b.nextOccurrence))
      .slice(0, 6);
  }, [careDates]);

  function openCreate(forDay?: Date) {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      eventDate: format(forDay ?? selectedDay, "yyyy-MM-dd"),
    });
    setDialogOpen(true);
  }

  function openEdit(c: CareDate) {
    setEditing(c);
    setForm({
      name: c.name,
      eventDate: c.eventDate,
      kind: c.kind,
      isAnnual: c.isAnnual,
      note: c.note ?? "",
      targetUserId: c.targetUserId != null ? String(c.targetUserId) : "",
    });
    setDialogOpen(true);
  }

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: getListCareDatesQueryKey(circleId) });
    queryClient.invalidateQueries({
      queryKey: getListUpcomingCareDatesQueryKey({ withinDays: 7 }),
    });
    queryClient.invalidateQueries({
      queryKey: getListUpcomingCareDatesQueryKey(),
    });
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast({ title: "Please add a name", variant: "destructive" });
      return;
    }
    const targetUserIdNum = form.targetUserId ? Number(form.targetUserId) : undefined;
    const payload = {
      name: form.name.trim(),
      eventDate: form.eventDate,
      kind: form.kind,
      isAnnual: form.isAnnual,
      note: form.note.trim() ? form.note.trim() : undefined,
      ...(targetUserIdNum ? { targetUserId: targetUserIdNum } : {}),
    };

    if (editing) {
      updateCareDate.mutate(
        { circleId, careDateId: editing.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Done." });
            setDialogOpen(false);
            invalidateAll();
          },
          onError: () => toast({ title: "Could not save", variant: "destructive" }),
        },
      );
    } else {
      createCareDate.mutate(
        { circleId, data: payload },
        {
          onSuccess: () => {
            toast({ title: "Done." });
            setDialogOpen(false);
            invalidateAll();
          },
          onError: () => toast({ title: "Could not save", variant: "destructive" }),
        },
      );
    }
  }

  function handleDelete() {
    if (!confirmDelete) return;
    deleteCareDate.mutate(
      { circleId, careDateId: confirmDelete.id },
      {
        onSuccess: () => {
          toast({ title: "Removed." });
          setConfirmDelete(null);
          invalidateAll();
        },
        onError: () => toast({ title: "Could not remove", variant: "destructive" }),
      },
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-2">
        <Link
          href={`/circles/${circleId}`}
          className="text-muted-foreground hover:text-foreground inline-flex items-center text-sm font-medium transition-colors"
          data-testid="link-back-to-circle"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Circle
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Care Calendar
          </h1>
          <p className="text-muted-foreground mt-1">
            {circle?.name
              ? `Birthdays, appointments, and gentle reminders for ${circle.name}.`
              : "Birthdays, appointments, and gentle reminders for your circle."}
          </p>
        </div>
        <Button
          className="rounded-full"
          onClick={() => openCreate()}
          data-testid="button-add-care-date"
        >
          <Plus className="w-4 h-4 mr-2" /> New care date
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
        <Card className="rounded-3xl border-border/50 shadow-none">
          <CardContent className="p-4 flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDay}
              onSelect={(d) => d && setSelectedDay(d)}
              modifiers={{ hasEvent: markedDays }}
              modifiersClassNames={{
                hasEvent:
                  "after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:h-1.5 after:w-1.5 after:rounded-full after:bg-primary",
              }}
              className="rounded-2xl"
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">
              {isSameDay(selectedDay, new Date())
                ? "Today"
                : format(selectedDay, "EEEE, MMMM d")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {selectedDayDates.length === 0
                ? "Nothing on this day yet."
                : `${selectedDayDates.length} ${selectedDayDates.length === 1 ? "item" : "items"}`}
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <div className="h-20 rounded-2xl bg-muted/50 animate-pulse" />
              <div className="h-20 rounded-2xl bg-muted/50 animate-pulse" />
            </div>
          ) : selectedDayDates.length === 0 ? (
            <Card className="rounded-2xl border-dashed border-border/50 shadow-none">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Nothing on the calendar for this day yet.
                <div className="mt-3">
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => openCreate(selectedDay)}
                    data-testid="button-add-for-day"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add for this day
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {selectedDayDates.map((d) => (
                <CareDateRow
                  key={d.id}
                  careDate={d}
                  onEdit={() => openEdit(d)}
                  onDelete={() => setConfirmDelete(d)}
                />
              ))}
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="pt-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Upcoming
              </h3>
              <div className="space-y-3">
                {upcoming.map((d) => (
                  <CareDateRow
                    key={`upcoming-${d.id}`}
                    careDate={d}
                    onEdit={() => openEdit(d)}
                    onDelete={() => setConfirmDelete(d)}
                    showDate
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit care date" : "New care date"}</DialogTitle>
            <DialogDescription>
              A gentle reminder shared with everyone in this circle.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="cd-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cd-name"
                placeholder="Mum's birthday"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-xl"
                data-testid="input-care-date-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cd-date">Date</Label>
                <Input
                  id="cd-date"
                  type="date"
                  value={form.eventDate}
                  onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                  className="rounded-xl"
                  data-testid="input-care-date-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Kind</Label>
                <Select
                  value={form.kind}
                  onValueChange={(v) => setForm({ ...form, kind: v as CareDate["kind"] })}
                >
                  <SelectTrigger className="rounded-xl" data-testid="select-care-date-kind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(CareDateKind).map((k) => (
                      <SelectItem key={k} value={k}>
                        {KIND_META[k].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Repeats every year</p>
                <p className="text-xs text-muted-foreground">
                  Great for birthdays and anniversaries.
                </p>
              </div>
              <Switch
                checked={form.isAnnual}
                onCheckedChange={(v) => setForm({ ...form, isAnnual: v })}
                data-testid="switch-care-date-annual"
              />
            </div>
            <div className="space-y-1.5">
              <Label>For someone in this circle (optional)</Label>
              <Select
                value={form.targetUserId === "" ? "__none__" : form.targetUserId}
                onValueChange={(v) =>
                  setForm({ ...form, targetUserId: v === "__none__" ? "" : v })
                }
              >
                <SelectTrigger
                  className="rounded-xl"
                  data-testid="select-care-date-recipient"
                >
                  <SelectValue placeholder="No specific person" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No specific person</SelectItem>
                  {members
                    .filter((m) => m.userId != null)
                    .map((m) => (
                      <SelectItem key={m.id} value={String(m.userId)}>
                        {m.displayName || m.email || `Member #${m.userId}`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Helpful for birthdays or appointments tied to one person.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cd-note">Note (optional)</Label>
              <Textarea
                id="cd-note"
                placeholder="Loves carrot cake."
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="rounded-xl min-h-[80px]"
                data-testid="input-care-date-note"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-full"
              onClick={handleSubmit}
              disabled={createCareDate.isPending || updateCareDate.isPending}
              data-testid="button-save-care-date"
            >
              {editing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Remove this date?</DialogTitle>
            <DialogDescription>
              This won't delete anything else — just the calendar entry.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setConfirmDelete(null)}
            >
              Keep
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              onClick={handleDelete}
              disabled={deleteCareDate.isPending}
              data-testid="button-confirm-delete-care-date"
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CareDateRow({
  careDate,
  onEdit,
  onDelete,
  showDate,
}: {
  careDate: CareDate;
  onEdit: () => void;
  onDelete: () => void;
  showDate?: boolean;
}) {
  const meta = KIND_META[careDate.kind];
  const Icon = meta.icon;
  return (
    <Card className="rounded-2xl border-border/50 shadow-none">
      <CardContent className="p-4 flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl ${meta.tone} flex items-center justify-center shrink-0`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate" data-testid="care-date-name">
            {careDate.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {showDate
              ? format(parseISO(careDate.nextOccurrence), "EEE, MMM d")
              : meta.label}
            {careDate.isAnnual ? " · yearly" : ""}
          </p>
          {careDate.note ? (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {careDate.note}
            </p>
          ) : null}
        </div>
        <Badge variant="outline" className={`rounded-full text-xs ${meta.tone} border-transparent`}>
          {meta.label}
        </Badge>
        <Button size="icon" variant="ghost" className="rounded-full" onClick={onEdit}>
          <Pencil className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
