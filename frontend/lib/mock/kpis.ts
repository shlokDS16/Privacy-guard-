export const mockKpis = [
  { label: "Successful Query Rate", value: "78%", badge: "low" as const, badgeLabel: "Stable", note: "Executed / Total (rolling)" },
  { label: "Blocked Query Rate", value: "12%", badge: "medium" as const, badgeLabel: "Watch", note: "Critical risk queries blocked" },
  { label: "Avg Information Loss", value: "0.23", badge: "neutral" as const, badgeLabel: "IL", note: "Lower is better" },
  { label: "Receipt Coverage", value: "100%", badge: "low" as const, badgeLabel: "OK", note: "Receipts for all decisions" },
];
