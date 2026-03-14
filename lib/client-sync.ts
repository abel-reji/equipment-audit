"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getLocalDb } from "@/lib/local-db";
import { deriveAssetSyncStatus } from "@/lib/sync-state";
import type {
  AssetDraft,
  CachedCustomer,
  CachedSite,
  DraftPhoto,
  SyncQueueItem
} from "@/lib/types";
import { fileExtensionForMimeType, nowIso } from "@/lib/utils";

async function upsertQueueItem(item: SyncQueueItem) {
  const db = getLocalDb();
  await db.syncQueue.put(item);
}

async function markQueueFailure(item: SyncQueueItem, error: unknown) {
  await upsertQueueItem({
    ...item,
    attempts: item.attempts + 1,
    lastError: error instanceof Error ? error.message : "Unknown sync error",
    updatedAt: nowIso()
  });
}

export async function queueCustomerForSync(customerId: string) {
  await upsertQueueItem({
    id: `queue_customer_${customerId}`,
    entityType: "customer",
    entityId: customerId,
    operation: "upsert",
    attempts: 0,
    createdAt: nowIso(),
    updatedAt: nowIso()
  });
}

export async function queueSiteForSync(siteId: string) {
  await upsertQueueItem({
    id: `queue_site_${siteId}`,
    entityType: "site",
    entityId: siteId,
    operation: "upsert",
    attempts: 0,
    createdAt: nowIso(),
    updatedAt: nowIso()
  });
}

export async function queueAssetForSync(assetId: string) {
  await upsertQueueItem({
    id: `queue_asset_${assetId}`,
    entityType: "asset",
    entityId: assetId,
    operation: "upsert",
    attempts: 0,
    createdAt: nowIso(),
    updatedAt: nowIso()
  });
}

export async function queuePhotoForSync(photoId: string) {
  await upsertQueueItem({
    id: `queue_photo_${photoId}`,
    entityType: "photo",
    entityId: photoId,
    operation: "upload",
    attempts: 0,
    createdAt: nowIso(),
    updatedAt: nowIso()
  });
}

async function upsertCustomer(customer: CachedCustomer) {
  const response = await fetch("/api/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: customer.id,
      name: customer.name,
      notes: customer.notes ?? ""
    })
  });

  if (!response.ok) {
    throw new Error("Customer sync failed");
  }

  return (await response.json()) as { customerId: string };
}

async function upsertSite(site: CachedSite) {
  const response = await fetch("/api/sites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: site.id,
      customerId: site.customerServerId ?? site.customerId,
      name: site.name,
      address: site.address ?? "",
      areaUnit: site.areaUnit ?? "",
      notes: site.notes ?? ""
    })
  });

  if (!response.ok) {
    throw new Error("Site sync failed");
  }

  return (await response.json()) as { siteId: string };
}

async function upsertAsset(asset: AssetDraft) {
  const response = await fetch("/api/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: asset.id,
      siteId: asset.siteServerId ?? asset.siteId,
      equipmentType: asset.equipmentType,
      equipmentTag: asset.equipmentTag ?? "",
      manufacturer: asset.manufacturer ?? "",
      quickNote: asset.quickNote ?? "",
      temporaryIdentifier: asset.temporaryIdentifier ?? "",
      photoCount: asset.photoCount
    })
  });

  if (!response.ok) {
    throw new Error("Asset sync failed");
  }

  return (await response.json()) as { assetId: string; captureStatus: string };
}

async function uploadPhoto(supabase: SupabaseClient, photo: DraftPhoto) {
  if (!photo.assetServerId) {
    throw new Error("Photo upload missing asset server id");
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Cannot upload photo without an authenticated user");
  }

  const extension = fileExtensionForMimeType(photo.mimeType);
  const storagePath = `${user.id}/${photo.assetServerId}/${photo.id}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("asset-photos")
    .upload(storagePath, photo.blob, {
      upsert: true,
      contentType: photo.mimeType
    });

  if (uploadError) {
    throw uploadError;
  }

  const response = await fetch(`/api/assets/${photo.assetServerId}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: photo.id,
      localDraftId: photo.assetDraftId,
      photoType: photo.photoType,
      storagePath
    })
  });

  if (!response.ok) {
    throw new Error("Photo metadata sync failed");
  }

  return storagePath;
}

