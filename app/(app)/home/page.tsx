"use client";

import Link from "next/link";
import { Camera, ChevronRight, MapPinned, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { SyncStatusPill } from "@/components/sync-status-pill";
import { getLocalDb } from "@/lib/local-db";
import { seedCustomers, seedSites } from "@/lib/local-data";
import type { AssetDraft, CachedSite } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";

export default function HomePage() {
  const [recentSites, setRecentSites] = useState<CachedSite[]>([]);
  const [recentAssets, setRecentAssets] = useState<AssetDraft[]>([]);
  const [queuedAssetCount, setQueuedAssetCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    async function load() {
      const db = getLocalDb();
      const [localSites, localAssets] = await Promise.all([
        db.sites.orderBy("lastUsedAt").reverse().limit(6).toArray(),
        db.assetDrafts.orderBy("updatedAt").reverse().limit(6).toArray()
      ]);

      setRecentSites(localSites);
      setRecentAssets(localAssets);
      setQueuedAssetCount(
        localAssets.filter((asset) => asset.captureStatus !== "synced").length
      );

      try {
        const response = await fetch("/api/bootstrap", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          await seedCustomers(data.customers ?? []);
          await seedSites(data.sites ?? []);
          const seededSites = await db.sites.orderBy("lastUsedAt").reverse().limit(6).toArray();
          setRecentSites(seededSites);
        }
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);
  }, []);

  return (
    <AppShell
      title="Field Capture"
      description="Use recent site context, open draft assets, and push queued records when the network is stable."
    >
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="panel p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                Fast Start
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">
                Capture the next asset
              </h2>
            </div>
            <Camera className="h-8 w-8 text-moss" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link href="/sites" className="button-primary">
              Pick site
            </Link>
            <Link href="/search" className="button-secondary">
              Search customers or sites
            </Link>
          </div>
        </section>

        <section className="panel p-5 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
            Status
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">What matters now</h2>
          <div className="mt-5 grid gap-3">
            <StatusRow label="Recent sites" value={String(recentSites.length)} />
            <StatusRow label="Queued assets" value={String(queuedAssetCount)} />
            <StatusRow
              label="Offline persistence"
              value={isOnline === null ? "Checking" : isOnline ? "Active" : "Offline"}
            />
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="panel p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                Recent Sites
              </p>
              <h2 className="mt-2 text-xl font-semibold text-ink">Return to a plant area fast</h2>
            </div>
            <MapPinned className="h-6 w-6 text-slate" />
          </div>

          <div className="mt-5 space-y-3">
            {recentSites.length ? (
              recentSites.map((site) => (
                <Link
                  key={site.id}
                  href={`/sites/${encodeURIComponent(site.id)}`}
                  className="flex items-center justify-between rounded-3xl border border-ink/10 bg-white px-4 py-4 transition hover:border-moss/50"
                >
                  <div>
                    <div className="font-semibold text-ink">{site.name}</div>
                    <div className="text-sm text-slate">
                      {site.areaUnit || site.address || "No area noted"}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate" />
                </Link>
              ))
            ) : (
              <EmptyState
                title={loading ? "Loading site context" : "No sites yet"}
                body="Create or sync a site first so field capture can start with the right context."
                action={<Link href="/sites" className="button-primary">Open site picker</Link>}
              />
            )}
          </div>
        </section>

        <section className="panel p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                Recent Assets
              </p>
              <h2 className="mt-2 text-xl font-semibold text-ink">Open recent assets</h2>
            </div>
            <Search className="h-6 w-6 text-slate" />
          </div>

          <div className="mt-5 space-y-3">
            {recentAssets.length ? (
              recentAssets.map((asset) => (
                <Link
                  key={asset.id}
                  href={`/assets/${encodeURIComponent(asset.serverId ?? asset.id)}`}
                  className="block rounded-3xl border border-ink/10 bg-white px-4 py-4 transition hover:border-moss/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold capitalize text-ink">
                        {asset.equipmentType}
                        {asset.equipmentTag ? ` · ${asset.equipmentTag}` : ""}
                      </div>
                      <div className="mt-1 text-sm text-slate">
                        {asset.manufacturer || asset.temporaryIdentifier || "No manufacturer or temp ID"}
                      </div>
                      <div className="mt-2 text-xs text-slate">
                        Updated {formatRelativeDate(asset.updatedAt)}
                      </div>
                    </div>
                    <SyncStatusPill status={asset.captureStatus} />
                  </div>
                </Link>
              ))
            ) : (
              <EmptyState
                title="No captured assets yet"
                body="Once you save the first draft, it will appear here for quick reopen on mobile or desktop."
              />
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-mist px-4 py-3">
      <span className="text-sm text-slate">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}
