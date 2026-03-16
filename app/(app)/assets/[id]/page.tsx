"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell, ContextBar } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { SyncStatusPill } from "@/components/sync-status-pill";
import { assetStatusOptions, equipmentTypeOptions } from "@/lib/constants";
import { getLocalDb } from "@/lib/local-db";
import { deleteAssetDraft, deleteDraftPhoto, updateAssetDraft } from "@/lib/local-data";
import type {
  AssetStatus,
  AssetCouplingDetails,
  AssetDraft,
  AssetDriverDetails,
  AssetSummary,
  DraftPhoto
} from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";

const emptyDriver: AssetDriverDetails = {
  motorOem: "",
  motorModel: "",
  serialNumber: "",
  hp: "",
  rpm: "",
  voltage: "",
  frame: ""
};

const emptyCoupling: AssetCouplingDetails = {
  oem: "",
  couplingType: "",
  size: "",
  spacer: "",
  notes: ""
};

interface AssetDetailFormState {
  siteId: string;
  equipmentType: AssetDraft["equipmentType"];
  equipmentTag: string;
  manufacturer: string;
  model: string;
  serial: string;
  serviceApplication: string;
  status: AssetStatus;
  temporaryIdentifier: string;
  quickNote: string;
  driver: AssetDriverDetails;
  coupling: AssetCouplingDetails;
}