export async function syncPendingData(supabase: SupabaseClient) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return;
  }

  const db = getLocalDb();
  while (true) {
    const queue = await db.syncQueue.toArray();
    if (!queue.length) {
      return;
    }

    let processedAnyItem = false;

    for (const item of queue) {
      try {
        if (item.entityType === "customer") {
          const customer = await db.customers.get(item.entityId);
          if (!customer) {
            await db.syncQueue.delete(item.id);
            processedAnyItem = true;
            continue;
          }

          const result = await upsertCustomer(customer);
          await db.customers.update(customer.id, {
            serverId: result.customerId,
            syncStatus: "synced",
            updatedAt: nowIso()
          });
        }

        if (item.entityType === "site") {
          const site = await db.sites.get(item.entityId);
          if (!site) {
            await db.syncQueue.delete(item.id);
            processedAnyItem = true;
            continue;
          }

          if (!site.customerServerId) {
            const customer = await db.customers.get(site.customerId);
            if (!customer?.serverId) {
              throw new Error("Site waiting on customer sync");
            }

            site.customerServerId = customer.serverId;
          }

          const result = await upsertSite(site);
          await db.sites.update(site.id, {
            serverId: result.siteId,
            customerServerId: site.customerServerId,
            syncStatus: "synced",
            updatedAt: nowIso()
          });
        }

        if (item.entityType === "asset") {
          const asset = await db.assetDrafts.get(item.entityId);
          if (!asset) {
            await db.syncQueue.delete(item.id);
            processedAnyItem = true;
            continue;
          }

          if (!asset.siteServerId) {
            const site = await db.sites.get(asset.siteId);
            if (!site?.serverId) {
              throw new Error("Asset waiting on site sync");
            }

            asset.siteServerId = site.serverId;
          }

          await db.assetDrafts.update(asset.id, {
            captureStatus: "syncing",
            siteServerId: asset.siteServerId,
            updatedAt: nowIso()
          });

          const result = await upsertAsset(asset);
          await db.assetDrafts.update(asset.id, {
            serverId: result.assetId,
            captureStatus: asset.photoCount > 0 ? "partial" : "synced",
            syncedAt: nowIso(),
            updatedAt: nowIso()
          });

          const photos = await db.draftPhotos.where("assetDraftId").equals(asset.id).toArray();
          for (const photo of photos) {
            if (photo.uploadStatus !== "synced") {
              await db.draftPhotos.update(photo.id, { assetServerId: result.assetId });
              await queuePhotoForSync(photo.id);
            }
          }
        }

        if (item.entityType === "photo") {
          const photo = await db.draftPhotos.get(item.entityId);
          if (!photo) {
            await db.syncQueue.delete(item.id);
            processedAnyItem = true;
            continue;
          }

          if (!photo.assetServerId) {
            const asset = await db.assetDrafts.get(photo.assetDraftId);
            if (!asset?.serverId) {
              throw new Error("Photo waiting on asset sync");
            }

            photo.assetServerId = asset.serverId;
          }

          await db.draftPhotos.update(photo.id, { uploadStatus: "syncing" });
          const storagePath = await uploadPhoto(supabase, photo);
          await db.draftPhotos.update(photo.id, {
            uploadStatus: "synced",
            storagePath
          });

          const siblingPhotos = await db.draftPhotos
            .where("assetDraftId")
            .equals(photo.assetDraftId)
            .toArray();
          const nextStatus = deriveAssetSyncStatus(
            siblingPhotos.map((entry) =>
              entry.id === photo.id ? "synced" : entry.uploadStatus
            )
          );

          if (nextStatus === "synced") {
            if (photo.assetServerId) {
              await fetch(`/api/assets/${photo.assetServerId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ captureStatus: "synced" })
              });
            }

            await db.assetDrafts.update(photo.assetDraftId, {
              captureStatus: nextStatus,
              syncedAt: nowIso(),
              updatedAt: nowIso()
            });
          } else {
            await db.assetDrafts.update(photo.assetDraftId, {
              captureStatus: nextStatus,
              updatedAt: nowIso()
            });
          }
        }

        await db.syncQueue.delete(item.id);
        processedAnyItem = true;
      } catch (error) {
        await markQueueFailure(item, error);

        if (item.entityType === "asset") {
          await db.assetDrafts.update(item.entityId, {
            captureStatus: "failed",
            updatedAt: nowIso()
          });
        }

        if (item.entityType === "photo") {
          await db.draftPhotos.update(item.entityId, { uploadStatus: "failed" });
        }
      }
    }

    if (!processedAnyItem) {
      return;
    }
  }
}
