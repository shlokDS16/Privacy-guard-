"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Receipt = Record<string, any>;

function loadReceipts(): Receipt[] {
  try {
    return JSON.parse(localStorage.getItem("pg_receipts_v1") || "[]");
  } catch {
    return [];
  }
}

export default function AuditLogPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  useEffect(() => setReceipts(loadReceipts()), []);

  const chain = useMemo(() => {
    const items = receipts.slice().reverse(); // oldest->newest
    return items.map((r, idx) => {
      const prev = r.prev_receipt_hash;
      const ok = idx === 0 ? true : prev === items[idx - 1].receipt_hash;
      return { r, ok };
    });
  }, [receipts]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Audit Log</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          Demonstration of a hash-linked receipt chain (local browser storage).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Receipt chain</CardTitle>
          <CardDescription>Oldest → newest; each receipt references the previous hash.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {chain.length === 0 ? (
            <div className="text-sm text-zinc-600 dark:text-zinc-300">No receipts stored yet.</div>
          ) : (
            chain.map(({ r, ok }, idx) => (
              <div key={idx} className="rounded-xl border border-zinc-200/60 p-3 dark:border-zinc-800/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium">{(r.timestamp_utc || "").slice(0, 19).replace("T", " ")}</div>
                  <Badge variant={ok ? "low" : "critical"}>{ok ? "CHAIN OK" : "CHAIN BREAK"}</Badge>
                </div>
                <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">
                  receipt_hash: <span className="font-mono">{r.receipt_hash}</span>
                </div>
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                  prev_hash: <span className="font-mono">{r.prev_receipt_hash || "null"}</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
