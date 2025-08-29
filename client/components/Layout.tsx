import { Link, NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Bell } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-gradient-to-b from-black to-neutral-900 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-bold text-white">
            <span className="inline-block h-5 w-5 rounded bg-gradient-to-br from-purple-500 to-violet-600" />
            LinguaOps
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <NavItem to="/" label="Home" />
            <NavItem to="/history" label="History" />
            <NavItem to="/settings" label="Settings" />
          </nav>
          <div className="flex items-center gap-3">
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
            <Button asChild size="sm" className="bg-purple-600 hover:bg-purple-500 text-white border-2 border-white">
              <a href="https://woocommerce.com/document/woocommerce-rest-api/" target="_blank" rel="noreferrer">API Docs</a>
            </Button>
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
            ? "bg-white text-black border-white shadow-sm"
            : "text-white/80 border-white hover:text-white hover:bg-white/10",
        )
      }
      end
    >
      {label}
    </NavLink>
  );
}
