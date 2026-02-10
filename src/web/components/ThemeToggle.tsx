import { useEffect, useState } from "react";
import { Moon, Sun, Monitor, Palette, Check } from "lucide-react";
import { Dropdown, DropdownItem, DropdownDivider } from "flowbite-react";
import { cn } from "@/lib/utils";

type Mode = "light" | "dark" | "system";
type Theme = "arena" | "default" | "enterprise" | "minimal" | "mono" | "playful" | "cyber" | "sunset" | "ocean" | "lavender" | "forest";

interface ThemeOption {
  id: Theme;
  name: string;
  description: string;
}

const themes: ThemeOption[] = [
  { id: "arena", name: "Arena", description: "Original purple theme" },
  { id: "default", name: "Default", description: "Clean blue theme" },
  { id: "enterprise", name: "Enterprise", description: "Professional cyan" },
  { id: "minimal", name: "Minimal", description: "Warm stone tones" },
  { id: "mono", name: "Mono", description: "Sharp monochrome" },
  { id: "playful", name: "Playful", description: "Fun pink accent" },
  { id: "cyber", name: "Cyber", description: "Neon indigo futuristic" },
  { id: "sunset", name: "Sunset", description: "Warm coral & amber" },
  { id: "ocean", name: "Ocean", description: "Tranquil sea blues" },
  { id: "lavender", name: "Lavender", description: "Soft digital lavender" },
  { id: "forest", name: "Forest", description: "Nature-inspired greens" },
];

function getSystemMode(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredMode(): Mode {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem("mode") as Mode) || "dark";
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "arena";
  return (localStorage.getItem("theme") as Theme) || "arena";
}

function applyTheme(mode: Mode, theme: Theme) {
  const root = document.documentElement;
  const effectiveMode = mode === "system" ? getSystemMode() : mode;

  // Remove all theme and mode classes
  root.classList.remove("light", "dark");
  themes.forEach((t) => root.classList.remove(`theme-${t.id}`));

  // Apply new classes
  root.classList.add(effectiveMode);
  root.classList.add(`theme-${theme}`);
}

export function ThemeToggle() {
  const [mode, setMode] = useState<Mode>(getStoredMode);
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    applyTheme(mode, theme);
    localStorage.setItem("mode", mode);
    localStorage.setItem("theme", theme);
  }, [mode, theme]);

  // Listen for system theme changes when in "system" mode
  useEffect(() => {
    if (mode !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme("system", theme);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [mode, theme]);

  const currentModeIcon =
    mode === "light" ? (
      <Sun className="h-4 w-4" />
    ) : mode === "dark" ? (
      <Moon className="h-4 w-4" />
    ) : (
      <Monitor className="h-4 w-4" />
    );

  return (
    <Dropdown
      label=""
      dismissOnClick={true}
      renderTrigger={() => (
        <button
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-lg px-2",
            "text-arena-text-muted hover:bg-arena-border/50 hover:text-arena-text",
            "transition-colors focus:outline-none focus:ring-2 focus:ring-arena-accent"
          )}
          aria-label="Toggle theme"
        >
          {currentModeIcon}
          <Palette className="h-3.5 w-3.5" />
        </button>
      )}
    >
      {/* Mode Selection */}
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-arena-text-muted">
        Mode
      </div>
      <DropdownItem
        onClick={() => setMode("light")}
        className="flex items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2">
          <Sun className="h-4 w-4" />
          Light
        </span>
        {mode === "light" && <Check className="h-4 w-4 text-arena-accent" />}
      </DropdownItem>
      <DropdownItem
        onClick={() => setMode("dark")}
        className="flex items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2">
          <Moon className="h-4 w-4" />
          Dark
        </span>
        {mode === "dark" && <Check className="h-4 w-4 text-arena-accent" />}
      </DropdownItem>
      <DropdownItem
        onClick={() => setMode("system")}
        className="flex items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2">
          <Monitor className="h-4 w-4" />
          System
        </span>
        {mode === "system" && <Check className="h-4 w-4 text-arena-accent" />}
      </DropdownItem>

      <DropdownDivider />

      {/* Theme Selection */}
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-arena-text-muted">
        Theme
      </div>
      {themes.map((t) => (
        <DropdownItem
          key={t.id}
          onClick={() => setTheme(t.id)}
          className="flex items-center justify-between gap-2"
        >
          <span className="flex flex-col">
            <span className="font-medium">{t.name}</span>
            <span className="text-xs text-arena-text-dim">{t.description}</span>
          </span>
          {theme === t.id && <Check className="h-4 w-4 text-arena-accent" />}
        </DropdownItem>
      ))}
    </Dropdown>
  );
}
