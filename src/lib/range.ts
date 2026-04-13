/**
 * Time range helpers. Ranges are passed via URL search param `?range=`.
 *
 * Supported values: 1h, 6h, 24h, 7d, 30d, all
 * Default: 30d
 */

export type Range = "1h" | "6h" | "24h" | "7d" | "30d" | "all";

export function parseRange(v: string | undefined | null): Range {
  const allowed: Range[] = ["1h", "6h", "24h", "7d", "30d", "all"];
  return (allowed.includes(v as Range) ? (v as Range) : "30d");
}

/** Returns ISO timestamp for the start of the range (or 2020-01-01 for "all"). */
export function rangeStart(range: Range): string {
  const now = new Date();
  switch (range) {
    case "1h":
      now.setHours(now.getHours() - 1);
      return now.toISOString();
    case "6h":
      now.setHours(now.getHours() - 6);
      return now.toISOString();
    case "24h":
      now.setDate(now.getDate() - 1);
      return now.toISOString();
    case "7d":
      now.setDate(now.getDate() - 7);
      return now.toISOString();
    case "30d":
      now.setDate(now.getDate() - 30);
      return now.toISOString();
    case "all":
      return new Date("2020-01-01").toISOString();
  }
}

export function rangeLabel(range: Range): string {
  switch (range) {
    case "1h":  return "last hour";
    case "6h":  return "last 6 hours";
    case "24h": return "last 24 hours";
    case "7d":  return "last 7 days";
    case "30d": return "last 30 days";
    case "all": return "all time";
  }
}

/** For projecting monthly cost. Only 24h+ ranges produce a useful projection. */
export function daysLeftInMonth(): number {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return last.getDate() - now.getDate() + 1;
}
