import { clsx } from "clsx";

export function cn(...parts: Array<string | false | null | undefined>) {
  return clsx(parts);
}

export function formatRelativeDate(value?: string) {
  if (!value) {
    return "Not yet";
  }

  const date = new Date(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function nowIso() {
  return new Date().toISOString();
}

export function makeClientId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function fileExtensionForMimeType(mimeType: string) {
  const [, subtype = "jpg"] = mimeType.split("/");
  return subtype === "jpeg" ? "jpg" : subtype;
}

