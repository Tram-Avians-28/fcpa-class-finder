import type { Activity, ActivityCatalog } from "./types";

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Validate and normalize the JSON emitted by scripts/fetch-activities.mjs. */
export function parseActivityCatalog(value: unknown): ActivityCatalog {
  if (!value || typeof value !== "object") throw new Error("Activity catalog is not an object.");
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.activities)) throw new Error("Activity catalog has no activities array.");

  const activities: Activity[] = raw.activities.map((entry, index) => {
    if (!entry || typeof entry !== "object") throw new Error(`Activity ${index + 1} is invalid.`);
    const item = entry as Record<string, unknown>;
    const title = optionalString(item.title).trim();
    const catalogId = optionalString(item.catalogId).trim();
    const startDate = optionalString(item.startDate);
    const endDate = optionalString(item.endDate);
    if (!title || !catalogId || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      throw new Error(`Activity ${index + 1} is missing a title, catalog ID, or valid dates.`);
    }
    return {
      title,
      category: optionalString(item.category).trim() || "Uncategorized",
      catalogId,
      community: optionalString(item.community).trim(),
      venue: optionalString(item.venue).trim(),
      fee: optionalNumber(item.fee),
      startDate,
      endDate,
      startTime: optionalString(item.startTime) || null,
      endTime: optionalString(item.endTime) || null,
      ageMin: optionalNumber(item.ageMin),
      ageMax: optionalNumber(item.ageMax),
      weekLabel: optionalString(item.weekLabel),
      status: optionalString(item.status),
      description: optionalString(item.description) || undefined,
      scheduleText: optionalString(item.scheduleText) || undefined,
      meetingDays: Array.isArray(item.meetingDays)
        ? item.meetingDays.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6)
        : undefined,
      seatsAvailable: optionalNumber(item.seatsAvailable),
      detailUrl: optionalString(item.detailUrl) || undefined,
      isVirtual: item.isVirtual === true,
    };
  });

  if (new Set(activities.map((activity) => activity.catalogId)).size !== activities.length) {
    throw new Error("Activity catalog contains duplicate catalog IDs.");
  }
  return {
    version: optionalNumber(raw.version) ?? 1,
    generatedAt: optionalString(raw.generatedAt),
    sourceUrl: optionalString(raw.sourceUrl),
    startDate: optionalString(raw.startDate),
    excludedCategories: Array.isArray(raw.excludedCategories)
      ? raw.excludedCategories.filter((item): item is string => typeof item === "string")
      : undefined,
    activities,
  };
}

export function parseActivityCatalogBytes(bytes: ArrayBuffer): ActivityCatalog {
  return parseActivityCatalog(JSON.parse(new TextDecoder().decode(bytes)));
}
