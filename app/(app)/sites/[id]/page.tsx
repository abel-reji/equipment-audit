"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { SyncStatusPill } from "@/components/sync-status-pill";
import { getLocalDb } from "@/lib/local-db";
import { deleteAssetDraft, deleteSiteDraft, updateSiteDraft } from "@/lib/local-data";
import type { AssetDraft, CachedCustomer, CachedSite } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";

interface ServerAsset {
  id: string;
  equipment_tag?: string | null;
  equipment_type: string;
  manufacturer?: string | null;
  model?: string | null;
  serial?: string | null;
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
  const [assetActionId, setAssetActionId] = useState<string | null>(null);
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
      localId: localByServerId.get(asset.id)?.id,
      serverId: asset.id,
      href: `/assets/${encodeURIComponent(asset.id)}`,
      equipmentType: asset.equipment_type,
      equipmentTag: asset.equipment_tag ?? undefined,
      manufacturer: asset.manufacturer ?? undefined,
      model: asset.model ?? undefined,
      serial: asset.serial ?? undefined,
      temporaryIdentifier: asset.temporary_identifier ?? undefined,
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
        localId: asset.id,
        serverId: asset.serverId,
        href: `/assets/${encodeURIComponent(asset.id)}`,
        equipmentType: asset.equipmentType,
        equipmentTag: asset.equipmentTag,
        manufacturer: asset.manufacturer,
        model: asset.model,
        serial: asset.serial,
        temporaryIdentifier: asset.temporaryIdentifier,
        updatedAt: asset.updatedAt,
        status: asset.captureStatus
      }));

    return [...localOnlyAssets, ...mergedServerAssets].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  }, [localAssets, serverAssets]);

  async function handleDeleteAsset(asset: {
    id: string;
    localId?: string;
    serverId?: string;
  }) {
    const confirmed = window.confirm("Delete this asset? This cannot be undone.");
    if (!confirmed) {
      return;
    }

    if (asset.serverId) {
      const response = await fetch(`/api/assets/${encodeURIComponent(asset.serverId)}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Unable to delete asset");
      }
    }

    if (asset.localId) {
      await deleteAssetDraft(asset.localId);
    }

    setLocalAssets((current) =>
      current.filter((entry) => entry.id !== asset.localId && entry.serverId !== asset.serverId)
    );
    setServerAssets((current) => current.filter((entry) => entry.id !== asset.serverId));
    setAssetActionId(null);
  }

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
                  <div
                    key={asset.id}
                    className="rounded-3xl border border-ink/10 bg-white px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <Link href={asset.href} className="min-w-0 flex-1 transition hover:text-moss">
                        <div className="font-semibold capitalize text-ink">
                          {asset.equipmentType}
                          {asset.equipmentTag ? ` | ${asset.equipmentTag}` : ""}
                        </div>
                        <div className="mt-1 text-sm text-slate">
                          {formatAssetIdentity(asset)}
                        </div>
                        <div className="mt-1 text-xs text-slate">
                          {formatAssetSecondary(asset)}
                        </div>
                        <div className="mt-2 text-xs text-slate">
                          Updated {formatRelativeDate(asset.updatedAt)}
                        </div>
                      </Link>
                      <div className="flex shrink-0 flex-col items-end gap-3">
                        <SyncStatusPill status={asset.status} />
                        <button
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink/10 bg-white text-slate transition hover:border-moss hover:text-moss"
                          type="button"
                          aria-label={`Open actions for ${asset.equipmentType}`}
                          onClick={() =>
                            setAssetActionId((current) => (current === asset.id ? null : asset.id))
                          }
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {assetActionId === asset.id ? (
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Link href={asset.href} className="button-primary">
                          Edit asset
                        </Link>
                        <button
                          className="inline-flex min-h-[3rem] items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100"
                          type="button"
                          onClick={() => void handleDeleteAsset(asset)}
                        >
                          Delete asset
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No assets saved here yet"
                  body="Use the site as your capture context, then new assets for this site will appear here."
                />
              )}
            </div>

            {!isEditing ? (
              <div className="mt-8 border-t border-ink/10 pt-6">
                <button
                  className="inline-flex min-h-[3rem] w-full items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-100"
                  type="button"
                  onClick={() => void handleDeleteSite()}
                >
                  Delete site
                </button>
              </div>
            ) : null}
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

function formatAssetIdentity(asset: {
  manufacturer?: string;
  model?: string;
  temporaryIdentifier?: string;
}) {
  const values = [asset.manufacturer, asset.model].filter(Boolean);

  if (values.length) {
    return values.join(" | ");
  }

  return asset.temporaryIdentifier ? `Temp ID: ${asset.temporaryIdentifier}` : "No manufacturer or model";
}

function formatAssetSecondary(asset: {
  serial?: string;
  temporaryIdentifier?: string;
}) {
  const values = [
    asset.serial ? `Serial: ${asset.serial}` : "",
    asset.temporaryIdentifier ? `Temp ID: ${asset.temporaryIdentifier}` : ""
  ].filter(Boolean);

  return values.length ? values.join(" | ") : "No serial or temporary ID";
}
