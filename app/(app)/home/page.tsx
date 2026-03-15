"use client";

import Link from "next/link";
import { ChevronRight, MapPinned, Rocket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { SyncStatusPill } from "@/components/sync-status-pill";
import { getLocalDb } from "@/lib/local-db";
import { seedCustomers, seedSites } from "@/lib/local-data";
import type { AssetDraft, CachedCustomer, CachedSite } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";

interface ServerAsset {
  id: string;
  equipment_tag?: string | null;
  equipment_type: string;
  manufacturer?: string | null;
  temporary_identifier?: string | null;
  capture_status: AssetDraft["captureStatus"];
  updated_at: string;
}

export default function HomePage() {
  const [recentSites, setRecentSites] = useState<CachedSite[]>([]);
  const [localAssets, setLocalAssets] = useState<AssetDraft[]>([]);
  const [serverAssets, setServerAssets] = useState<ServerAsset[]>([]);
  const [customers, setCustomers] = useState<CachedCustomer[]>([]);
  const [queuedAssetCount, setQueuedAssetCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    async function load() {
      const db = getLocalDb();
      const [localSites, draftAssets, localCustomers] = await Promise.all([
        db.sites.toArray(),
        db.assetDrafts.orderBy("updatedAt").reverse().toArray(),
        db.customers.orderBy("name").toArray()
      ]);

      setRecentSites(sortRecentSites(localSites));
      setLocalAssets(draftAssets);
      setCustomers(localCustomers);
      setQueuedAssetCount(
        draftAssets.filter((asset) => asset.captureStatus !== "synced").length
      );

      try {
        const [bootstrapResponse, assetsResponse] = await Promise.all([
          fetch("/api/bootstrap", { cache: "no-store" }),
          fetch("/api/assets", { cache: "no-store" })
        ]);

        if (bootstrapResponse.ok) {
          const data = await bootstrapResponse.json();
          await seedCustomers(data.customers ?? []);
          await seedSites(data.sites ?? []);
          const [seededSites, seededCustomers] = await Promise.all([
            db.sites.toArray(),
            db.customers.orderBy("name").toArray()
          ]);
          setRecentSites(sortRecentSites(seededSites));
          setCustomers(seededCustomers);
        }

        if (assetsResponse.ok) {
          const data = await assetsResponse.json();
          setServerAssets(data.assets ?? []);
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

  const recentAssets = useMemo(() => {
    const localByServerId = new Map(
      localAssets
        .filter((asset) => asset.serverId)
        .map((asset) => [asset.serverId as string, asset])
    );

    const mergedServerAssets = serverAssets.map((asset) => ({
      id: localByServerId.get(asset.id)?.id ?? asset.id,
      href: `/assets/${encodeURIComponent(asset.id)}`,
      equipmentType: asset.equipment_type,
      equipmentTag:
        localByServerId.get(asset.id)?.equipmentTag ?? asset.equipment_tag ?? undefined,
      manufacturer:
        localByServerId.get(asset.id)?.manufacturer ??
        asset.manufacturer ??
        localByServerId.get(asset.id)?.temporaryIdentifier ??
        asset.temporary_identifier ??
        undefined,
      updatedAt: localByServerId.get(asset.id)?.updatedAt ?? asset.updated_at,
      status: localByServerId.get(asset.id)?.captureStatus ?? asset.capture_status
    }));

    const localOnlyAssets = localAssets
      .filter(
        (asset) =>
          !asset.serverId || !serverAssets.some((serverAsset) => serverAsset.id === asset.serverId)
      )
      .map((asset) => ({
        id: asset.id,
        href: `/assets/${encodeURIComponent(asset.id)}`,
        equipmentType: asset.equipmentType,
        equipmentTag: asset.equipmentTag,
        manufacturer: asset.manufacturer || asset.temporaryIdentifier,
        updatedAt: asset.updatedAt,
        status: asset.captureStatus
      }));

    return [...localOnlyAssets, ...mergedServerAssets]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 3);
  }, [localAssets, serverAssets]);

  return (
    <AppShell title="Field Capture">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="panel p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                Quick Start
              </p>
            </div>
            <Rocket className="h-7 w-7 text-moss" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link href="/sites" className="button-primary">
              Pick site
            </Link>
            <Link href="/more" className="button-secondary">
              More
            </Link>
          </div>
        </section>

        <section className="panel p-5 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
            Status
          </p>
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
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                      {customers.find(
                        (customer) =>
                          customer.id === site.customerId ||
                          customer.serverId === site.customerServerId
                      )?.name || "Unknown customer"}
                    </div>
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
                body=""
                action={
                  <Link href="/sites" className="button-primary">
                    Sites
                  </Link>
                }
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
            </div>
            <MotorIcon className="h-6 w-6 text-slate" />
          </div>

          <div className="mt-5 space-y-3">
            {recentAssets.length ? (
              recentAssets.map((asset) => (
                <Link
                  key={asset.id}
                  href={asset.href}
                  className="block rounded-3xl border border-ink/10 bg-white px-4 py-4 transition hover:border-moss/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold capitalize text-ink">
                        {asset.equipmentType}
                        {asset.equipmentTag ? ` | ${asset.equipmentTag}` : ""}
                      </div>
                      <div className="mt-1 text-sm text-slate">
                        {asset.manufacturer || "No manufacturer or temp ID"}
                      </div>
                      <div className="mt-2 text-xs text-slate">
                        Updated {formatRelativeDate(asset.updatedAt)}
                      </div>
                    </div>
                    <SyncStatusPill status={asset.status} />
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

function MotorIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="14" y="18" width="36" height="28" rx="6" />
      <path d="M18 12h28" />
      <path d="M22 8h20v4H22z" />
      <path d="M18 52h28" />
      <path d="M22 52h20v4H22z" />
      <path d="M8 20v24" />
      <path d="M8 20h6v24H8" />
      <path d="M50 24h4a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-4" />
      <path d="M58 32h6" />
      <path d="M22 26h20" />
      <path d="M22 32h20" />
      <path d="M22 38h20" />
    </svg>
  );
}

function sortRecentSites(sites: CachedSite[]) {
  return [...sites]
    .sort((a, b) =>
      (b.lastUsedAt ?? b.updatedAt ?? "").localeCompare(a.lastUsedAt ?? a.updatedAt ?? "")
    )
    .slice(0, 3);
}
