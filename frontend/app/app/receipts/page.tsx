"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { verifyReceipt } from "@/lib/api/client";

type Receipt = Record<string, any>;

function loadReceipts(): Receipt[] {
  try {
    const raw = JSON.parse(localStorage.getItem("pg_receipts_v1") || "[]");
    if (!Array.isArray(raw)) return [];

    // ✅ Remove null/undefined/non-object entries that crash the receipts page
    return raw.filter((r: any) => r && typeof r === "object") as Receipt[];
  } catch {
    return [];
  }
}

export default function ReceiptsPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [selected, setSelected] = useState<Receipt | null>(null);
  const [verify, setVerify] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setReceipts(loadReceipts()), []);

  const hash = selected?.receipt_hash || "";
  const badge = useMemo(() => {
    const lvl = selected?.risk_assessment?.risk_level;
    if (!lvl) return "neutral" as const;
    return lvl === "LOW" ? "low" : lvl === "MEDIUM" ? "medium" : lvl === "HIGH" ? "high" : "critical";
  }, [selected]);

  const runVerify = async () => {
    setBusy(true);
    setError(null);
    try {
      if (!selected) throw new Error("Select a receipt first");
      const res = await verifyReceipt(selected);
      setVerify(res);
    } catch (e: any) {
      setError(e?.message || "Verify failed");
    } finally {
      setBusy(false);
    }
  };

  const clear = () => {
    localStorage.removeItem("pg_receipts_v1");
    setReceipts([]);
    setSelected(null);
    setVerify(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Receipts</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Receipts captured from executions (stored in browser localStorage).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setReceipts(loadReceipts())}>Refresh</Button>
          <Button variant="secondary" onClick={clear}>Clear</Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Receipt list</CardTitle>
            <CardDescription>{receipts.length} stored</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {receipts.length === 0 ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">No receipts yet. Execute a query first.</div>
            ) : (
              receipts.map((r, idx) => (
                <button
                  key={idx}
                  onClick={() => { setSelected(r); setVerify(null); }}
                  className="w-full rounded-xl border border-zinc-200/60 p-3 text-left text-sm hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{(r?.timestamp_utc || "").slice(0, 19).replace("T", " ")}</div>
                    <Badge variant={r.risk_assessment?.risk_level === "CRITICAL" ? "critical" : "neutral"}>{r.risk_assessment?.risk_level || "—"}</Badge>
                  </div>
                  <div className="mt-2 font-mono text-[11px] break-words text-zinc-600 dark:text-zinc-300">
                    {(r.receipt_hash || "").slice(0, 28)}…
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Receipt viewer</CardTitle>
            <CardDescription>Verify signature + inspect rewrite and factors.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selected ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">Select a receipt to view details.</div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={badge}>{selected.risk_assessment?.risk_level}</Badge>
                  <div className="text-xs text-zinc-600 dark:text-zinc-300">Hash: <span className="font-mono">{hash}</span></div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={runVerify} disabled={busy}>Verify Receipt</Button>
                  {verify ? (
                    <Badge variant={verify.valid ? "low" : "critical"}>{verify.valid ? "VALID" : "INVALID"}</Badge>
                  ) : null}
                  {verify ? (
                    <div className="text-xs text-zinc-600 dark:text-zinc-300">{verify.reason}</div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-zinc-200/60 bg-zinc-50 p-3 dark:border-zinc-800/60 dark:bg-zinc-950">
                  <div className="text-sm font-medium">Receipt JSON</div>
                  <pre className="mt-2 overflow-x-auto text-xs text-zinc-700 dark:text-zinc-200">
{JSON.stringify(selected, null, 2)}
                  </pre>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
