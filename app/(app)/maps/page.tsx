"use client";

import { AppShell, ContextBar } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";

export default function MapsPage() {
  return (
    <AppShell
      title="Maps"
      description="Map-based workflows can live here once geotagged asset navigation becomes a priority."
      contextBar={
        <ContextBar items={[{ label: "More", href: "/more" }, { label: "Maps" }]} />
      }
    >
      <section className="panel p-5 md:p-6">
        <EmptyState
          title="Maps are not built yet"
          body="This page is ready for a future geotagged asset map, open-in-maps actions, or location-based browsing."
        />
      </section>
    </AppShell>
  );
}
