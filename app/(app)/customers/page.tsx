"use client";

import Link from "next/link";
import { Building2, PlusCircle } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { SyncStatusPill } from "@/components/sync-status-pill";
import { getLocalDb } from "@/lib/local-db";
import { createCustomerDraft, seedCustomers } from "@/lib/local-data";
import type { CachedCustomer } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CachedCustomer[]>([]);
  const [search, setSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");

  async function refreshLocalState() {
    const db = getLocalDb();
    setCustomers(await db.customers.orderBy("updatedAt").reverse().toArray());
  }

  useEffect(() => {
    async function bootstrap() {
      await refreshLocalState();

      const response = await fetch("/api/customers", { cache: "no-store" });
      if (response.ok) {
        const data = await response.json();
        await seedCustomers(data.customers ?? []);
        await refreshLocalState();
      }
    }

    void bootstrap();
  }, []);

  async function handleCreateCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customerName.trim()) {
      return;
    }

    await createCustomerDraft({
      name: customerName.trim(),
      notes: customerNotes.trim()
    });

    setCustomerName("");
    setCustomerNotes("");
    await refreshLocalState();
  }

  const filteredCustomers = customers.filter((customer) =>
    [customer.name, customer.notes]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <AppShell
      title="Customers"
      description="Create customer records first, then use them as the parent context for site setup and future asset capture."
    >
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="panel p-5 md:p-6">
          <label className="label" htmlFor="customer-search">
            Search customers
          </label>
          <input
            id="customer-search"
            className="field"
            placeholder="Search customer name or notes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <div className="mt-5 space-y-3">
            {filteredCustomers.length ? (
              filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="rounded-3xl border border-ink/10 bg-white px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-ink">{customer.name}</div>
                      <div className="mt-1 text-sm text-slate">
                        {customer.notes || "No notes"}
                      </div>
                      <div className="mt-2 text-xs text-slate">
                        Updated {formatRelativeDate(customer.updatedAt)}
                      </div>
                    </div>
                    <SyncStatusPill status={customer.syncStatus} />
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No matching customers"
                body="Create the customer first, then move to Sites to add plant locations under that customer."
                action={<Link href="/sites" className="button-secondary">Go to sites</Link>}
              />
            )}
          </div>
        </section>

        <section className="panel p-5 md:p-6">
          <div className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-moss" />
            <h2 className="text-xl font-semibold text-ink">Add customer</h2>
          </div>

          <form className="mt-4 space-y-4" onSubmit={handleCreateCustomer}>
            <div>
              <label className="label" htmlFor="customer-name">
                Customer name
              </label>
              <input
                id="customer-name"
                className="field"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Acme Refining"
              />
            </div>

            <div>
              <label className="label" htmlFor="customer-notes">
                Notes
              </label>
              <textarea
                id="customer-notes"
                className="field min-h-24"
                value={customerNotes}
                onChange={(event) => setCustomerNotes(event.target.value)}
                placeholder="Account context, access notes, or internal reminders"
              />
            </div>

            <button className="button-primary w-full" type="submit">
              Save customer
            </button>
          </form>

          <div className="mt-6 rounded-3xl bg-mist px-4 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Building2 className="h-4 w-4 text-moss" />
              Recommended workflow
            </div>
            <p className="mt-2 text-sm text-slate">
              Save the customer here first. Then open Sites and assign each plant,
              terminal, or unit to that customer before capturing assets.
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
