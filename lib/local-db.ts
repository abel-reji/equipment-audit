"use client";

import Dexie, { type Table } from "dexie";

import type {
  AssetDraft,
  CachedCustomer,
  CachedSite,
  DraftPhoto,
  SyncQueueItem
} from "@/lib/types";

export class PlantAuditDatabase extends Dexie {
  customers!: Table<CachedCustomer, string>;
  sites!: Table<CachedSite, string>;
  assetDrafts!: Table<AssetDraft, string>;
  draftPhotos!: Table<DraftPhoto, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super("plant-audit-db");

    this.version(1).stores({
      customers: "id, serverId, name, syncStatus, updatedAt",
      sites: "id, serverId, customerId, name, lastUsedAt, syncStatus, updatedAt",
      assetDrafts: "id, serverId, siteId, captureStatus, updatedAt, syncedAt",
      draftPhotos: "id, assetDraftId, assetServerId, uploadStatus, createdAt",
      syncQueue: "id, entityType, entityId, operation, updatedAt"
    });
  }
}

let dbSingleton: PlantAuditDatabase | null = null;

export function getLocalDb() {
  if (!dbSingleton) {
    dbSingleton = new PlantAuditDatabase();
  }

  return dbSingleton;
}

