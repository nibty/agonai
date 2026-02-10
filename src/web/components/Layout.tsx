import { useState } from "react";
import { Outlet, NavLink, Link } from "react-router-dom";
import {
  Home,
  Trophy,
  ListOrdered,
  MessageSquare,
  User,
  Bot,
  Settings,
  Menu,
  X,
  BookOpen,
  Zap,
} from "lucide-react";

// GitHub icon (brand icons deprecated in lucide-react)
function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}
import { Button } from "@/components/ui/Button";
import { WalletButton } from "@/components/WalletButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

function NavItem({ to, icon, label, onClick }: NavItemProps) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-arena-accent/20 text-arena-accent"
            : "text-arena-text-muted hover:bg-arena-border/50 hover:text-arena-text"
        )
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

interface SidebarLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

function SidebarLink({ to, icon, label, onClick }: SidebarLinkProps) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors",
          isActive
            ? "bg-arena-accent/20 text-arena-accent"
            : "text-arena-text-muted hover:bg-arena-border/50 hover:text-arena-text"
        )
      }
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isAuthenticated } = useAuth();

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-arena-bg text-arena-text">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-arena-border bg-arena-bg/95 backdrop-blur supports-[backdrop-filter]:bg-arena-bg/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          {/* Left: Logo and Mobile Menu */}
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-arena-accent">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">AI Debates</span>
            </Link>
          </div>

          {/* Center: Navigation (Desktop) */}
          <nav className="hidden items-center gap-1 lg:flex">
            <NavItem to="/" icon={<Home className="h-4 w-4" />} label="Home" />
            <NavItem to="/queue" icon={<ListOrdered className="h-4 w-4" />} label="Queue" />
            <NavItem to="/leaderboard" icon={<Trophy className="h-4 w-4" />} label="Leaderboard" />
            <NavItem to="/topics" icon={<MessageSquare className="h-4 w-4" />} label="Topics" />
          </nav>

          {/* Right: Theme Toggle & Wallet Button */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 transform border-r border-arena-border bg-arena-card transition-transform duration-300 ease-in-out lg:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Sidebar Header */}
          <div className="flex h-16 items-center justify-between border-b border-arena-border px-4">
            <Link to="/" onClick={closeSidebar} className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-arena-accent">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">AI Debates</span>
            </Link>
            <Button variant="ghost" size="sm" onClick={closeSidebar} aria-label="Close menu">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-1 p-4">
            <div className="mb-4">
              <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-arena-text-dim">
                Navigation
              </h3>
              <SidebarLink
                to="/"
                icon={<Home className="h-5 w-5" />}
                label="Home"
                onClick={closeSidebar}
              />
              <SidebarLink
                to="/queue"
                icon={<ListOrdered className="h-5 w-5" />}
                label="Queue"
                onClick={closeSidebar}
              />
              <SidebarLink
                to="/leaderboard"
                icon={<Trophy className="h-5 w-5" />}
                label="Leaderboard"
                onClick={closeSidebar}
              />
              <SidebarLink
                to="/topics"
                icon={<MessageSquare className="h-5 w-5" />}
                label="Topics"
                onClick={closeSidebar}
              />
            </div>

            {isAuthenticated && (
              <div className="mb-4">
                <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-arena-text-dim">
                  Account
                </h3>
                <SidebarLink
                  to="/profile"
                  icon={<User className="h-5 w-5" />}
                  label="Profile"
                  onClick={closeSidebar}
                />
                <SidebarLink
                  to="/bots"
                  icon={<Bot className="h-5 w-5" />}
                  label="My Bots"
                  onClick={closeSidebar}
                />
                <SidebarLink
                  to="/settings"
                  icon={<Settings className="h-5 w-5" />}
                  label="Settings"
                  onClick={closeSidebar}
                />
              </div>
            )}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-arena-border bg-arena-card/50">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            {/* Left: Powered by */}
            <div className="flex items-center gap-2 text-sm text-arena-text-muted">
              <Zap className="h-4 w-4 text-arena-accent" />
              <span>Powered by X1</span>
            </div>

            {/* Center: Links */}
            <nav className="flex items-center gap-6">
              <a
                href="https://docs.x1.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-arena-text-muted transition-colors hover:text-arena-text"
              >
                <BookOpen className="h-4 w-4" />
                <span>Docs</span>
              </a>
              <a
                href="https://github.com/ai-debates"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-arena-text-muted transition-colors hover:text-arena-text"
              >
                <GitHubIcon className="h-4 w-4" />
                <span>GitHub</span>
              </a>
            </nav>

            {/* Right: Copyright */}
            <div className="text-sm text-arena-text-dim">{new Date().getFullYear()} AI Debates Arena</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
