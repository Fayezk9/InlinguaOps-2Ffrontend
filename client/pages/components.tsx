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
          ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 p-4 dark:border-amber-500/60 dark:bg-amber-900/20 dark:text-amber-100 dark:hover:bg-amber-900/30"
          : "border-purple-200/60 bg-white hover:bg-purple-50 h-12 px-4 flex items-center text-foreground dark:bg-neutral-800 dark:hover:bg-neutral-700",
      )}
    >
      <div className="flex items-center justify-between w-full">
        <div className={cn("font-semibold", isAttention ? "text-amber-900 dark:text-amber-100" : "text-foreground")}>{label}</div>
        <span className={cn("h-2 w-2 rounded-full", isAttention ? "bg-amber-400" : "bg-purple-500")} />
      </div>
    </Link>
  );
}
