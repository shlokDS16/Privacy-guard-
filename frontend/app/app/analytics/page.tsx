"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { API_BASE } from "@/lib/api/client";

type T1Row = {
  method: string;
  sqr: number;
  bqr: number;
  rsr: number | null;
  mean_il: number;
  asr: number;
  mean_utility: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  executed: number;
  rewritten: number;
  blocked: number;
};

type T2Row = {
  method: string;
  rewrites: number;
  age_band_count: number;
  age_band_pct: number;
  cp_group_count: number;
  cp_group_pct: number;
  drop_predicate_count: number;
  drop_predicate_pct: number;
  combo_count: number;
  combo_pct: number;
  other_count: number;
  other_pct: number;
};

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadLatest() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/evaluation/latest`);
      const data = await res.json();
      setReport(data);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function runEval() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/evaluation/run`, { method: "POST" });
      const data = await res.json();
      setReport(data);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLatest();
  }, []);

  const tableRows: T1Row[] = useMemo(() => (report?.table_T1 || []) as T1Row[], [report]);
  const ablationRows: T2Row[] = useMemo(() => (report?.table_T2 || []) as T2Row[], [report]);
  const outcomeBars = useMemo(() => report?.charts?.outcomes || [], [report]);
  const kpiSeries = useMemo(() => report?.charts?.kpi || [], [report]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Evaluation Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Generates the patent-style table (T1) and charts by running experiments on the loaded dataset.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={loadLatest} disabled={loading}>Refresh</Button>
          <Button onClick={runEval} disabled={loading}>Run Evaluation</Button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Backend not reachable</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {report?.status === "missing" ? (
        <Card>
          <CardHeader>
            <CardTitle>No evaluation report found</CardTitle>
            <CardDescription>
              Click <b>Run Evaluation</b> to generate the report (writes backend/reports/eval_latest.json).
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Table T1 — Baseline Comparison</CardTitle>
          <CardDescription>
            k_min={report?.k_min ?? "-"}, l_min={report?.l_min ?? "-"}, drop_pred={report?.enable_drop_predicate ? "ON" : "OFF"}, queries={report?.query_count ?? "-"}{" "}
            {report?.generated_at ? <Badge variant="outline">generated</Badge> : <Badge variant="outline">demo</Badge>}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="text-left">
              <tr className="border-b">
                <th className="py-2 pr-4">Method</th>
                <th className="py-2 pr-4">SQR %</th>
                <th className="py-2 pr-4">BQR %</th>
                <th className="py-2 pr-4">RSR %</th>
                <th className="py-2 pr-4">Mean IL</th>
                <th className="py-2 pr-4">ASR %</th>
                <th className="py-2 pr-4">Utility</th>
                <th className="py-2 pr-4">Avg Lat (ms)</th>
                <th className="py-2 pr-4">P95 Lat (ms)</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => (
                <tr key={r.method} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-medium">{r.method}</td>
                  <td className="py-2 pr-4">{r.sqr}</td>
                  <td className="py-2 pr-4">{r.bqr}</td>
                  <td className="py-2 pr-4">{r.rsr ?? "-"}</td>
                  <td className="py-2 pr-4">{Number.isFinite(r.mean_il) ? r.mean_il.toFixed(3) : r.mean_il}</td>
                  <td className="py-2 pr-4">{r.asr}</td>
                  <td className="py-2 pr-4">{Math.round((r.mean_utility ?? 0) * 1000) / 10}%</td>
                  <td className="py-2 pr-4">{r.avg_latency_ms}</td>
                  <td className="py-2 pr-4">{r.p95_latency_ms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Table T2 — Rewrite Ablation</CardTitle>
          <CardDescription>
            Distribution of dominant rewrite types among rewritten queries (R2 age_band, R3&apos; cp_group, R4 drop predicate, combo).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ablationRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rewrite ablation data available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">Method</th>
                    <th className="py-2 pr-4">Rewrites</th>
                    <th className="py-2 pr-4">Age band</th>
                    <th className="py-2 pr-4">CP group</th>
                    <th className="py-2 pr-4">Drop predicate</th>
                    <th className="py-2 pr-4">Combo</th>
                    <th className="py-2 pr-4">Other</th>
                  </tr>
                </thead>
                <tbody>
                  {ablationRows.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{r.method}</td>
                      <td className="py-2 pr-4">{r.rewrites}</td>
                      <td className="py-2 pr-4">
                        {r.age_band_count} ({Math.round((r.age_band_pct ?? 0) * 10) / 10}%)
                      </td>
                      <td className="py-2 pr-4">
                        {r.cp_group_count} ({Math.round((r.cp_group_pct ?? 0) * 10) / 10}%)
                      </td>
                      <td className="py-2 pr-4">
                        {r.drop_predicate_count} ({Math.round((r.drop_predicate_pct ?? 0) * 10) / 10}%)
                      </td>
                      <td className="py-2 pr-4">
                        {r.combo_count} ({Math.round((r.combo_pct ?? 0) * 10) / 10}%)
                      </td>
                      <td className="py-2 pr-4">
                        {r.other_count} ({Math.round((r.other_pct ?? 0) * 10) / 10}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Outcomes</CardTitle>
            <CardDescription>Executed vs Rewritten vs Blocked</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={outcomeBars}>
                <XAxis dataKey="method" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="executed" />
                <Bar dataKey="rewritten" />
                <Bar dataKey="blocked" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>KPIs</CardTitle>
            <CardDescription>SQR/BQR/ASR/Utility vs method</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={kpiSeries}>
                <XAxis dataKey="method" />
                <YAxis />
                <Tooltip />
                <Line dataKey="SQR" />
                <Line dataKey="BQR" />
                <Line dataKey="ASR" />
                <Line dataKey="Utility" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
