import { useState, useEffect } from "react";
import { Check, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlusBadge } from "@/components/plus-badge";
import {
  ASSIGNABLE_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  isPlusGatedRole,
  type AssignableRole,
} from "@/lib/circle-roles";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRole: string;
  memberName: string;
  ownerHasPlus: boolean;
  saving?: boolean;
  onConfirm: (role: AssignableRole) => void;
  onPlusGated: () => void;
};

export function RolePickerDialog({
  open,
  onOpenChange,
  currentRole,
  memberName,
  ownerHasPlus,
  saving,
  onConfirm,
  onPlusGated,
}: Props) {
  const [selected, setSelected] = useState<AssignableRole>(
    (currentRole === "owner" ? "admin" : (currentRole as AssignableRole)) || "member",
  );

  useEffect(() => {
    if (open) {
      setSelected(
        (currentRole === "owner" ? "admin" : (currentRole as AssignableRole)) || "member",
      );
    }
  }, [open, currentRole]);

  function handlePick(role: AssignableRole) {
    if (isPlusGatedRole(role) && !ownerHasPlus) {
      onPlusGated();
      return;
    }
    setSelected(role);
  }

  function handleSubmit() {
    if (isPlusGatedRole(selected) && !ownerHasPlus) {
      onPlusGated();
      return;
    }
    onConfirm(selected);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="role-picker-dialog">
        <DialogHeader>
          <DialogTitle>Change role for {memberName}</DialogTitle>
          <DialogDescription>
            Sub-roles let trusted members co-run the circle.
            {!ownerHasPlus && " Sub-roles unlock with Plus."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 mt-2 max-h-[60vh] overflow-y-auto">
          {ASSIGNABLE_ROLES.map((role) => {
            const gated = isPlusGatedRole(role) && !ownerHasPlus;
            const isSelected = selected === role;
            return (
              <button
                key={role}
                type="button"
                onClick={() => handlePick(role)}
                data-testid={`role-option-${role}`}
                className={`w-full text-left rounded-2xl border p-3 transition-colors flex items-start gap-3 ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border/50 hover:bg-muted/50"
                } ${gated ? "opacity-80" : ""}`}
              >
                <div
                  className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                    isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  }`}
                >
                  {isSelected ? <Check className="w-3 h-3" /> : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{ROLE_LABELS[role]}</p>
                    {isPlusGatedRole(role) ? (
                      gated ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                          <Lock className="w-2.5 h-2.5" /> Plus
                        </span>
                      ) : (
                        <PlusBadge size="sm" variant="soft" />
                      )
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{ROLE_DESCRIPTIONS[role]}</p>
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving} data-testid="role-picker-confirm">
            {saving ? "Saving…" : "Save role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
