"use client";

import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { SyncStatusPill } from "@/components/sync-status-pill";
import { getLocalDb } from "@/lib/local-db";
import { createSiteDraft, seedCustomers, seedSites } from "@/lib/local-data";
import type { CachedCustomer, CachedSite } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";

export default function SitesPage() {
  const [customers, setCustomers] = useState<CachedCustomer[]>([]);
  const [sites, setSites] = useState<CachedSite[]>([]);
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [siteForm, setSiteForm] = useState({
    customerId: "",
    name: "",
    address: "",
    areaUnit: "",
    notes: ""
  });

  async function refreshLocalState() {
    const db = getLocalDb();
    const [localCustomers, localSites] = await Promise.all([
      db.customers.orderBy("name").toArray(),
      db.sites.orderBy("updatedAt").reverse().toArray()
    ]);

    setCustomers(localCustomers);
    setSites(localSites);
  }

  useEffect(() => {
    async function bootstrap() {
      await refreshLocalState();

      const response = await fetch("/api/bootstrap", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        await seedCustomers(data.customers ?? []);
        await seedSites(data.sites ?? []);
        await refreshLocalState();
      }
    }

    void bootstrap();
  }, []);

  async function handleCreateSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!siteForm.customerId || !siteForm.name.trim()) {
      return;
    }

    await createSiteDraft({
      customerId: siteForm.customerId,
      name: siteForm.name.trim(),
      address: siteForm.address.trim(),
      areaUnit: siteForm.areaUnit.trim(),
      notes: siteForm.notes.trim()
    });

    setSiteForm({
      customerId: siteForm.customerId,
      name: "",
      address: "",
      areaUnit: "",
      notes: ""
    });
    setShowCreateForm(false);
    await refreshLocalState();
  }

  const filteredSites = sites.filter((site) =>
    [
      site.name,
      site.address,
      site.areaUnit,
      customers.find(
        (customer) =>
          customer.id === site.customerId || customer.serverId === site.customerServerId
      )?.name
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <AppShell
      title="Site Picker"
      description="Keep customer and site context lightweight so you can start the asset capture flow without admin overhead."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="panel p-5 md:p-6">
          <label className="label" htmlFor="site-search">
            Search sites
          </label>
          <input
            id="site-search"
            className="field"
            placeholder="Search by customer, site name, address, or area"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <div className="mt-5 space-y-3">
            {filteredSites.length ? (
              filteredSites.map((site) => (
                <Link
                  key={site.id}
                  href={`/sites/${encodeURIComponent(site.id)}`}
                  className="block rounded-3xl border border-ink/10 bg-white px-4 py-4 transition hover:border-moss/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                        {customers.find(
                          (customer) =>
                            customer.id === site.customerId ||
                            customer.serverId === site.customerServerId
                        )?.name || "Unknown customer"}
                      </div>
                      <div className="font-semibold text-ink">{site.name}</div>
                      <div className="mt-1 text-sm text-slate">
                        {site.address || site.areaUnit || "No address or area/unit entered"}
                      </div>
                      <div className="mt-2 text-xs text-slate">
                        Updated {formatRelativeDate(site.updatedAt)}
                      </div>
                    </div>
                    <SyncStatusPill status={site.syncStatus} />
                  </div>
                </Link>
              ))
            ) : (
              <EmptyState
                title="No matching sites"
                body="Create a customer first, then add a site below. Offline site saves will stay queued on this device."
              />
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section className="panel p-5 md:p-6">
            <h2 className="text-xl font-semibold text-ink">Customer required first</h2>
            <p className="mt-3 text-sm text-slate">
              Save or confirm the customer record before adding a new site. Asset
              capture stays site-based, and each site belongs to a customer.
            </p>
            <div className="mt-4">
              <Link href="/customers" className="button-secondary">
                Open customers
              </Link>
            </div>
          </section>

          <section className="panel p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-ink">Add site</h2>
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink/10 bg-white text-slate transition hover:border-moss hover:text-moss"
                type="button"
                aria-label={showCreateForm ? "Hide add site form" : "Show add site form"}
                onClick={() => setShowCreateForm((current) => !current)}
              >
                <PlusCircle className="h-5 w-5" />
              </button>
            </div>
            {!customers.length ? (
              <div className="mt-4">
                <EmptyState
                  title="No customers saved yet"
                  body="Save at least one customer in the Customers tab before creating sites."
                  action={<Link href="/customers" className="button-primary">Go to customers</Link>}
                />
              </div>
            ) : showCreateForm ? (
              <form className="mt-4 space-y-4" onSubmit={handleCreateSite}>
                <div>
                  <label className="label" htmlFor="customer-id">
                    Customer
                  </label>
                  <select
                    id="customer-id"
                    className="field"
                    value={siteForm.customerId}
                    onChange={(event) =>
                      setSiteForm((current) => ({
                        ...current,
                        customerId: event.target.value
                      }))
                    }
                  >
                    <option value="">Select customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="site-name">
                    Site name
                  </label>
                  <input
                    id="site-name"
                    className="field"
                    value={siteForm.name}
                    onChange={(event) =>
                      setSiteForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="South plant"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="site-address">
                      Address
                    </label>
                    <input
                      id="site-address"
                      className="field"
                      value={siteForm.address}
                      onChange={(event) =>
                        setSiteForm((current) => ({ ...current, address: event.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="site-area">
                      Area or unit
                    </label>
                    <input
                      id="site-area"
                      className="field"
                      value={siteForm.areaUnit}
                      onChange={(event) =>
                        setSiteForm((current) => ({ ...current, areaUnit: event.target.value }))
                      }
                      placeholder="Unit 300"
                    />
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="site-notes">
                    Notes
                  </label>
                  <textarea
                    id="site-notes"
                    className="field min-h-24"
                    value={siteForm.notes}
                    onChange={(event) =>
                      setSiteForm((current) => ({ ...current, notes: event.target.value }))
                    }
                  />
                </div>

                <button className="button-primary w-full" type="submit">
                  Save site draft
                </button>
              </form>
            ) : (
              <p className="mt-4 text-sm text-slate">
                Tap the plus icon when you need to add a new site.
              </p>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
