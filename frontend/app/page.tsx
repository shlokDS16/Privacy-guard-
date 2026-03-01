import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Component as Globe } from "@/components/ui/interactive-globe";

export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="w-full max-w-5xl rounded-2xl border border-border bg-card overflow-hidden relative shadow-2xl">
        {/* Ambient glow */}
        <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row min-h-[500px]">
          {/* Left content */}
          <div className="flex-1 flex flex-col justify-center p-10 md:p-14 relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground mb-6 w-fit">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Privacy Systems Operational
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground leading-[1.1] mb-4">
              PrivacyGuard
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                Analytics
              </span>
            </h1>

            <p className="text-sm md:text-base text-muted-foreground max-w-md leading-relaxed mb-6">
              Score privacy risk, automatically rewrite unsafe cohort queries, and generate verifiable receipts for audit.
              Built as a healthcare demo over the UCI Heart Disease dataset.
            </p>

            <div className="flex gap-3 mb-8">
              <Link href="/app/dashboard">
                <Button>Open App</Button>
              </Link>
              <Link href="/app/analytics">
                <Button variant="secondary">View Evaluation</Button>
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div>
                <p className="text-2xl font-bold text-foreground">k, l</p>
                <p className="text-xs text-muted-foreground">Privacy Controls</p>
              </div>
              <div className="w-px h-8 bg-border hidden sm:block" />
              <div>
                <p className="text-2xl font-bold text-foreground">Ed25519</p>
                <p className="text-xs text-muted-foreground">Verifiable Receipts</p>
              </div>
              <div className="w-px h-8 bg-border hidden sm:block" />
              <div>
                <p className="text-2xl font-bold text-foreground">JIT</p>
                <p className="text-xs text-muted-foreground">Generalization</p>
              </div>
            </div>
          </div>

          {/* Right — Globe */}
          <div className="flex-1 flex items-center justify-center p-4 md:p-0 min-h-[400px]">
            <Globe
              size={460}
              dotColor="rgba(100, 180, 255, ALPHA)"
              arcColor="rgba(100, 180, 255, 0.5)"
              markerColor="rgba(100, 220, 255, 1)"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
