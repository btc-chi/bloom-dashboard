import { fetchTopUsers, fetchActiveUsers } from "@/lib/queries";
import { Card, CardTitle, CardValue, CardFooter } from "@/components/ui/card";
import { RangeToggle } from "@/components/range-toggle";
import { parseRange, rangeLabel } from "@/lib/range";
import { Flame, Users as UsersIcon, UserPlus, Activity } from "lucide-react";

export const revalidate = 60;

function fmt(n: number, decimals = 4): string {
  return `$${n.toFixed(decimals)}`;
}

function mask(id: string): string {
  return id.slice(0, 12);
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = parseRange(params.range);

  const [topUsers, active] = await Promise.all([
    fetchTopUsers(range, 50),
    fetchActiveUsers(),
  ]);

  // Derived metrics
  const stickinessLabel =
    active.stickiness >= 30 ? "Great (>30%)" :
    active.stickiness >= 20 ? "Solid (>20%)" :
    active.stickiness >= 10 ? "Okay" :
    "Low";

  const stickinessColor =
    active.stickiness >= 30 ? "text-emerald-400" :
    active.stickiness >= 20 ? "text-blue-400" :
    active.stickiness >= 10 ? "text-amber-400" :
    "text-red-400";

  // Tier breakdown of users in this range
  const tierCounts = topUsers.reduce(
    (acc, u) => {
      if (u.access_state === "subscriber") acc.subscriber++;
      else if (u.access_state === "trial") acc.trial++;
      else if (u.access_state === "free_limited") acc.free++;
      else acc.other++;
      return acc;
    },
    { subscriber: 0, trial: 0, free: 0, other: 0 },
  );

  return (
    <main className="mx-auto max-w-6xl px-8 py-10">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Activity, stickiness, and per-user cost breakdown
          </p>
        </div>
        <RangeToggle />
      </div>

      {/* Active user metrics (fixed windows) */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Flame className="h-4 w-4 text-orange-400" />
            <CardTitle>DAU</CardTitle>
          </div>
          <CardValue>{active.dau}</CardValue>
          <CardFooter>Last 24 hours</CardFooter>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-2">
            <UsersIcon className="h-4 w-4 text-blue-400" />
            <CardTitle>WAU</CardTitle>
          </div>
          <CardValue>{active.wau}</CardValue>
          <CardFooter>Last 7 days</CardFooter>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-2">
            <UsersIcon className="h-4 w-4 text-emerald-400" />
            <CardTitle>MAU</CardTitle>
          </div>
          <CardValue>{active.mau}</CardValue>
          <CardFooter>Last 30 days</CardFooter>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-zinc-400" />
            <CardTitle>Stickiness</CardTitle>
          </div>
          <CardValue className={stickinessColor}>{active.stickiness}%</CardValue>
          <CardFooter>{stickinessLabel} · DAU/MAU</CardFooter>
        </Card>
      </div>

      {/* Growth + tier split */}
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <UserPlus className="h-4 w-4 text-zinc-500" />
            <CardTitle>All-time</CardTitle>
          </div>
          <CardValue>{active.all_time}</CardValue>
          <CardFooter>Ever tracked</CardFooter>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-2">
            <UserPlus className="h-4 w-4 text-blue-400" />
            <CardTitle>New (24h)</CardTitle>
          </div>
          <CardValue>{active.new_users_24h}</CardValue>
          <CardFooter>First-time today</CardFooter>
        </Card>

        <Card>
          <div className="flex items-center gap-2 mb-2">
            <UserPlus className="h-4 w-4 text-emerald-400" />
            <CardTitle>New (7d)</CardTitle>
          </div>
          <CardValue>{active.new_users_7d}</CardValue>
          <CardFooter>First-time this week</CardFooter>
        </Card>

        <Card>
          <CardTitle className="mb-2">Tier Split</CardTitle>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-emerald-400">Subscriber</span>
              <span className="font-mono text-zinc-300">{tierCounts.subscriber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-400">Trial</span>
              <span className="font-mono text-zinc-300">{tierCounts.trial}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Free limited</span>
              <span className="font-mono text-zinc-300">{tierCounts.free}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-600">Other</span>
              <span className="font-mono text-zinc-500">{tierCounts.other}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Full user table */}
      <Card className="mt-6">
        <CardTitle className="mb-4">All Users ({rangeLabel(range)})</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-500">
                <th className="pb-2 pr-4 font-medium">User</th>
                <th className="pb-2 pr-4 font-medium">Access</th>
                <th className="pb-2 pr-4 font-medium text-right">Perplexity</th>
                <th className="pb-2 pr-4 font-medium text-right">DeepSeek</th>
                <th className="pb-2 pr-4 font-medium text-right">TTS</th>
                <th className="pb-2 pr-4 font-medium">First seen</th>
                <th className="pb-2 pr-4 font-medium">Last seen</th>
                <th className="pb-2 font-medium text-right">Total $</th>
              </tr>
            </thead>
            <tbody>
              {topUsers.map((u) => (
                <tr key={u.user_id} className="border-b border-zinc-800/50">
                  <td className="py-2 pr-4 font-mono text-xs text-zinc-400">{mask(u.user_id)}</td>
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
                  <td className="py-2 pr-4 text-xs text-zinc-500">{relTime(u.first_seen)}</td>
                  <td className="py-2 pr-4 text-xs text-zinc-500">{relTime(u.last_seen)}</td>
                  <td className="py-2 text-right font-mono font-semibold text-zinc-100">{fmt(u.total_cost_usd)}</td>
                </tr>
              ))}
              {topUsers.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-zinc-600">No users in this range</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-8 text-center text-xs text-zinc-600">
        DAU/WAU/MAU are always fixed windows · Table respects range toggle
      </div>
    </main>
  );
}
