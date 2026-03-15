"use client";

import { AppShell, ContextBar } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";

export default function ReportsPage() {
  return (
    <AppShell
      title="Reports"
      description="Summary and export tools can live here as reporting requirements get clearer."
      contextBar={
        <ContextBar items={[{ label: "More", href: "/more" }, { label: "Reports" }]} />
      }
    >
      <section className="panel p-5 md:p-6">
        <EmptyState
          title="Reports are not built yet"
          body="This page is ready for the first reporting slice when you want asset summaries, exports, or site-level rollups."
        />
      </section>
    </AppShell>
  );
}
