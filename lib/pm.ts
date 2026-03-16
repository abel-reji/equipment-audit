import { z } from "zod";

export const pmProgramStatusOptions = ["active", "paused"] as const;
export const pmLogStatusOptions = ["completed", "skipped"] as const;

export const pmFrequencyOptions = [1, 3, 6, 12] as const;

export const checklistItemSchema = z.object({
  label: z.string().min(1).max(160)
});

export const checklistResultSchema = z.object({
  label: z.string().min(1).max(160),
  done: z.boolean(),
  note: z.string().max(500).optional().or(z.literal(""))
});

export function toDateOnly(value: string | Date) {
  const date = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date");
  }

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
}

export function addMonthsToDate(value: string, months: number) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    throw new Error("Invalid date");
  }

  const next = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(day, lastDay));

  return toDateOnly(next);
}

export function formatPmFrequency(months: number) {
  if (months === 1) {
    return "Monthly";
  }
  if (months === 3) {
    return "Quarterly";
  }
  if (months === 6) {
    return "Semiannual";
  }
  if (months === 12) {
    return "Annual";
  }

  return `${months}-month interval`;
}

export function getPmDueBucket(nextDueAt: string, today = new Date()) {
  const dueDate = new Date(`${nextDueAt}T00:00:00`);
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round((dueDate.getTime() - localToday.getTime()) / 86400000);

  if (diffDays < 0) {
    return "overdue" as const;
  }
  if (diffDays <= 14) {
    return "due-soon" as const;
  }

  return "upcoming" as const;
}
