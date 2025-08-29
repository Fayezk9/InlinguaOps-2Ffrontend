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
          ? "border-orange-300/60 bg-orange-50 text-orange-900 hover:bg-orange-100 p-4"
          : "border-purple-200/60 bg-white/80 hover:bg-purple-50 h-12 px-4 flex items-center",
      )}
    >
      <div className="flex items-center justify-between w-full">
        <div className={cn("font-medium", isAttention ? "text-orange-900" : "text-foreground")}>{label}</div>
        <span className={cn("h-2 w-2 rounded-full", isAttention ? "bg-orange-500" : "bg-purple-500")} />
      </div>
    </Link>
  );
}
