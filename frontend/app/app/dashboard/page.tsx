import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mockKpis } from "@/lib/mock/kpis";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          Session summary and recent activity.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {mockKpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">{kpi.label}</CardTitle>
              <Badge variant={kpi.badge}>{kpi.badgeLabel}</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{kpi.value}</div>
              <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">{kpi.note}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What to demo</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-600 dark:text-zinc-300">
          Try a risky query in <span className="font-medium">Query Builder</span>, apply the suggested rewrite, then open the generated receipt.
        </CardContent>
      </Card>
    </div>
  );
}
