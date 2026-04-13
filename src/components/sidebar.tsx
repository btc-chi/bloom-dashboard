"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Activity,
  DollarSign,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/costs", label: "Costs", icon: DollarSign },
  { href: "/routing", label: "Routing", icon: Activity, soon: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "sticky top-0 h-screen shrink-0 border-r border-zinc-900 bg-zinc-950 transition-all duration-200",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className="flex h-full flex-col">
        {/* Brand + collapse */}
        <div className="flex items-center justify-between px-4 py-4">
          {!collapsed && (
            <span className="text-lg font-semibold tracking-tight">Bloom API</span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 px-2">
          {NAV.map(({ href, label, icon: Icon, soon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={soon ? "#" : href}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-zinc-900 text-zinc-50"
                    : soon
                      ? "text-zinc-600 cursor-not-allowed"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100",
                )}
                onClick={(e) => soon && e.preventDefault()}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1">{label}</span>
                    {soon && <span className="text-[10px] text-zinc-600">soon</span>}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="mt-auto border-t border-zinc-900 p-4">
            <div className="text-xs text-zinc-600">
              Bloom Dashboard
              <br />
              <span className="font-mono">v0.3</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
