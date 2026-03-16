"use client";

import Link from "next/link";
import { CalendarClock, CheckSquare, ChevronRight, ClipboardList, Filter } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppShell, ContextBar } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { formatPmFrequency, getPmDueBucket } from "@/lib/pm";
import type { AssetListItem, PmDueItem, PmLogRecord } from "@/lib/types";
import { formatEquipmentTypeLabel } from "@/lib/utils";

type RecentLogItem = PmLogRecord & {
  assets?: { equipment_tag?: string | null; equipment_type?: string | null } | null;
};

type Filters = {
  customerId: string;
  siteId: string;
  status: "all" | "overdue" | "due-soon" | "upcoming";
  frequency: string;
};

export default function PmPage() {
  const [items, setItems] = useState<PmDueItem[]>([]);
  const [recentLogs, setRecentLogs] = useState<RecentLogItem[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [sites, setSites] = useState<Array<{ id: string; name: string; customer_id: string }>>([]);
  const [candidateAssets, setCandidateAssets] = useState<AssetListItem[]>([]);
  const [showEnrollPanel, setShowEnrollPanel] = useState(false);
  const [enrollCustomerId, setEnrollCustomerId] = useState("");
  const [enrollSiteId, setEnrollSiteId] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [enrollForm, setEnrollForm] = useState({
    title: "Quarterly PM",
    frequencyMonths: "3",
    startDate: new Date().toISOString().slice(0, 10),
    instructions: "",
    checklistText: ""
  });
  const [enrollMessage, setEnrollMessage] = useState("");
  const [enrollError, setEnrollError] = useState("");
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [isSavingEnrollment, setIsSavingEnrollment] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    customerId: "",
    siteId: "",
    status: "all",
    frequency: ""
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [pmResponse, customersResponse, sitesResponse] = await Promise.all([
          fetch("/api/pm", { cache: "no-store" }),
          fetch("/api/customers", { cache: "no-store" }),
          fetch("/api/sites", { cache: "no-store" })
        ]);

        if (pmResponse.ok) {
          const payload = await pmResponse.json();
          setItems(payload.items ?? []);
          setRecentLogs(payload.recentLogs ?? []);
        }
        if (customersResponse.ok) {
          const payload = await customersResponse.json();
          setCustomers(payload.customers ?? []);
        }
        if (sitesResponse.ok) {
          const payload = await sitesResponse.json();
          setSites(payload.sites ?? []);
        }
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const customerOptions = useMemo(
    () =>
      customers.length
        ? customers
        : Array.from(
            new Map(
              items
                .filter((item) => item.customer)
                .map((item) => [item.customer!.id, { id: item.customer!.id, name: item.customer!.name }])
            ).values()
          ),
    [customers, items]
  );

  const siteOptions = useMemo(
    () =>
      sites.length
        ? sites.map((site) => ({ id: site.id, name: site.name }))
        : Array.from(
            new Map(items.map((item) => [item.site.id, { id: item.site.id, name: item.site.name }])).values()
          ),
    [items, sites]
  );

  const enrollSiteOptions = useMemo(
    () => sites.filter((site) => !enrollCustomerId || site.customer_id === enrollCustomerId),
    [enrollCustomerId, sites]
  );

  const availableAssets = useMemo(
    () =>
      candidateAssets.filter((asset) => {
        const hasProgram = Array.isArray(asset.pm_programs) && asset.pm_programs.length > 0;
        return !hasProgram;
      }),
    [candidateAssets]
  );

  const selectedChecklistTemplate = useMemo(
    () =>
      enrollForm.checklistText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    [enrollForm.checklistText]
  );

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const bucket = getPmDueBucket(item.program.next_due_at);

        if (filters.customerId && item.customer?.id !== filters.customerId) {
          return false;
        }
        if (filters.siteId && item.site.id !== filters.siteId) {
          return false;
        }
        if (filters.status !== "all" && bucket !== filters.status) {
          return false;
        }
        if (filters.frequency && String(item.program.frequency_months) !== filters.frequency) {
          return false;
        }

        return true;
      }),
    [filters, items]
  );

  const grouped = useMemo(
    () => ({
      overdue: filteredItems.filter((item) => getPmDueBucket(item.program.next_due_at) === "overdue"),
      dueSoon: filteredItems.filter((item) => getPmDueBucket(item.program.next_due_at) === "due-soon"),
      upcoming: filteredItems.filter((item) => getPmDueBucket(item.program.next_due_at) === "upcoming")
    }),
    [filteredItems]
  );

  useEffect(() => {
    async function loadCandidateAssets() {
      if (!enrollSiteId) {
        setCandidateAssets([]);
        setSelectedAssetIds([]);
        return;
      }

      setIsLoadingCandidates(true);
      setEnrollError("");
      setEnrollMessage("");

      try {
        const response = await fetch(`/api/assets?siteId=${encodeURIComponent(enrollSiteId)}&limit=200`, {
          cache: "no-store"
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load site assets");
        }

        setCandidateAssets(payload.assets ?? []);
        setSelectedAssetIds([]);
      } catch (error) {
        setEnrollError(error instanceof Error ? error.message : "Unable to load site assets");
      } finally {
        setIsLoadingCandidates(false);
      }
    }

    void loadCandidateAssets();
  }, [enrollSiteId]);

  async function refreshPmData() {
    const response = await fetch("/api/pm", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    setItems(payload.items ?? []);
    setRecentLogs(payload.recentLogs ?? []);
  }

  async function handleEnrollAssets() {
    if (!selectedAssetIds.length) {
      setEnrollError("Select at least one asset to enroll.");
      return;
    }

    setIsSavingEnrollment(true);
    setEnrollError("");
    setEnrollMessage("");

    try {
      const response = await fetch("/api/pm/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetIds: selectedAssetIds,
          title: enrollForm.title,
          frequencyMonths: Number(enrollForm.frequencyMonths),
          startDate: enrollForm.startDate,
          instructions: enrollForm.instructions,
          checklistTemplate: selectedChecklistTemplate
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to enroll selected assets");
      }

      const enrolledCount = payload.enrolledAssetIds?.length ?? 0;
      const skippedCount = payload.skippedAssetIds?.length ?? 0;
      setEnrollMessage(
        skippedCount
          ? `Enrolled ${enrolledCount} assets. Skipped ${skippedCount} that already had PM programs.`
          : `Enrolled ${enrolledCount} assets in PM tracking.`
      );
      await refreshPmData();
      setCandidateAssets((current) =>
        current.map((asset) =>
          selectedAssetIds.includes(asset.id) ? { ...asset, pm_programs: [{ id: "created", is_active: true }] } : asset
        )
      );
      setSelectedAssetIds([]);
    } catch (error) {
      setEnrollError(error instanceof Error ? error.message : "Unable to enroll selected assets");
    } finally {
      setIsSavingEnrollment(false);
    }
  }

  function toggleAssetSelection(assetId: string) {
    setSelectedAssetIds((current) =>
      current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId]
    );
  }

  return (
    <AppShell
      title="PM Tracker"
      description="Track recurring PM work, see what is due, and drill into maintenance history by asset."
      contextBar={<ContextBar items={[{ label: "More", href: "/more" }, { label: "PM Tracker" }]} />}
    >
      {loading ? (
        <section className="panel p-5 md:p-6">
          <EmptyState title="Loading PM tracker" body="Pulling due assets, cadence details, and recent PM work." />
        </section>
      ) : (
        <div className="grid gap-6">
          <section className="panel p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">Overview</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Due list</h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => setShowEnrollPanel((current) => !current)}
                >
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Enroll Assets
                </button>
                <Filter className="h-5 w-5 text-slate" />
              </div>
            </div>

            {showEnrollPanel ? (
              <div className="mt-5 rounded-3xl bg-mist p-4 md:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                      Batch enrollment
                    </div>
                    <div className="mt-1 text-sm text-slate">
                      Select a customer, then a site, then one or more assets. One PM setup will be applied to all selected assets.
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <select
                    className="field"
                    value={enrollCustomerId}
                    onChange={(event) => {
                      setEnrollCustomerId(event.target.value);
                      setEnrollSiteId("");
                      setCandidateAssets([]);
                      setSelectedAssetIds([]);
                    }}
                  >
                    <option value="">Select customer</option>
                    {customerOptions.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="field"
                    value={enrollSiteId}
                    disabled={!enrollCustomerId}
                    onChange={(event) => setEnrollSiteId(event.target.value)}
                  >
                    <option value="">{enrollCustomerId ? "Select site" : "Select customer first"}</option>
                    {enrollSiteOptions.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                  <div className="rounded-3xl bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                          Asset selection
                        </div>
                        <div className="mt-1 text-sm text-slate">
                          Only assets without PM programs are selectable.
                        </div>
                      </div>
                      {selectedAssetIds.length ? (
                        <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate">
                          {selectedAssetIds.length} selected
                        </span>
                      ) : null}
                    </div>

                    {isLoadingCandidates ? (
                      <div className="mt-4">
                        <EmptyState title="Loading assets" body="Pulling assets for the selected site." />
                      </div>
                    ) : enrollSiteId ? (
                      availableAssets.length ? (
                        <div className="mt-4 grid gap-3">
                          {availableAssets.map((asset) => {
                            const selected = selectedAssetIds.includes(asset.id);
                            return (
                              <label
                                key={asset.id}
                                className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition ${
                                  selected
                                    ? "border-moss/40 bg-moss/10"
                                    : "border-ink/10 bg-white hover:border-moss/30"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleAssetSelection(asset.id)}
                                  className="mt-1"
                                />
                                <div>
                                  <div className="font-semibold text-ink">
                                    {asset.equipment_tag || asset.temporary_identifier || asset.equipment_type}
                                    {asset.equipment_tag ||
                                      asset.temporary_identifier ||
                                      formatEquipmentTypeLabel(asset.equipment_type)}
                                  </div>
                                  <div className="mt-1 text-sm text-slate">
                                    {asset.manufacturer || "Unknown manufacturer"}
                                    {asset.model ? ` | ${asset.model}` : ""}
                                    {asset.serial ? ` | ${asset.serial}` : ""}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="mt-4">
                          <EmptyState
                            title="No available assets"
                            body="Every asset at this site is already enrolled in PM tracking, or there are no assets here yet."
                          />
                        </div>
                      )
                    ) : (
                      <div className="mt-4">
                        <EmptyState title="Select a site" body="Choose a customer and site to load assets for enrollment." />
                      </div>
                    )}
                  </div>

                  <div className="rounded-3xl bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                      Shared PM setup
                    </div>
                    <div className="mt-1 text-sm text-slate">
                      These settings will be applied to every selected asset.
                    </div>

                    <div className="mt-4 space-y-4">
                      <Field label="Title">
                        <input
                          className="field"
                          value={enrollForm.title}
                          onChange={(event) => setEnrollForm((current) => ({ ...current, title: event.target.value }))}
                        />
                      </Field>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Cadence">
                          <select
                            className="field"
                            value={enrollForm.frequencyMonths}
                            onChange={(event) =>
                              setEnrollForm((current) => ({ ...current, frequencyMonths: event.target.value }))
                            }
                          >
                            <option value="1">Monthly</option>
                            <option value="3">Quarterly</option>
                            <option value="6">Semiannual</option>
                            <option value="12">Annual</option>
                          </select>
                        </Field>
                        <Field label="Start date">
                          <input
                            className="field"
                            type="date"
                            value={enrollForm.startDate}
                            onChange={(event) =>
                              setEnrollForm((current) => ({ ...current, startDate: event.target.value }))
                            }
                          />
                        </Field>
                      </div>
                      <Field label="Instructions">
                        <textarea
                          className="field min-h-24"
                          value={enrollForm.instructions}
                          onChange={(event) =>
                            setEnrollForm((current) => ({ ...current, instructions: event.target.value }))
                          }
                        />
                      </Field>
                      <Field label="Checklist template">
                        <textarea
                          className="field min-h-24"
                          placeholder="One checklist item per line"
                          value={enrollForm.checklistText}
                          onChange={(event) =>
                            setEnrollForm((current) => ({ ...current, checklistText: event.target.value }))
                          }
                        />
                      </Field>
                      <button
                        className="button-primary w-full"
                        type="button"
                        onClick={() => void handleEnrollAssets()}
                        disabled={!selectedAssetIds.length || isSavingEnrollment}
                      >
                        {isSavingEnrollment
                          ? "Enrolling assets..."
                          : selectedAssetIds.length
                            ? `Enroll ${selectedAssetIds.length} Assets`
                            : "Enroll Assets"}
                      </button>
                      {enrollMessage ? (
                        <p className="rounded-2xl bg-mist px-4 py-3 text-sm text-slate">{enrollMessage}</p>
                      ) : null}
                      {enrollError ? (
                        <p className="rounded-2xl bg-mist px-4 py-3 text-sm text-slate">{enrollError}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <select
                className="field"
                value={filters.customerId}
                onChange={(event) => setFilters((current) => ({ ...current, customerId: event.target.value }))}
              >
                <option value="">All customers</option>
                {customerOptions.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
              <select
                className="field"
                value={filters.siteId}
                onChange={(event) => setFilters((current) => ({ ...current, siteId: event.target.value }))}
              >
                <option value="">All sites</option>
                {siteOptions.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
              <select
                className="field"
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value as Filters["status"]
                  }))
                }
              >
                <option value="all">All statuses</option>
                <option value="overdue">Overdue</option>
                <option value="due-soon">Due soon</option>
                <option value="upcoming">Upcoming</option>
              </select>
              <select
                className="field"
                value={filters.frequency}
                onChange={(event) => setFilters((current) => ({ ...current, frequency: event.target.value }))}
              >
                <option value="">All cadences</option>
                <option value="1">Monthly</option>
                <option value="3">Quarterly</option>
                <option value="6">Semiannual</option>
                <option value="12">Annual</option>
              </select>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MetricCard label="Overdue" value={grouped.overdue.length} tone="rose" />
              <MetricCard label="Due soon" value={grouped.dueSoon.length} tone="amber" />
              <MetricCard label="Upcoming" value={grouped.upcoming.length} tone="moss" />
            </div>
          </section>

          <PmSection title="Overdue" body="Assets that are already past the next due date." items={grouped.overdue} />
          <PmSection title="Due soon" body="Assets due within the next two weeks." items={grouped.dueSoon} />
          <PmSection title="Upcoming" body="Assets with PMs scheduled beyond the next two weeks." items={grouped.upcoming} />

          <section className="panel p-5 md:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">History</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Completed recently</h2>
              </div>
              <ClipboardList className="h-5 w-5 text-slate" />
            </div>

            {recentLogs.length ? (
              <div className="mt-5 grid gap-3">
                {recentLogs.map((log) => (
                  <div key={log.id} className="rounded-3xl border border-ink/10 bg-white px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-ink">{log.summary || "PM logged"}</div>
                        <div className="mt-1 text-sm text-slate">
                          {log.assets?.equipment_tag ||
                            formatEquipmentTypeLabel(log.assets?.equipment_type) ||
                            "Asset"}{" "}
                          | Due {log.due_at}
                          {log.completed_at ? ` | Completed ${log.completed_at}` : ""}
                        </div>
                      </div>
                      <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate">
                        {log.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5">
                <EmptyState title="No PM work logged yet" body="Enrolled assets will show recent maintenance history here." />
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}

function PmSection({
  title,
  body,
  items
}: {
  title: string;
  body: string;
  items: PmDueItem[];
}) {
  return (
    <section className="panel p-5 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">{title}</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">{title} PMs</h2>
          <p className="mt-2 text-sm text-slate">{body}</p>
        </div>
        <CalendarClock className="h-5 w-5 text-slate" />
      </div>

      {items.length ? (
        <div className="mt-5 grid gap-3">
          {items.map((item) => (
            <Link
              key={item.program.id}
              href={`/pm/${encodeURIComponent(item.asset.id)}`}
              className="rounded-3xl border border-ink/10 bg-white px-4 py-4 transition hover:border-moss/40 hover:bg-white/90"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-ink">
                    {item.asset.equipment_tag ||
                      item.asset.temporary_identifier ||
                      formatEquipmentTypeLabel(item.asset.equipment_type)}
                  </div>
                  <div className="mt-1 text-sm text-slate">
                    {(item.customer?.name ? `${item.customer.name} | ` : "") + item.site.name}
                  </div>
                  <div className="mt-2 text-sm text-slate">
                    {formatPmFrequency(item.program.frequency_months)} | Due {item.program.next_due_at}
                    {item.program.last_completed_at ? ` | Last done ${item.program.last_completed_at}` : ""}
                  </div>
                  {item.lastLog?.summary ? (
                    <div className="mt-2 text-sm text-slate">Latest note: {item.lastLog.summary}</div>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate">
                    {getPmDueBucket(item.program.next_due_at).replace("-", " ")}
                  </span>
                  <ChevronRight className="h-5 w-5 text-slate" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-5">
          <EmptyState title={`No ${title.toLowerCase()} PMs`} body="Adjust filters or enroll assets from asset detail pages." />
        </div>
      )}
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "rose" | "amber" | "moss";
}) {
  const toneClass =
    tone === "rose"
      ? "bg-rose-50 text-rose-700"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700"
        : "bg-moss/10 text-ink";

  return (
    <div className={`rounded-3xl px-4 py-4 ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.18em]">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
