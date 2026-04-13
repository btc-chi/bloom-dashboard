import { supabase } from "./supabase";
import { Range, rangeStart } from "./range";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DailyStat {
  day: string;
  active_users: number;
  total_calls: number;
  perplexity_cost: number;
  deepseek_cost: number;
  tts_cost: number;
  total_cost_usd: number;
}

export interface UserStat {
  user_id: string;
  access_state: string;
  total_calls: number;
  perplexity_calls: number;
  deepseek_calls: number;
  tts_calls: number;
  total_cost_usd: number;
  first_seen: string;
  last_seen: string;
}

export interface Summary {
  total_answers: number;
  unique_users: number;
  perplexity_answers: number;
  deepseek_answers: number;
  perplexity_pct: number;
  avg_llm_cost: number;
  avg_tts_cost: number;
  avg_cost_per_answer: number;
  total_llm_cost: number;
  total_tts_cost: number;
  total_perplexity_cost: number;
  total_deepseek_cost: number;
  total_cost: number;
  cost_per_user: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tts_chars: number;
  avg_input_tokens: number;
  avg_output_tokens: number;
}

export interface ActiveUsers {
  dau: number;
  wau: number;
  mau: number;
  all_time: number;
  stickiness: number; // DAU/MAU ratio
  new_users_24h: number;
  new_users_7d: number;
}

export interface Trend {
  today_cost: number;
  yesterday_cost: number;
  week_cost: number;
  month_cost: number;
  delta_vs_yesterday: number;
}

export interface AnswerDetail {
  created_at: string;
  user_id: string;
  provider: string;
  input_tokens: number | null;
  output_tokens: number | null;
  llm_cost: number;
  tts_chars: number | null;
  tts_cost: number;
  total_cost: number;
  access_state: string | null;
}

// ---------------------------------------------------------------------------
// Core fetchers — all respect a time range
// ---------------------------------------------------------------------------

export async function fetchSummary(range: Range): Promise<Summary> {
  const start = rangeStart(range);
  const { data, error } = await supabase
    .from("api_usage")
    .select("provider, cost_usd, input_tokens, output_tokens, character_count, user_id, access_state")
    .gte("created_at", start);

  if (error) {
    console.error("[fetchSummary] failed:", JSON.stringify(error, null, 2));
    return emptySummary();
  }
  if (!data || data.length === 0) return emptySummary();

  const llmRows = data.filter((r: any) => r.provider !== "openai_tts");
  const ttsRows = data.filter((r: any) => r.provider === "openai_tts");
  const perplexityRows = data.filter((r: any) => r.provider === "perplexity");
  const deepseekRows = data.filter((r: any) => r.provider === "deepseek");
  const uniqueUsers = new Set(data.map((r: any) => r.user_id)).size;

  const totalLlmCost = llmRows.reduce((s: number, r: any) => s + (Number(r.cost_usd) || 0), 0);
  const totalTtsCost = ttsRows.reduce((s: number, r: any) => s + (Number(r.cost_usd) || 0), 0);
  const totalPerplexityCost = perplexityRows.reduce((s: number, r: any) => s + (Number(r.cost_usd) || 0), 0);
  const totalDeepseekCost = deepseekRows.reduce((s: number, r: any) => s + (Number(r.cost_usd) || 0), 0);
  const totalCost = totalLlmCost + totalTtsCost;

  const totalInputTokens = llmRows.reduce((s: number, r: any) => s + (Number(r.input_tokens) || 0), 0);
  const totalOutputTokens = llmRows.reduce((s: number, r: any) => s + (Number(r.output_tokens) || 0), 0);
  const totalTtsChars = ttsRows.reduce((s: number, r: any) => s + (Number(r.character_count) || 0), 0);

  return {
    total_answers: llmRows.length,
    unique_users: uniqueUsers,
    perplexity_answers: perplexityRows.length,
    deepseek_answers: deepseekRows.length,
    perplexity_pct: llmRows.length > 0 ? Math.round((perplexityRows.length / llmRows.length) * 100) : 0,
    avg_llm_cost: llmRows.length > 0 ? totalLlmCost / llmRows.length : 0,
    avg_tts_cost: ttsRows.length > 0 ? totalTtsCost / ttsRows.length : 0,
    avg_cost_per_answer: llmRows.length > 0 ? totalCost / llmRows.length : 0,
    total_llm_cost: totalLlmCost,
    total_tts_cost: totalTtsCost,
    total_perplexity_cost: totalPerplexityCost,
    total_deepseek_cost: totalDeepseekCost,
    total_cost: totalCost,
    cost_per_user: uniqueUsers > 0 ? totalCost / uniqueUsers : 0,
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    total_tts_chars: totalTtsChars,
    avg_input_tokens: llmRows.length > 0 ? Math.round(totalInputTokens / llmRows.length) : 0,
    avg_output_tokens: llmRows.length > 0 ? Math.round(totalOutputTokens / llmRows.length) : 0,
  };
}

