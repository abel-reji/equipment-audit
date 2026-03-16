import { describe, expect, it } from "vitest";

import {
  assetDraftSchema,
  customerSchema,
  pmLogSchema,
  pmProgramBatchSchema,
  pmProgramSchema,
  siteSchema
} from "@/lib/validation";

describe("validation schemas", () => {
  it("accepts a valid customer payload", () => {
    expect(
      customerSchema.safeParse({
        id: "customer_1",
        name: "Acme Plant Services",
        notes: ""
      }).success
    ).toBe(true);
  });

  it("rejects an asset draft without a photo count", () => {
    expect(
      assetDraftSchema.safeParse({
        id: "asset_1",
        siteId: "site_1",
        equipmentType: "pump"
      }).success
    ).toBe(false);
  });

  it("accepts a valid site payload", () => {
    expect(
      siteSchema.safeParse({
        id: "site_1",
        customerId: "customer_1",
        name: "North plant",
        address: "123 Main",
        areaUnit: "Unit 4",
        notes: "Front gate access"
      }).success
    ).toBe(true);
  });

  it("accepts a valid PM program payload", () => {
    expect(
      pmProgramSchema.safeParse({
        assetId: "4f4d2b4d-a9ca-42c4-a0f7-bdb862191001",
        title: "Quarterly PM",
        frequencyMonths: 3,
        startDate: "2026-03-16",
        instructions: "Inspect bearings and coupling.",
        checklistTemplate: ["Check oil", "Inspect coupling"]
      }).success
    ).toBe(true);
  });

  it("accepts a valid batch PM program payload", () => {
    expect(
      pmProgramBatchSchema.safeParse({
        assetIds: [
          "4f4d2b4d-a9ca-42c4-a0f7-bdb862191001",
          "8bb2cd8d-a120-46ca-a76a-3d40dfdbe901"
        ],
        title: "Quarterly PM",
        frequencyMonths: 3,
        startDate: "2026-03-16",
        checklistTemplate: ["Check oil"]
      }).success
    ).toBe(true);
  });

  it("rejects a PM log with an invalid status", () => {
    expect(
      pmLogSchema.safeParse({
        programId: "4f4d2b4d-a9ca-42c4-a0f7-bdb862191001",
        assetId: "8bb2cd8d-a120-46ca-a76a-3d40dfdbe901",
        dueAt: "2026-03-16",
        status: "due"
      }).success
    ).toBe(false);
  });
});
