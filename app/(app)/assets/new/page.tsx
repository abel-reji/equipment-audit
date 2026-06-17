"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  ShieldAlert,
  Trash2
} from "lucide-react";
import { Suspense, useEffect, useId, useMemo, useState } from "react";

import { AppShell, ContextBar } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { SyncStatusPill } from "@/components/sync-status-pill";
import { equipmentTypeOptions, photoTypeOptions } from "@/lib/constants";
import { getLocalDb } from "@/lib/local-db";
import {
  addDraftPhoto,
  deleteDraftPhoto,
  hydrateDraftPhotoPreviews,
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

type WizardStep = "photos" | "context" | "details" | "driver" | "review";

interface WorkspaceSnapshot {
  assetId: string;
  currentStep: WizardStep;
  photoType: PhotoType;
  form: typeof initialAssetForm;
  location: CapturedLocation | null;
}

const WORKSPACE_KEY = "new-asset-workspace-v2";

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

const wizardSteps: Array<{ id: WizardStep; label: string; description: string }> = [
  {
    id: "photos",
    label: "Photos",
    description: "Capture evidence first while you are standing at the equipment."
  },
  {
    id: "context",
    label: "Context",
    description: "Attach the asset to the right customer, site, and equipment type."
  },
  {
    id: "details",
    label: "Details",
    description: "Record the primary equipment identifiers and field notes."
  },
  {
    id: "driver",
    label: "Driver",
    description: "Add driver, coupling, and geotag details if you have them."
  },
  {
    id: "review",
    label: "Review",
    description: "Check the record and save it into the synced queue."
  }
];

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
  const [currentStep, setCurrentStep] = useState<WizardStep>("photos");

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

      const workspace = readWorkspaceSnapshot();
      if (!workspace) {
        return;
      }

      setAssetId(workspace.assetId);
      setCurrentStep(workspace.currentStep);
      setPhotoType(workspace.photoType);
      setLocation(workspace.location);
      setForm({
        ...initialAssetForm,
        ...workspace.form,
        siteId: selectedSiteId || workspace.form.siteId
      });

      const draftPhotos = hydrateDraftPhotoPreviews(
        await db.draftPhotos.where("assetDraftId").equals(workspace.assetId).toArray()
      );
      setPhotos(draftPhotos);
    }

    void bootstrap();
  }, [selectedSiteId]);

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
  const currentStepIndex = wizardSteps.findIndex((step) => step.id === currentStep);
  const photoCounts = summarizePhotoStatuses(photos);
  const hasUnsavedWorkspace = hasWorkspaceChanges(form, photos, location);
  const canAdvance =
    currentStep !== "context" || Boolean(form.customerId && form.siteId && form.equipmentType);
  const canSave = Boolean(form.customerId && form.siteId && form.equipmentType);

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

  useEffect(() => {
    writeWorkspaceSnapshot({
      assetId,
      currentStep,
      photoType,
      form,
      location
    });
  }, [assetId, currentStep, form, location, photoType, photos.length]);

  useEffect(() => {
    if (!hasUnsavedWorkspace) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedWorkspace]);

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

  async function handleDeletePhoto(photoId: string) {
    await deleteDraftPhoto(photoId);
    setPhotos((current) => current.filter((photo) => photo.id !== photoId));
    setLastSavedAssetId(null);
  }

  async function handleSaveDraft() {
    if (!canSave) {
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
    const nextAssetId = makeClientId("asset");
    const preservedCustomerId = form.customerId;
    const preservedSiteId = form.siteId;

    setLastSavedAssetId(assetId);
    setAssetId(nextAssetId);
    setPhotos([]);
    setPhotoType("equipment");
    setLocation(null);
    setLocationError("");
    setCurrentStep("photos");
    setForm({
      ...initialAssetForm,
      customerId: preservedCustomerId,
      siteId: preservedSiteId
    });
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

  function handleNextStep() {
    if (!canAdvance || currentStepIndex >= wizardSteps.length - 1) {
      return;
    }

    setCurrentStep(wizardSteps[currentStepIndex + 1].id);
  }

  function handlePreviousStep() {
    if (currentStepIndex <= 0) {
      return;
    }

    setCurrentStep(wizardSteps[currentStepIndex - 1].id);
  }

  const selectedStepConfig = wizardSteps[currentStepIndex];

  return (
    <AppShell
      title="New Asset"
      description="Use the guided capture flow to collect photos first, then fill in only the details you can confirm."
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
      <section className="panel min-h-[72vh] p-5 md:p-6">
        <div className="flex flex-col gap-5 border-b border-ink/10 pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                Capture Wizard
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-ink">
                {selectedStepConfig.label}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate">
                {selectedStepConfig.description}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {lastSavedAssetId ? <SyncStatusPill status="synced" /> : null}
              {hasUnsavedWorkspace ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-2 text-xs font-medium text-amber-900">
                  <ShieldAlert className="h-4 w-4" />
                  Local workspace protected on this device
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-5">
            {wizardSteps.map((step, index) => {
              const isActive = step.id === currentStep;
              const isComplete = index < currentStepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  className={[
                    "rounded-3xl border px-4 py-3 text-left transition",
                    isActive
                      ? "border-ink bg-ink text-white"
                      : isComplete
                        ? "border-moss/25 bg-moss/10 text-ink"
                        : "border-ink/10 bg-white text-slate"
                  ].join(" ")}
                  onClick={() => setCurrentStep(step.id)}
                >
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em]">
                    Step {index + 1}
                  </div>
                  <div className="mt-1 text-sm font-semibold">{step.label}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="py-6">
          {currentStep === "photos" ? (
            <div className="space-y-6">
              <div className="grid gap-5 lg:grid-cols-[0.62fr_1fr]">
                <div className="rounded-3xl bg-mist p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                        Capture Status
                      </div>
                      <div className="mt-2 text-2xl font-semibold text-ink">
                        {photos.length} photo{photos.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    <Camera className="h-6 w-6 text-slate" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <SyncStatusPill status={photoCounts.primaryStatus} />
                    {photoCounts.failed > 0 ? (
                      <span className="pill bg-red-100 text-red-800">
                        {photoCounts.failed} failed
                      </span>
                    ) : null}
                    {photoCounts.pending > 0 ? (
                      <span className="pill bg-amber-100 text-amber-900">
                        {photoCounts.pending} pending save
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-4 text-sm text-slate">
                    Captured photos stay cached on this device even if the page reloads. They do
                    not sync to other devices until you save the asset.
                  </p>
                </div>

                <div className="rounded-3xl border border-ink/10 p-4">
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

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label
                      htmlFor={cameraInputId}
                      className="button-primary w-full cursor-pointer justify-center"
                    >
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

                    <label
                      htmlFor={libraryInputId}
                      className="button-secondary w-full cursor-pointer justify-center"
                    >
                      Upload from device
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
                </div>
              </div>

              {photos.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {photos.map((photo) => (
                    <div
                      key={photo.id}
                      className="overflow-hidden rounded-3xl border border-ink/10 bg-white"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt={photo.photoType}
                        src={photo.previewUrl}
                        className="h-44 w-full object-cover"
                      />
                      <div className="flex items-start justify-between gap-3 px-3 py-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold capitalize text-ink">
                            {photo.photoType.replace("-", " ")}
                          </div>
                          <div className="mt-1 truncate text-xs text-slate">{photo.fileName}</div>
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-red-200 text-red-700 transition hover:bg-red-50"
                          onClick={() => void handleDeletePhoto(photo.id)}
                          aria-label={`Delete ${photo.photoType} photo`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Capture photos first when you can"
                  body="This flow now keeps the camera controls at the top so evidence collection happens before the long-form details."
                />
              )}
            </div>
          ) : null}

          {currentStep === "context" ? (
            <div className="grid gap-5 lg:grid-cols-[1fr_0.72fr]">
              <div className="space-y-5">
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
                    <option value="">
                      {form.customerId ? "Select a site" : "Select a customer first"}
                    </option>
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
              </div>

              <div className="rounded-3xl bg-mist p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                  Current context
                </div>
                <div className="mt-3 space-y-3 text-sm text-slate">
                  <div>
                    <div className="font-semibold text-ink">Customer</div>
                    <div>
                      {customers.find((customer) => customer.id === form.customerId)?.name ??
                        "Not selected"}
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-ink">Site</div>
                    <div>{selectedSite?.name ?? "Not selected"}</div>
                  </div>
                  <div>
                    <div className="font-semibold text-ink">Equipment type</div>
                    <div className="capitalize">{form.equipmentType}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {currentStep === "details" ? (
            <div className="space-y-5">
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
                  className="field min-h-32"
                  value={form.quickNote}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, quickNote: event.target.value }))
                  }
                />
              </div>
            </div>
          ) : null}

          {currentStep === "driver" ? (
            <div className="space-y-5">
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

              <div className="rounded-3xl bg-mist p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                      Geotag
                    </div>
                    <div className="mt-1 text-sm text-slate">
                      Capture location only if you are physically at the asset.
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
          ) : null}

          {currentStep === "review" ? (
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <ReviewCard
                  title="Context"
                  rows={[
                    {
                      label: "Customer",
                      value:
                        customers.find((customer) => customer.id === form.customerId)?.name ??
                        "Not selected"
                    },
                    { label: "Site", value: selectedSite?.name ?? "Not selected" },
                    { label: "Equipment type", value: form.equipmentType }
                  ]}
                />
                <ReviewCard
                  title="Capture"
                  rows={[
                    { label: "Photos", value: String(photos.length) },
                    {
                      label: "Location",
                      value: location ? formatLocationSummary(location) : "Not captured"
                    },
                    {
                      label: "Readiness",
                      value: canSave ? "Ready to save" : "Customer and site still required"
                    }
                  ]}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <ReviewCard
                  title="Primary details"
                  rows={[
                    { label: "Equipment tag", value: form.equipmentTag || "Not entered" },
                    { label: "Temporary ID", value: form.temporaryIdentifier || "Not entered" },
                    { label: "Manufacturer", value: form.manufacturer || "Not entered" },
                    { label: "Model", value: form.model || "Not entered" },
                    { label: "Serial", value: form.serial || "Not entered" }
                  ]}
                />
                <ReviewCard
                  title="Support notes"
                  rows={[
                    {
                      label: "Quick note",
                      value: form.quickNote || "Not entered"
                    },
                    {
                      label: "Driver serial",
                      value: form.driver.serialNumber || "Not entered"
                    },
                    {
                      label: "Coupling type",
                      value: form.coupling.couplingType || "Not entered"
                    }
                  ]}
                />
              </div>

              {lastSavedAssetId ? (
                <div className="rounded-3xl bg-mist px-4 py-4 text-sm text-slate">
                  Asset saved. Customer and site stayed selected so the next capture can start
                  immediately.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="safe-bottom sticky bottom-20 z-20 mt-4 border-t border-ink/10 bg-white/95 pt-4 backdrop-blur">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[auto_auto_1fr_auto]">
            <button
              className="button-secondary w-full justify-center"
              type="button"
              onClick={handlePreviousStep}
              disabled={currentStepIndex === 0}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </button>
            {currentStep !== "review" ? (
              <button
                className="button-primary w-full justify-center"
                type="button"
                onClick={handleNextStep}
                disabled={!canAdvance}
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </button>
            ) : (
              <button
                className="button-primary w-full justify-center"
                type="button"
                onClick={() => void handleSaveDraft()}
                disabled={!canSave}
              >
                Save asset
              </button>
            )}

            <div className="hidden lg:block" />

            {lastSavedAssetId ? (
              <Link
                href={`/assets/${encodeURIComponent(lastSavedAssetId)}`}
                className="button-secondary w-full justify-center"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                View saved asset
              </Link>
            ) : (
              <Link href="/sites" className="button-secondary w-full justify-center">
                Change site
              </Link>
            )}
          </div>
        </div>
      </section>

      {!sites.length || !customers.length ? (
        <div className="mt-6">
          <EmptyState
            title="No customer or site context yet"
            body="Create or sync a customer and site before field capture starts."
            action={
              <Link href="/sites" className="button-primary">
                Sites
              </Link>
            }
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

function ReviewCard({
  title,
  rows
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="rounded-3xl bg-mist p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">{title}</div>
      <div className="mt-3 space-y-3">
        {rows.map((row) => (
          <div key={`${title}-${row.label}`}>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate">
              {row.label}
            </div>
            <div className="mt-1 text-sm text-ink">{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function summarizePhotoStatuses(photos: DraftPhoto[]) {
  const failed = photos.filter((photo) => photo.uploadStatus === "failed").length;
  const pending = photos.filter((photo) => photo.uploadStatus !== "synced").length;

  if (failed > 0) {
    return { failed, pending, primaryStatus: "failed" as const };
  }

  if (!photos.length) {
    return { failed: 0, pending: 0, primaryStatus: "local-only" as const };
  }

  return { failed: 0, pending, primaryStatus: "local-only" as const };
}

function hasWorkspaceChanges(
  form: typeof initialAssetForm,
  photos: DraftPhoto[],
  location: CapturedLocation | null
) {
  if (photos.length || location) {
    return true;
  }

  return Boolean(
    form.equipmentTag ||
      form.manufacturer ||
      form.model ||
      form.serial ||
      form.quickNote ||
      form.temporaryIdentifier ||
      Object.values(form.driver).some(Boolean) ||
      Object.values(form.coupling).some(Boolean)
  );
}

function readWorkspaceSnapshot() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.localStorage.getItem(WORKSPACE_KEY);
    if (!value) {
      return null;
    }

    return JSON.parse(value) as WorkspaceSnapshot;
  } catch {
    return null;
  }
}

function writeWorkspaceSnapshot(snapshot: WorkspaceSnapshot) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(WORKSPACE_KEY, JSON.stringify(snapshot));
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
