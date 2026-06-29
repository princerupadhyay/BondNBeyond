import { type ReactNode, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  FileText,
  Timer,
  BarChart3,
  Heart,
  Trophy,
  Settings,
  Sun,
  Moon,
  Monitor,
  LogOut,
  Menu,
  X,
  // Bell,
} from "lucide-react";
import { useAuth } from "../lib/auth";
import { useSettings } from "../lib/settings";
import { Logo } from "./Logo";
import { AnimatedBackground } from "./AnimatedBackground";
import { cn, initials } from "../lib/utils";

const NAV = [
  { to: "/app", label: "Home", icon: Home, end: true },
  { to: "/app/contract", label: "Weekly Contract", icon: FileText },
  { to: "/app/timer", label: "Focus Timer", icon: Timer },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/app/partner", label: "Partner", icon: Heart },
  { to: "/app/achievements", label: "Achievements", icon: Trophy },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

const MOBILE_NAV = [
  { to: "/app", label: "Home", icon: Home, end: true },
  { to: "/app/contract", label: "Contract", icon: FileText },
  { to: "/app/timer", label: "Timer", icon: Timer },
  { to: "/app/analytics", label: "Stats", icon: BarChart3 },
  { to: "/app/partner", label: "Partner", icon: Heart },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);

  const cycleTheme = () => {
    const order = ["dark", "light", "system"] as const;
    const idx = order.indexOf(theme);
    setTheme(order[(idx + 1) % order.length]);
  };

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="relative min-h-screen">
      <AnimatedBackground />

      {/* Desktop Sidebar */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-64 flex-col border-r border-black/5 p-4 dark:border-white/5 lg:flex">
        <div className="px-2 py-3">
          <Logo size="md" to="/app" />
        </div>

        <nav className="mt-6 flex-1 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-gradient-warm-soft text-primary-500"
                    : "text-muted hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5",
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-2 border-t border-black/5 pt-4 dark:border-white/5">
          <div className="flex items-center gap-3 rounded-xl px-3 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-warm text-sm font-bold text-white">
              {initials(profile?.name || profile?.email || "U")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {profile?.name || "User"}
              </p>
              <p className="truncate text-xs text-muted">{profile?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-danger-500/10 hover:text-danger-500"
          >
            <LogOut className="h-5 w-5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between border-b border-black/5 px-4 py-3 backdrop-blur-xl lg:hidden"
        style={{ background: "color-mix(in srgb, var(--bg) 80%, transparent)" }}
      >
        <Logo size="sm" to="/app" />
        <div className="flex items-center gap-2">
          <button onClick={cycleTheme} className="btn-ghost p-2">
            <ThemeIcon className="h-5 w-5" />
          </button>
          <button onClick={() => setMobileOpen(true)} className="btn-ghost p-2">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 z-50 h-screen w-72 overflow-y-auto border-l border-black/5 p-4 dark:border-white/5 lg:hidden"
              style={{ background: "var(--card)" }}
            >
              <div className="flex items-center justify-between">
                <Logo size="sm" />
                <button
                  onClick={() => setMobileOpen(false)}
                  className="btn-ghost p-2"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <nav className="mt-6 space-y-1">
                {NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                        isActive
                          ? "bg-gradient-warm-soft text-primary-500"
                          : "text-muted hover:bg-black/5 dark:hover:bg-white/5",
                      )
                    }
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </NavLink>
                ))}
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-danger-500/10 hover:text-danger-500"
                >
                  <LogOut className="h-5 w-5" /> Sign Out
                </button>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Desktop Topbar */}
        <header
          className="sticky top-0 z-20 hidden items-center justify-between border-b border-black/5 px-8 py-4 backdrop-blur-xl lg:flex"
          style={{
            background: "color-mix(in srgb, var(--bg) 80%, transparent)",
          }}
        >
          <div>
            <h1 className="font-display text-lg font-bold">
              {NAV.find((n) =>
                n.end
                  ? location.pathname === n.to
                  : location.pathname.startsWith(n.to),
              )?.label ?? "Dashboard"}
            </h1>
            <p className="text-xs text-muted">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* <button className="btn-ghost relative p-2.5">
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent-500" />
            </button> */}
            <button onClick={cycleTheme} className="btn-ghost p-2.5">
              <ThemeIcon className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="px-4 py-6 pb-24 lg:px-8 lg:py-8 lg:pb-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-black/5 px-2 py-2 backdrop-blur-xl lg:hidden"
        style={{
          background: "color-mix(in srgb, var(--card) 90%, transparent)",
        }}
      >
        {MOBILE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-[10px] font-medium transition-colors",
                isActive ? "text-primary-500" : "text-muted",
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
