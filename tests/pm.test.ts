import { describe, expect, it } from "vitest";

import { addMonthsToDate, getPmDueBucket } from "@/lib/pm";

describe("pm utilities", () => {
  it("rolls a quarterly due date forward by three months", () => {
    expect(addMonthsToDate("2026-03-16", 3)).toBe("2026-06-16");
  });

  it("keeps end-of-month dates valid when adding months", () => {
    expect(addMonthsToDate("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("classifies overdue items using the local date bucket", () => {
    expect(getPmDueBucket("2026-03-15", new Date("2026-03-16T12:00:00"))).toBe("overdue");
  });
});
