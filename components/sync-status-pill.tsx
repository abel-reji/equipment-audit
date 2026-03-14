import type { SyncStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const styles: Record<SyncStatus, string> = {
  "local-only": "bg-sand text-ink",
  queued: "bg-sand text-ink",
  syncing: "bg-mist text-slate",
  partial: "bg-amber-100 text-amber-900",
  synced: "bg-emerald-100 text-emerald-900",
  failed: "bg-red-100 text-red-800"
};

export function SyncStatusPill({ status }: { status: SyncStatus }) {
  return (
    <span className={cn("pill", styles[status])}>
      {status.replace("-", " ")}
    </span>
  );
}

