import { describe, expect, it } from "vitest";

import { deriveAssetSyncStatus } from "@/lib/sync-state";

describe("deriveAssetSyncStatus", () => {
  it("returns synced when every photo is synced", () => {
    expect(deriveAssetSyncStatus(["synced", "synced"])).toBe("synced");
  });

  it("returns failed when any photo fails", () => {
    expect(deriveAssetSyncStatus(["synced", "failed"])).toBe("failed");
  });

  it("returns partial while queued photos remain", () => {
    expect(deriveAssetSyncStatus(["synced", "queued"])).toBe("partial");
  });
});

