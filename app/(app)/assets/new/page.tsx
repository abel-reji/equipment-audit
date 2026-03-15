"use client";

import Link from "next/link";
import { Camera, CheckCircle2 } from "lucide-react";
import { Suspense, useEffect, useId, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { SyncStatusPill } from "@/components/sync-status-pill";
import { equipmentTypeOptions, photoTypeOptions } from "@/lib/constants";
import { getLocalDb } from "@/lib/local-db";
import { addDraftPhoto, markSiteUsed, saveAssetDraft, seedSites } from "@/lib/local-data";
import type { CachedSite, DraftPhoto, PhotoType } from "@/lib/types";
import { makeClientId } from "@/lib/utils";

export default function NewAssetPage() {
  return (
    <Suspense fallback={null}>
      <NewAssetPageContent />
    </Suspense>
  );
}

function NewAssetPageContent() {
  const cameraInputId = useId();
  const libraryInputId = useId();
  const searchParams = useSearchParams();
  const selectedSiteId = searchParams.get("siteId") ?? "";

  const [sites, setSites] = useState<CachedSite[]>([]);
  const [assetId] = useState(() => makeClientId("asset"));
  const [form, setForm] = useState({
    siteId: selectedSiteId,
    equipmentType: "pump",
    equipmentTag: "",
    manufacturer: "",
    quickNote: "",
    temporaryIdentifier: ""
  });
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [photoType, setPhotoType] = useState<PhotoType>("equipment");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      const db = getLocalDb();
      const localSites = await db.sites.orderBy("updatedAt").reverse().toArray();
      setSites(localSites);

      if (!localSites.length) {
        const response = await fetch("/api/sites", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          await seedSites(data.sites ?? []);
          setSites(await db.sites.orderBy("updatedAt").reverse().toArray());
        }
      }
    }

    void bootstrap();
  }, []);

  useEffect(() => {
    setForm((current) => ({ ...current, siteId: selectedSiteId || current.siteId }));
  }, [selectedSiteId]);

  const selectedSite = useMemo(
    () => sites.find((site) => site.id === form.siteId || site.serverId === form.siteId),
    [form.siteId, sites]
  );

  async function handlePhotoSelected(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    const nextPhotos: DraftPhoto[] = [];
    for (const file of Array.from(files)) {
      const photo = await addDraftPhoto({
        assetDraftId: assetId,
        photoType,
        file
      });
      nextPhotos.push(photo);
    }

    setPhotos((current) => [...current, ...nextPhotos]);
    setSaved(false);
  }

  async function handleSaveDraft() {
    if (!form.siteId || !form.equipmentType || photos.length < 1) {
      return;
    }

    await saveAssetDraft({
      id: assetId,
      siteId: selectedSite?.id ?? form.siteId,
      siteServerId: selectedSite?.serverId,
      equipmentType: form.equipmentType as typeof equipmentTypeOptions[number],
      equipmentTag: form.equipmentTag,
      manufacturer: form.manufacturer,
      quickNote: form.quickNote,
      temporaryIdentifier: form.temporaryIdentifier,
      photoCount: photos.length
    });

    await markSiteUsed(selectedSite?.id ?? form.siteId);
    setSaved(true);
  }

  return (
    <AppShell
      title="New Asset"
      description="Capture only the details you can reliably grab in the field. Everything else can wait for desktop cleanup."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_0.92fr]">
        <section className="panel p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                Capture Form
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">
                Minimal inputs, photo-first record
              </h2>
            </div>
            {saved ? <SyncStatusPill status="queued" /> : null}
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <label className="label" htmlFor="site-select">
                Site
              </label>
              <select
                id="site-select"
                className="field"
                value={form.siteId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, siteId: event.target.value }))
                }
              >
                <option value="">Select a site</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="equipment-type">
                Equipment type
              </label>
              <select
                id="equipment-type"
                className="field capitalize"
                value={form.equipmentType}
                onChange={(event) =>
                  setForm((current) => ({ ...current, equipmentType: event.target.value }))
                }
              >
                {equipmentTypeOptions.map((option) => (
                  <option key={option} value={option} className="capitalize">
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="equipment-tag"
                label="Equipment tag"
                value={form.equipmentTag}
                onChange={(value) =>
                  setForm((current) => ({ ...current, equipmentTag: value }))
                }
              />
              <TextField
                id="temp-id"
                label="Temporary identifier"
                value={form.temporaryIdentifier}
                onChange={(value) =>
                  setForm((current) => ({ ...current, temporaryIdentifier: value }))
                }
              />
            </div>

            <TextField
              id="manufacturer"
              label="Manufacturer"
              value={form.manufacturer}
              onChange={(value) => setForm((current) => ({ ...current, manufacturer: value }))}
            />

            <div>
              <label className="label" htmlFor="quick-note">
                Quick note
              </label>
              <textarea
                id="quick-note"
                className="field min-h-28"
                value={form.quickNote}
                onChange={(event) =>
                  setForm((current) => ({ ...current, quickNote: event.target.value }))
                }
              />
            </div>
          </div>
        </section>

        <section className="panel p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                Photos
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Evidence first</h2>
            </div>
            <Camera className="h-6 w-6 text-slate" />
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="label" htmlFor="photo-type">
                Photo type
              </label>
              <select
                id="photo-type"
                className="field capitalize"
                value={photoType}
                onChange={(event) => setPhotoType(event.target.value as PhotoType)}
              >
                {photoTypeOptions.map((option) => (
                  <option key={option} value={option} className="capitalize">
                    {option.replace("-", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label htmlFor={cameraInputId} className="button-secondary w-full cursor-pointer">
                Use camera
              </label>
              <input
                id={cameraInputId}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                multiple
                onChange={(event) => void handlePhotoSelected(event.target.files)}
              />

              <label htmlFor={libraryInputId} className="button-secondary w-full cursor-pointer">
                Upload from phone
              </label>
              <input
                id={libraryInputId}
                type="file"
                accept="image/*"
                className="hidden"
                multiple
                onChange={(event) => void handlePhotoSelected(event.target.files)}
              />
            </div>

            {photos.length ? (
              <div className="grid grid-cols-2 gap-3">
                {photos.map((photo) => (
                  <div key={photo.id} className="overflow-hidden rounded-3xl border border-ink/10 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      alt={photo.photoType}
                      src={photo.previewUrl}
                      className="h-36 w-full object-cover"
                    />
                    <div className="px-3 py-3">
                      <div className="text-sm font-semibold capitalize text-ink">
                        {photo.photoType.replace("-", " ")}
                      </div>
                      <div className="mt-1 text-xs text-slate">{photo.fileName}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="Add at least one photo"
                body="The draft stays incomplete until a queued photo exists. Use the camera while you are at the asset."
              />
            )}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              className="button-primary"
              type="button"
              onClick={() => void handleSaveDraft()}
              disabled={!form.siteId || photos.length < 1}
            >
              Save draft
            </button>
            {saved ? (
              <Link href={`/assets/${encodeURIComponent(assetId)}`} className="button-secondary">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Open draft
              </Link>
            ) : (
              <Link href="/sites" className="button-secondary">
                Change site
              </Link>
            )}
          </div>
        </section>
      </div>

      {!sites.length ? (
        <div className="mt-6">
          <EmptyState
            title="No site context yet"
            body="Create or sync a site before field capture starts."
            action={<Link href="/sites" className="button-primary">Open site picker</Link>}
          />
        </div>
      ) : null}
    </AppShell>
  );
}

function TextField({
  id,
  label,
  value,
  onChange
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input id={id} className="field" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
