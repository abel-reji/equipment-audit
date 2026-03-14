import { describe, expect, it } from "vitest";

import { assetDraftSchema, customerSchema, siteSchema } from "@/lib/validation";

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
        equipmentType: "pump",
        photoCount: 0
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
});

