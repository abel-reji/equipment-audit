import type { SyncStatus } from "@/lib/types";

export function deriveAssetSyncStatus(photoStatuses: SyncStatus[]): SyncStatus {
  if (!photoStatuses.length) {
    return "queued";
  }

  if (photoStatuses.every((status) => status === "synced")) {
    return "synced";
  }

  if (photoStatuses.some((status) => status === "failed")) {
    return "failed";
  }

  if (photoStatuses.some((status) => status === "syncing")) {
    return "syncing";
  }

  return "partial";
}

