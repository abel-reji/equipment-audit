"use client";

import Link from "next/link";
import { CalendarClock, ChevronRight, ClipboardList, Filter } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppShell, ContextBar } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { formatPmFrequency, getPmDueBucket } from "@/lib/pm";
import type { PmDueItem, PmLogRecord } from "@/lib/types";

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
        const response = await fetch("/api/pm", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        setItems(payload.items ?? []);
        setRecentLogs(payload.recentLogs ?? []);
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const customerOptions = useMemo(
    () =>
      Array.from(
        new Map(
          items
            .filter((item) => item.customer)
            .map((item) => [item.customer!.id, { id: item.customer!.id, name: item.customer!.name }])
        ).values()
      ),
    [items]
  );

  const siteOptions = useMemo(
    () =>
      Array.from(
        new Map(items.map((item) => [item.site.id, { id: item.site.id, name: item.site.name }])).values()
      ),
    [items]
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
              <Filter className="h-5 w-5 text-slate" />
            </div>

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
                          {log.assets?.equipment_tag || log.assets?.equipment_type || "Asset"} | Due {log.due_at}
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
                    {item.asset.equipment_tag || item.asset.temporary_identifier || item.asset.equipment_type}
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
