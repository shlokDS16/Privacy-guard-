"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { analyzeQuery, getHeatmapOptions, type AnalyzeResponse } from "@/lib/api/client";

type Cell = { key: string; res?: AnalyzeResponse; err?: string };

export default function RiskHeatmapPage() {
  const [ageBands, setAgeBands] = useState<string[]>([]);
  const [cpGroups, setCpGroups] = useState<string[]>([]);
  const [sex, setSex] = useState<string>("1"); // default
  const [busy, setBusy] = useState(false);
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const opt = await getHeatmapOptions();
        setAgeBands(opt.age_bands || []);
        setCpGroups(opt.cp_groups || []);
        // if sex values exist, pick first as default
        if ((opt.sex_values || []).length > 0) setSex(String(opt.sex_values[0]));
      } catch (e: any) {
        setError(e?.message || "Failed to load heatmap options");
      }
    })();
  }, []);

  const orderedKeys = useMemo(() => {
    const keys: string[] = [];
    for (const a of ageBands) for (const c of cpGroups) keys.push(`${a}__${c}`);
    return keys;
  }, [ageBands, cpGroups]);

  const run = async () => {
    setBusy(true);
    setError(null);

    const next: Record<string, Cell> = {};
    for (const k of orderedKeys) next[k] = { key: k };
    setCells(next);

    try {
      // sequential to keep backend stable (you can parallelize later)
      for (const a of ageBands) {
        for (const c of cpGroups) {
          const key = `${a}__${c}`;
          const sql =
            `SELECT COUNT(*) FROM patient_records ` +
            `WHERE age_band = '${a}' AND cp_group = '${c}' AND sex = ${sex}`;

          try {
            const res = await analyzeQuery(sql);
            next[key] = { key, res };
          } catch (e: any) {
            next[key] = { key, err: e?.message || "Analyze failed" };
          }
          setCells({ ...next });
        }
      }
    } catch (e: any) {
      setError(e?.message || "Heatmap generation failed");
    } finally {
      setBusy(false);
    }
  };

  const badgeVariant = (lvl?: string) => {
    if (!lvl) return "neutral" as const;
    return lvl === "LOW" ? "low" : lvl === "MEDIUM" ? "medium" : lvl === "HIGH" ? "high" : "critical";
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Risk Heatmap</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          Visualize privacy risk across cohorts (age_band × cp_group) under the current policy.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Controls</CardTitle>
          <CardDescription>Generate the heatmap by calling /api/query/analyze per cell.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="text-sm text-zinc-600 dark:text-zinc-300">
            Sex:
            <select
              value={sex}
              onChange={(e) => setSex(e.target.value)}
              className="ml-2 rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              disabled={busy}
            >
              <option value="0">0</option>
              <option value="1">1</option>
            </select>
          </div>

          <Button onClick={run} disabled={busy || ageBands.length === 0 || cpGroups.length === 0}>
            {busy ? "Generating..." : "Generate Heatmap"}
          </Button>

          <div className="text-xs text-zinc-600 dark:text-zinc-300">
            Cells: {ageBands.length} × {cpGroups.length}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Heatmap</CardTitle>
          <CardDescription>Each cell shows risk level + k/l estimates for that cohort.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {ageBands.length === 0 || cpGroups.length === 0 ? (
            <div className="text-sm text-zinc-600 dark:text-zinc-300">No options loaded yet.</div>
          ) : (
            <table className="min-w-[900px] w-full border-separate border-spacing-2">
              <thead>
                <tr>
                  <th className="text-left text-xs text-zinc-500">age_band \\ cp_group</th>
                  {cpGroups.map((c) => (
                    <th key={c} className="text-left text-xs text-zinc-500">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ageBands.map((a) => (
                  <tr key={a}>
                    <td className="text-xs font-medium text-zinc-700 dark:text-zinc-200">{a}</td>
                    {cpGroups.map((c) => {
                      const key = `${a}__${c}`;
                      const cell = cells[key];
                      const res = cell?.res;
                      return (
                        <td key={key} className="rounded-xl border border-zinc-200/60 p-2 dark:border-zinc-800/60">
                          {cell?.err ? (
                            <div className="text-xs text-red-500">ERR</div>
                          ) : !res ? (
                            <div className="text-xs text-zinc-500">—</div>
                          ) : (
                            <div className="space-y-1">
                              <Badge variant={badgeVariant(res.risk_level)}>{res.risk_level}</Badge>
                              <div className="text-[11px] text-zinc-600 dark:text-zinc-300">
                                score {res.risk_score}/100
                              </div>
                              <div className="text-[11px] text-zinc-600 dark:text-zinc-300">
                                k {res.k_est} | l {res.l_est}
                              </div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


