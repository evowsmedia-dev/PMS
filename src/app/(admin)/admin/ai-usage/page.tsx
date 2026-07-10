import { prisma } from "@/lib/prisma";
import { formatUsd, formatVnd } from "@/lib/ai-usage";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell, PageSection, PageToolbar, ResponsiveTableFrame } from "@/components/page-shell";

const MAX_LOGS_FOR_REPORT = 5000;
const RECENT_LOGS = 80;
const FALLBACK_USD_VND_RATE = 26_000;

interface UserUsageSummary {
  userId: string;
  fullName: string;
  email: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  lastUsedAt: Date;
}

export default async function AdminAiUsagePage() {
  const logs = await prisma.aiUsageLog.findMany({
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      project: { select: { name: true, code: true } },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_LOGS_FOR_REPORT,
  });

  const userSummaries = summarizeByUser(logs);
  const totalCalls = logs.length;
  const totalInputTokens = sum(logs.map((log) => log.inputTokens));
  const totalOutputTokens = sum(logs.map((log) => log.outputTokens));
  const totalTokens = sum(logs.map((log) => log.totalTokens));
  const totalCostUsd = sum(logs.map((log) => Number(log.costUsd)));
  const usdVndRate = await getUsdVndRate();
  const totalCostVnd = totalCostUsd * usdVndRate.rate;
  const recentLogs = logs.slice(0, RECENT_LOGS);

  return (
    <PageShell size="data">
      <PageSection>
        <PageToolbar
          title="Báo cáo sử dụng AI"
          description="Thống kê token và chi phí từ các lần gọi AI đã được hệ thống ghi nhận."
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <MetricCard label="Lượt gọi AI" value={formatNumber(totalCalls)} />
          <MetricCard label="Input tokens" value={formatNumber(totalInputTokens)} />
          <MetricCard label="Output tokens" value={formatNumber(totalOutputTokens)} />
          <MetricCard label="Tổng tokens" value={formatNumber(totalTokens)} />
          <MetricCard label="Chi phí ước tính USD" value={formatUsd(totalCostUsd)} />
          <MetricCard
            label="Chi phí ước tính VND"
            value={formatVnd(totalCostVnd)}
            description={`1 USD ≈ ${formatNumber(Math.round(usdVndRate.rate))} VND${
              usdVndRate.fallback ? " · tạm tính" : ""
            }`}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Thống kê theo user</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveTableFrame minWidth="min-w-[900px]">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">User</th>
                    <th className="px-4 py-2 text-right">Lượt gọi</th>
                    <th className="px-4 py-2 text-right">Input</th>
                    <th className="px-4 py-2 text-right">Output</th>
                    <th className="px-4 py-2 text-right">Tổng token</th>
                    <th className="px-4 py-2 text-right">Chi phí</th>
                    <th className="px-4 py-2">Lần cuối</th>
                  </tr>
                </thead>
                <tbody>
                  {userSummaries.length > 0 ? (
                    userSummaries.map((row) => (
                      <tr key={row.userId} className="border-t">
                        <td className="px-4 py-2">
                          <div className="font-medium">{row.fullName}</div>
                          <div className="text-xs text-muted-foreground">{row.email}</div>
                        </td>
                        <td className="px-4 py-2 text-right">{formatNumber(row.calls)}</td>
                        <td className="px-4 py-2 text-right">{formatNumber(row.inputTokens)}</td>
                        <td className="px-4 py-2 text-right">{formatNumber(row.outputTokens)}</td>
                        <td className="px-4 py-2 text-right">{formatNumber(row.totalTokens)}</td>
                        <td className="px-4 py-2 text-right font-medium">{formatUsd(row.costUsd)}</td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {row.lastUsedAt.toLocaleString("vi-VN")}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-6 text-center text-muted-foreground" colSpan={7}>
                        Chưa có usage AI nào được ghi nhận.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ResponsiveTableFrame>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Log gần đây</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveTableFrame minWidth="min-w-[980px]">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Thời gian</th>
                    <th className="px-4 py-2">User</th>
                    <th className="px-4 py-2">Dự án</th>
                    <th className="px-4 py-2">Tác vụ</th>
                    <th className="px-4 py-2">Model</th>
                    <th className="px-4 py-2 text-right">Token</th>
                    <th className="px-4 py-2 text-right">Chi phí</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.length > 0 ? (
                    recentLogs.map((log) => (
                      <tr key={log.id} className="border-t">
                        <td className="px-4 py-2 text-muted-foreground">
                          {log.createdAt.toLocaleString("vi-VN")}
                        </td>
                        <td className="px-4 py-2">
                          <div className="font-medium">{log.user.fullName}</div>
                          <div className="text-xs text-muted-foreground">{log.user.email}</div>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {log.project ? `${log.project.code} - ${log.project.name}` : "-"}
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="outline">{log.operation}</Badge>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{log.model}</td>
                        <td className="px-4 py-2 text-right">
                          <div>{formatNumber(log.totalTokens)}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatNumber(log.inputTokens)} in / {formatNumber(log.outputTokens)} out
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right font-medium">
                          {formatUsd(Number(log.costUsd))}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-6 text-center text-muted-foreground" colSpan={7}>
                        Chưa có log AI gần đây.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ResponsiveTableFrame>
            {logs.length >= MAX_LOGS_FOR_REPORT ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Báo cáo đang lấy tối đa {formatNumber(MAX_LOGS_FOR_REPORT)} bản ghi mới nhất.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </PageSection>
    </PageShell>
  );
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold leading-none">{value}</p>
        {description ? <p className="mt-2 text-xs text-muted-foreground">{description}</p> : null}
      </CardContent>
    </Card>
  );
}

function summarizeByUser(
  logs: Array<{
    userId: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    costUsd: unknown;
    createdAt: Date;
    user: { fullName: string; email: string };
  }>,
) {
  const rows = new Map<string, UserUsageSummary>();

  for (const log of logs) {
    const current = rows.get(log.userId);
    if (!current) {
      rows.set(log.userId, {
        userId: log.userId,
        fullName: log.user.fullName,
        email: log.user.email,
        calls: 1,
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        totalTokens: log.totalTokens,
        costUsd: Number(log.costUsd),
        lastUsedAt: log.createdAt,
      });
      continue;
    }

    current.calls += 1;
    current.inputTokens += log.inputTokens;
    current.outputTokens += log.outputTokens;
    current.totalTokens += log.totalTokens;
    current.costUsd += Number(log.costUsd);
    if (log.createdAt > current.lastUsedAt) current.lastUsedAt = log.createdAt;
  }

  return [...rows.values()].sort((a, b) => b.costUsd - a.costUsd || b.totalTokens - a.totalTokens);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

async function getUsdVndRate() {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });
    if (!response.ok) throw new Error(`Exchange rate API returned ${response.status}`);
    const payload = (await response.json()) as {
      result?: string;
      rates?: { VND?: number };
    };
    const rate = payload.rates?.VND;
    if (payload.result !== "success" || typeof rate !== "number" || !Number.isFinite(rate)) {
      throw new Error("Exchange rate API returned an invalid VND rate");
    }
    return { rate, fallback: false };
  } catch {
    return { rate: FALLBACK_USD_VND_RATE, fallback: true };
  }
}
