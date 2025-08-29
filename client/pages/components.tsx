import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function FeatureLink({ to, label, variant }: { to: string; label: string; variant?: "attention" | "default" }) {
  const isAttention = variant === "attention";
  return (
    <Link
      to={to}
      className={cn(
        "group rounded-xl border shadow-sm transition-all self-center w-auto",
        isAttention
          ? "border-amber-500/60 bg-amber-900/20 text-amber-100 hover:bg-amber-900/30 p-4"
          : "border-purple-200/60 bg-neutral-800 hover:bg-neutral-700 h-12 px-4 flex items-center",
      )}
    >
      <div className="flex items-center justify-between w-full">
        <div className={cn("font-medium", isAttention ? "text-amber-100" : "text-foreground")}>{label}</div>
        <span className={cn("h-2 w-2 rounded-full", isAttention ? "bg-amber-400" : "bg-purple-500")} />
      </div>
    </Link>
  );
}
