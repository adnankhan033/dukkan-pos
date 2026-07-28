import { useEffect } from "react";
import { useThemeStore } from "../contexts/store";

export function useTheme() {
  const { theme, toggleTheme, setTheme } = useThemeStore();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return { theme, toggleTheme, setTheme, isDark: theme === "dark" };
}
