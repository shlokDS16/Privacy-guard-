export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") || "http://localhost:8000";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status} ${res.statusText}: ${text}`);
  }
  return (await res.json()) as T;
}

export type AnalyzeResponse = {
  risk_score: number;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  k_est: number;
  l_est: number;
  decision: "ALLOW" | "REWRITE" | "BLOCK";
  factors: Array<{ code: string; severity: string; evidence?: any }>;
  suggested_rewrite_sql?: string | null;
};

export type ExecuteResponse =
  | {
      status: "ok";
      final_sql: string;
      result: { rows: number; data: Array<Record<string, any>> };
      receipt: Record<string, any>;
      analysis: any;
    }
  | {
      status: "blocked";
      analysis: any;
      reason?: string;
      final_sql?: string;
    };

export async function getSchema() {
  return api<{ dataset_id: string; columns: any[]; policy_defaults: any }>(
    "/api/datasets/uci_heart/schema"
  );
}

export async function analyzeQuery(sql: string, dataset_id = "uci_heart_v1", mode = "jit") {
  return api<AnalyzeResponse>("/api/query/analyze", {
    method: "POST",
    body: JSON.stringify({ dataset_id, sql, mode }),
  });
}

export async function executeQuery(sql: string, dataset_id = "uci_heart_v1", accept_rewrite = true) {
  return api<ExecuteResponse>("/api/query/execute", {
    method: "POST",
    body: JSON.stringify({ dataset_id, sql, accept_rewrite }),
  });
}

export async function verifyReceipt(receipt: Record<string, any>) {
  return api<{ valid: boolean; reason: string; recomputed?: string }>(
    "/api/receipts/verify",
    { method: "POST", body: JSON.stringify({ receipt }) }
  );
}


export type Policy = {
  policy_id: string;
  k_min: number;
  l_min: number;
  enable_drop_predicate: boolean;
  updated_at: string;
};

export async function getPolicy() {
  return api<Policy>("/api/policy");
}

export async function updatePolicy(patch: Partial<Pick<Policy, "k_min" | "l_min" | "enable_drop_predicate">>) {
  return api<Policy>("/api/policy", { method: "POST", body: JSON.stringify(patch) });
}

export async function getHeatmapOptions() {
  return api<{ age_bands: string[]; cp_groups: string[]; sex_values: Array<number | string> }>(
    "/api/heatmap/options"
  );
}

