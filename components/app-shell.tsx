"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChevronRight, Home, MapPinned, Search, UploadCloud } from "lucide-react";

import { useSyncManager } from "@/hooks/use-sync-manager";
import { formatRelativeDate } from "@/lib/utils";

export function AppShell({
  children,
  title,
  description,
  contextBar
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
  contextBar?: React.ReactNode;
}) {
  const pathname = usePathname();
  const { isSyncing, lastSyncedAt, syncNow } = useSyncManager();

  return (
    <div className="safe-top mx-auto flex min-h-screen w-full max-w-6xl flex-col px-3 pb-28 pt-3 md:px-8 md:pb-8 md:pt-6">
      <header className="mb-4 overflow-hidden rounded-3xl border border-white/70 bg-white/78 shadow-panel backdrop-blur md:mb-6 md:rounded-4xl">
        <div className="bg-grid bg-[size:20px_20px] px-4 py-4 md:px-8 md:py-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-moss">
                Rotating Equipment Audit
              </p>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-ink md:mt-2 md:text-3xl">
                {title}
              </h1>
              {description ? (
                <p className="mt-1.5 max-w-2xl text-sm text-slate md:mt-2">{description}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2 self-start md:gap-3">
              <div className="rounded-xl border border-ink/10 bg-white/80 px-3 py-2 text-left text-[11px] text-slate md:rounded-2xl md:px-4 md:py-3 md:text-right md:text-xs">
                <div className="font-semibold text-ink md:text-sm">
                  {isSyncing ? "Syncing" : "Ready"}
                </div>
                <div>Last sync: {formatRelativeDate(lastSyncedAt)}</div>
              </div>
              <button className="button-secondary shrink-0" onClick={() => void syncNow()}>
                <UploadCloud className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Sync now</span>
              </button>
            </div>
          </div>
          {contextBar ? <div className="mt-4">{contextBar}</div> : null}
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <nav className="safe-bottom fixed inset-x-3 bottom-0 z-40 mt-6 rounded-[28px] border border-white/80 bg-white/92 p-2 shadow-panel backdrop-blur md:sticky md:inset-auto md:bottom-4 md:grid md:grid-cols-5 md:gap-3 md:rounded-4xl md:p-3">
        <div className="grid grid-cols-5 gap-1 md:contents">
          <NavItem
            href="/home"
            label="Home"
            icon={<Home className="h-5 w-5" />}
            active={pathname === "/home"}
          />
          <NavItem
            href="/customers"
            label="Customers"
            icon={<Building2 className="h-5 w-5" />}
            active={pathname === "/customers"}
          />
          <NavItem
            href="/sites"
            label="Sites"
            icon={<MapPinned className="h-5 w-5" />}
            active={pathname === "/sites" || pathname?.startsWith("/sites/")}
          />
          <NavItem
            href="/search"
            label="Search"
            icon={<Search className="h-5 w-5" />}
            active={pathname === "/search"}
          />
          <Link
            href="/assets/new"
            className="flex min-h-[3.75rem] flex-col items-center justify-center rounded-2xl bg-ink px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-slate md:min-h-0 md:flex-row md:rounded-2xl md:px-5 md:py-3 md:text-sm"
          >
            <span className="md:hidden">
              <UploadCloud className="h-5 w-5" />
            </span>
            <span className="mt-1 md:mt-0">Add Asset</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

export function ContextBar({
  items
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-ink/10 bg-white/70 px-3 py-2 text-xs text-slate">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="flex items-center gap-1 whitespace-nowrap">
          {item.href ? (
            <Link href={item.href} className="font-medium text-ink transition hover:text-moss">
              {item.label}
            </Link>
          ) : (
            <span className="font-medium text-ink">{item.label}</span>
          )}
          {index < items.length - 1 ? <ChevronRight className="h-3.5 w-3.5 text-slate/70" /> : null}
        </div>
      ))}
    </div>
  );
}

function NavItem({
  href,
  label,
  icon,
  active
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-[3.75rem] flex-col items-center justify-center rounded-2xl border px-2 py-2 text-[11px] font-semibold transition md:min-h-0 md:px-4 md:py-3 md:text-xs ${
        active
          ? "border-moss/30 bg-moss/10 text-ink"
          : "border-transparent text-slate hover:border-ink/10 hover:bg-white"
      }`}
    >
      {icon}
      <span className="mt-1">{label}</span>
    </Link>
  );
}
