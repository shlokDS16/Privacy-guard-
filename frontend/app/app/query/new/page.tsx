"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { analyzeQuery, executeQuery, verifyReceipt, type AnalyzeResponse } from "@/lib/api/client";

function saveReceiptLocal(receipt: any) {
  try {
    const key = "pg_receipts_v1";
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    existing.unshift(receipt);
    localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
  } catch {}
}

export default function QueryBuilderPage() {
  const [sql, setSql] = useState("SELECT AVG(chol) FROM patient_records WHERE age = 63 AND sex = 1 AND cp = 4");
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [execRes, setExecRes] = useState<any>(null);
  const [verifyRes, setVerifyRes] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const suggestedSql = analysis?.suggested_rewrite_sql || "";

  const badgeVariant = useMemo(() => {
    const lvl = analysis?.risk_level;
    if (!lvl) return "neutral" as const;
    return lvl === "LOW" ? "low" : lvl === "MEDIUM" ? "medium" : lvl === "HIGH" ? "high" : "critical";
  }, [analysis]);

  const runAnalyze = async () => {
    setBusy(true);
    setError(null);
    setVerifyRes(null);
    try {
      const res = await analyzeQuery(sql);
      setAnalysis(res);
    } catch (e: any) {
      setError(e?.message || "Analyze failed");
    } finally {
      setBusy(false);
    }
  };

const runExecute = async (acceptRewrite: boolean) => {
  setBusy(true);
  setError(null);
  setVerifyRes(null);
  try {
    const res: any = await executeQuery(sql, "uci_heart_v1", acceptRewrite);
    setExecRes(res);

    // ✅ Only save when backend actually returned a receipt
    if (res?.status === "ok" && res?.receipt) {
      saveReceiptLocal(res.receipt);
    }
  } catch (e: any) {
    setError(e?.message || "Execute failed");
  } finally {
    setBusy(false);
  }
};



const runVerify = async () => {
  setBusy(true);
  setError(null);
  try {
    if (!execRes || execRes.status !== "ok") throw new Error("No successful execution to verify yet");
    const res = await verifyReceipt(execRes.receipt);
    setVerifyRes(res);
  } catch (e: any) {
    setError(e?.message || "Verify failed");
  } finally {
    setBusy(false);
  }
};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Query Builder</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          Write a cohort query and preview privacy risk before execution.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>SQL</CardTitle>
            <CardDescription>Aggregate-only queries recommended for the demo.</CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              className="h-44 w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-zinc-400/40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={runAnalyze} disabled={busy}>Analyze Risk</Button>
              <Button variant="secondary" onClick={() => setSql("SELECT COUNT(*) FROM patient_records WHERE age = 63 AND sex = 1 AND cp = 4")} disabled={busy}>
                Load Risky Example
              </Button>
              <Button variant="secondary" onClick={() => setSql("SELECT AVG(chol) FROM patient_records WHERE age_band = '60-69' AND cp_group = 'HighRiskSymptoms'")} disabled={busy}>
                Load Safe Example
              </Button>
              <Button onClick={() => runExecute(true)} disabled={busy}>Execute (accept rewrite)</Button>
              <Button variant="secondary" onClick={() => runExecute(false)} disabled={busy}>Execute (no rewrite)</Button>
            </div>

            {analysis?.decision === "REWRITE" && suggestedSql ? (
              <div className="mt-4 rounded-xl border border-zinc-200/60 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800/60 dark:bg-zinc-950 dark:text-zinc-200">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Suggested rewrite</div>
                  <Badge variant={badgeVariant}>{analysis.risk_level}</Badge>
                </div>
                <div className="mt-2 font-mono text-xs break-words">{suggestedSql}</div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk Preview</CardTitle>
            <CardDescription>Estimated safety under current policy.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!analysis ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">Run “Analyze Risk” to see factors and rewrite suggestions.</div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Risk</div>
                  <Badge variant={badgeVariant}>{analysis.risk_level}</Badge>
                </div>
                <div className="text-sm text-zinc-600 dark:text-zinc-300">k_est: <span className="font-medium">{analysis.k_est}</span></div>
                <div className="text-sm text-zinc-600 dark:text-zinc-300">l_est: <span className="font-medium">{analysis.l_est}</span></div>
                <div className="text-sm text-zinc-600 dark:text-zinc-300">Score: <span className="font-medium">{analysis.risk_score}</span>/100</div>

                <div className="rounded-xl border border-zinc-200/60 p-3 dark:border-zinc-800/60">
                  <div className="text-sm font-medium">Factors</div>
                  <ul className="mt-2 space-y-2 text-xs text-zinc-600 dark:text-zinc-300">
                    {(analysis.factors || []).length === 0 ? (
                      <li>No risk factors triggered.</li>
                    ) : (
                      analysis.factors.map((f, idx) => (
                        <li key={idx} className="flex items-start justify-between gap-3">
                          <span className="font-mono">{f.code}</span>
                          <span className="text-zinc-500 dark:text-zinc-400">{f.severity}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Execution Result</CardTitle>
            <CardDescription>Demo output returned by backend execute endpoint.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!execRes ? (
  <div className="text-sm text-zinc-600 dark:text-zinc-300">Execute a query to see results and receipt.</div>
) : execRes.status === "blocked" ? (
  <div className="space-y-2">
    <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900 dark:border-yellow-900/40 dark:bg-yellow-900/20 dark:text-yellow-200">
      <div className="font-medium">Blocked</div>
      <div className="mt-1 text-xs break-words">{execRes.reason || "Policy blocked this query."}</div>
    </div>
    {execRes.final_sql ? (
      <div className="text-sm text-zinc-600 dark:text-zinc-300">
        Final SQL: <span className="font-mono text-xs break-words">{execRes.final_sql}</span>
      </div>
    ) : null}
    <pre className="text-xs overflow-x-auto rounded-xl border border-zinc-200/60 bg-zinc-50 p-3 dark:border-zinc-800/60 dark:bg-zinc-950 dark:text-zinc-200">
      {JSON.stringify(execRes.analysis, null, 2)}
    </pre>
  </div>
) : (
  <>
    <div className="text-sm text-zinc-600 dark:text-zinc-300">
      Final SQL: <span className="font-mono text-xs break-words">{execRes.final_sql}</span>
    </div>
    <div className="rounded-xl border border-zinc-200/60 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800/60 dark:bg-zinc-950 dark:text-zinc-200">
      <div className="font-medium">Result (preview)</div>
      <pre className="mt-2 overflow-x-auto text-xs">{JSON.stringify(execRes.result, null, 2)}</pre>
    </div>
  </>
)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Privacy Receipt</CardTitle>
            <CardDescription>Signed audit artifact (verifyable)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!execRes || execRes.status !== "ok" ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">Execute an allowed query to generate a receipt.</div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={runVerify} disabled={busy}>Verify Receipt</Button>
                  {verifyRes ? (
                    <Badge variant={verifyRes.valid ? "low" : "critical"}>{verifyRes.valid ? "VALID" : "INVALID"}</Badge>
                  ) : null}
                  {verifyRes ? (
                    <div className="text-xs text-zinc-600 dark:text-zinc-300">{verifyRes.reason}</div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-zinc-200/60 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800/60 dark:bg-zinc-950 dark:text-zinc-200">
                  <div className="font-medium">Receipt JSON</div>
                  <pre className="mt-2 overflow-x-auto text-xs">{JSON.stringify(execRes.receipt, null, 2)}</pre>
                </div>

                <div className="text-xs text-zinc-600 dark:text-zinc-300">
                  Receipts are also saved locally (see <span className="font-medium">Receipts</span> page).
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
