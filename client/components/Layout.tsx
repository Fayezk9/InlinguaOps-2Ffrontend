import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bell, ArrowLeft } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const showBack = location.pathname !== "/";
  const onBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-gradient-to-b from-black to-neutral-900 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between relative">
          <Link to="/" className="flex items-center gap-2 font-bold text-white">
            <span className="inline-block h-5 w-5 rounded bg-gradient-to-br from-purple-500 to-violet-600" />
            LinguaOps
          </Link>
          {showBack && (
            <button
              onClick={onBack}
              className="md:hidden ml-3 text-sm rounded-md px-3 py-1 border-2 transition-colors text-white/80 border-white hover:text-white hover:bg-white/10 inline-flex items-center gap-2"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}
          <nav className="hidden md:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
            {showBack && (
              <button
                onClick={onBack}
                className="text-sm rounded-md px-3 py-1 border-2 transition-colors text-white/80 border-white hover:text-white hover:bg-white/10 inline-flex items-center gap-2"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            )}
            <NavItem to="/" label="Home" />
            <NavItem to="/history" label="History" />
            <NavItem to="/settings" label="Settings" />
          </nav>
          <div className="ml-auto flex items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Mitteilungen"
                  className="text-orange-400 hover:text-orange-300 border-2 border-white rounded-md"
                >
                  <Bell className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mitteilungen</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>
      <main className="flex-1 bg-neutral-950">{children}</main>
      <footer className="border-t" />
    </div>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "text-sm rounded-md px-3 py-1 border-2 transition-colors",
          isActive
            ? "bg-neutral-800 text-white border-white shadow-sm"
            : "text-white/80 border-white hover:text-white hover:bg-white/10",
        )
      }
      end
    >
      {label}
    </NavLink>
  );
}
