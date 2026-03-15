"use client";

import Link from "next/link";
import { Download, FileSpreadsheet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppShell, ContextBar } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";

export default function ReportsPage() {
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [sites, setSites] = useState<
    Array<{
      id: string;
      name: string;
      customer_id: string;
      customers?: { name: string } | Array<{ name: string }> | null;
    }>
  >([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [customersResponse, sitesResponse] = await Promise.all([
          fetch("/api/customers", { cache: "no-store" }),
          fetch("/api/sites", { cache: "no-store" })
        ]);

        if (customersResponse.ok) {
          const data = await customersResponse.json();
          setCustomers(data.customers ?? []);
        }

        if (sitesResponse.ok) {
          const data = await sitesResponse.json();
          setSites(data.sites ?? []);
        }
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const siteOptions = useMemo(
    () =>
      sites.map((site) => ({
        id: site.id,
        label: getSiteCustomerName(site)
          ? `${getSiteCustomerName(site)} | ${site.name}`
          : site.name
      })),
    [sites]
  );

  return (
    <AppShell
      title="Reports"
      description="Download CSV exports by customer or site for quoting, cleanup, and offline review."
      contextBar={
        <ContextBar items={[{ label: "More", href: "/more" }, { label: "Reports" }]} />
      }
    >
      {loading ? (
        <section className="panel p-5 md:p-6">
          <EmptyState
            title="Loading reports"
            body="Pulling customers and sites so export options can be generated."
          />
        </section>
      ) : customers.length || sites.length ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="panel p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                  Customer Export
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Export by customer</h2>
              </div>
              <FileSpreadsheet className="h-6 w-6 text-slate" />
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="label" htmlFor="customer-report">
                  Customer
                </label>
                <select
                  id="customer-report"
                  className="field"
                  value={selectedCustomerId}
                  onChange={(event) => setSelectedCustomerId(event.target.value)}
                >
                  <option value="">Select customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCustomerId ? (
                <a
                  className="button-primary inline-flex w-full items-center justify-center"
                  href={`/api/reports/export?scope=customer&id=${encodeURIComponent(selectedCustomerId)}`}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Customer CSV
                </a>
              ) : (
                <p className="text-sm text-slate">
                  Select a customer to download a CSV with all of its site assets.
                </p>
              )}
            </div>
          </section>

          <section className="panel p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
                  Site Export
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">Export by site</h2>
              </div>
              <FileSpreadsheet className="h-6 w-6 text-slate" />
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="label" htmlFor="site-report">
                  Site
                </label>
                <select
                  id="site-report"
                  className="field"
                  value={selectedSiteId}
                  onChange={(event) => setSelectedSiteId(event.target.value)}
                >
                  <option value="">Select site</option>
                  {siteOptions.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.label}
                    </option>
                  ))}
                </select>
              </div>

              {selectedSiteId ? (
                <a
                  className="button-primary inline-flex w-full items-center justify-center"
                  href={`/api/reports/export?scope=site&id=${encodeURIComponent(selectedSiteId)}`}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Site CSV
                </a>
              ) : (
                <p className="text-sm text-slate">
                  Select a site to download a CSV for just that location.
                </p>
              )}
            </div>
          </section>
        </div>
      ) : (
        <section className="panel p-5 md:p-6">
          <EmptyState
            title="No report context yet"
            body="Create a customer and site first, then CSV exports will be available here."
            action={
              <Link href="/sites" className="button-primary">
                Open Sites
              </Link>
            }
          />
        </section>
      )}
    </AppShell>
  );
}

function getSiteCustomerName(site: {
  customers?: { name: string } | Array<{ name: string }> | null;
}) {
  if (Array.isArray(site.customers)) {
    return site.customers[0]?.name;
  }

  return site.customers?.name;
}
