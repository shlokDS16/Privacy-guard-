export const outcomeBars = [
  { method: "No Controls", executed: 52, rewritten: 0, blocked: 3 },
  { method: "Global Recoding", executed: 55, rewritten: 0, blocked: 0 },
  { method: "JIT Lattice", executed: 41, rewritten: 12, blocked: 2 },
  { method: "JIT + Heatmap", executed: 44, rewritten: 10, blocked: 1 },
];

export const baselineRows = [
  { method: "No Controls", sqr: "95", bqr: "0", rsr: "0", il: "0.00", asr: "38", p95: "90" },
  { method: "Global Recoding", sqr: "100", bqr: "0", rsr: "0", il: "0.41", asr: "7", p95: "110" },
  { method: "JIT Lattice", sqr: "96", bqr: "4", rsr: "86", il: "0.23", asr: "8", p95: "190" },
  { method: "JIT + Heatmap", sqr: "98", bqr: "2", rsr: "90", il: "0.21", asr: "6", p95: "175" },
];

export const kpiSeries = {
  summary: [
    { label: "Successful Query Rate", value: "78%", badge: "low" as const, badgeLabel: "OK" },
    { label: "Blocked Query Rate", value: "12%", badge: "medium" as const, badgeLabel: "Watch" },
    { label: "Avg IL", value: "0.23", badge: "neutral" as const, badgeLabel: "IL" },
    { label: "ASR proxy", value: "8%", badge: "low" as const, badgeLabel: "Low" },
  ],
  ilTrend: [
    { run: "R1", il: 0.18 },
    { run: "R2", il: 0.22 },
    { run: "R3", il: 0.24 },
    { run: "R4", il: 0.23 },
    { run: "R5", il: 0.21 },
  ],
};
