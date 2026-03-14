"use client";

import { getLocalDb } from "@/lib/local-db";
import type { AssetDraft, CachedCustomer, CachedSite, DraftPhoto, PhotoType } from "@/lib/types";
import { makeClientId, nowIso } from "@/lib/utils";
import {
  queueAssetForSync,
  queueCustomerForSync,
  queuePhotoForSync,
  queueSiteForSync
} from "@/lib/client-sync";

export async function seedCustomers(
  customers: Array<{ id: string; client_uid?: string; name: string; notes?: string | null }>
) {
  const db = getLocalDb();
  for (const customer of customers) {
    const matches = await db.customers
      .filter(
        (entry) =>
          entry.serverId === customer.id ||
          entry.id === customer.id ||
          entry.id === ("client_uid" in customer ? customer.client_uid : undefined)
      )
      .toArray();

    const canonical = matches.find((entry) => entry.serverId === customer.id) ?? matches[0];
    const localId =
      canonical?.id ??
      ("client_uid" in customer && customer.client_uid ? customer.client_uid : customer.id);

    await db.customers.put({
      id: localId,
      serverId: customer.id,
      name: customer.name,
      notes: customer.notes ?? undefined,
      syncStatus: "synced",
      createdAt: canonical?.createdAt ?? nowIso(),
      updatedAt: nowIso()
    });

    for (const duplicate of matches) {
      if (duplicate.id !== localId) {
        await db.customers.delete(duplicate.id);
      }
    }
  }
}

export async function seedSites(
  sites: Array<{
    id: string;
    client_uid?: string;
    customer_id: string;
    name: string;
    address?: string | null;
    area_unit?: string | null;
    notes?: string | null;
  }>
) {
  const db = getLocalDb();
  for (const site of sites) {
    const matches = await db.sites
      .filter(
        (entry) =>
          entry.serverId === site.id ||
          entry.id === site.id ||
          entry.id === site.client_uid
      )
      .toArray();

    const canonical = matches.find((entry) => entry.serverId === site.id) ?? matches[0];
    const localId = canonical?.id ?? site.client_uid ?? site.id;

    await db.sites.put({
      id: localId,
      serverId: site.id,
      customerId: canonical?.customerId ?? site.customer_id,
      customerServerId: site.customer_id,
      name: site.name,
      address: site.address ?? undefined,
      areaUnit: site.area_unit ?? undefined,
      notes: site.notes ?? undefined,
      syncStatus: "synced",
      lastUsedAt: canonical?.lastUsedAt,
      createdAt: canonical?.createdAt ?? nowIso(),
      updatedAt: nowIso()
    });

    for (const duplicate of matches) {
      if (duplicate.id !== localId) {
        await db.sites.delete(duplicate.id);
      }
    }
  }
}

