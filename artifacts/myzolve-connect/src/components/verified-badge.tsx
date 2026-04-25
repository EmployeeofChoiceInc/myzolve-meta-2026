import { CheckCircle2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type VerifiedBadgeProps = {
  size?: "sm" | "md";
  showLabel?: boolean;
  pending?: boolean;
  className?: string;
};

const VERIFIED_BLUE = "#1D9BF0";

export function VerifiedBadge({
  size = "sm",
  showLabel = false,
  pending = false,
  className,
}: VerifiedBadgeProps) {
  const isSm = size === "sm";
  const label = pending ? "Verification pending" : "Verified circle";

  if (!showLabel) {
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex items-center justify-center rounded-full text-white",
          isSm ? "w-5 h-5" : "w-6 h-6",
          pending ? "bg-muted-foreground/40" : "",
          className,
        )}
        style={pending ? undefined : { backgroundColor: VERIFIED_BLUE }}
        data-testid="verified-badge"
      >
        <Check className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />
      </span>
    );
  }

  return (
    <span
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold tracking-wide",
        isSm ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        pending ? "bg-muted text-muted-foreground" : "bg-[#E0F2FE] text-[#1D9BF0]",
        className,
      )}
      data-testid="verified-badge"
    >
      <CheckCircle2 className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />
      {pending ? "Pending" : "Verified"}
    </span>
  );
}
