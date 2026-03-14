"use client";

import Link from "next/link";
import { SearchIcon } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";

interface SearchPayload {
  customers: Array<{ id: string; name: string; notes?: string | null }>;
  sites: Array<{ id: string; name: string; customer_name?: string; area_unit?: string | null }>;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchPayload>({ customers: [], sites: [] });
  const [searched, setSearched] = useState(false);

  async function runSearch() {
    if (!query.trim()) {
      setResults({ customers: [], sites: [] });
      setSearched(false);
      return;
    }

    const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, {
      cache: "no-store"
    });

    if (response.ok) {
      setResults(await response.json());
      setSearched(true);
    }
  }

  return (
    <AppShell
      title="Search"
      description="Search is intentionally narrow in phase 1: find the right customer or site, then drill into capture work from there."
    >
      <section className="panel p-5 md:p-6">
        <div className="flex gap-3">
          <input
            className="field"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search customer or site"
          />
          <button className="button-primary" type="button" onClick={() => void runSearch()}>
            <SearchIcon className="mr-2 h-4 w-4" />
            Search
          </button>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="panel p-5 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
            Customers
          </p>
          <h2 className="mt-2 text-xl font-semibold text-ink">Matching accounts</h2>
          <div className="mt-5 space-y-3">
            {results.customers.length ? (
              results.customers.map((customer) => (
                <Link
                  key={customer.id}
                  href="/customers"
                  className="block rounded-3xl border border-ink/10 bg-white px-4 py-4 transition hover:border-moss/50"
                >
                  <div className="font-semibold text-ink">{customer.name}</div>
                  <div className="mt-1 text-sm text-slate">{customer.notes || "No notes"}</div>
                </Link>
              ))
            ) : (
              <EmptyState
                title={searched ? "No matching customers" : "Search customers"}
                body="Customer records are available here once you enter a query."
              />
            )}
          </div>
        </section>

        <section className="panel p-5 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-moss">
            Sites
          </p>
          <h2 className="mt-2 text-xl font-semibold text-ink">Open a site context</h2>
          <div className="mt-5 space-y-3">
            {results.sites.length ? (
              results.sites.map((site) => (
                <Link
                  key={site.id}
                  href={`/sites/${encodeURIComponent(site.id)}`}
                  className="block rounded-3xl border border-ink/10 bg-white px-4 py-4 transition hover:border-moss/50"
                >
                  <div className="font-semibold text-ink">{site.name}</div>
                  <div className="mt-1 text-sm text-slate">
                    {site.customer_name || "Unknown customer"}
                    {site.area_unit ? ` · ${site.area_unit}` : ""}
                  </div>
                </Link>
              ))
            ) : (
              <EmptyState
                title={searched ? "No matching sites" : "Search sites"}
                body="Site results become the entry point back into capture and review."
              />
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
