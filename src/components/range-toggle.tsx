"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const RANGES = [
  { value: "1h",  label: "1H" },
  { value: "6h",  label: "6H" },
  { value: "24h", label: "24H" },
  { value: "7d",  label: "7D" },
  { value: "30d", label: "30D" },
  { value: "all", label: "All" },
];

export function RangeToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("range") ?? "30d";

  const setRange = (r: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("range", r);
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="inline-flex items-center gap-0 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
      {RANGES.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setRange(value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            current === value
              ? "bg-zinc-800 text-zinc-50"
              : "text-zinc-500 hover:text-zinc-300",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
