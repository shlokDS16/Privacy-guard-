"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type ThemePref = "light" | "dark" | "system";

function apply(pref: ThemePref) {
  const isDark =
    pref === "dark" ||
    (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>("system");

  useEffect(() => {
    const stored = (localStorage.getItem("pg_theme") as ThemePref) || "system";
    setPref(stored);
    apply(stored);
  }, []);

  const cycle = () => {
    const next: ThemePref = pref === "system" ? "light" : pref === "light" ? "dark" : "system";
    setPref(next);
    localStorage.setItem("pg_theme", next);
    apply(next);
  };

  return (
    <Button variant="secondary" onClick={cycle} aria-label="Toggle theme">
      Theme: {pref}
    </Button>
  );
}
