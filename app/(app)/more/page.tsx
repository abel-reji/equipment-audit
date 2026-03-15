"use client";

import Link from "next/link";
import { BarChart3, ChevronRight, Map } from "lucide-react";

import { AppShell } from "@/components/app-shell";

export default function MorePage() {
  return (
    <AppShell
      title="More"
      description="Secondary tools that do not need a dedicated spot in the main mobile nav."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Link
          href="/reports"
          className="panel flex items-center justify-between p-5 transition hover:border-moss/40 hover:bg-white/90 md:p-6"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
              Reports
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Reporting</h2>
            <p className="mt-2 text-sm text-slate">
              Review summary outputs, exports, and reporting workflows.
            </p>
          </div>
          <div className="flex items-center gap-3 text-slate">
            <BarChart3 className="h-6 w-6" />
            <ChevronRight className="h-5 w-5" />
          </div>
        </Link>

        <Link
          href="/maps"
          className="panel flex items-center justify-between p-5 transition hover:border-moss/40 hover:bg-white/90 md:p-6"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
              Maps
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Mapping</h2>
            <p className="mt-2 text-sm text-slate">
              Open geotagged assets and future map-based location tools.
            </p>
          </div>
          <div className="flex items-center gap-3 text-slate">
            <Map className="h-6 w-6" />
            <ChevronRight className="h-5 w-5" />
          </div>
        </Link>
      </div>
    </AppShell>
  );
}
