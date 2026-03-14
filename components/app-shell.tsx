"use client";

import Link from "next/link";
import { Building2, Home, MapPinned, Search, UploadCloud } from "lucide-react";

import { useSyncManager } from "@/hooks/use-sync-manager";
import { formatRelativeDate } from "@/lib/utils";

export function AppShell({
  children,
  title,
  description
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
}) {
  const { isSyncing, lastSyncedAt, syncNow } = useSyncManager();

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-8 pt-6 md:px-8">
      <header className="mb-6 panel overflow-hidden">
        <div className="bg-grid bg-[size:22px_22px] px-5 py-6 md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-moss">
                Plant Audit
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
                {title}
              </h1>
              {description ? (
                <p className="mt-2 max-w-2xl text-sm text-slate">{description}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-ink/10 bg-white/80 px-4 py-3 text-right text-xs text-slate">
                <div className="font-semibold text-ink">
                  {isSyncing ? "Syncing..." : "Ready"}
                </div>
                <div>Last sync: {formatRelativeDate(lastSyncedAt)}</div>
              </div>
              <button className="button-secondary" onClick={() => void syncNow()}>
                <UploadCloud className="mr-2 h-4 w-4" />
                Sync now
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <nav className="sticky bottom-4 mt-6 grid grid-cols-5 gap-3 panel p-3">
        <NavItem href="/home" label="Home" icon={<Home className="h-5 w-5" />} />
        <NavItem href="/customers" label="Customers" icon={<Building2 className="h-5 w-5" />} />
        <NavItem href="/sites" label="Sites" icon={<MapPinned className="h-5 w-5" />} />
        <NavItem href="/search" label="Search" icon={<Search className="h-5 w-5" />} />
        <Link href="/assets/new" className="button-primary">
          Add Asset
        </Link>
      </nav>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center justify-center rounded-2xl border border-transparent px-4 py-3 text-xs font-semibold text-slate transition hover:border-ink/10 hover:bg-white"
    >
      {icon}
      <span className="mt-1">{label}</span>
    </Link>
  );
}
