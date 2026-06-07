import type { Camp } from "./types";

export interface CampEvent {
  id: string;
  title: string;
  start: string; // ISO date (all-day) or "YYYY-MM-DDTHH:MM" (timed)
  end: string; // all-day end is EXCLUSIVE per FullCalendar semantics
  allDay: boolean;
  extendedProps: { camp: Camp };
}

function weekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun .. 6=Sat
}

/** Add `n` days to an ISO "YYYY-MM-DD" date, returning ISO. */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  const p = (x: number) => String(x).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

/** Convert 24h "HH:MM" to a compact 12h label like "4:00 PM". */
export function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

/** Short "9:00 AM–4:00 PM" label, or "" when times are missing. */
export function timeLabel(camp: Camp): string {
  if (!camp.startTime || !camp.endTime) return "";
  return `${to12h(camp.startTime)}–${to12h(camp.endTime)}`;
}

/** Build a FullCalendar all-day event spanning the camp's dates (end exclusive). */
export function campToEvent(camp: Camp, index: number): CampEvent {
  const t = timeLabel(camp);
  return {
    id: `${camp.catalogId}-${index}`,
    title: t ? `${camp.title} · ${t}` : camp.title,
    start: camp.startDate,
    end: addDays(camp.endDate || camp.startDate, 1),
    allDay: true,
    extendedProps: { camp },
  };
}

export function campsToEvents(camps: Camp[]): CampEvent[] {
  return camps
    .filter((c) => c.startDate)
    .map((c, i) => campToEvent(c, i));
}

/**
 * Expand one camp into per-day TIMED events within [rangeStart, rangeEnd)
 * (rangeEnd exclusive, matching FullCalendar's activeEnd). Multi-day camps skip
 * weekends; single-day camps are kept as-is. Camps without times fall back to an
 * all-day block so they still appear.
 */
export function expandCampToTimedEvents(
  camp: Camp,
  rangeStart: string,
  rangeEnd: string,
): CampEvent[] {
  if (!camp.startDate || !camp.endDate) return [];
  if (!camp.startTime || !camp.endTime) return campsToEvents([camp]);

  const multiDay = camp.startDate !== camp.endDate;
  const lower = camp.startDate < rangeStart ? rangeStart : camp.startDate;
  const campEndExclusive = addDays(camp.endDate, 1);
  const upperExclusive = campEndExclusive < rangeEnd ? campEndExclusive : rangeEnd;

  const out: CampEvent[] = [];
  for (let day = lower; day < upperExclusive; day = addDays(day, 1)) {
    const wd = weekday(day);
    if (multiDay && (wd === 0 || wd === 6)) continue; // skip weekends for week-long camps
    out.push({
      id: `${camp.catalogId}-${day}`,
      title: camp.title,
      start: `${day}T${camp.startTime}`,
      end: `${day}T${camp.endTime}`,
      allDay: false,
      extendedProps: { camp },
    });
  }
  return out;
}

/**
 * Slot window for the time-grid view: start an hour before the earliest camp
 * start time and end an hour after the latest end time. Falls back to 7am–7pm
 * when no times are present.
 */
export function timeWindow(camps: Camp[]): { slotMinTime: string; slotMaxTime: string } {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  let min = Infinity;
  let max = -Infinity;
  for (const c of camps) {
    if (c.startTime) min = Math.min(min, toMin(c.startTime));
    if (c.endTime) max = Math.max(max, toMin(c.endTime));
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { slotMinTime: "07:00:00", slotMaxTime: "19:00:00" };
  }
  const fmt = (h: number) => `${String(h).padStart(2, "0")}:00:00`;
  const startHour = Math.max(0, Math.floor(min / 60) - 1);
  const endHour = Math.min(24, Math.ceil(max / 60) + 1);
  return { slotMinTime: fmt(startHour), slotMaxTime: fmt(endHour) };
}

/** Timed events for all camps overlapping [rangeStart, rangeEnd). */
export function campsToTimedEvents(camps: Camp[], rangeStart: string, rangeEnd: string): CampEvent[] {
  const out: CampEvent[] = [];
  for (const c of camps) {
    if (!c.startDate) continue;
    if (c.endDate && c.endDate < rangeStart) continue;
    if (c.startDate >= rangeEnd) continue;
    out.push(...expandCampToTimedEvents(c, rangeStart, rangeEnd));
  }
  return out;
}
