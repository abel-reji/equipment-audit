"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { SyncStatusPill } from "@/components/sync-status-pill";
import { getLocalDb } from "@/lib/local-db";
import { deleteAssetDraft, updateAssetDraft } from "@/lib/local-data";
import { equipmentTypeOptions } from "@/lib/constants";
import type { AssetDraft, AssetSummary, DraftPhoto } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";

export default function AssetDetailPage({
  params
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [serverAsset, setServerAsset] = useState<AssetSummary | null>(null);
  const [localDraft, setLocalDraft] = useState<AssetDraft | null>(null);
  const [draftPhotos, setDraftPhotos] = useState<DraftPhoto[]>([]);
  const [sites, setSites] = useState<Array<{ id: string; serverId?: string; name: string }>>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState({
    siteId: "",
    equipmentType: "pump",
    equipmentTag: "",
    manufacturer: "",
    temporaryIdentifier: "",
    quickNote: ""
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const db = getLocalDb();
      const draft =
        (await db.assetDrafts.get(params.id)) ??
        (await db.assetDrafts.filter((entry) => entry.serverId === params.id).first());
      const localSites = await db.sites.orderBy("name").toArray();
      setSites(localSites.map((site) => ({ id: site.id, serverId: site.serverId, name: site.name })));

      if (draft) {
        setLocalDraft(draft);
        const photos = await db.draftPhotos.where("assetDraftId").equals(draft.id).toArray();
        setDraftPhotos(photos);
        setForm({
          siteId: draft.siteId,
          equipmentType: draft.equipmentType,
          equipmentTag: draft.equipmentTag || "",
          manufacturer: draft.manufacturer || "",
          temporaryIdentifier: draft.temporaryIdentifier || "",
          quickNote: draft.quickNote || ""
        });
      }

      const assetId = draft?.serverId ?? params.id;
      const response = await fetch(`/api/assets/${encodeURIComponent(assetId)}`, {
        cache: "no-store"
      });

      if (response.ok) {
        const payload = await response.json();
        setServerAsset(payload);
        setForm((current) => ({
          siteId: draft?.siteId || payload.site.id,
          equipmentType: draft?.equipmentType || payload.asset.equipment_type,
          equipmentTag: draft?.equipmentTag || payload.asset.equipment_tag || "",
          manufacturer: draft?.manufacturer || payload.asset.manufacturer || "",
          temporaryIdentifier:
            draft?.temporaryIdentifier || payload.asset.temporary_identifier || "",
          quickNote: draft?.quickNote || payload.asset.quick_note || ""
        }));
      }

      setLoading(false);
    }

    void load();
  }, [params.id]);

  const detailAsset = serverAsset?.asset;
  const detailSiteName = serverAsset?.site.name || "Local draft site";
  const detailStatus = detailAsset?.capture_status ?? localDraft?.captureStatus ?? "queued";

  async function handleSaveEdits() {
    const localId = localDraft?.id ?? params.id;
    const selectedSite = sites.find((site) => site.id === form.siteId || site.serverId === form.siteId);

    await updateAssetDraft(localId, {
      siteId: selectedSite?.id ?? form.siteId,
      siteServerId: selectedSite?.serverId,
      equipmentType: form.equipmentType as AssetDraft["equipmentType"],
      equipmentTag: form.equipmentTag,
      manufacturer: form.manufacturer,
      temporaryIdentifier: form.temporaryIdentifier,
      quickNote: form.quickNote
    });

    if (localDraft?.serverId || serverAsset?.asset.id) {
      const response = await fetch(`/api/assets/${encodeURIComponent(serverAsset?.asset.id ?? localDraft?.serverId ?? params.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: selectedSite?.serverId,
          equipmentType: form.equipmentType,
          equipmentTag: form.equipmentTag,
          manufacturer: form.manufacturer,
          temporaryIdentifier: form.temporaryIdentifier,
          quickNote: form.quickNote
        })
      });

      if (!response.ok) {
        throw new Error("Unable to update asset");
      }
    }

    setLocalDraft((current) =>
      current
        ? {
            ...current,
            siteId: selectedSite?.id ?? form.siteId,
            siteServerId: selectedSite?.serverId,
            equipmentType: form.equipmentType as AssetDraft["equipmentType"],
            equipmentTag: form.equipmentTag,
            manufacturer: form.manufacturer,
            temporaryIdentifier: form.temporaryIdentifier,
            quickNote: form.quickNote,
            captureStatus: current.serverId ? "queued" : current.captureStatus,
            updatedAt: new Date().toISOString()
          }
        : current
    );
    setServerAsset((current) =>
      current
        ? {
            ...current,
            asset: {
              ...current.asset,
              equipment_type: form.equipmentType as AssetDraft["equipmentType"],
              equipment_tag: form.equipmentTag || null,
              manufacturer: form.manufacturer || null,
              temporary_identifier: form.temporaryIdentifier || null,
              quick_note: form.quickNote || null
            },
            site: selectedSite?.serverId === current.site.id
              ? current.site
              : {
                  ...current.site,
                  id: selectedSite?.serverId ?? current.site.id,
                  name: selectedSite?.name ?? current.site.name
                }
          }
        : current
    );
    setIsEditing(false);
  }

  async function handleDeleteAsset() {
    const confirmed = window.confirm("Delete this asset? This cannot be undone.");
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    try {
      const localId = localDraft?.id ?? params.id;
      if (serverAsset?.asset.id || localDraft?.serverId) {
        const response = await fetch(
          `/api/assets/${encodeURIComponent(serverAsset?.asset.id ?? localDraft?.serverId ?? params.id)}`,
          { method: "DELETE" }
        );

        if (!response.ok) {
          throw new Error("Unable to delete asset");
        }
      }

      await deleteAssetDraft(localId);
      router.push("/home");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <AppShell
      title="Asset Detail"
      description="Review capture completeness, sync state, and attached photos before deeper cleanup work on desktop."
    >
      {loading ? (
        <EmptyState title="Loading asset" body="Pulling local drafts and server state into one summary." />
      ) : serverAsset || draftPhotos.length ? (
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="panel p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                  Summary
                </p>
                <h2 className="mt-2 text-2xl font-semibold capitalize text-ink">
                  {detailAsset?.equipment_type ?? localDraft?.equipmentType ?? "Draft asset"}
                </h2>
              </div>
              <SyncStatusPill status={detailStatus} />
            </div>

            {isEditing ? (
              <div className="mt-5 space-y-4">
                <FormField label="Site">
                  <select
                    className="field"
                    value={form.siteId}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, siteId: event.target.value }))
                    }
                  >
                    <option value="">Select site</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Equipment type">
                  <select
                    className="field capitalize"
                    value={form.equipmentType}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, equipmentType: event.target.value }))
                    }
                  >
                    {equipmentTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Equipment tag">
                  <input
                    className="field"
                    value={form.equipmentTag}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, equipmentTag: event.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Manufacturer">
                  <input
                    className="field"
                    value={form.manufacturer}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, manufacturer: event.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Temporary ID">
                  <input
                    className="field"
                    value={form.temporaryIdentifier}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        temporaryIdentifier: event.target.value
                      }))
                    }
                  />
                </FormField>
                <FormField label="Quick note">
                  <textarea
                    className="field min-h-24"
                    value={form.quickNote}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, quickNote: event.target.value }))
                    }
                  />
                </FormField>
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                <DetailRow
                  label="Equipment tag"
                  value={detailAsset?.equipment_tag || localDraft?.equipmentTag || "Not entered"}
                />
                <DetailRow
                  label="Manufacturer"
                  value={detailAsset?.manufacturer || localDraft?.manufacturer || "Not entered"}
                />
                <DetailRow
                  label="Temporary ID"
                  value={detailAsset?.temporary_identifier || localDraft?.temporaryIdentifier || "Not entered"}
                />
                <DetailRow
                  label="Quick note"
                  value={detailAsset?.quick_note || localDraft?.quickNote || "Not entered"}
                />
                <DetailRow label="Site" value={detailSiteName} />
                <DetailRow
                  label="Captured"
                  value={formatRelativeDate(detailAsset?.captured_at ?? localDraft?.createdAt)}
                />
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {isEditing ? (
                <>
                  <button className="button-primary" type="button" onClick={() => void handleSaveEdits()}>
                    Save changes
                  </button>
                  <button className="button-secondary" type="button" onClick={() => setIsEditing(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button className="button-primary" type="button" onClick={() => setIsEditing(true)}>
                    Edit asset
                  </button>
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={() => void handleDeleteAsset()}
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Deleting..." : "Delete asset"}
                  </button>
                  <Link href="/assets/new" className="button-secondary">
                    Capture another asset
                  </Link>
                </>
              )}
            </div>
          </section>

          <section className="panel p-5 md:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
              Photos
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Field evidence</h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {serverAsset?.photos?.map((photo) => (
                <PhotoCard
                  key={photo.id}
                  label={photo.photo_type}
                  src={photo.signedUrl}
                  subtitle="Synced photo"
                />
              ))}
              {!serverAsset?.photos?.length &&
                draftPhotos.map((photo) => (
                  <PhotoCard
                    key={photo.id}
                    label={photo.photoType}
                    src={photo.previewUrl}
                    subtitle={photo.uploadStatus}
                  />
                ))}
            </div>

            {!serverAsset?.photos?.length && !draftPhotos.length ? (
              <div className="mt-4">
                <EmptyState
                  title="No photos on this record"
                  body="Capture at least one queued photo to make the record field-ready."
                />
              </div>
            ) : null}
          </section>
        </div>
      ) : (
        <EmptyState
          title="Asset not found"
          body="The draft may not exist on this device yet, or the synced asset id is invalid."
        />
      )}
    </AppShell>
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-mist px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate">{label}</div>
      <div className="mt-1 text-sm text-ink">{value}</div>
    </div>
  );
}

function PhotoCard({
  label,
  src,
  subtitle
}: {
  label: string;
  src?: string;
  subtitle: string;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-ink/10 bg-white">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={label} src={src} className="h-44 w-full object-cover" />
      ) : (
        <div className="flex h-44 items-center justify-center bg-mist text-sm text-slate">
          Preview unavailable
        </div>
      )}
      <div className="px-4 py-3">
        <div className="font-semibold capitalize text-ink">{label.replace("-", " ")}</div>
        <div className="mt-1 text-xs text-slate capitalize">{subtitle.replace("-", " ")}</div>
      </div>
    </div>
  );
}
