import { NextRequest, NextResponse } from "next/server";
import { fetchSummary, fetchTrend, fetchDailyBurn } from "@/lib/queries";
import { parseRange } from "@/lib/range";

/**
 * JSON summary endpoint — for external monitoring, daily email digests,
 * Slack bots, or anything else.
 *
 * GET /api/summary?range=30d
 *   range: 1h | 6h | 24h | 7d | 30d | all (default: 30d)
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const range = parseRange(url.searchParams.get("range"));

  try {
    const [summary, trend, daily] = await Promise.all([
      fetchSummary(range),
      fetchTrend(),
      fetchDailyBurn(range),
    ]);

    return NextResponse.json({
      ok: true,
      range,
      timestamp: new Date().toISOString(),
      summary,
      trend,
      daily: daily.slice(0, 14),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
