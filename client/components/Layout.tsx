import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Bell,
  ArrowLeft,
  Home as HomeIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";
import { getHistory, onHistoryChanged } from "@/lib/history";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const showBack = location.pathname !== "/";
  const onBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1)
      navigate(-1);
    else navigate("/");
  };

  const [theme, setTheme] = useState<"light" | "dark">("dark");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved =
      (localStorage.getItem("theme") as "light" | "dark" | null) || "dark";
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
    const ensureSetupNotification = async () => {
      try {
        const res = await fetch("/api/setup/status");
        if (!res.ok) return;
        const j = await res.json();
        if (j?.needsSetup) {
          const raw = localStorage.getItem("notifications") || "[]";
          const list = JSON.parse(raw);
          const exists =
            Array.isArray(list) && list.some((n: any) => n.id === "setup-db");
          if (!exists) {
            const next = [
              {
                id: "setup-db",
                text: "Set up your local database",
                read: false,
                action: "open-database-setup",
              },
              ...(Array.isArray(list) ? list : []),
            ];
            localStorage.setItem("notifications", JSON.stringify(next));
          }
        }
      } catch {}
    };

    const checkNotifications = () => {
      const notifications = JSON.parse(
        localStorage.getItem("notifications") || "[]",
      );
      const unreadNotifications = notifications.filter((n: any) => !n.read);
      setHasNotifications(unreadNotifications.length > 0);
    };

    ensureSetupNotification().then(checkNotifications);
    const interval = setInterval(() => {
      ensureSetupNotification()
        .then(checkNotifications)
        .catch(() => {});
    }, 30000);
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
      <header className="sticky top-0 z-40 border-b bg-background text-foreground dark:border-white/10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between relative">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border-2 border-neutral-200 bg-black px-2 py-1 transition-opacity hover:opacity-90 dark:border-white"
            aria-label="LinguaOps"
          >
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2Fd5ceaaf188a440b69293546711d11d26%2F545eafbd77e0489ebec025f362dd517c?format=webp&width=2400"
              alt="LinguaOps logo"
              className="h-9 w-auto"
            />
          </Link>
          <nav className="flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
            {showBack && (
              <button
                onClick={onBack}
                className="text-sm rounded-md px-3 py-1 border-2 transition-colors font-bold text-foreground border-border hover:text-foreground hover:bg-foreground/10 inline-flex items-center gap-2 dark:text-white dark:border-white dark:hover:text-white dark:hover:bg-white/10 bg-white/90 dark:bg-neutral-800/90 backdrop-blur"
                aria-label={t("back", "Back")}
              >
                <ArrowLeft className="h-4 w-4" />
                {t("back", "Back")}
              </button>
            )}
            <NavItem
              to="/"
              label={t("home", "Home")}
              icon={<HomeIcon className="h-5 w-5" />}
            />
            <NavItem
              to="/history"
              label={t("history", "History")}
              icon={<HistoryIcon className="h-5 w-5" />}
              showDot={hasNewHistory && location.pathname !== "/history"}
            />
            <NavItem
              to="/settings"
              label={t("settings", "Settings")}
              icon={<SettingsIcon className="h-5 w-5" />}
            />
          </nav>
          <div className="ml-auto flex items-center gap-6">
            <div className="hidden md:flex items-center gap-1">
              <Button
                size="sm"
                variant={lang === "de" ? "default" : "outline"}
                onClick={() => setLang("de")}
              >
                DE
              </Button>
              <Button
                size="sm"
                variant={lang === "en" ? "default" : "outline"}
                onClick={() => setLang("en")}
              >
                EN
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("notifications", "Notifications")}
                      className="text-orange-500 border-2 border-border rounded-md dark:border-white"
                    >
                      <Bell className="h-5 w-5 fill-current" />
                    </Button>
                    {hasNotifications && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="h-1.5 w-1.5 bg-white rounded-full"></span>
                      </span>
                    )}
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[220px]">
                  <NotificationItems
                    onNavigateToDatabase={() =>
                      navigate("/settings", {
                        state: { openSection: "database" },
                      })
                    }
                    onAfterAction={() => setHasNotifications(false)}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
              {hasNotifications && (
                <span className="text-xs font-semibold text-red-600">New</span>
              )}
            </div>
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
            aria-label={t("light", "Light")}
            onClick={() => applyTheme("light")}
            className={cn(
              "backdrop-blur",
              theme === "light" ? "ring-2 ring-ring" : "",
            )}
          >
            {t("light", "Light")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label={t("dark", "Dark")}
            onClick={() => applyTheme("dark")}
            className={cn(
              "backdrop-blur",
              theme === "dark" ? "ring-2 ring-ring" : "",
            )}
          >
            {t("dark", "Dark")}
          </Button>
        </div>
      )}
    </div>
  );
}

function NotificationItems({
  onNavigateToDatabase,
  onAfterAction,
}: {
  onNavigateToDatabase: () => void;
  onAfterAction: () => void;
}) {
  const [items, setItems] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("notifications") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const id = setInterval(() => {
      try {
        setItems(JSON.parse(localStorage.getItem("notifications") || "[]"));
      } catch {}
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const markRead = (id: string) => {
    const updated = items.map((n) => (n.id === id ? { ...n, read: true } : n));
    setItems(updated);
    localStorage.setItem("notifications", JSON.stringify(updated));
    onAfterAction();
  };

  const handle = (n: any) => {
    if (n.action === "open-database-setup") {
      markRead(n.id);
      onNavigateToDatabase();
    }
  };

  if (!items.length)
    return (
      <div className="px-2 py-1.5 text-sm text-muted-foreground">
        No notifications
      </div>
    );

  return (
    <>
      {items.map((n) => (
        <DropdownMenuItem
          key={n.id}
          onClick={() => handle(n)}
          className={cn("cursor-pointer", !n.read ? "font-semibold" : "")}
        >
          {n.text}
        </DropdownMenuItem>
      ))}
    </>
  );
}

function PageFade({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function NavItem({
  to,
  label,
  showDot,
  icon,
}: {
  to: string;
  label: string;
  showDot?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "relative text-sm rounded-md px-4 py-2 border-2 transition-colors font-bold inline-flex items-center justify-center gap-2",
          isActive
            ? "bg-white text-black border-neutral-200 shadow-sm dark:bg-neutral-800 dark:text-white dark:border-white"
            : "text-foreground border-neutral-200 hover:bg-neutral-100 dark:text-white/80 dark:border-white dark:hover:text-white dark:hover:bg-white/10",
        )
      }
      end
      aria-label={label}
    >
      {icon ?? <span>{label}</span>}
      <span className="sr-only">{label}</span>
      {showDot ? (
        <span
          className="pointer-events-none absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-neutral-900"
          aria-hidden="true"
        />
      ) : null}
    </NavLink>
  );
}
