import { fetchSummary, fetchDailyBurn, fetchTopUsers, fetchTrend, fetchRecentAnswers } from "@/lib/queries";
import { Card, CardTitle, CardValue, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RangeToggle } from "@/components/range-toggle";
import { parseRange, rangeLabel } from "@/lib/range";
import { Activity, Users, DollarSign, Zap, TrendingUp, TrendingDown, Hash, Type } from "lucide-react";

export const revalidate = 60;

function fmt(n: number, decimals = 4): string {
  return `$${n.toFixed(decimals)}`;
}

function mask(id: string): string {
  return id.slice(0, 8);
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = parseRange(params.range);

  const [summary, daily, topUsers, trend, recent] = await Promise.all([
    fetchSummary(range),
    fetchDailyBurn(range),
    fetchTopUsers(range),
    fetchTrend(),
    fetchRecentAnswers(range, 20),
  ]);

  const totalCost = summary.total_cost;
  const totalForBar = totalCost || 1;
  const perplexityCost = summary.total_perplexity_cost;
  const deepseekCost = summary.total_deepseek_cost;
  const ttsCost = summary.total_tts_cost;

  const isSpike = trend.delta_vs_yesterday > 50;
  const isDrop = trend.delta_vs_yesterday < -20;

  return (
    <main className="mx-auto max-w-6xl px-8 py-10">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Showing {rangeLabel(range)} · Updated{" "}
            {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </p>
        </div>
        <RangeToggle />
      </div>

      {/* Cost stats for selected range */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-zinc-500" />
            <CardTitle>Total Cost</CardTitle>
          </div>
          <CardValue>{fmt(totalCost)}</CardValue>
          <CardFooter>{rangeLabel(range)}</CardFooter>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-zinc-500" />
            <CardTitle>Cost / Answer</CardTitle>
          </div>
          <CardValue>{fmt(summary.avg_cost_per_answer)}</CardValue>
          <CardFooter>{summary.total_answers} answers</CardFooter>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-zinc-500" />
            <CardTitle>Active Users</CardTitle>
          </div>
          <CardValue>{summary.unique_users}</CardValue>
          <CardFooter>{fmt(summary.cost_per_user)} / user</CardFooter>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-zinc-500" />
            <CardTitle>Routing</CardTitle>
          </div>
          <CardValue>{summary.perplexity_pct}%</CardValue>
          <CardFooter>Perplexity / {100 - summary.perplexity_pct}% DeepSeek</CardFooter>
        </Card>
      </div>

      {/* Trend row — fixed windows */}
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardTitle>Today</CardTitle>
          <CardValue className="text-2xl">{fmt(trend.today_cost)}</CardValue>
          <CardFooter className="flex items-center gap-1">
            {trend.delta_vs_yesterday > 0 ? (
              <TrendingUp className={`h-3 w-3 ${isSpike ? "text-red-400" : "text-zinc-500"}`} />
            ) : (
              <TrendingDown className={`h-3 w-3 ${isDrop ? "text-amber-400" : "text-zinc-500"}`} />
            )}
            <span className={isSpike ? "text-red-400" : isDrop ? "text-amber-400" : "text-zinc-500"}>
              {trend.delta_vs_yesterday > 0 ? "+" : ""}{trend.delta_vs_yesterday}% vs yesterday
            </span>
          </CardFooter>
        </Card>

        <Card>
          <CardTitle>Yesterday</CardTitle>
          <CardValue className="text-2xl">{fmt(trend.yesterday_cost)}</CardValue>
          <CardFooter>24h prior</CardFooter>
        </Card>

        <Card>
          <CardTitle>Week</CardTitle>
          <CardValue className="text-2xl">{fmt(trend.week_cost)}</CardValue>
          <CardFooter>Last 7 days</CardFooter>
        </Card>

        <Card>
          <CardTitle>Projected Month</CardTitle>
          <CardValue className="text-2xl">
            {fmt(trend.today_cost * new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate(), 2)}
          </CardValue>
          <CardFooter>At today's rate</CardFooter>
        </Card>
      </div>

      {/* Spike alert */}
      {isSpike && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-red-400">
            <TrendingUp className="h-4 w-4" />
            <strong>Cost spike detected:</strong>
            <span className="text-zinc-300">
              Today is {trend.delta_vs_yesterday}% higher than yesterday. Check API dashboards.
            </span>
          </div>
        </div>
      )}

      {/* Provider Breakdown */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardTitle className="mb-4">Perplexity Sonar</CardTitle>
          <CardValue className="text-2xl">{fmt(perplexityCost)}</CardValue>
          <CardFooter>{summary.perplexity_answers} calls</CardFooter>
          <div className="mt-4">
            <Progress
              value={(perplexityCost / totalForBar) * 100}
              label="% of total"
              amount={`${Math.round((perplexityCost / totalForBar) * 100)}%`}
              color="bg-blue-500"
            />
          </div>
        </Card>

        <Card>
          <CardTitle className="mb-4">DeepSeek Chat</CardTitle>
          <CardValue className="text-2xl">{fmt(deepseekCost)}</CardValue>
          <CardFooter>{summary.deepseek_answers} calls</CardFooter>
          <div className="mt-4">
            <Progress
              value={(deepseekCost / totalForBar) * 100}
              label="% of total"
              amount={`${Math.round((deepseekCost / totalForBar) * 100)}%`}
              color="bg-emerald-500"
            />
          </div>
        </Card>

        <Card>
          <CardTitle className="mb-4">OpenAI TTS</CardTitle>
          <CardValue className="text-2xl">{fmt(ttsCost)}</CardValue>
          <CardFooter>{summary.total_answers} calls</CardFooter>
          <div className="mt-4">
            <Progress
              value={(ttsCost / totalForBar) * 100}
              label="% of total"
              amount={`${Math.round((ttsCost / totalForBar) * 100)}%`}
              color="bg-amber-500"
            />
          </div>
        </Card>
      </div>

      {/* Token stats */}
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Hash className="h-4 w-4 text-zinc-500" />
            <CardTitle>Input Tokens</CardTitle>
          </div>
          <CardValue className="text-2xl">{fmtNum(summary.total_input_tokens)}</CardValue>
          <CardFooter>~{fmtNum(summary.avg_input_tokens)} per answer</CardFooter>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Hash className="h-4 w-4 text-zinc-500" />
            <CardTitle>Output Tokens</CardTitle>
          </div>
          <CardValue className="text-2xl">{fmtNum(summary.total_output_tokens)}</CardValue>
          <CardFooter>~{fmtNum(summary.avg_output_tokens)} per answer</CardFooter>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Type className="h-4 w-4 text-zinc-500" />
            <CardTitle>TTS Characters</CardTitle>
          </div>
          <CardValue className="text-2xl">{fmtNum(summary.total_tts_chars)}</CardValue>
          <CardFooter>Spoken audio</CardFooter>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-zinc-500" />
            <CardTitle>Total Tokens</CardTitle>
          </div>
          <CardValue className="text-2xl">
            {fmtNum(summary.total_input_tokens + summary.total_output_tokens)}
          </CardValue>
          <CardFooter>LLM only</CardFooter>
        </Card>
      </div>

      {/* Daily/Hourly Burn */}
      <Card className="mt-6">
        <CardTitle className="mb-4">
          {range === "1h" || range === "6h" || range === "24h" ? "Hourly" : "Daily"} Burn ({rangeLabel(range)})
        </CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-500">
                <th className="pb-2 pr-4 font-medium">When</th>
                <th className="pb-2 pr-4 font-medium text-right">Users</th>
                <th className="pb-2 pr-4 font-medium text-right">Calls</th>
                <th className="pb-2 pr-4 font-medium text-right">Perplexity</th>
                <th className="pb-2 pr-4 font-medium text-right">DeepSeek</th>
                <th className="pb-2 pr-4 font-medium text-right">TTS</th>
                <th className="pb-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((d) => (
                <tr key={d.day} className="border-b border-zinc-800/50">
                  <td className="py-2 pr-4 font-mono text-zinc-300">
                    {range === "1h" || range === "6h" || range === "24h"
                      ? new Date(d.day).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" })
                      : new Date(d.day).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </td>
                  <td className="py-2 pr-4 text-right text-zinc-400">{d.active_users}</td>
                  <td className="py-2 pr-4 text-right text-zinc-400">{d.total_calls}</td>
                  <td className="py-2 pr-4 text-right font-mono text-blue-400">{fmt(d.perplexity_cost)}</td>
                  <td className="py-2 pr-4 text-right font-mono text-emerald-400">{fmt(d.deepseek_cost)}</td>
                  <td className="py-2 pr-4 text-right font-mono text-amber-400">{fmt(d.tts_cost)}</td>
                  <td className="py-2 text-right font-mono font-semibold text-zinc-100">{fmt(d.total_cost_usd)}</td>
                </tr>
              ))}
              {daily.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-zinc-600">No data in this range</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Recent Answers */}
      <Card className="mt-6">
        <CardTitle className="mb-4">Recent Answers</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-500">
                <th className="pb-2 pr-4 font-medium">When</th>
                <th className="pb-2 pr-4 font-medium">User</th>
                <th className="pb-2 pr-4 font-medium">Route</th>
                <th className="pb-2 pr-4 font-medium text-right">In tok</th>
                <th className="pb-2 pr-4 font-medium text-right">Out tok</th>
                <th className="pb-2 pr-4 font-medium text-right">TTS chars</th>
                <th className="pb-2 pr-4 font-medium text-right">LLM $</th>
                <th className="pb-2 pr-4 font-medium text-right">TTS $</th>
                <th className="pb-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={i} className="border-b border-zinc-800/50">
                  <td className="py-2 pr-4 font-mono text-xs text-zinc-500">{fmtTime(r.created_at)}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-zinc-400">{mask(r.user_id)}</td>
                  <td className="py-2 pr-4">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                      r.provider === "perplexity" ? "bg-blue-500/10 text-blue-400" :
                      r.provider === "deepseek" ? "bg-emerald-500/10 text-emerald-400" :
                      "bg-zinc-800 text-zinc-400"
                    }`}>
                      {r.provider}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right text-zinc-400">{r.input_tokens ?? "-"}</td>
                  <td className="py-2 pr-4 text-right text-zinc-400">{r.output_tokens ?? "-"}</td>
                  <td className="py-2 pr-4 text-right text-zinc-400">{r.tts_chars ?? "-"}</td>
                  <td className="py-2 pr-4 text-right font-mono text-zinc-400">{fmt(r.llm_cost, 5)}</td>
                  <td className="py-2 pr-4 text-right font-mono text-zinc-400">{fmt(r.tts_cost, 5)}</td>
                  <td className="py-2 text-right font-mono font-semibold text-zinc-100">{fmt(r.total_cost, 5)}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={9} className="py-8 text-center text-zinc-600">No answers in this range</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Top Users */}
      <Card className="mt-6">
        <CardTitle className="mb-4">Top Users by Cost ({rangeLabel(range)})</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-500">
                <th className="pb-2 pr-4 font-medium">User</th>
                <th className="pb-2 pr-4 font-medium">Access</th>
                <th className="pb-2 pr-4 font-medium text-right">Perplexity</th>
                <th className="pb-2 pr-4 font-medium text-right">DeepSeek</th>
                <th className="pb-2 pr-4 font-medium text-right">TTS</th>
                <th className="pb-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.map((u) => (
                <tr key={u.user_id} className="border-b border-zinc-800/50">
                  <td className="py-2 pr-4 font-mono text-zinc-400">{mask(u.user_id)}</td>
                  <td className="py-2 pr-4">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.access_state === "subscriber" ? "bg-emerald-500/10 text-emerald-400" :
                      u.access_state === "trial" ? "bg-blue-500/10 text-blue-400" :
                      "bg-zinc-800 text-zinc-400"
                    }`}>
                      {u.access_state}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right text-zinc-400">{u.perplexity_calls}</td>
                  <td className="py-2 pr-4 text-right text-zinc-400">{u.deepseek_calls}</td>
                  <td className="py-2 pr-4 text-right text-zinc-400">{u.tts_calls}</td>
                  <td className="py-2 text-right font-mono font-semibold text-zinc-100">{fmt(u.total_cost_usd)}</td>
                </tr>
              ))}
              {topUsers.length === 0 && (
                <tr><td colSpan={6} className="py-8 text-center text-zinc-600">No users in this range</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-8 text-center text-xs text-zinc-600">
        Auto-refreshes every 60s · Data from Supabase api_usage
      </div>
    </main>
  );
}
