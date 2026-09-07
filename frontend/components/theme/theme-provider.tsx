"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { applyMode, Mode } from "@cloudscape-design/global-styles";
import { applyTheme } from "@cloudscape-design/components/theming";

export const THEME_STORAGE_KEY = "route53-theme";

export type ThemePreference = "light" | "dark" | "system";

const route53Theme = {
  tokens: {
    colorBackgroundButtonPrimaryDefault: {
      light: "#ec7211",
      dark: "#ff9900",
    },
    colorBackgroundButtonPrimaryHover: {
      light: "#eb5f07",
      dark: "#ec7211",
    },
    colorBackgroundButtonPrimaryActive: {
      light: "#dd6b10",
      dark: "#eb5f07",
    },
    colorBorderButtonPrimaryDefault: {
      light: "#ec7211",
      dark: "#ff9900",
    },
    colorBorderButtonPrimaryHover: {
      light: "#eb5f07",
      dark: "#ec7211",
    },
    colorBorderButtonPrimaryActive: {
      light: "#dd6b10",
      dark: "#eb5f07",
    },
    colorTextButtonPrimaryDefault: {
      light: "#16191f",
      dark: "#16191f",
    },
    colorTextButtonPrimaryHover: {
      light: "#16191f",
      dark: "#16191f",
    },
    colorTextButtonPrimaryActive: {
      light: "#16191f",
      dark: "#16191f",
    },
  },
};

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference(preference: ThemePreference): void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function resolveMode(preference: ThemePreference): Mode {
  if (preference === "dark") return Mode.Dark;
  if (preference === "light") return Mode.Light;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? Mode.Dark
    : Mode.Light;
}

function applyPreference(preference: ThemePreference) {
  applyMode(resolveMode(preference));
  document.body.dataset.route53Theme = preference;
}

function getInitialPreference(): ThemePreference {
  if (typeof document === "undefined") return "system";
  const initializedPreference = document.body.dataset.route53Theme ?? null;
  if (isThemePreference(initializedPreference)) {
    return initializedPreference;
  }
  const storedPreference = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(storedPreference) ? storedPreference : "system";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] =
    useState<ThemePreference>(getInitialPreference);

  useLayoutEffect(() => {
    applyPreference(preference);
  }, [preference]);

  useLayoutEffect(() => {
    const { reset } = applyTheme({ theme: route53Theme });
    return reset;
  }, []);

  useLayoutEffect(() => {
    if (preference !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyPreference("system");
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [preference]);

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    setPreferenceState(nextPreference);
  }, []);

  const value = useMemo(
    () => ({ preference, setPreference }),
    [preference, setPreference],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
