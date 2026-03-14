import { z } from "zod";

import { equipmentTypeOptions, photoTypeOptions } from "@/lib/constants";

export const signInSchema = z.object({
  email: z.string().email()
});

export const customerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).max(120),
  notes: z.string().max(500).optional().or(z.literal(""))
});

export const siteSchema = z.object({
  id: z.string().min(1),
  customerId: z.string().min(1),
  name: z.string().min(2).max(120),
  address: z.string().max(200).optional().or(z.literal("")),
  areaUnit: z.string().max(120).optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal(""))
});

export const assetDraftSchema = z.object({
  id: z.string().min(1),
  siteId: z.string().min(1),
  equipmentType: z.enum(equipmentTypeOptions),
  equipmentTag: z.string().max(120).optional().or(z.literal("")),
  manufacturer: z.string().max(120).optional().or(z.literal("")),
  quickNote: z.string().max(800).optional().or(z.literal("")),
  temporaryIdentifier: z.string().max(120).optional().or(z.literal("")),
  photoCount: z.number().int().min(1)
});

export const draftPhotoSchema = z.object({
  id: z.string().min(1),
  assetDraftId: z.string().min(1),
  photoType: z.enum(photoTypeOptions),
  fileName: z.string().min(1),
  mimeType: z.string().min(1)
});

