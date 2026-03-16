"use client";

import Link from "next/link";
import { Camera, CheckCircle2, MapPin } from "lucide-react";
import { Suspense, useEffect, useId, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AppShell, ContextBar } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { SyncStatusPill } from "@/components/sync-status-pill";
import { equipmentTypeOptions, photoTypeOptions } from "@/lib/constants";
import { getLocalDb } from "@/lib/local-db";
import {
  addDraftPhoto,
  markSiteUsed,
  saveAssetDraft,
  seedCustomers,
  seedSites
} from "@/lib/local-data";
import type {
  AssetCouplingDetails,
  AssetDriverDetails,
  CachedCustomer,
  CachedSite,
  DraftPhoto,
  PhotoType
} from "@/lib/types";
import { formatRelativeDate, makeClientId } from "@/lib/utils";

interface CapturedLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
}

const initialAssetForm = {
  customerId: "",
  siteId: "",
  equipmentType: "pump",
  equipmentTag: "",
  manufacturer: "",
  model: "",
  serial: "",
  quickNote: "",
  temporaryIdentifier: "",
  driver: {
    motorOem: "",
    motorModel: "",
    serialNumber: "",
    hp: "",
    rpm: "",
    voltage: "",
    frame: ""
  } satisfies AssetDriverDetails,
  coupling: {
    oem: "",
    couplingType: "",
    size: "",
    spacer: "",
    notes: ""
  } satisfies AssetCouplingDetails
};

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

  const [customers, setCustomers] = useState<CachedCustomer[]>([]);
  const [sites, setSites] = useState<CachedSite[]>([]);
  const [assetId, setAssetId] = useState(() => makeClientId("asset"));
  const [form, setForm] = useState({
    ...initialAssetForm,
    siteId: selectedSiteId
  });
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const [photoType, setPhotoType] = useState<PhotoType>("equipment");
  const [lastSavedAssetId, setLastSavedAssetId] = useState<string | null>(null);
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [locationError, setLocationError] = useState("");
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);

  useEffect(() => {
    async function bootstrap() {
      const db = getLocalDb();
      const [localCustomers, localSites] = await Promise.all([
        db.customers.orderBy("name").toArray(),
        db.sites.orderBy("updatedAt").reverse().toArray()
      ]);
      setCustomers(localCustomers);
      setSites(localSites);

      if (!localCustomers.length || !localSites.length) {
        const response = await fetch("/api/bootstrap", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          await seedCustomers(data.customers ?? []);
          await seedSites(data.sites ?? []);
          const [seededCustomers, seededSites] = await Promise.all([
            db.customers.orderBy("name").toArray(),
            db.sites.orderBy("updatedAt").reverse().toArray()
          ]);
          setCustomers(seededCustomers);
          setSites(seededSites);
        }
      }
    }

    void bootstrap();
  }, []);

  const selectedSite = useMemo(
    () => sites.find((site) => site.id === form.siteId || site.serverId === form.siteId),
    [form.siteId, sites]
  );
  const filteredSites = useMemo(() => {
    if (!form.customerId) {
      return [];
    }

    return sites.filter(
      (site) =>
        site.customerId === form.customerId || site.customerServerId === form.customerId
    );
  }, [form.customerId, sites]);

  useEffect(() => {
    if (!selectedSiteId || !sites.length || !customers.length) {
      return;
    }

    const matchingSite = sites.find(
      (site) => site.id === selectedSiteId || site.serverId === selectedSiteId
    );

    if (!matchingSite) {
      return;
    }

    const matchingCustomer = customers.find(
      (customer) =>
        customer.id === matchingSite.customerId ||
        customer.serverId === matchingSite.customerId ||
        customer.id === matchingSite.customerServerId ||
        customer.serverId === matchingSite.customerServerId
    );

    setForm((current) => ({
      ...current,
      customerId:
        matchingCustomer?.id ??
        matchingCustomer?.serverId ??
        matchingSite.customerId ??
        matchingSite.customerServerId ??
        current.customerId,
      siteId: matchingSite.id
    }));
  }, [customers, selectedSiteId, sites]);

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
    setLastSavedAssetId(null);
  }

  async function handleSaveDraft() {
    if (!form.siteId || !form.equipmentType) {
      return;
    }

    await saveAssetDraft({
      id: assetId,
      siteId: selectedSite?.id ?? form.siteId,
      siteServerId: selectedSite?.serverId,
      equipmentType: form.equipmentType as typeof equipmentTypeOptions[number],
      equipmentTag: form.equipmentTag,
      manufacturer: form.manufacturer,
      model: form.model,
      serial: form.serial,
      latitude: location?.latitude,
      longitude: location?.longitude,
      locationAccuracyMeters: location?.accuracy ?? undefined,
      locationCapturedAt: location?.capturedAt,
      quickNote: form.quickNote,
      temporaryIdentifier: form.temporaryIdentifier,
      driver: form.driver,
      coupling: form.coupling,
      photoCount: photos.length
    });

    await markSiteUsed(selectedSite?.id ?? form.siteId);
    setLastSavedAssetId(assetId);
    setAssetId(makeClientId("asset"));
    setPhotos([]);
    setPhotoType("equipment");
    setLocation(null);
    setLocationError("");
    setForm((current) => ({
      ...initialAssetForm,
      customerId: current.customerId,
      siteId: current.siteId
    }));
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

      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        capturedAt: new Date().toISOString()
      });
      setLastSavedAssetId(null);
    } catch (error) {
      setLocationError(formatLocationError(error));
    } finally {
      setIsCapturingLocation(false);
    }
  }

  return (
    <AppShell
      title="New Asset"
      description="Capture only the details you can reliably grab in the field. Everything else can wait for desktop cleanup."
      contextBar={
        selectedSite ? (
          <ContextBar
            items={[
              { label: "Sites", href: "/sites" },
              {
                label: selectedSite.name,
                href: selectedSite.id ? `/sites/${encodeURIComponent(selectedSite.id)}` : undefined
              },
              { label: "New Asset" }
            ]}
          />
        ) : undefined
      }
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
            {lastSavedAssetId ? <SyncStatusPill status="synced" /> : null}
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <label className="label" htmlFor="customer-select">
                Customer
              </label>
              <select
                id="customer-select"
                className="field"
                value={form.customerId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    customerId: event.target.value,
                    siteId: ""
                  }))
                }
              >
                <option value="">Select a customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="site-select">
                Site
              </label>
              <select
                id="site-select"
                className="field"
                value={form.siteId}
                disabled={!form.customerId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, siteId: event.target.value }))
                }
              >
                <option value="">{form.customerId ? "Select a site" : "Select a customer first"}</option>
                {filteredSites.map((site) => (
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

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="equipment-model"
                label="Model"
                value={form.model}
                onChange={(value) => setForm((current) => ({ ...current, model: value }))}
              />
              <TextField
                id="equipment-serial"
                label="Serial"
                value={form.serial}
                onChange={(value) => setForm((current) => ({ ...current, serial: value }))}
              />
            </div>

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

            <div className="rounded-3xl bg-mist p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                Driver
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <TextField
                  id="driver-motor-oem"
                  label="Motor OEM"
                  value={form.driver.motorOem || ""}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      driver: { ...current.driver, motorOem: value }
                    }))
                  }
                />
                <TextField
                  id="driver-motor-model"
                  label="Motor model"
                  value={form.driver.motorModel || ""}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      driver: { ...current.driver, motorModel: value }
                    }))
                  }
                />
                <TextField
                  id="driver-serial"
                  label="Driver serial no."
                  value={form.driver.serialNumber || ""}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      driver: { ...current.driver, serialNumber: value }
                    }))
                  }
                />
                <TextField
                  id="driver-hp"
                  label="HP"
                  value={form.driver.hp || ""}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      driver: { ...current.driver, hp: value }
                    }))
                  }
                />
                <TextField
                  id="driver-rpm"
                  label="RPM"
                  value={form.driver.rpm || ""}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      driver: { ...current.driver, rpm: value }
                    }))
                  }
                />
                <TextField
                  id="driver-voltage"
                  label="Voltage"
                  value={form.driver.voltage || ""}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      driver: { ...current.driver, voltage: value }
                    }))
                  }
                />
                <TextField
                  id="driver-frame"
                  label="Frame"
                  value={form.driver.frame || ""}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      driver: { ...current.driver, frame: value }
                    }))
                  }
                />
              </div>
            </div>

            <div className="rounded-3xl bg-mist p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                Coupling
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <TextField
                  id="coupling-oem"
                  label="Coupling OEM"
                  value={form.coupling.oem || ""}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      coupling: { ...current.coupling, oem: value }
                    }))
                  }
                />
                <TextField
                  id="coupling-type"
                  label="Type"
                  value={form.coupling.couplingType || ""}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      coupling: { ...current.coupling, couplingType: value }
                    }))
                  }
                />
                <TextField
                  id="coupling-size"
                  label="Size"
                  value={form.coupling.size || ""}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      coupling: { ...current.coupling, size: value }
                    }))
                  }
                />
                <TextField
                  id="coupling-spacer"
                  label="Spacer"
                  value={form.coupling.spacer || ""}
                  onChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      coupling: { ...current.coupling, spacer: value }
                    }))
                  }
                />
              </div>
              <div className="mt-4">
                <div>
                  <label className="label" htmlFor="coupling-notes">
                    Coupling notes
                  </label>
                  <textarea
                    id="coupling-notes"
                    className="field min-h-24"
                    value={form.coupling.notes || ""}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        coupling: { ...current.coupling, notes: event.target.value }
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-mist p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                    Geotag
                  </div>
                  <div className="mt-1 text-sm text-slate">
                    Save the phone location with this asset while you are standing at it.
                  </div>
                </div>
                <MapPin className="h-5 w-5 text-slate" />
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => void handleCaptureLocation()}
                  disabled={isCapturingLocation}
                >
                  {isCapturingLocation ? "Capturing location..." : "Capture location"}
                </button>
              </div>

              <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate">
                {location ? formatLocationSummary(location) : "No location captured yet"}
              </div>

              {locationError ? (
                <p className="mt-3 text-sm text-slate">{locationError}</p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="panel p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                Photos
              </p>
            </div>
            <Camera className="h-6 w-6 text-slate" />
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <label className="label" htmlFor="photo-type">
                Photo of:
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
                title="Add photos when available"
                body="Photos are strongly recommended for field records, but you can save now and add them later."
              />
            )}
          </div>

          <div className="safe-bottom sticky bottom-20 z-20 mt-6 grid gap-3 rounded-3xl bg-white/92 p-3 shadow-panel backdrop-blur sm:grid-cols-2 md:static md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
            <button
              className="button-primary w-full"
              type="button"
              onClick={() => void handleSaveDraft()}
              disabled={!form.siteId}
            >
              Save asset
            </button>
            {lastSavedAssetId ? (
              <Link
                href={`/assets/${encodeURIComponent(lastSavedAssetId)}`}
                className="button-secondary w-full"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                View saved asset
              </Link>
            ) : (
              <Link href="/sites" className="button-secondary w-full">
                Change site
              </Link>
            )}
          </div>

          {lastSavedAssetId ? (
            <p className="mt-4 rounded-2xl bg-mist px-4 py-3 text-sm text-slate">
              Asset saved. Customer and site stayed selected so you can add the next asset faster.
            </p>
          ) : null}
        </section>
      </div>

      {!sites.length || !customers.length ? (
        <div className="mt-6">
          <EmptyState
            title="No customer or site context yet"
            body="Create or sync a customer and site before field capture starts."
            action={<Link href="/sites" className="button-primary">Sites</Link>}
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

function formatLocationSummary(location: CapturedLocation) {
  const latitude = location.latitude.toFixed(6);
  const longitude = location.longitude.toFixed(6);
  const accuracy = location.accuracy ? ` +/- ${Math.round(location.accuracy)}m` : "";

  return `${latitude}, ${longitude}${accuracy} | ${formatRelativeDate(location.capturedAt)}`;
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
