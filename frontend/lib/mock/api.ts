import type { BadgeVariant, RiskLevel } from "@/lib/types";

export async function analyzeQueryMock(sql: string): Promise<{
  riskScore: number;
  riskLevel: RiskLevel;
  riskBadge: BadgeVariant;
  kEst: number;
  suggestedRewrite: string;
}> {
  const risky = /age\s*=\s*\d+/i.test(sql) && /cp\s*=\s*4/i.test(sql);
  const kEst = risky ? 2 : 18;
  const riskScore = risky ? 84 : 18;
  const riskLevel: RiskLevel = risky ? "CRITICAL" : "LOW";
  const riskBadge: BadgeVariant = risky ? "critical" : "low";
  const suggestedRewrite = risky
    ? "SELECT AVG(chol) FROM patient_records WHERE age_band = '60-69' AND cp_group = 'HighRiskSymptoms'"
    : sql;

  return new Promise((resolve) =>
    setTimeout(() => resolve({ riskScore, riskLevel, riskBadge, kEst, suggestedRewrite }), 250)
  );
}
