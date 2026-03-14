import { z } from "zod";

import { assetStatusOptions, equipmentTypeOptions, photoTypeOptions } from "@/lib/constants";

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
  model: z.string().max(120).optional().or(z.literal("")),
  serial: z.string().max(120).optional().or(z.literal("")),
  serviceApplication: z.string().max(160).optional().or(z.literal("")),
  status: z.enum(assetStatusOptions).optional(),
  quickNote: z.string().max(800).optional().or(z.literal("")),
  temporaryIdentifier: z.string().max(120).optional().or(z.literal("")),
  driver: z
    .object({
      motorOem: z.string().max(120).optional().or(z.literal("")),
      motorModel: z.string().max(120).optional().or(z.literal("")),
      hp: z.string().max(40).optional().or(z.literal("")),
      rpm: z.string().max(40).optional().or(z.literal("")),
      voltage: z.string().max(40).optional().or(z.literal("")),
      frame: z.string().max(40).optional().or(z.literal(""))
    })
    .optional(),
  coupling: z
    .object({
      oem: z.string().max(120).optional().or(z.literal("")),
      couplingType: z.string().max(120).optional().or(z.literal("")),
      size: z.string().max(80).optional().or(z.literal("")),
      spacer: z.string().max(80).optional().or(z.literal("")),
      notes: z.string().max(500).optional().or(z.literal(""))
    })
    .optional(),
  photoCount: z.number().int().min(1)
});

export const draftPhotoSchema = z.object({
  id: z.string().min(1),
  assetDraftId: z.string().min(1),
  photoType: z.enum(photoTypeOptions),
  fileName: z.string().min(1),
  mimeType: z.string().min(1)
});