interface CapturedLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
}

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
  const [saveError, setSaveError] = useState("");
  const [locationError, setLocationError] = useState("");
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);
  const [form, setForm] = useState<AssetDetailFormState>({
    siteId: "",
    equipmentType: "pump",
    equipmentTag: "",
    manufacturer: "",
    model: "",
    serial: "",
    serviceApplication: "",
    status: "unknown",
    temporaryIdentifier: "",
    quickNote: "",
    driver: emptyDriver,
    coupling: emptyCoupling
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
          model: draft.model || "",
          serial: draft.serial || "",
          serviceApplication: draft.serviceApplication || "",
          status: draft.status || "unknown",
          temporaryIdentifier: draft.temporaryIdentifier || "",
          quickNote: draft.quickNote || "",
          driver: {
            ...emptyDriver,
            ...draft.driver
          },
          coupling: {
            ...emptyCoupling,
            ...draft.coupling
          }
        });
      }

      const assetId = draft?.serverId ?? params.id;
      const response = await fetch(`/api/assets/${encodeURIComponent(assetId)}`, {
        cache: "no-store"
      });

      if (response.ok) {
        const payload = await response.json();
        setServerAsset(payload);
        setForm({
          siteId: draft?.siteId || payload.site.id,
          equipmentType: draft?.equipmentType || payload.asset.equipment_type,
          equipmentTag: draft?.equipmentTag || payload.asset.equipment_tag || "",
          manufacturer: draft?.manufacturer || payload.asset.manufacturer || "",
          model: draft?.model || payload.asset.model || "",
          serial: draft?.serial || payload.asset.serial || "",
          serviceApplication:
            draft?.serviceApplication || payload.asset.service_application || "",
          status: draft?.status || payload.asset.status || "unknown",
          temporaryIdentifier:
            draft?.temporaryIdentifier || payload.asset.temporary_identifier || "",
          quickNote: draft?.quickNote || payload.asset.quick_note || "",
          driver: {
            ...emptyDriver,
            motorOem: draft?.driver?.motorOem || payload.driver?.motor_oem || "",
            motorModel: draft?.driver?.motorModel || payload.driver?.motor_model || "",
            serialNumber: draft?.driver?.serialNumber || payload.driver?.serial_number || "",
            hp: draft?.driver?.hp || payload.driver?.hp || "",
            rpm: draft?.driver?.rpm || payload.driver?.rpm || "",
            voltage: draft?.driver?.voltage || payload.driver?.voltage || "",
            frame: draft?.driver?.frame || payload.driver?.frame || ""
          },
          coupling: {
            ...emptyCoupling,
            oem: draft?.coupling?.oem || payload.coupling?.oem || "",
            couplingType:
              draft?.coupling?.couplingType || payload.coupling?.coupling_type || "",
            size: draft?.coupling?.size || payload.coupling?.size || "",
            spacer: draft?.coupling?.spacer || payload.coupling?.spacer || "",
            notes: draft?.coupling?.notes || payload.coupling?.notes || ""
          }
        });
      }

      setLoading(false);
    }

    void load();
  }, [params.id]);

  const detailAsset = serverAsset?.asset;
  const detailStatus = detailAsset?.capture_status ?? localDraft?.captureStatus ?? "queued";
  const detailLocation = getDisplayedLocation(detailAsset, localDraft);
  const matchedSite = sites.find(
    (site) =>
      site.id === localDraft?.siteId ||
      site.id === form.siteId ||
      site.serverId === localDraft?.siteServerId ||
      site.serverId === serverAsset?.site.id
  );
  const detailSiteId = matchedSite?.id ?? localDraft?.siteId;
  const detailSiteName = matchedSite?.name || serverAsset?.site.name || "Local draft site";

  async function handleSaveEdits() {
    try {
      setSaveError("");
      const localId = localDraft?.id ?? params.id;
      const selectedSite = sites.find((site) => site.id === form.siteId || site.serverId === form.siteId);
      const nextLocalStatus =
        localDraft?.serverId || serverAsset?.asset.id
          ? navigator.onLine
            ? "queued"
            : "local-only"
          : localDraft?.captureStatus ?? "queued";

      if (localDraft) {
        await updateAssetDraft(localId, {
          siteId: selectedSite?.id ?? form.siteId,
          siteServerId: selectedSite?.serverId,
          equipmentType: form.equipmentType as AssetDraft["equipmentType"],
          equipmentTag: form.equipmentTag,
          manufacturer: form.manufacturer,
          model: form.model,
          serial: form.serial,
          serviceApplication: form.serviceApplication,
          status: form.status,
          temporaryIdentifier: form.temporaryIdentifier,
          quickNote: form.quickNote,
          driver: form.driver,
          coupling: form.coupling
        });
      } else if (!navigator.onLine) {
        throw new Error("This asset is not cached locally. Reconnect before saving changes.");
      }

      if (navigator.onLine && (localDraft?.serverId || serverAsset?.asset.id)) {
        const response = await fetch(`/api/assets/${encodeURIComponent(serverAsset?.asset.id ?? localDraft?.serverId ?? params.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            siteId: selectedSite?.serverId,
            equipmentType: form.equipmentType,
            equipmentTag: form.equipmentTag,
            manufacturer: form.manufacturer,
            model: form.model,
            serial: form.serial,
            serviceApplication: form.serviceApplication,
            status: form.status,
            temporaryIdentifier: form.temporaryIdentifier,
            quickNote: form.quickNote,
            driver: form.driver,
            coupling: form.coupling
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
              model: form.model,
              serial: form.serial,
              serviceApplication: form.serviceApplication,
              status: form.status,
              temporaryIdentifier: form.temporaryIdentifier,
              quickNote: form.quickNote,
              driver: form.driver,
              coupling: form.coupling,
              captureStatus: nextLocalStatus,
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
                model: form.model || null,
                serial: form.serial || null,
                service_application: form.serviceApplication || null,
                status: form.status,
                temporary_identifier: form.temporaryIdentifier || null,
                quick_note: form.quickNote || null
              },
              driver: hasDriverValues(form.driver)
                ? {
                    ...(current.driver ?? {
                      id: "local-driver",
                      account_id: current.asset.account_id,
                      asset_id: current.asset.id,
                      created_at: current.asset.created_at,
                      updated_at: new Date().toISOString()
                    }),
                    motor_oem: form.driver.motorOem || null,
                    motor_model: form.driver.motorModel || null,
                    serial_number: form.driver.serialNumber || null,
                    hp: form.driver.hp || null,
                    rpm: form.driver.rpm || null,
                    voltage: form.driver.voltage || null,
                    frame: form.driver.frame || null
                  }
                : null,
              coupling: hasCouplingValues(form.coupling)
                ? {
                    ...(current.coupling ?? {
                      id: "local-coupling",
                      account_id: current.asset.account_id,
                      asset_id: current.asset.id,
                      created_at: current.asset.created_at,
                      updated_at: new Date().toISOString()
                    }),
                    oem: form.coupling.oem || null,
                    coupling_type: form.coupling.couplingType || null,
                    size: form.coupling.size || null,
                    spacer: form.coupling.spacer || null,
                    notes: form.coupling.notes || null
                  }
                : null,
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
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save changes");
    }
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

  async function handleCaptureLocation() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocationError("Geolocation is not supported on this device.");
      return;
    }

    try {
      setLocationError("");
      setIsCapturingLocation(true);
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        });
      });

      const capturedLocation: CapturedLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        capturedAt: new Date().toISOString()
      };

      if (localDraft) {
        const nextLocalStatus =
          localDraft.serverId || serverAsset?.asset.id
            ? navigator.onLine
              ? "queued"
              : "local-only"
            : localDraft.captureStatus;

        await updateAssetDraft(localDraft.id, {
          latitude: capturedLocation.latitude,
          longitude: capturedLocation.longitude,
          locationAccuracyMeters: capturedLocation.accuracy ?? undefined,
          locationCapturedAt: capturedLocation.capturedAt
        });

        setLocalDraft((current) =>
          current
            ? {
                ...current,
                latitude: capturedLocation.latitude,
                longitude: capturedLocation.longitude,
                locationAccuracyMeters: capturedLocation.accuracy ?? undefined,
                locationCapturedAt: capturedLocation.capturedAt,
                captureStatus: nextLocalStatus,
                updatedAt: new Date().toISOString()
              }
            : current
        );
      } else if (!navigator.onLine) {
        throw new Error("This asset is not cached locally. Reconnect before capturing location.");
      }

      if (navigator.onLine && (serverAsset?.asset.id || localDraft?.serverId)) {
        const response = await fetch(
          `/api/assets/${encodeURIComponent(serverAsset?.asset.id ?? localDraft?.serverId ?? params.id)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: capturedLocation.latitude,
              longitude: capturedLocation.longitude,
              locationAccuracyMeters: capturedLocation.accuracy,
              locationCapturedAt: capturedLocation.capturedAt
            })
          }
        );

        if (!response.ok) {
          throw new Error("Unable to save location");
        }
      }

      setServerAsset((current) =>
        current
          ? {
              ...current,
              asset: {
                ...current.asset,
                latitude: capturedLocation.latitude,
                longitude: capturedLocation.longitude,
                location_accuracy_meters: capturedLocation.accuracy,
                location_captured_at: capturedLocation.capturedAt
              }
            }
          : current
      );
    } catch (error) {
      setLocationError(formatLocationError(error));
    } finally {
      setIsCapturingLocation(false);
    }
  }

  async function handleDeleteDraftPhoto(photoId: string) {
    await deleteDraftPhoto(photoId);
    setDraftPhotos((current) => current.filter((photo) => photo.id !== photoId));
    setLocalDraft((current) =>
      current
        ? {
            ...current,
            photoCount: Math.max(0, current.photoCount - 1),
            updatedAt: new Date().toISOString()
          }
        : current
    );
  }

  async function handleDeleteServerPhoto(photoId: string) {
    if (!serverAsset?.asset.id) {
      return;
    }

    const confirmed = window.confirm("Delete this photo from the asset?");
    if (!confirmed) {
      return;
    }

    const response = await fetch(
      `/api/assets/${encodeURIComponent(serverAsset.asset.id)}/photos/${encodeURIComponent(photoId)}`,
      { method: "DELETE" }
    );

    if (!response.ok) {
      throw new Error("Unable to delete photo");
    }

    setServerAsset((current) =>
      current
        ? {
            ...current,
            photos: current.photos.filter((photo) => photo.id !== photoId)
          }
        : current
    );
  }

  return (
    <AppShell
      title="Asset Detail"
      description="Review capture completeness, sync state, and attached photos before deeper cleanup work on desktop."
      contextBar={
        detailSiteId ? (
          <ContextBar
            items={[
              { label: "Sites", href: "/sites" },
              { label: detailSiteName, href: `/sites/${encodeURIComponent(detailSiteId)}` },
              { label: "Asset Detail" }
            ]}
          />
        ) : undefined
      }
    >
      {loading ? (
        <EmptyState title="Loading asset" body="Pulling local drafts and server state into one summary." />
      ) : serverAsset || localDraft || draftPhotos.length ? (
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
                      setForm((current) => ({
                        ...current,
                        equipmentType: event.target.value as AssetDraft["equipmentType"]
                      }))
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Model">
                    <input
                      className="field"
                      value={form.model}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, model: event.target.value }))
                      }
                    />
                  </FormField>
                  <FormField label="Serial">
                    <input
                      className="field"
                      value={form.serial}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, serial: event.target.value }))
                      }
                    />
                  </FormField>
                </div>
                <FormField label="Service / application">
                  <input
                    className="field"
                    value={form.serviceApplication}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        serviceApplication: event.target.value
                      }))
                    }
                  />
                </FormField>
                <FormField label="Status">
                  <select
                    className="field"
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        status: event.target.value as AssetStatus
                      }))
                    }
                  >
                    {assetStatusOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
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
                <div className="rounded-3xl bg-mist p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                    Driver
                  </div>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <FormField label="Motor OEM">
                      <input
                        className="field"
                        value={form.driver.motorOem}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            driver: { ...current.driver, motorOem: event.target.value }
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="Motor model">
                      <input
                        className="field"
                        value={form.driver.motorModel}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            driver: { ...current.driver, motorModel: event.target.value }
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="Driver serial no.">
                      <input
                        className="field"
                        value={form.driver.serialNumber}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            driver: { ...current.driver, serialNumber: event.target.value }
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="HP">
                      <input
                        className="field"
                        value={form.driver.hp}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            driver: { ...current.driver, hp: event.target.value }
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="RPM">
                      <input
                        className="field"
                        value={form.driver.rpm}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            driver: { ...current.driver, rpm: event.target.value }
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="Voltage">
                      <input
                        className="field"
                        value={form.driver.voltage}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            driver: { ...current.driver, voltage: event.target.value }
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="Frame">
                      <input
                        className="field"
                        value={form.driver.frame}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            driver: { ...current.driver, frame: event.target.value }
                          }))
                        }
                      />
                    </FormField>
                  </div>
                </div>
                <div className="rounded-3xl bg-mist p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                    Coupling
                  </div>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <FormField label="Coupling OEM">
                      <input
                        className="field"
                        value={form.coupling.oem}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            coupling: { ...current.coupling, oem: event.target.value }
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="Type">
                      <input
                        className="field"
                        value={form.coupling.couplingType}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            coupling: {
                              ...current.coupling,
                              couplingType: event.target.value
                            }
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="Size">
                      <input
                        className="field"
                        value={form.coupling.size}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            coupling: { ...current.coupling, size: event.target.value }
                          }))
                        }
                      />
                    </FormField>
                    <FormField label="Spacer">
                      <input
                        className="field"
                        value={form.coupling.spacer}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            coupling: { ...current.coupling, spacer: event.target.value }
                          }))
                        }
                      />
                    </FormField>
                  </div>
                  <div className="mt-4">
                    <FormField label="Coupling notes">
                      <textarea
                        className="field min-h-24"
                        value={form.coupling.notes}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            coupling: { ...current.coupling, notes: event.target.value }
                          }))
                        }
                      />
                    </FormField>
                  </div>
                </div>
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
                  label="Model"
                  value={detailAsset?.model || localDraft?.model || "Not entered"}
                />
                <DetailRow
                  label="Serial"
                  value={detailAsset?.serial || localDraft?.serial || "Not entered"}
                />
                <DetailRow
                  label="Service / application"
                  value={
                    detailAsset?.service_application ||
                    localDraft?.serviceApplication ||
                    "Not entered"
                  }
                />
                <DetailRow
                  label="Status"
                  value={detailAsset?.status || localDraft?.status || "unknown"}
                />
                <DetailRow
                  label="Temporary ID"
                  value={detailAsset?.temporary_identifier || localDraft?.temporaryIdentifier || "Not entered"}
                />
                <DetailRow
                  label="Quick note"
                  value={detailAsset?.quick_note || localDraft?.quickNote || "Not entered"}
                />
                <DetailRow label="Geotag" value={formatLocationSummary(detailLocation)} />
                <DetailRow label="Site" value={detailSiteName} />
                <DetailRow
                  label="Captured"
                  value={formatRelativeDate(detailAsset?.captured_at ?? localDraft?.createdAt)}
                />
                <DetailRow
                  label="Driver"
                  value={formatDriverSummary(serverAsset?.driver, localDraft?.driver)}
                />
                <DetailRow
                  label="Coupling"
                  value={formatCouplingSummary(serverAsset?.coupling, localDraft?.coupling)}
                />
              </div>
            )}

            <div className="safe-bottom sticky bottom-20 z-20 mt-6 flex flex-col gap-3 rounded-3xl bg-white/92 p-3 shadow-panel backdrop-blur sm:flex-row sm:flex-wrap md:static md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
              {isEditing ? (
                <>
                  <button className="button-primary w-full sm:w-auto" type="button" onClick={() => void handleSaveEdits()}>
                    Save changes
                  </button>
                  <button className="button-secondary w-full sm:w-auto" type="button" onClick={() => setIsEditing(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button className="button-primary w-full sm:w-auto" type="button" onClick={() => setIsEditing(true)}>
                    Edit asset
                  </button>
                  {serverAsset?.asset.id || localDraft?.serverId ? (
                    <Link
                      href={`/pm/${encodeURIComponent(serverAsset?.asset.id ?? localDraft?.serverId ?? params.id)}`}
                      className="button-secondary w-full sm:w-auto"
                    >
                      Open PM tracker
                    </Link>
                  ) : null}
                  <button
                    className="button-secondary w-full sm:w-auto"
                    type="button"
                    onClick={() => void handleCaptureLocation()}
                    disabled={isCapturingLocation}
                  >
                    {isCapturingLocation ? "Capturing location..." : "Capture location"}
                  </button>
                  <button
                    className="button-secondary w-full sm:w-auto"
                    type="button"
                    onClick={() => void handleDeleteAsset()}
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Deleting..." : "Delete asset"}
                  </button>
                  <Link href="/assets/new" className="button-secondary w-full sm:w-auto">
                    Capture another asset
                  </Link>
                </>
              )}
            </div>

            {saveError ? (
              <p className="mt-4 rounded-2xl bg-mist px-4 py-3 text-sm text-slate">{saveError}</p>
            ) : null}
            {locationError ? (
              <p className="mt-4 rounded-2xl bg-mist px-4 py-3 text-sm text-slate">{locationError}</p>
            ) : null}
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
                  onDelete={() => void handleDeleteServerPhoto(photo.id)}
                />
              ))}
              {!serverAsset?.photos?.length &&
                draftPhotos.map((photo) => (
                  <PhotoCard
                    key={photo.id}
                    label={photo.photoType}
                    src={photo.previewUrl}
                    subtitle={photo.uploadStatus}
                    onDelete={() => void handleDeleteDraftPhoto(photo.id)}
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
  subtitle,
  onDelete
}: {
  label: string;
  src?: string;
  subtitle: string;
  onDelete?: () => void;
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
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold capitalize text-ink">{label.replace("-", " ")}</div>
            <div className="mt-1 text-xs text-slate capitalize">{subtitle.replace("-", " ")}</div>
          </div>
          {onDelete ? (
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700 transition hover:border-red-300 hover:bg-red-100"
              type="button"
              aria-label={`Delete ${label.replace("-", " ")} photo`}
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function hasDriverValues(driver: AssetDriverDetails) {
  return Object.values(driver).some((value) => value && value.trim().length > 0);
}

function hasCouplingValues(coupling: AssetCouplingDetails) {
  return Object.values(coupling).some((value) => value && value.trim().length > 0);
}

function formatDriverSummary(
  serverDriver?: AssetSummary["driver"],
  localDriver?: AssetDriverDetails
) {
  const values = [
    localDriver?.motorOem || serverDriver?.motor_oem || "",
    localDriver?.motorModel || serverDriver?.motor_model || "",
    localDriver?.serialNumber || serverDriver?.serial_number || "",
    localDriver?.hp ? `${localDriver.hp} HP` : serverDriver?.hp ? `${serverDriver.hp} HP` : "",
    localDriver?.rpm ? `${localDriver.rpm} RPM` : serverDriver?.rpm ? `${serverDriver.rpm} RPM` : ""
  ].filter(Boolean);

  return values.length ? values.join(" | ") : "Not entered";
}

function formatCouplingSummary(
  serverCoupling?: AssetSummary["coupling"],
  localCoupling?: AssetCouplingDetails
) {
  const values = [
    localCoupling?.oem || serverCoupling?.oem || "",
    localCoupling?.couplingType || serverCoupling?.coupling_type || "",
    localCoupling?.size || serverCoupling?.size || "",
    localCoupling?.spacer || serverCoupling?.spacer || ""
  ].filter(Boolean);

  return values.length ? values.join(" | ") : "Not entered";
}

function getDisplayedLocation(
  asset?: AssetSummary["asset"],
  draft?: AssetDraft | null
): CapturedLocation | null {
  const latitude = draft?.latitude ?? asset?.latitude;
  const longitude = draft?.longitude ?? asset?.longitude;

  if (latitude === undefined || latitude === null || longitude === undefined || longitude === null) {
    return null;
  }

  return {
    latitude,
    longitude,
    accuracy: draft?.locationAccuracyMeters ?? asset?.location_accuracy_meters ?? null,
    capturedAt: draft?.locationCapturedAt ?? asset?.location_captured_at ?? asset?.updated_at ?? ""
  };
}

function formatLocationSummary(location: CapturedLocation | null) {
  if (!location) {
    return "Not captured";
  }

  const latitude = location.latitude.toFixed(6);
  const longitude = location.longitude.toFixed(6);
  const accuracy = location.accuracy ? ` ±${Math.round(location.accuracy)}m` : "";
  const capturedAt = location.capturedAt ? ` | ${formatRelativeDate(location.capturedAt)}` : "";

  return `${latitude}, ${longitude}${accuracy}${capturedAt}`;
}

function formatLocationError(error: unknown) {
  if (typeof GeolocationPositionError !== "undefined" && error instanceof GeolocationPositionError) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return "Location access was denied. Allow location permission and try again.";
      case error.POSITION_UNAVAILABLE:
        return "The device could not determine a location.";
      case error.TIMEOUT:
        return "Location capture timed out. Try again outside or with a stronger signal.";
      default:
        return error.message || "Unable to capture location.";
    }
  }

  return error instanceof Error ? error.message : "Unable to capture location.";
}
