"use client";

/**
 * Minimal theme bootstrap (light/dark) without external libs.
 * localStorage key: "pg_theme" ("light" | "dark" | "system")
 */
export function ThemeScript() {
  const code = `
  (function() {
    try {
      var pref = localStorage.getItem("pg_theme") || "system";
      var isDark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", isDark);
    } catch (e) {}
  })();`;
  // eslint-disable-next-line @next/next/no-sync-scripts
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
