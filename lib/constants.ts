export const equipmentTypeOptions = [
  "pump",
  "compressor",
  "motor",
  "gearbox",
  "fan",
  "blower",
  "other"
] as const;

export const assetStatusOptions = [
  "active",
  "spare",
  "removed",
  "unknown",
  "needs-review"
] as const;

export const photoTypeOptions = [
  "equipment-tag",
  "motor-tag",
  "coupling",
  "equipment",
  "piping-context",
  "other"
] as const;

export const pmRecentCompletedLimit = 8;
