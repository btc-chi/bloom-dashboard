import { fetchDailyBurn, fetchSummary } from "@/lib/queries";
import { Card, CardTitle, CardValue, CardFooter } from "@/components/ui/card";
import { RangeToggle } from "@/components/range-toggle";
import { parseRange, rangeLabel } from "@/lib/range";
import { Wallet, AlertTriangle, Hash, Type, DollarSign } from "lucide-react";

export const revalidate = 60;

function fmt(n: number, decimals = 2): string {
  return `$${n.toFixed(decimals)}`;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

// API account balances — update these when you top up
const BALANCES = [
  { provider: "Perplexity Sonar", key: "perplexity" as const, balance: 4.31, alertAt: 1, note: "No auto top-up", color: "text-blue-400" },
  { provider: "DeepSeek", key: "deepseek" as const, balance: 9.88, alertAt: 1, note: "Notified at $1 remaining", color: "text-emerald-400" },
  { provider: "OpenAI TTS", key: "tts" as const, balance: 5.04, alertAt: 1, note: "Auto top-up enabled", color: "text-amber-400" },
];

export default async function CostsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = parseRange(params.range);

  const [daily, summary] = await Promise.all([
    fetchDailyBurn(range),
    fetchSummary(range),
  ]);

  // Build running balance deduction table (most recent day first)
  const sortedDaily = [...daily].reverse();

  // Calculate cumulative spend per provider
  const runningBalances = sortedDaily.map((d, i) => {
    const priorDays = sortedDaily.slice(0, i + 1);
    const cumPerplexity = priorDays.reduce((s, dd) => s + dd.perplexity_cost, 0);
    const cumDeepseek = priorDays.reduce((s, dd) => s + dd.deepseek_cost, 0);
    const cumTts = priorDays.reduce((s, dd) => s + dd.tts_cost, 0);

    return {
      day: d.day,
      perplexity_spend: d.perplexity_cost,
      deepseek_spend: d.deepseek_cost,
      tts_spend: d.tts_cost,
      total_spend: d.total_cost_usd,
      perplexity_balance: BALANCES[0].balance - cumPerplexity,
      deepseek_balance: BALANCES[1].balance - cumDeepseek,
      tts_balance: BALANCES[2].balance - cumTts,
    };
  });

  const warnings = BALANCES.filter((b) => b.balance <= b.alertAt);

  return (
    <main className="mx-auto max-w-6xl px-8 py-10">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Costs</h1>
          <p className="mt-1 text-sm text-zinc-500">
            API balances and daily spend deductions
          </p>
        </div>
        <RangeToggle />
      </div>

      {/* API Account Balances */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {BALANCES.map((b) => {
          const isLow = b.balance <= b.alertAt;
          return (
            <Card key={b.provider}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Wallet className={`h-4 w-4 ${b.color}`} />
                  <CardTitle>{b.provider}</CardTitle>
                </div>
                {isLow && <AlertTriangle className="h-4 w-4 text-red-400" />}
              </div>
              <CardValue className={`text-2xl ${isLow ? "text-red-400" : ""}`}>
                ${b.balance.toFixed(2)}
              </CardValue>
              <CardFooter>{b.note} · Alert at ${b.alertAt}</CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Low balance alerts */}
      {warnings.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div className="flex items-start gap-2 text-sm text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <strong>Low balance:</strong>{" "}
              <span className="text-zinc-300">
                {warnings.map((w) => `${w.provider} is at $${w.balance.toFixed(2)}`).join(" · ")}
                . Time to top up.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Token stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
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

      {/* Daily Spend Deductions */}
      <Card className="mt-6">
        <CardTitle className="mb-4">Daily Spend ({rangeLabel(range)})</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-500">
                <th className="pb-2 pr-4 font-medium">Day</th>
                <th className="pb-2 pr-4 font-medium text-right">Perplexity</th>
                <th className="pb-2 pr-4 font-medium text-right">Balance</th>
                <th className="pb-2 pr-4 font-medium text-right">DeepSeek</th>
                <th className="pb-2 pr-4 font-medium text-right">Balance</th>
                <th className="pb-2 pr-4 font-medium text-right">TTS</th>
                <th className="pb-2 pr-4 font-medium text-right">Balance</th>
                <th className="pb-2 font-medium text-right">Day Total</th>
              </tr>
            </thead>
            <tbody>
              {runningBalances.map((r) => (
                <tr key={r.day} className="border-b border-zinc-800/50">
                  <td className="py-2 pr-4 font-mono text-zinc-300">
                    {new Date(r.day).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-blue-400">
                    -{fmt(r.perplexity_spend)}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-zinc-500">
                    {fmt(r.perplexity_balance)}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-emerald-400">
                    -{fmt(r.deepseek_spend)}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-zinc-500">
                    {fmt(r.deepseek_balance)}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-amber-400">
                    -{fmt(r.tts_spend)}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-zinc-500">
                    {fmt(r.tts_balance)}
                  </td>
                  <td className="py-2 text-right font-mono font-semibold text-zinc-100">
                    -{fmt(r.total_spend)}
                  </td>
                </tr>
              ))}
              {runningBalances.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-zinc-600">No data in this range</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-8 text-center text-xs text-zinc-600">
        Balances are manually set · Update in costs/page.tsx when you top up
      </div>
    </main>
  );
}
