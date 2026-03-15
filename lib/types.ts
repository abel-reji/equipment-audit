export type SyncStatus = "local-only" | "queued" | "syncing" | "partial" | "synced" | "failed";

export type PhotoType =
  | "equipment-tag"
  | "motor-tag"
  | "coupling"
  | "equipment"
  | "piping-context"
  | "other";

export type EquipmentType =
  | "pump"
  | "compressor"
  | "motor"
  | "gearbox"
  | "fan"
  | "blower"
  | "other";

export type AssetStatus =
  | "active"
  | "spare"
  | "removed"
  | "unknown"
  | "needs-review";

export interface AssetDriverDetails {
  motorOem?: string;
  motorModel?: string;
  serialNumber?: string;
  hp?: string;
  rpm?: string;
  voltage?: string;
  frame?: string;
}

export interface AssetCouplingDetails {
  oem?: string;
  couplingType?: string;
  size?: string;
  spacer?: string;
  notes?: string;
}

export interface AccountRecord {
  id: string;
  auth_user_id: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerRecord {
  id: string;
  account_id: string;
  client_uid: string;
  name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SiteRecord {
  id: string;
  account_id: string;
  client_uid: string;
  customer_id: string;
  name: string;
  address: string | null;
  area_unit: string | null;
  notes: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetRecord {
  id: string;
  account_id: string;
  client_uid: string;
  site_id: string;
  temporary_identifier: string | null;
  equipment_tag: string | null;
  equipment_type: EquipmentType;
  manufacturer: string | null;
  model: string | null;
  serial: string | null;
  service_application: string | null;
  status: AssetStatus;
  latitude: number | null;
  longitude: number | null;
  location_accuracy_meters: number | null;
  location_captured_at: string | null;
  quick_note: string | null;
  capture_status: SyncStatus;
  captured_at: string;
  created_at: string;
  updated_at: string;
}

export interface AssetDriverRecord {
  id: string;
  account_id: string;
  asset_id: string;
  motor_oem: string | null;
  motor_model: string | null;
  serial_number: string | null;
  hp: string | null;
  rpm: string | null;
  voltage: string | null;
  frame: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetCouplingRecord {
  id: string;
  account_id: string;
  asset_id: string;
  oem: string | null;
  coupling_type: string | null;
  size: string | null;
  spacer: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetPhotoRecord {
  id: string;
  account_id: string;
  asset_id: string;
  client_uid: string;
  local_draft_id: string | null;
  photo_type: PhotoType;
  storage_path: string;
  captured_at: string;
  created_at: string;
  updated_at: string;
}

export interface CachedCustomer {
  id: string;
  serverId?: string;
  name: string;
  notes?: string;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CachedSite {
  id: string;
  serverId?: string;
  customerId: string;
  customerServerId?: string;
  name: string;
  address?: string;
  areaUnit?: string;
  notes?: string;
  syncStatus: SyncStatus;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetDraft {
  id: string;
  serverId?: string;
  siteId: string;
  siteServerId?: string;
  equipmentType: EquipmentType;
  equipmentTag?: string;
  manufacturer?: string;
  model?: string;
  serial?: string;
  serviceApplication?: string;
  status?: AssetStatus;
  latitude?: number;
  longitude?: number;
  locationAccuracyMeters?: number;
  locationCapturedAt?: string;
  quickNote?: string;
  temporaryIdentifier?: string;
  driver?: AssetDriverDetails;
  coupling?: AssetCouplingDetails;
  captureStatus: SyncStatus;
  photoCount: number;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
}

export interface DraftPhoto {
  id: string;
  assetDraftId: string;
  assetServerId?: string;
  photoType: PhotoType;
  blob: Blob;
  fileName: string;
  mimeType: string;
  previewUrl?: string;
  uploadStatus: SyncStatus;
  storagePath?: string;
  createdAt: string;
}

export interface SyncQueueItem {
  id: string;
  entityType: "customer" | "site" | "asset" | "photo";
  entityId: string;
  operation: "upsert" | "upload";
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  customers: CustomerRecord[];
  sites: Array<SiteRecord & { customer_name: string }>;
}

export interface AssetSummary {
  asset: AssetRecord;
  site: SiteRecord;
  customer?: CustomerRecord;
  driver?: AssetDriverRecord | null;
  coupling?: AssetCouplingRecord | null;
  photos: Array<AssetPhotoRecord & { signedUrl?: string }>;
}
