import { z } from "zod";

import { assetStatusOptions, equipmentTypeOptions, photoTypeOptions } from "@/lib/constants";
import { checklistResultSchema, pmLogStatusOptions } from "@/lib/pm";

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
  notes: z.string().max(500).optional().or(z.literal("")),
  lastUsedAt: z.string().datetime().optional()
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
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  locationAccuracyMeters: z.number().nonnegative().optional(),
  locationCapturedAt: z.string().datetime().optional(),
  quickNote: z.string().max(800).optional().or(z.literal("")),
  temporaryIdentifier: z.string().max(120).optional().or(z.literal("")),
  driver: z
    .object({
      motorOem: z.string().max(120).optional().or(z.literal("")),
      motorModel: z.string().max(120).optional().or(z.literal("")),
      serialNumber: z.string().max(120).optional().or(z.literal("")),
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
  photoCount: z.number().int().min(0)
});

export const draftPhotoSchema = z.object({
  id: z.string().min(1),
  assetDraftId: z.string().min(1),
  photoType: z.enum(photoTypeOptions),
  fileName: z.string().min(1),
  mimeType: z.string().min(1)
});

export const pmProgramSchema = z.object({
  assetId: z.string().uuid(),
  title: z.string().min(1).max(120),
  frequencyMonths: z.number().int().min(1).max(120),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  instructions: z.string().max(2000).optional().or(z.literal("")),
  checklistTemplate: z.array(z.string().min(1).max(160)).max(20).default([])
});

export const pmProgramBatchSchema = z.object({
  assetIds: z.array(z.string().uuid()).min(1).max(100),
  title: z.string().min(1).max(120),
  frequencyMonths: z.number().int().min(1).max(120),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  instructions: z.string().max(2000).optional().or(z.literal("")),
  checklistTemplate: z.array(z.string().min(1).max(160)).max(20).default([])
});

export const pmProgramPatchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  frequencyMonths: z.number().int().min(1).max(120).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  nextDueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  instructions: z.string().max(2000).optional().or(z.literal("")),
  checklistTemplate: z.array(z.string().min(1).max(160)).max(20).optional(),
  isActive: z.boolean().optional()
});

export const pmLogSchema = z.object({
  programId: z.string().uuid(),
  assetId: z.string().uuid(),
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  completedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(pmLogStatusOptions),
  performedBy: z.string().max(120).optional().or(z.literal("")),
  summary: z.string().max(200).optional().or(z.literal("")),
  workNotes: z.string().max(4000).optional().or(z.literal("")),
  findings: z.string().max(2000).optional().or(z.literal("")),
  followUpRequired: z.boolean().default(false),
  checklistResults: z.array(checklistResultSchema).max(20).default([])
});
