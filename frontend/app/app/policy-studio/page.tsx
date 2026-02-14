"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getPolicy, updatePolicy, type Policy } from "@/lib/api/client";

function fmtTime(iso?: string) {
  if (!iso) return "-";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default function Page() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [policy, setPolicyState] = useState<Policy | null>(null);

  const [kMin, setKMin] = useState(5);
  const [lMin, setLMin] = useState(2);
  const [enableDrop, setEnableDrop] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const p = await getPolicy();
      setPolicyState(p);
      setKMin(p.k_min);
      setLMin(p.l_min);
      setEnableDrop(p.enable_drop_predicate);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const p = await updatePolicy({ k_min: kMin, l_min: lMin, enable_drop_predicate: enableDrop });
      setPolicyState(p);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  function resetDefaults() {
    setKMin(5);
    setLMin(2);
    setEnableDrop(true);
  }

  useEffect(() => {
    load();
  }, []);

  const kHint = useMemo(() => {
    if (kMin <= 5) return "Looser privacy constraint (fewer rewrites).";
    if (kMin <= 10) return "Moderate privacy constraint.";
    return "Stricter privacy constraint (more rewrites/blocks expected).";
  }, [kMin]);

  const lHint = useMemo(() => {
    if (lMin <= 2) return "Basic diversity constraint.";
    if (lMin <= 4) return "Moderate diversity constraint.";
    return "Stricter diversity constraint (more rewrites/blocks expected).";
  }, [lMin]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Policy Studio</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Tune privacy thresholds for risk analysis, rewriting, and evaluation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
          <Button onClick={save} disabled={saving || loading}>
            Save Policy
          </Button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-400">Error</CardTitle>
            <CardDescription className="text-red-300">{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Current Policy</CardTitle>
          <CardDescription>
            {policy ? (
              <span className="text-sm">
                policy_id=<span className="font-medium">{policy.policy_id}</span>, updated{" "}
                <span className="font-medium">{fmtTime(policy.updated_at)}</span>
              </span>
            ) : (
              "Loading..."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">k_min (k-anonymity)</div>
                <Badge>{kMin}</Badge>
              </div>
              <input
                type="range"
                min={2}
                max={25}
                value={kMin}
                onChange={(e) => setKMin(parseInt(e.target.value, 10))}
                className="w-full"
              />
              <div className="text-xs text-zinc-600 dark:text-zinc-300">{kHint}</div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">l_min (l-diversity)</div>
                <Badge>{lMin}</Badge>
              </div>
              <input
                type="range"
                min={1}
                max={6}
                value={lMin}
                onChange={(e) => setLMin(parseInt(e.target.value, 10))}
                className="w-full"
              />
              <div className="text-xs text-zinc-600 dark:text-zinc-300">{lHint}</div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Enable R4 (Drop predicate)</div>
                <div className="text-xs text-zinc-600 dark:text-zinc-300">
                  Allows the engine to remove a highly identifying predicate (demo: <span className="font-mono">sex=...</span>) when still risky.
                </div>
              </div>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={enableDrop}
                  onChange={(e) => setEnableDrop(e.target.checked)}
                  className="h-4 w-4"
                />
                <span className="text-sm">{enableDrop ? "ON" : "OFF"}</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" onClick={resetDefaults}>
              Reset to defaults
            </Button>
            <div className="text-xs text-zinc-600 dark:text-zinc-300">
              After saving, re-run <span className="font-medium">Analyze Risk</span> or <span className="font-medium">Run Evaluation</span> to see changes.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
