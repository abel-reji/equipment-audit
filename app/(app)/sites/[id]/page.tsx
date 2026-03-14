"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { SyncStatusPill } from "@/components/sync-status-pill";
import { getLocalDb } from "@/lib/local-db";
import { deleteSiteDraft, updateSiteDraft } from "@/lib/local-data";
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

export default function SiteDetailPage({
  params
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [site, setSite] = useState<CachedSite | null>(null);
  const [customers, setCustomers] = useState<CachedCustomer[]>([]);
  const [customer, setCustomer] = useState<CachedCustomer | null>(null);
  const [localAssets, setLocalAssets] = useState<AssetDraft[]>([]);
  const [serverAssets, setServerAssets] = useState<ServerAsset[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    customerId: "",
    name: "",
    address: "",
    areaUnit: "",
    notes: ""
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const db = getLocalDb();
      const localSite =
        (await db.sites.get(params.id)) ??
        (await db.sites.filter((entry) => entry.serverId === params.id).first());
      setCustomers(await db.customers.orderBy("name").toArray());

      if (!localSite) {
        setLoading(false);
        return;
      }

      setSite(localSite);

      const localCustomer =
        (await db.customers.get(localSite.customerId)) ??
        (await db.customers.filter((entry) => entry.serverId === localSite.customerServerId).first()) ??
        null;
      setCustomer(localCustomer);
      setForm({
        customerId: localSite.customerId,
        name: localSite.name,
        address: localSite.address || "",
        areaUnit: localSite.areaUnit || "",
        notes: localSite.notes || ""
      });

      const draftAssets = await db.assetDrafts
        .filter(
          (asset) =>
            asset.siteId === localSite.id ||
            asset.siteId === localSite.serverId ||
            asset.siteServerId === localSite.serverId
        )
        .toArray();
      setLocalAssets(draftAssets.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));

      if (localSite.serverId) {
        const response = await fetch(
          `/api/assets?siteId=${encodeURIComponent(localSite.serverId)}`,
          { cache: "no-store" }
        );

        if (response.ok) {
          const data = await response.json();
          setServerAssets(data.assets ?? []);
        }
      }

      setLoading(false);
    }

    void load();
  }, [params.id]);

  const visibleAssets = useMemo(() => {
    const localByServerId = new Map(
      localAssets
        .filter((asset) => asset.serverId)
        .map((asset) => [asset.serverId as string, asset])
    );

    const mergedServerAssets = serverAssets.map((asset) => ({
      id: asset.id,
      href: `/assets/${encodeURIComponent(asset.id)}`,
      equipmentType: asset.equipment_type,
      equipmentTag: asset.equipment_tag ?? undefined,
      manufacturer: asset.manufacturer ?? asset.temporary_identifier ?? undefined,
      updatedAt: asset.updated_at,
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

    return [...localOnlyAssets, ...mergedServerAssets].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  }, [localAssets, serverAssets]);

  async function handleSaveSite() {
    if (!site) {
      return;
    }

    const selectedCustomer = customers.find(
      (entry) => entry.id === form.customerId || entry.serverId === form.customerId
    );

    await updateSiteDraft(site.id, {
      customerId: selectedCustomer?.id ?? form.customerId,
      name: form.name,
      address: form.address,
      areaUnit: form.areaUnit,
      notes: form.notes
    });

    if (site.serverId) {
      const response = await fetch(`/api/sites/${encodeURIComponent(site.serverId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selectedCustomer?.serverId,
          name: form.name,
          address: form.address,
          areaUnit: form.areaUnit,
          notes: form.notes
        })
      });

      if (!response.ok) {
        throw new Error("Unable to update site");
      }
    }

    setSite((current) =>
      current
        ? {
            ...current,
            customerId: selectedCustomer?.id ?? form.customerId,
            customerServerId: selectedCustomer?.serverId,
            name: form.name,
            address: form.address,
            areaUnit: form.areaUnit,
            notes: form.notes,
            syncStatus: current.serverId ? "queued" : current.syncStatus,
            updatedAt: new Date().toISOString()
          }
        : current
    );
    setCustomer(selectedCustomer ?? null);
    setIsEditing(false);
  }

  async function handleDeleteSite() {
    if (!site) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this site? All assets saved under it will also be removed."
    );
    if (!confirmed) {
      return;
    }

    if (site.serverId) {
      const response = await fetch(`/api/sites/${encodeURIComponent(site.serverId)}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Unable to delete site");
      }
    }

    await deleteSiteDraft(site.id);
    router.push("/sites");
  }

  return (
    <AppShell
      title="Site Detail"
      description="Review the customer context for this site, inspect saved assets, and jump back into capture with the site already selected."
    >
      {loading ? (
        <EmptyState title="Loading site" body="Pulling site context and related assets." />
      ) : !site ? (
        <EmptyState title="Site not found" body="This site is not available in the local cache for the current device." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="panel p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
              Site Context
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">{isEditing ? "Edit site" : site.name}</h2>
            {isEditing ? (
              <div className="mt-5 space-y-4">
                <FormField label="Customer">
                  <select
                    className="field"
                    value={form.customerId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, customerId: event.target.value }))
                    }
                  >
                    <option value="">Select customer</option>
                    {customers.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Site name">
                  <input
                    className="field"
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Address">
                  <input
                    className="field"
                    value={form.address}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, address: event.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Area / unit">
                  <input
                    className="field"
                    value={form.areaUnit}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, areaUnit: event.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Notes">
                  <textarea
                    className="field min-h-24"
                    value={form.notes}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, notes: event.target.value }))
                    }
                  />
                </FormField>
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                <DetailRow label="Customer" value={customer?.name || "Unknown customer"} />
                <DetailRow label="Address" value={site.address || "No address entered"} />
                <DetailRow label="Area / unit" value={site.areaUnit || "No area or unit entered"} />
                <DetailRow label="Notes" value={site.notes || "No notes"} />
                <DetailRow label="Status" value={site.syncStatus} />
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {isEditing ? (
                <>
                  <button className="button-primary" type="button" onClick={() => void handleSaveSite()}>
                    Save changes
                  </button>
                  <button className="button-secondary" type="button" onClick={() => setIsEditing(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button className="button-primary" type="button" onClick={() => setIsEditing(true)}>
                    Edit site
                  </button>
                  <button className="button-secondary" type="button" onClick={() => void handleDeleteSite()}>
                    Delete site
                  </button>
                </>
              )}
              <Link
                href={`/assets/new?siteId=${encodeURIComponent(site.id)}`}
                className="button-secondary"
              >
                Add asset for this site
              </Link>
            </div>
          </section>

          <section className="panel p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
              Assets
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Saved at this site</h2>

            <div className="mt-5 space-y-3">
              {visibleAssets.length ? (
                visibleAssets.map((asset) => (
                  <Link
                    key={asset.id}
                    href={asset.href}
                    className="block rounded-3xl border border-ink/10 bg-white px-4 py-4 transition hover:border-moss/50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold capitalize text-ink">
                          {asset.equipmentType}
                          {asset.equipmentTag ? ` · ${asset.equipmentTag}` : ""}
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
                  title="No assets saved here yet"
                  body="Use the site as your capture context, then new assets for this site will appear here."
                />
              )}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-mist px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">{label}</div>
      <div className="mt-1 text-sm text-ink">{value}</div>
    </div>
  );
}

function FormField({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
