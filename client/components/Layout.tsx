import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
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

  const [theme, setTheme] = useState<"light" | "dark">("dark");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = (localStorage.getItem("theme") as "light" | "dark" | null) || "dark";
    const root = document.documentElement;
    root.classList.toggle("dark", saved === "dark");
    setTheme(saved);
  }, []);
  const applyTheme = (t: "light" | "dark") => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    root.classList.toggle("dark", t === "dark");
    localStorage.setItem("theme", t);
    setTheme(t);
  };

  return (
    <div className="min-h-screen flex flex-col bold-all">
      <header className="sticky top-0 z-40 border-b bg-gradient-to-b from-white to-neutral-100 text-foreground shadow-lg dark:border-white/10 dark:from-black dark:to-neutral-900 dark:text-white">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between relative">
          <Link to="/" className="flex items-center gap-2 font-bold text-foreground dark:text-white">
            <span className="inline-block h-5 w-5 rounded bg-gradient-to-br from-purple-500 to-violet-600" />
            LinguaOps
          </Link>
          {showBack && (
            <button
              onClick={onBack}
              className="md:hidden ml-3 text-sm rounded-md px-3 py-1 border-2 transition-colors font-bold text-foreground/80 border-border hover:text-foreground hover:bg-foreground/10 inline-flex items-center gap-2 dark:text-white/80 dark:border-white dark:hover:text-white dark:hover:bg-white/10"
              aria-label={t('back','Back')}
            >
              <ArrowLeft className="h-4 w-4" />
              {t('back','Back')}
            </button>
          )}
          <nav className="hidden md:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
            {showBack && (
              <button
                onClick={onBack}
                className="text-sm rounded-md px-3 py-1 border-2 transition-colors font-bold text-foreground/80 border-border hover:text-foreground hover:bg-foreground/10 inline-flex items-center gap-2 dark:text-white/80 dark:border-white dark:hover:text-white dark:hover:bg-white/10"
                aria-label={t('back','Back')}
              >
                <ArrowLeft className="h-4 w-4" />
                {t('back','Back')}
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
                  className="text-orange-500 hover:text-orange-400 border-2 border-border rounded-md dark:border-white"
                >
                  <Bell className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mitteilungen</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>
      <main className="flex-1 bg-neutral-50 dark:bg-black">{children}</main>
      <footer className="border-t" />
      {!showBack && (
        <div className="fixed bottom-4 right-4 z-50 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label="Switch to light theme"
            onClick={() => applyTheme("light")}
            className={cn(
              "backdrop-blur",
              theme === "light" ? "ring-2 ring-ring" : ""
            )}
          >
            Light
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="Switch to dark theme"
            onClick={() => applyTheme("dark")}
            className={cn(
              "backdrop-blur",
              theme === "dark" ? "ring-2 ring-ring" : ""
            )}
          >
            Dark
          </Button>
        </div>
      )}
    </div>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "text-sm rounded-md px-3 py-1 border-2 transition-colors font-bold",
          isActive
            ? "bg-white text-black border-neutral-200 shadow-sm dark:bg-neutral-800 dark:text-white dark:border-white"
            : "text-foreground border-neutral-200 hover:bg-neutral-100 dark:text-white/80 dark:border-white dark:hover:text-white dark:hover:bg-white/10",
        )
      }
      end
    >
      {label}
    </NavLink>
  );
}
