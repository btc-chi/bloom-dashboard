import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number; // 0-100
  label: string;
  amount: string;
  color?: string;
  className?: string;
}

export function Progress({ value, label, amount, color = "bg-zinc-50", className }: ProgressProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-400">{label}</span>
        <span className="font-mono text-zinc-300">{amount}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-zinc-800">
        <div
          className={cn("h-2 rounded-full transition-all duration-500", color)}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}
