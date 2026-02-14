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
    <div className="min-h-screen">
      <div className="flex">
        <aside className="hidden w-64 shrink-0 border-r border-zinc-200/60 bg-white dark:border-zinc-800/60 dark:bg-zinc-950 md:block">
          <div className="flex items-center gap-2 px-5 py-5">
            <ShieldCheck className="h-5 w-5" />
            <div className="text-sm font-semibold">PrivacyGuard</div>
          </div>
          <nav className="px-3 pb-6">
            {nav.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "mb-1 flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-900",
                    active && "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-900 dark:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1">
          <header className="sticky top-0 z-10 border-b border-zinc-200/60 bg-zinc-50/80 backdrop-blur dark:border-zinc-800/60 dark:bg-zinc-950/60">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                Healthcare Demo • UCI Heart Disease
              </div>
              <ThemeToggle />
            </div>
          </header>
          <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
