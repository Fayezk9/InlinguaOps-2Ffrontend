import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bell, ArrowLeft } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/lib/i18n";
import { getHistory, onHistoryChanged } from "@/lib/history";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { t, lang, setLang } = useI18n();
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

  const [hasNewHistory, setHasNewHistory] = useState(false);
  const [hasNotifications, setHasNotifications] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const LAST_SEEN_KEY = "appHistory:lastSeenAt";
    const computeHasNew = () => {
      const items = getHistory();
      const latest = items.length ? items[0].at : 0;
      const lastSeen = Number(localStorage.getItem(LAST_SEEN_KEY) || 0);
      return latest > lastSeen;
    };
    setHasNewHistory(computeHasNew());
    const unsub = onHistoryChanged(() => setHasNewHistory(computeHasNew()));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Check for notifications from localStorage or other sources
    const checkNotifications = () => {
      const notifications = JSON.parse(localStorage.getItem("notifications") || "[]");
      const unreadNotifications = notifications.filter((n: any) => !n.read);
      setHasNotifications(unreadNotifications.length > 0);
    };

    checkNotifications();
    // Set up interval to check for new notifications every 30 seconds
    const interval = setInterval(checkNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (location.pathname === "/history") {
      const LAST_SEEN_KEY = "appHistory:lastSeenAt";
      const latest = getHistory()[0]?.at || Date.now();
      localStorage.setItem(LAST_SEEN_KEY, String(latest));
      setHasNewHistory(false);
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bold-all">
      <header className="sticky top-0 z-40 border-b bg-gradient-to-b from-white to-neutral-100 text-foreground shadow-lg dark:border-white/10 dark:from-black dark:to-neutral-900 dark:text-white">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between relative">
          <Link to="/" className="flex items-center gap-2 font-bold text-foreground dark:text-white">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-purple-500 to-violet-600 shadow-sm">
              <span className="text-xs font-bold text-white">L</span>
            </div>
            LinguaOps
          </Link>
          <nav className="flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
            {showBack && (
              <button
                onClick={onBack}
                className="text-sm rounded-md px-3 py-1 border-2 transition-colors font-bold text-foreground border-border hover:text-foreground hover:bg-foreground/10 inline-flex items-center gap-2 dark:text-white dark:border-white dark:hover:text-white dark:hover:bg-white/10 bg-white/90 dark:bg-neutral-800/90 backdrop-blur"
                aria-label={t('back','Back')}
              >
                <ArrowLeft className="h-4 w-4" />
                {t('back','Back')}
              </button>
            )}
            <NavItem to="/" label={t('home','Home')} />
            <NavItem to="/history" label={t('history','History')} showDot={hasNewHistory && location.pathname !== "/history"} />
            <NavItem to="/settings" label={t('settings','Settings')} />
          </nav>
          <div className="ml-auto flex items-center gap-6">
            <div className="hidden md:flex items-center gap-1">
              <Button size="sm" variant={lang==='de'? 'default':'outline'} onClick={()=>setLang('de')}>DE</Button>
              <Button size="sm" variant={lang==='en'? 'default':'outline'} onClick={()=>setLang('en')}>EN</Button>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('notifications','Notifications')}
                    className="text-orange-500 hover:text-orange-400 border-2 border-border rounded-md dark:border-white hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all duration-200"
                  >
                    <Bell className="h-5 w-5 fill-current" />
                  </Button>
                  <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="h-1.5 w-1.5 bg-white rounded-full"></span>
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>{t('notifications','Notifications')}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>
      <main className="flex-1 bg-neutral-50 dark:bg-black">
        <PageFade key={location.pathname}>{children}</PageFade>
      </main>
      <footer className="border-t" />
      {!showBack && (
        <div className="fixed bottom-4 right-4 z-50 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label={t('light','Light')}
            onClick={() => applyTheme("light")}
            className={cn(
              "backdrop-blur",
              theme === "light" ? "ring-2 ring-ring" : ""
            )}
          >
            {t('light','Light')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label={t('dark','Dark')}
            onClick={() => applyTheme("dark")}
            className={cn(
              "backdrop-blur",
              theme === "dark" ? "ring-2 ring-ring" : ""
            )}
          >
            {t('dark','Dark')}
          </Button>
        </div>
      )}
    </div>
  );
}

function PageFade({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className={cn("transition-opacity duration-300 ease-out", ready ? "opacity-100" : "opacity-0")}>{children}</div>
  );
}

function NavItem({ to, label, showDot }: { to: string; label: string; showDot?: boolean }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "relative text-sm rounded-md px-3 py-1 border-2 transition-colors font-bold",
          isActive
            ? "bg-white text-black border-neutral-200 shadow-sm dark:bg-neutral-800 dark:text-white dark:border-white"
            : "text-foreground border-neutral-200 hover:bg-neutral-100 dark:text-white/80 dark:border-white dark:hover:text-white dark:hover:bg-white/10",
        )
      }
      end
    >
      {label}
      {showDot ? (
        <span
          className="pointer-events-none absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-gradient-to-br from-purple-500 to-violet-600 ring-2 ring-white dark:ring-neutral-900"
          aria-hidden="true"
        />
      ) : null}
    </NavLink>
  );
}
