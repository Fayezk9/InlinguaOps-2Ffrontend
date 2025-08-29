import { Link, NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bell } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <span className="inline-block h-5 w-5 rounded bg-gradient-to-br from-primary to-accent" />
            LinguaOps
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <NavItem to="/" label="Home" />
            <NavItem to="/history" label="History" />
            <NavItem to="/settings" label="Settings" />
          </nav>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Mitteilungen">
                  <Bell className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mitteilungen</TooltipContent>
            </Tooltip>
            <Button asChild size="sm" variant="outline">
              <a href="https://woocommerce.com/document/woocommerce-rest-api/" target="_blank" rel="noreferrer">API Docs</a>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t">
        <div className="max-w-6xl mx-auto px-4 py-6 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>© {new Date().getFullYear()} LinguaOps • Language school operations</div>
          <div className="flex gap-4">
            <a className="hover:text-foreground" href="/settings">Settings</a>
            <a className="hover:text-foreground" href="/history">History</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "text-sm text-muted-foreground hover:text-foreground transition-colors",
          isActive && "text-foreground font-medium",
        )
      }
      end
    >
      {label}
    </NavLink>
  );
}
