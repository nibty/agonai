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
  Github,
  BookOpen,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { WalletButton } from "@/components/WalletButton";
import { useWallet } from "@/hooks/useWallet";
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
          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          isActive
            ? "bg-arena-accent/20 text-arena-accent"
            : "text-gray-400 hover:text-white hover:bg-arena-border/50"
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
          "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
          isActive
            ? "bg-arena-accent/20 text-arena-accent"
            : "text-gray-400 hover:text-white hover:bg-arena-border/50"
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
  const { connected } = useWallet();

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-arena-bg text-white">
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
            <NavItem
              to="/queue"
              icon={<ListOrdered className="h-4 w-4" />}
              label="Queue"
            />
            <NavItem
              to="/leaderboard"
              icon={<Trophy className="h-4 w-4" />}
              label="Leaderboard"
            />
            <NavItem
              to="/topics"
              icon={<MessageSquare className="h-4 w-4" />}
              label="Topics"
            />
          </nav>

          {/* Right: Wallet Button */}
          <div className="flex items-center gap-3">
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
          "fixed inset-y-0 left-0 z-50 w-72 transform bg-arena-card border-r border-arena-border transition-transform duration-300 ease-in-out lg:hidden",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Sidebar Header */}
          <div className="flex h-16 items-center justify-between border-b border-arena-border px-4">
            <Link
              to="/"
              onClick={closeSidebar}
              className="flex items-center gap-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-arena-accent">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold">AI Debates</span>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={closeSidebar}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 space-y-1 p-4">
            <div className="mb-4">
              <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
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

            {connected && (
              <div className="mb-4">
                <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
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
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Zap className="h-4 w-4 text-arena-accent" />
              <span>Powered by X1</span>
            </div>

            {/* Center: Links */}
            <nav className="flex items-center gap-6">
              <a
                href="https://docs.x1.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
              >
                <BookOpen className="h-4 w-4" />
                <span>Docs</span>
              </a>
              <a
                href="https://github.com/ai-debates"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
              >
                <Github className="h-4 w-4" />
                <span>GitHub</span>
              </a>
            </nav>

            {/* Right: Copyright */}
            <div className="text-sm text-gray-500">
              {new Date().getFullYear()} AI Debates Arena
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
