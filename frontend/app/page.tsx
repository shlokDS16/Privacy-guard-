import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              Privacy-aware healthcare analytics
            </div>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
              PrivacyGuard Analytics
            </h1>
            <p className="mt-4 max-w-xl text-zinc-600 dark:text-zinc-300">
              Score privacy risk, automatically rewrite unsafe cohort queries, and generate verifiable receipts for audit.
              Built as a healthcare demo over the UCI Heart Disease dataset.
            </p>
            <div className="mt-6 flex gap-3">
              <Link href="/app/dashboard"><Button>Open App</Button></Link>
              <Link href="/app/analytics"><Button variant="secondary">View Evaluation</Button></Link>
            </div>
          </div>
          <div className="grid w-full grid-cols-1 gap-3 md:w-[420px]">
            <Card>
              <CardHeader>
                <CardTitle>Core pipeline</CardTitle>
                <CardDescription>Query → Risk → Rewrite → Receipt</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-zinc-600 dark:text-zinc-300">
                Demonstrates just-in-time generalization lattice, risk heatmap guidance, and tamper-evident receipts.
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Adaptive Granularity</CardTitle>
              <CardDescription>Generalize only what’s needed</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-zinc-600 dark:text-zinc-300">
              Slice-aware lattice broadens age/cp granularity to satisfy k and l without global recoding.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Risk Heatmap</CardTitle>
              <CardDescription>Precomputed vulnerability</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-zinc-600 dark:text-zinc-300">
              Shows risky attribute combinations before execution to reduce trial-and-error.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Privacy Receipt</CardTitle>
              <CardDescription>Verifiable audit artifact</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-zinc-600 dark:text-zinc-300">
              Every decision is logged and signed (demo keys) with a hash-linked chain.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
