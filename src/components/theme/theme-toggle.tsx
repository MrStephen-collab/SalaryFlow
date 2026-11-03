"use client";

import { useEffect } from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

/**
 * Day/night switch. One tap flips between light and dark; there is deliberately
 * no "system" option in the UI.
 */
export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Migrate anyone who still has the old "system" choice saved.
  useEffect(() => {
    if (theme === "system") {
      setTheme(resolvedTheme === "dark" ? "dark" : "light");
    }
  }, [theme, resolvedTheme, setTheme]);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Switch between day and night mode"
      title={isDark ? "Switch to day mode" : "Switch to night mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <SunIcon className="size-4 dark:hidden" />
      <MoonIcon className="hidden size-4 dark:block" />
    </Button>
  );
}