/**
 * DAU / WAU / MAU + all-time user count + stickiness.
 * These are FIXED windows (always 24h, 7d, 30d) — NOT tied to the UI range toggle.
 * The range toggle affects cost/usage metrics but not these product metrics.
 */
export async function fetchActiveUsers(): Promise<ActiveUsers> {
  const now = new Date();
  const day = new Date(now); day.setDate(day.getDate() - 1);
  const week = new Date(now); week.setDate(week.getDate() - 7);
  const month = new Date(now); month.setDate(month.getDate() - 30);

  // One query for the last 30 days, derive DAU/WAU/MAU from it in JS
  const { data: recent } = await supabase
    .from("api_usage")
    .select("user_id, created_at")
    .gte("created_at", month.toISOString());

  const dauSet = new Set<string>();
  const wauSet = new Set<string>();
  const mauSet = new Set<string>();
  const firstSeen = new Map<string, Date>();

  for (const row of recent ?? []) {
    const ts = new Date(row.created_at);
    if (ts >= day) dauSet.add(row.user_id);
    if (ts >= week) wauSet.add(row.user_id);
    if (ts >= month) mauSet.add(row.user_id);
    const prev = firstSeen.get(row.user_id);
    if (!prev || ts < prev) firstSeen.set(row.user_id, ts);
  }

  // All-time user count: need a distinct count across all of api_usage
  const { data: allRows } = await supabase
    .from("api_usage")
    .select("user_id, created_at")
    .order("created_at", { ascending: true });

  const allTimeSet = new Set<string>();
  const firstEverSeen = new Map<string, Date>();
  for (const row of allRows ?? []) {
    allTimeSet.add(row.user_id);
    if (!firstEverSeen.has(row.user_id)) {
      firstEverSeen.set(row.user_id, new Date(row.created_at));
    }
  }

  // New users: first-ever timestamp within last 24h / 7d
  let newUsers24h = 0;
  let newUsers7d = 0;
  for (const [, firstTs] of firstEverSeen) {
    if (firstTs >= day) newUsers24h++;
    if (firstTs >= week) newUsers7d++;
  }

  const mau = mauSet.size;
  const dau = dauSet.size;

  return {
    dau,
    wau: wauSet.size,
    mau,
    all_time: allTimeSet.size,
    stickiness: mau > 0 ? Math.round((dau / mau) * 100) : 0,
    new_users_24h: newUsers24h,
    new_users_7d: newUsers7d,
  };
}

export async function fetchTopUsers(range: Range, limit = 10): Promise<UserStat[]> {
  const start = rangeStart(range);
  const { data, error } = await supabase
    .from("api_usage")
    .select("user_id, provider, cost_usd, access_state, created_at")
    .gte("created_at", start);

  if (error) {
    console.error("[fetchTopUsers] failed:", JSON.stringify(error, null, 2));
    return [];
  }
  if (!data || data.length === 0) return [];

  const byUser = new Map<string, Omit<UserStat, "user_id"> & { firstTs: Date; lastTs: Date }>();

  for (const row of data) {
    const existing = byUser.get(row.user_id);
    const ts = new Date(row.created_at);
    if (!existing) {
      byUser.set(row.user_id, {
        access_state: row.access_state ?? "unknown",
        total_calls: 0,
        perplexity_calls: 0,
        deepseek_calls: 0,
        tts_calls: 0,
        total_cost_usd: 0,
        firstTs: ts,
        lastTs: ts,
        first_seen: ts.toISOString(),
        last_seen: ts.toISOString(),
      });
    }
    const u = byUser.get(row.user_id)!;
    u.total_calls++;
    u.total_cost_usd += Number(row.cost_usd) || 0;
    if (row.provider === "perplexity") u.perplexity_calls++;
    else if (row.provider === "deepseek") u.deepseek_calls++;
    else if (row.provider === "openai_tts") u.tts_calls++;
    if (row.access_state) u.access_state = row.access_state;
    if (ts < u.firstTs) u.firstTs = ts;
    if (ts > u.lastTs) u.lastTs = ts;
  }

  return Array.from(byUser.entries())
    .map(([user_id, u]) => ({
      user_id,
      access_state: u.access_state,
      total_calls: u.total_calls,
      perplexity_calls: u.perplexity_calls,
      deepseek_calls: u.deepseek_calls,
      tts_calls: u.tts_calls,
      total_cost_usd: Number(u.total_cost_usd.toFixed(6)),
      first_seen: u.firstTs.toISOString(),
      last_seen: u.lastTs.toISOString(),
    }))
    .sort((a, b) => b.total_cost_usd - a.total_cost_usd)
    .slice(0, limit);
}

