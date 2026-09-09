"use client";
import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "screenshots-color-theme";

export function ThemeToggle({ disabled }: { disabled?: boolean }) {
  // null until mounted so server and first client render agree (light).
  // The pre-hydration script in layout.tsx already applied the stored or
  // system theme to <html>; we just read it back here.
  const [dark, setDark] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !(dark ?? document.documentElement.classList.contains("dark"));
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch (e) {
      // storage unavailable (private mode etc.) — theme still applies
      void e;
    }
    setDark(next);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={toggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle color theme"
      aria-pressed={dark ?? false}
      disabled={disabled}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
