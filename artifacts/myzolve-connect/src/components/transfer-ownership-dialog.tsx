import { useState, useEffect } from "react";
import { Check, Crown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type TransferMember = {
  id: number;
  userId: number | null;
  displayName: string;
  email: string | null;
};

type DemoteRole = "admin" | "member";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: TransferMember[];
  saving?: boolean;
  onConfirm: (newOwnerUserId: number, demoteToRole: DemoteRole) => void;
};

const DEMOTE_OPTIONS: { value: DemoteRole; label: string; description: string }[] = [
  {
    value: "admin",
    label: "Admin",
    description: "Keep full management access — manage members, roles, and settings.",
  },
  {
    value: "member",
    label: "Member",
    description: "Step back to a standard member with no management access.",
  },
];

export function TransferOwnershipDialog({
  open,
  onOpenChange,
  members,
  saving,
  onConfirm,
}: Props) {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [demoteToRole, setDemoteToRole] = useState<DemoteRole>("admin");

  useEffect(() => {
    if (open) {
      setSelectedUserId(null);
      setDemoteToRole("admin");
    }
  }, [open]);

  const selectedMember =
    selectedUserId != null
      ? members.find((m) => m.userId === selectedUserId) ?? null
      : null;

  function handleSubmit() {
    if (selectedUserId != null) {
      onConfirm(selectedUserId, demoteToRole);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl" data-testid="transfer-ownership-dialog">
        <DialogHeader>
          <DialogTitle>Transfer ownership</DialogTitle>
          <DialogDescription>
            Hand this circle over to another member. They'll get full control, and
            you'll step down to the role you choose. This can't be undone by you
            afterwards.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          <div className="space-y-2">
            <p className="text-sm font-semibold">New owner</p>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                There's no one to transfer to yet. Invite another member first, then
                come back here.
              </p>
            ) : (
              <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                {members.map((m) => {
                  const isSelected = m.userId === selectedUserId;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      data-testid={`transfer-member-${m.id}`}
                      onClick={() => m.userId != null && setSelectedUserId(m.userId)}
                      className={`w-full text-left rounded-2xl border p-3 transition-colors flex items-center gap-3 ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:bg-muted/50"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border"
                        }`}
                      >
                        {isSelected ? <Check className="w-3 h-3" /> : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{m.displayName}</p>
                        {m.email ? (
                          <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Your role after transfer</p>
            <div className="space-y-2">
              {DEMOTE_OPTIONS.map((opt) => {
                const isSelected = demoteToRole === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    data-testid={`transfer-demote-${opt.value}`}
                    onClick={() => setDemoteToRole(opt.value)}
                    className={`w-full text-left rounded-2xl border p-3 transition-colors flex items-start gap-3 ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border/50 hover:bg-muted/50"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border"
                      }`}
                    >
                      {isSelected ? <Check className="w-3 h-3" /> : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" className="rounded-full" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            className="rounded-full gap-1.5"
            onClick={handleSubmit}
            disabled={selectedUserId == null || saving}
            data-testid="transfer-ownership-confirm"
          >
            <Crown className="w-3.5 h-3.5" />
            {saving
              ? "Transferring…"
              : selectedMember
                ? `Transfer to ${selectedMember.displayName}`
                : "Transfer ownership"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
