import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * Vercel Cron endpoint. Runs daily at 00:05 UTC (scheduled in vercel.json).
 *
 * 1. Calls Supabase's snapshot_daily_usage() function which rolls up
 *    yesterday's data into daily_snapshots.
 * 2. Returns a summary of today's usage for observability.
 *
 * Security: Vercel Cron automatically sets an Authorization header
 * with CRON_SECRET. We verify that to prevent unauthorized triggers.
 */
export async function GET(req: NextRequest) {
  // Verify Vercel cron secret (set in Vercel env + vercel.json cron config)
  const authHeader = req.headers.get("authorization") || "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (process.env.CRON_SECRET && authHeader !== expected) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    // Trigger the Supabase function that snapshots yesterday's data
    const { error: rpcError } = await supabase.rpc("snapshot_daily_usage");
    if (rpcError) {
      console.error("[cron/snapshot] RPC failed:", rpcError);
      return NextResponse.json({ ok: false, error: rpcError.message }, { status: 500 });
    }

    // Return today's running totals for logs/observability
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: todayRows } = await supabase
      .from("api_usage")
      .select("provider, cost_usd, user_id")
      .gte("created_at", today.toISOString());

    const todayCost =
      todayRows?.reduce((s: number, r: any) => s + (Number(r.cost_usd) || 0), 0) ?? 0;
    const todayUsers = new Set(todayRows?.map((r: any) => r.user_id) ?? []).size;
    const todayCalls = todayRows?.length ?? 0;

    return NextResponse.json({
      ok: true,
      message: "Daily snapshot completed",
      today: {
        cost: Number(todayCost.toFixed(4)),
        users: todayUsers,
        calls: todayCalls,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[cron/snapshot] unhandled error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    );
  }
}