export async function createCustomerDraft(input: {
  name: string;
  notes?: string;
}) {
  const db = getLocalDb();
  const customer: CachedCustomer = {
    id: makeClientId("customer"),
    name: input.name,
    notes: input.notes,
    syncStatus: navigator.onLine ? "queued" : "local-only",
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  await db.customers.put(customer);
  await queueCustomerForSync(customer.id);
  return customer;
}

export async function createSiteDraft(input: {
  customerId: string;
  name: string;
  address?: string;
  areaUnit?: string;
  notes?: string;
}) {
  const db = getLocalDb();
  const site: CachedSite = {
    id: makeClientId("site"),
    customerId: input.customerId,
    name: input.name,
    address: input.address,
    areaUnit: input.areaUnit,
    notes: input.notes,
    syncStatus: navigator.onLine ? "queued" : "local-only",
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  await db.sites.put(site);
  await queueSiteForSync(site.id);
  return site;
}

export async function markSiteUsed(siteId: string) {
  const db = getLocalDb();
  await db.sites.update(siteId, {
    lastUsedAt: nowIso(),
    updatedAt: nowIso()
  });
}

export async function saveAssetDraft(
  input: Omit<AssetDraft, "createdAt" | "updatedAt" | "captureStatus">
) {
  const db = getLocalDb();
  const existing = await db.assetDrafts.get(input.id);
  const draft: AssetDraft = {
    ...existing,
    ...input,
    captureStatus: navigator.onLine ? "queued" : "local-only",
    createdAt: existing?.createdAt ?? nowIso(),
    updatedAt: nowIso()
  };

  await db.assetDrafts.put(draft);
  const photos = await db.draftPhotos.where("assetDraftId").equals(draft.id).toArray();
  await Promise.all(
    photos.map((photo) =>
      db.draftPhotos.update(photo.id, {
        uploadStatus: navigator.onLine ? "queued" : "local-only"
      })
    )
  );
  await queueAssetForSync(draft.id);
  await Promise.all(photos.map((photo) => queuePhotoForSync(photo.id)));
  return draft;
}

export async function addDraftPhoto(input: {
  assetDraftId: string;
  photoType: PhotoType;
  file: File;
}) {
  const db = getLocalDb();
  const photo: DraftPhoto = {
    id: makeClientId("photo"),
    assetDraftId: input.assetDraftId,
    photoType: input.photoType,
    blob: input.file,
    fileName: input.file.name,
    mimeType: input.file.type || "image/jpeg",
    previewUrl: URL.createObjectURL(input.file),
    uploadStatus: "local-only",
    createdAt: nowIso()
  };

  await db.draftPhotos.put(photo);

  const asset = await db.assetDrafts.get(input.assetDraftId);
  if (asset) {
    await db.assetDrafts.update(asset.id, {
      photoCount: asset.photoCount + 1,
      captureStatus: navigator.onLine ? "queued" : "local-only",
      updatedAt: nowIso()
    });
  }

  return photo;
}

export async function getDraftAssetWithPhotos(assetDraftId: string) {
  const db = getLocalDb();
  const draft = await db.assetDrafts.get(assetDraftId);
  const photos = await db.draftPhotos.where("assetDraftId").equals(assetDraftId).toArray();
  return { draft, photos };
}

export async function updateAssetDraft(
  assetDraftId: string,
  updates: Partial<
    Pick<
      AssetDraft,
      | "siteId"
      | "siteServerId"
      | "equipmentType"
      | "equipmentTag"
      | "manufacturer"
      | "quickNote"
      | "temporaryIdentifier"
    >
  >
) {
  const db = getLocalDb();
  const existing = await db.assetDrafts.get(assetDraftId);

  if (!existing) {
    throw new Error("Asset draft not found");
  }

  const nextStatus =
    existing.captureStatus === "synced" || existing.captureStatus === "partial"
      ? "queued"
      : navigator.onLine
        ? "queued"
        : "local-only";

  await db.assetDrafts.update(assetDraftId, {
    ...updates,
    captureStatus: nextStatus,
    updatedAt: nowIso()
  });

  await queueAssetForSync(assetDraftId);
}

export async function deleteAssetDraft(assetDraftId: string) {
  const db = getLocalDb();
  const photos = await db.draftPhotos.where("assetDraftId").equals(assetDraftId).toArray();

  for (const photo of photos) {
    if (photo.previewUrl) {
      URL.revokeObjectURL(photo.previewUrl);
    }
    await db.draftPhotos.delete(photo.id);
    await db.syncQueue.delete(`queue_photo_${photo.id}`);
  }

  await db.assetDrafts.delete(assetDraftId);
  await db.syncQueue.delete(`queue_asset_${assetDraftId}`);
}

export async function updateCustomerDraft(
  customerId: string,
  updates: Partial<Pick<CachedCustomer, "name" | "notes">>
) {
  const db = getLocalDb();
  const existing = await db.customers.get(customerId);

  if (!existing) {
    throw new Error("Customer not found");
  }

  await db.customers.update(customerId, {
    ...updates,
    syncStatus:
      existing.syncStatus === "synced"
        ? "queued"
        : navigator.onLine
          ? "queued"
          : "local-only",
    updatedAt: nowIso()
  });

  await queueCustomerForSync(customerId);
}

export async function deleteCustomerDraft(customerId: string) {
  const db = getLocalDb();
  const sites = await db.sites.where("customerId").equals(customerId).toArray();

  for (const site of sites) {
    await deleteSiteDraft(site.id);
  }

  await db.customers.delete(customerId);
  await db.syncQueue.delete(`queue_customer_${customerId}`);
}

export async function updateSiteDraft(
  siteId: string,
  updates: Partial<Pick<CachedSite, "customerId" | "name" | "address" | "areaUnit" | "notes">>
) {
  const db = getLocalDb();
  const existing = await db.sites.get(siteId);

  if (!existing) {
    throw new Error("Site not found");
  }

  await db.sites.update(siteId, {
    ...updates,
    syncStatus:
      existing.syncStatus === "synced"
        ? "queued"
        : navigator.onLine
          ? "queued"
          : "local-only",
    updatedAt: nowIso()
  });

  await queueSiteForSync(siteId);
}

export async function deleteSiteDraft(siteId: string) {
  const db = getLocalDb();
  const assets = await db.assetDrafts.where("siteId").equals(siteId).toArray();

  for (const asset of assets) {
    await deleteAssetDraft(asset.id);
  }

  await db.sites.delete(siteId);
  await db.syncQueue.delete(`queue_site_${siteId}`);
}
