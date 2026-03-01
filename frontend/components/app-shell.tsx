"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";
import {
  ShieldCheck,
  LayoutDashboard,
  FileSearch,
  FileText,
  BarChart3,
  Activity,
  Settings,
  BookOpen,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const nav = [
  { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app/query/new", label: "Query Builder", icon: FileSearch },
  { href: "/app/risk-heatmap", label: "Risk Heatmap", icon: Activity },
  { href: "/app/analytics", label: "Evaluation", icon: BarChart3 },
  { href: "/app/receipts", label: "Receipts", icon: FileText },
  { href: "/app/audit-log", label: "Audit Log", icon: BookOpen },
  { href: "/app/policy-studio", label: "Policy Studio", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient glow matching the interactive globe theme */}
      <div className="absolute top-0 right-1/4 w-[800px] h-[800px] rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-cyan-500/5 blur-[100px] pointer-events-none" />

      <div className="flex relative z-10">
        <aside className="hidden w-64 shrink-0 border-r border-zinc-200/60 bg-card/50 backdrop-blur-sm dark:border-white/10 dark:bg-zinc-950/50 md:block min-h-screen">
          <div className="flex items-center gap-2 px-5 py-6">
            <ShieldCheck className="h-6 w-6 text-blue-400" />
            <div className="text-base font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              PrivacyGuard
            </div>
          </div>
          <nav className="px-3 pb-6 space-y-1">
            {nav.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-blue-500/10 font-medium text-blue-600 dark:text-blue-400 dark:bg-blue-500/20"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200"
                  )}
                >
                  <Icon className={cn("h-4 w-4", active ? "text-blue-500" : "opacity-70")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 min-h-screen flex flex-col">
          <header className="sticky top-0 z-20 border-b border-zinc-200/60 bg-background/80 backdrop-blur-md dark:border-white/10 dark:bg-zinc-950/80">
            <div className="mx-auto flex w-full items-center justify-between px-6 py-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                Healthcare Demo • UCI Heart Disease
              </div>
              <ThemeToggle />
            </div>
          </header>
          <div className="w-full px-6 py-8 flex-1">{children}</div>
        </main>
      </div>
    </div>
  );
}