export async function fetchDailyBurn(range: Range): Promise<DailyStat[]> {
  const start = rangeStart(range);

  const { data, error } = await supabase
    .from("api_usage")
    .select("created_at, user_id, provider, cost_usd")
    .gte("created_at", start);

  if (error) {
    console.error("[fetchDailyBurn] failed:", JSON.stringify(error, null, 2));
    return [];
  }
  if (!data || data.length === 0) return [];

  // For short ranges (<=24h), bucket by hour instead of day
  const useHourly = range === "1h" || range === "6h" || range === "24h";

  const byBucket = new Map<string, {
    users: Set<string>;
    calls: number;
    perplexity: number;
    deepseek: number;
    tts: number;
    total: number;
  }>();

  for (const row of data) {
    const ts = new Date(row.created_at);
    const bucket = useHourly
      ? `${ts.toISOString().slice(0, 13)}:00`
      : ts.toISOString().slice(0, 10);
    if (!byBucket.has(bucket)) {
      byBucket.set(bucket, { users: new Set(), calls: 0, perplexity: 0, deepseek: 0, tts: 0, total: 0 });
    }
    const b = byBucket.get(bucket)!;
    b.users.add(row.user_id);
    b.calls++;
    const cost = Number(row.cost_usd) || 0;
    b.total += cost;
    if (row.provider === "perplexity") b.perplexity += cost;
    else if (row.provider === "deepseek") b.deepseek += cost;
    else if (row.provider === "openai_tts") b.tts += cost;
  }

  return Array.from(byBucket.entries())
    .map(([day, b]) => ({
      day,
      active_users: b.users.size,
      total_calls: b.calls,
      perplexity_cost: Number(b.perplexity.toFixed(6)),
      deepseek_cost: Number(b.deepseek.toFixed(6)),
      tts_cost: Number(b.tts.toFixed(6)),
      total_cost_usd: Number(b.total.toFixed(6)),
    }))
    .sort((a, b) => b.day.localeCompare(a.day));
}

export async function fetchTrend(): Promise<Trend> {
  // Trend is fixed-window: always compares today vs yesterday vs week vs month
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("api_usage")
    .select("created_at, cost_usd")
    .gte("created_at", monthStart.toISOString());

  if (error || !data) {
    return { today_cost: 0, yesterday_cost: 0, week_cost: 0, month_cost: 0, delta_vs_yesterday: 0 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  let todayCost = 0, yesterdayCost = 0, weekCost = 0, monthCost = 0;
  for (const row of data) {
    const ts = new Date(row.created_at);
    const cost = Number(row.cost_usd) || 0;
    monthCost += cost;
    if (ts >= weekAgo) weekCost += cost;
    if (ts >= today) todayCost += cost;
    else if (ts >= yesterday) yesterdayCost += cost;
  }

  const delta = yesterdayCost > 0 ? ((todayCost - yesterdayCost) / yesterdayCost) * 100 : 0;

  return {
    today_cost: Number(todayCost.toFixed(6)),
    yesterday_cost: Number(yesterdayCost.toFixed(6)),
    week_cost: Number(weekCost.toFixed(6)),
    month_cost: Number(monthCost.toFixed(6)),
    delta_vs_yesterday: Number(delta.toFixed(1)),
  };
}

export async function fetchRecentAnswers(range: Range, limit = 20): Promise<AnswerDetail[]> {
  const start = rangeStart(range);
  const { data, error } = await supabase
    .from("api_usage")
    .select("created_at, user_id, provider, input_tokens, output_tokens, character_count, cost_usd, access_state")
    .gte("created_at", start)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const llmCalls = data.filter((r: any) => r.provider !== "openai_tts");
  const ttsCalls = data.filter((r: any) => r.provider === "openai_tts");

  return llmCalls.slice(0, limit).map((llm: any) => {
    const llmTime = new Date(llm.created_at).getTime();
    const tts = ttsCalls.find((t: any) => {
      if (t.user_id !== llm.user_id) return false;
      const diff = new Date(t.created_at).getTime() - llmTime;
      return diff >= 0 && diff <= 10_000;
    });

    const llmCost = Number(llm.cost_usd) || 0;
    const ttsCost = tts ? Number(tts.cost_usd) || 0 : 0;

    return {
      created_at: llm.created_at,
      user_id: llm.user_id,
      provider: llm.provider,
      input_tokens: llm.input_tokens,
      output_tokens: llm.output_tokens,
      llm_cost: Number(llmCost.toFixed(6)),
      tts_chars: tts?.character_count ?? null,
      tts_cost: Number(ttsCost.toFixed(6)),
      total_cost: Number((llmCost + ttsCost).toFixed(6)),
      access_state: llm.access_state,
    };
  });
}

function emptySummary(): Summary {
  return {
    total_answers: 0, unique_users: 0, perplexity_answers: 0,
    deepseek_answers: 0, perplexity_pct: 0, avg_llm_cost: 0,
    avg_tts_cost: 0, avg_cost_per_answer: 0, total_llm_cost: 0,
    total_tts_cost: 0, total_perplexity_cost: 0, total_deepseek_cost: 0,
    total_cost: 0, cost_per_user: 0,
    total_input_tokens: 0, total_output_tokens: 0, total_tts_chars: 0,
    avg_input_tokens: 0, avg_output_tokens: 0,
  };
}
