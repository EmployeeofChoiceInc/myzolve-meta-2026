import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

type PlusBadgeProps = {
  size?: "sm" | "md";
  variant?: "solid" | "soft";
  className?: string;
};

export function PlusBadge({
  size = "sm",
  variant = "solid",
  className,
}: PlusBadgeProps) {
  const isSm = size === "sm";
  const isSolid = variant === "solid";
  return (
    <span
      aria-label="MyZolve Connect Plus member"
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold tracking-wide",
        isSm ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        isSolid
          ? "bg-[#B47A2A] text-white"
          : "bg-[#F5E6CC] text-[#B47A2A]",
        className,
      )}
      data-testid="plus-badge"
    >
      <Star className={isSm ? "w-2.5 h-2.5 fill-current" : "w-3 h-3 fill-current"} />
      Plus
    </span>
  );
}
