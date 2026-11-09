import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JSDOM } from "jsdom";
import * as XLSX from "xlsx";
import { preserveUnrefreshedActivities } from "./catalog-refresh.mjs";

const SEARCH_URL =
  "https://fairfax.usedirect.com/FairfaxFCPAWeb/ACTIVITIES/Search.aspx";
const OUTPUT = new URL("../public/fcpa-activities.json", import.meta.url);
const CAMP_WORKBOOK = new URL("../public/fcpa-camp-spreadsheet.xlsx", import.meta.url);
const CHECKPOINT = join(tmpdir(), "fcpa-activities-progress.json");
const PAGE_SIZE = 50;
const MAX_PAGES = 5;
const CHECKPOINT_VERSION = 4;
const REQUEST_DELAY_MS = Number(process.env.FCPA_REQUEST_DELAY_MS ?? 125);

const FIELD = {
  search: "ctl01$mainContent$LinkButton1",
  category: "ctl01$mainContent$ddlCategoryList",
  place: "ctl01$mainContent$ddlPlaceList",
  month: "ctl01$mainContent$ddlMonths",
  day: "ctl01$mainContent$ddlDayOfWeek",
  age: "ctl01$mainContent$ddlAgeRange",
  startDate: "ctl01$mainContent$txtStartDate",
};

const INVENTORY_CATEGORIES = new Set([
  "AMUSEMENT TICKETS",
  "BOAT RENTALS",
  "FACILITY RENTALS",
  "FARMERS MARKETS",
  "ICE TICKETS",
  "INDOOR ARENA TICKETS",
  "RECENTER TICKETS",
  "WATER MINE TICKETS",
]);

class CookieJar {
  values = new Map();

  absorb(response) {
    const raw = response.headers.getSetCookie?.() ?? [];
    const headers = raw.length
      ? raw
      : (response.headers.get("set-cookie") ?? "")
          .split(/,(?=\s*[^;,=]+=[^;,]+)/)
          .filter(Boolean);
    for (const header of headers) {
      const pair = header.split(";", 1)[0];
      const equals = pair.indexOf("=");
      if (equals > 0) this.values.set(pair.slice(0, equals).trim(), pair.slice(equals + 1));
    }
  }

  header() {
    return [...this.values].map(([name, value]) => `${name}=${value}`).join("; ");
  }
}

const jar = new CookieJar();
let requestCount = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(url, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    if (requestCount > 0 && REQUEST_DELAY_MS > 0) await sleep(REQUEST_DELAY_MS);
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "User-Agent": "fcpa-class-finder catalog refresh (+https://github.com/Tram-Avians-28/fcpa-class-finder)",
          ...(jar.header() ? { Cookie: jar.header() } : {}),
          ...options.headers,
        },
      });
      requestCount += 1;
      jar.absorb(response);
      if (response.ok) return response.text();

      lastError = new Error(`${response.status} ${response.statusText} for ${url}`);
      if (response.status < 500 && response.status !== 429) throw lastError;
      await response.text();
    } catch (error) {
      lastError = error;
    }
    if (attempt < 4) await sleep(500 * 2 ** (attempt - 1));
  }
  throw lastError;
}

function documentFrom(html) {
  return new JSDOM(html, { url: SEARCH_URL }).window.document;
}

function serializeForm(document) {
  const params = new URLSearchParams();
  const form = document.querySelector("form");
  if (!form) throw new Error("Fairfax search page no longer contains a form.");

  for (const element of form.querySelectorAll("input[name], select[name], textarea[name]")) {
    if (element.disabled) continue;
    const name = element.getAttribute("name");
    if (!name) continue;

    if (element.tagName === "SELECT") {
      for (const option of element.querySelectorAll("option:checked")) {
        params.append(name, option.value);
      }
      continue;
    }

    const type = (element.getAttribute("type") ?? "").toLowerCase();
    if (["submit", "button", "image", "file", "reset"].includes(type)) continue;
    if (["checkbox", "radio"].includes(type) && !element.checked) continue;
    params.append(name, element.value ?? "");
  }
  return params;
}

function setParam(params, name, value) {
  params.delete(name);
  params.set(name, value);
}

function optionList(document, selector) {
  return [...document.querySelectorAll(`${selector} option`)].map((option) => ({
    label: option.textContent?.replace(/\s+/g, " ").trim() ?? "",
    value: option.value,
  }));
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function todayUS() {
  const now = new Date();
  return `${pad2(now.getMonth() + 1)}/${pad2(now.getDate())}/${now.getFullYear()}`;
}

function usDateToISO(value) {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match ? `${match[3]}-${pad2(match[1])}-${pad2(match[2])}` : "";
}

function clockTo24(value) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  return `${pad2(hour)}:${match[2]}`;
}

function parseSchedule(value) {
  const dates = [...value.matchAll(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g)].map((match) => match[0]);
  const times = [...value.matchAll(/\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/gi)].map((match) => match[0]);
  return {
    startDate: usDateToISO(dates[0] ?? ""),
    endDate: usDateToISO(dates[1] ?? dates[0] ?? ""),
    startTime: times[0] ? clockTo24(times[0]) : null,
    endTime: times[1] ? clockTo24(times[1]) : null,
    scheduleText: value,
    meetingDays: parseMeetingDays(value),
  };
}

function parseMeetingDays(value) {
  if (/\bweekdays?\b/i.test(value)) return [1, 2, 3, 4, 5];
  if (/\bdaily\b/i.test(value)) return [0, 1, 2, 3, 4, 5, 6];
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const days = names.flatMap((name, index) =>
    new RegExp(`\\b${name}(?:day)?s?\\b`, "i").test(value) ? [index] : [],
  );
  return days.length ? days : undefined;
}

function parseAges(value) {
  const text = value.replace(/\s+/g, " ").trim();
  const measured = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(months?|years?)/gi)].map(
    (match) => (Number(match[1]) * (/month/i.test(match[2]) ? 1 / 12 : 1)),
  );
  const numbers = measured.length
    ? measured
    : [...text.matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
  if (numbers.length === 0) return { ageMin: null, ageMax: null };
  if (/and older|and up|\+|or older/i.test(text)) {
    return { ageMin: numbers[0], ageMax: null };
  }
  return {
    ageMin: numbers[0],
    ageMax: numbers[1] ?? numbers[0],
  };
}

function decimalAge(value) {
  const normalized = value
    .toLowerCase()
    .replace(/[½½]/g, ".5")
    .replace(/(\d+)\s+1\s*\/\s*2/g, (_, whole) => String(Number(whole) + 0.5));
  const years = Number(normalized.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?|yr|y)\b/)?.[1] ?? 0);
  const months = Number(normalized.match(/(\d+(?:\.\d+)?)\s*(?:months?|mos?|mo)\b/)?.[1] ?? 0);
  if (years || months) return years + months / 12;
  const bare = Number(normalized.match(/\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(bare) ? bare : null;
}

// Activity names carry the clearest public age range. The site's Restrictions
// cell frequently renders only the upper bound (for example, 12 for a title
// ending in "(6-12 yrs.)"), so prefer a title range whenever one is present.
function parseTitleAges(title) {
  const groups = [...title.matchAll(/\(([^()]*)\)/g)].map((match) => match[1].trim());
  for (const group of groups.reverse()) {
    if (/^adults?$/i.test(group)) return { ageMin: 18, ageMax: null };
    if (/^all ages?$/i.test(group)) return { ageMin: null, ageMax: null };

    const range = group.split(/\s*[-–—]\s*/);
    if (range.length === 2) {
      const upperIsAdult = /^adults?$/i.test(range[1]);
      const upper = upperIsAdult ? null : decimalAge(range[1]);
      let lower = decimalAge(range[0]);
      // Shared units are normally printed once: "6-12 yrs." or "20-36 mos".
      if (lower !== null && !/(?:years?|yrs?|yr|y|months?|mos?|mo)\b/i.test(range[0])) {
        if (/(?:months?|mos?|mo)\b/i.test(range[1])) lower /= 12;
      }
      if (lower !== null && (upperIsAdult || upper !== null)) {
        return { ageMin: lower, ageMax: upper };
      }
    }

    if (/\+\s*$/.test(group)) {
      const lower = decimalAge(group);
      if (lower !== null) return { ageMin: lower, ageMax: null };
    }
    const exact = group.match(/^\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?|yr|y)\.?\s*$/i);
    if (exact) return { ageMin: Number(exact[1]), ageMax: Number(exact[1]) };
  }
  return null;
}

function parseWorkbookAge(value) {
  const text = String(value ?? "");
  const years = Number(text.match(/(\d+(?:\.\d+)?)\s*years?/i)?.[1] ?? 0);
  const months = Number(text.match(/(\d+(?:\.\d+)?)\s*months?/i)?.[1] ?? 0);
  return years || months ? years + months / 12 : null;
}

function text(element) {
  return element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function parseResults(document, category) {
  const headings = [...document.querySelectorAll(".activity-list h2.FindTour")];
  const descriptions = [...document.querySelectorAll(".activity-list .description p")];
  const panels = [...document.querySelectorAll(".activity-list div.sessions")];
  const activities = [];

  panels.forEach((panel, index) => {
    const title = text(headings[index]);
    const description = text(descriptions[index]);
    for (const row of panel.querySelectorAll("tbody tr")) {
      const field = (label) => text(row.querySelector(`td[data-label="${label}"]`));
      const catalogId = field("Session");
      if (!catalogId) continue;
      const venue = field("Place");
      const scheduleText = field("Schedule");
      const restrictionText = field("Restrictions");
      const seatsText = field("Seats");
      const action = field("Select");
      const detailLink = row.querySelector('td[data-label="Select"] a[href*="Details.aspx"]');
      const seats = Number(seatsText);

      activities.push({
        title,
        description,
        category,
        catalogId,
        community: "",
        venue,
        fee: null,
        ...parseSchedule(scheduleText),
        ...(parseTitleAges(title) ?? parseAges(restrictionText)),
        weekLabel: "",
        status: action || (seatsText === "None" ? "Unavailable" : "Listed"),
        seatsAvailable: Number.isFinite(seats) ? seats : null,
        isVirtual: venue.toLowerCase() === "virtual fcpa",
        detailUrl: detailLink ? new URL(detailLink.href, SEARCH_URL).href : "",
      });
    }
  });
  return activities;
}

function pageCount(document) {
  const value = Number(text(document.querySelector("#mainContent_lblResultsTotal")));
  return Number.isFinite(value) && value > 0 ? Math.min(value, MAX_PAGES) : 0;
}

async function freshSearch({
  category,
  month = "All Months",
  place = "All Places",
  day,
  age,
  startDate,
}) {
  // Search.aspx stores filters in ASP.NET session state. Isolate every query so
  // one category/month partition cannot leak into the next one.
  jar.values.clear();
  const initialDocument = documentFrom(await request(SEARCH_URL));
  const params = serializeForm(initialDocument);
  setParam(params, FIELD.category, category.value);
  setParam(params, FIELD.month, month);
  setParam(params, FIELD.place, place);
  if (day) setParam(params, FIELD.day, day);
  if (age) setParam(params, FIELD.age, age);
  setParam(params, FIELD.startDate, startDate);
  setParam(params, FIELD.search, "Search Activities");
  params.delete("__EVENTTARGET");
  params.delete("__EVENTARGUMENT");

  const html = await request(SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const result = documentFrom(html);
  const selectedCategory = result.querySelector("#mainContent_ddlCategoryList option:checked")?.value;
  if (selectedCategory !== category.value) {
    throw new Error(
      `Fairfax returned category ${selectedCategory ?? "(none)"} after requesting ${category.value} (${category.label}).`,
    );
  }
  return result;
}

async function nextPage(document) {
  const params = serializeForm(document);
  setParam(params, "__EVENTTARGET", "ctl01$mainContent$bNext");
  setParam(params, "__EVENTARGUMENT", "");
  params.delete(FIELD.search);
  const html = await request(SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  return documentFrom(html);
}

async function collectQuery(options) {
  let document = await freshSearch(options);
  const pages = pageCount(document);
  const activities = [];
  let lastPageSize = 0;

  for (let page = 1; page <= pages; page += 1) {
    const rows = parseResults(document, options.category.label);
    activities.push(...rows);
    lastPageSize = rows.length;
    if (page < pages) document = await nextPage(document);
  }
  return {
    activities,
    saturated: pages === MAX_PAGES && lastPageSize >= PAGE_SIZE,
  };
}

function addUnique(target, activities) {
  for (const activity of activities) {
    const titleAges = parseTitleAges(activity.title);
    target.set(activity.catalogId, titleAges ? { ...activity, ...titleAges } : activity);
  }
}

function excelDateToISO(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(Math.round((value - 25569) * 86_400_000)).toISOString().slice(0, 10);
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value.trim());
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }
  return "";
}

function excelTimeTo24(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const minutes = Math.round((value - Math.floor(value)) * 24 * 60) % 1440;
    return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
  }
  return typeof value === "string" ? clockTo24(value) : null;
}

async function mergeCampWorkbook(target, startDate, allowedCategories) {
  const workbook = XLSX.read(await readFile(CAMP_WORKBOOK));
  const sheetName = workbook.SheetNames.find((name) => /camp/i.test(name));
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
  let added = 0;
  let enriched = 0;

  for (const row of rows) {
    const catalogId = String(row["Catalog ID"] ?? "").trim();
    const title = String(row["Camp Title"] ?? "").trim();
    const endDate = excelDateToISO(row["End Date"]);
    if (!catalogId || !title || !endDate || endDate < startDate) continue;
    const category = /extended care/i.test(title) ? "CAMPS EXTENDED CARE PROGRAMS" : "CAMPS SUMMER";
    if (!allowedCategories.has(category)) continue;

    const existing = target.get(catalogId);
    const fee = Number(row.Fee);
    if (existing) {
      target.set(catalogId, {
        ...existing,
        fee: Number.isFinite(fee) ? fee : existing.fee,
        community: existing.community || String(row.Community ?? "").trim(),
        weekLabel: existing.weekLabel || String(row["Date Range"] ?? "").trim(),
      });
      enriched += 1;
      continue;
    }

    const venue = String(row.Location ?? "").trim();
    target.set(catalogId, {
      title,
      description: "",
      category,
      catalogId,
      community: String(row.Community ?? "").trim(),
      venue,
      fee: Number.isFinite(fee) ? fee : null,
      startDate: excelDateToISO(row["Start Date"]),
      endDate,
      startTime: excelTimeTo24(row["Start Time"]),
      endTime: excelTimeTo24(row["End Time"]),
      ageMin: parseWorkbookAge(row["Min Age"]),
      ageMax: parseWorkbookAge(row["Max Age"]),
      weekLabel: String(row["Date Range"] ?? "").trim(),
      status: String(row.Status ?? "").trim(),
      meetingDays: [1, 2, 3, 4, 5],
      seatsAvailable: null,
      isVirtual: venue.toLowerCase() === "virtual fcpa",
      detailUrl: SEARCH_URL,
    });
    added += 1;
  }
  console.log(`Camp workbook: enriched ${enriched}, added ${added} sessions.`);
}

async function collectCategory(category, { months, places, days, ages, startDate }) {
  const found = new Map();
  const broad = await collectQuery({ category, startDate });
  addUnique(found, broad.activities);
  if (!broad.saturated) return found;

  console.warn(`${category.label}: broad query reached the five-page cap; subdividing by place.`);
  for (const place of places) {
    const local = await collectQuery({ category, place: place.value, startDate });
    addUnique(found, local.activities);
    if (!local.saturated) continue;

    console.warn(`${category.label} / ${place.label}: still capped; subdividing by month.`);
    for (const month of months) {
      const monthly = await collectQuery({
        category,
        month: month.value,
        place: place.value,
        startDate,
      });
      addUnique(found, monthly.activities);
      if (!monthly.saturated) continue;

      console.warn(
        `${category.label} / ${place.label} / ${month.label}: still capped; subdividing by weekday.`,
      );
      for (const day of days) {
        const daily = await collectQuery({
          category,
          month: month.value,
          place: place.value,
          day: day.value,
          startDate,
        });
        addUnique(found, daily.activities);
        if (!daily.saturated) continue;

        console.warn(
          `${category.label} / ${place.label} / ${month.label} / ${day.label}: still capped; subdividing by age.`,
        );
        for (const age of ages) {
          const aged = await collectQuery({
            category,
            month: month.value,
            place: place.value,
            day: day.value,
            age: age.value,
            startDate,
          });
          addUnique(found, aged.activities);
          if (aged.saturated) {
            throw new Error(
              `${category.label} / ${place.label} / ${month.label} / ${day.label} / ${age.label} still exceeds the five-page cap.`,
            );
          }
        }
      }
    }
  }
  return found;
}

async function main() {
  const startDate = process.env.FCPA_START_DATE || todayUS();
  const initialDocument = documentFrom(await request(SEARCH_URL));
  const includeInventory = process.env.FCPA_INCLUDE_INVENTORY === "1";
  const campsOnly = process.env.FCPA_CAMPS_ONLY === "1";
  const categoryFilter = process.env.FCPA_CATEGORY?.trim().toLowerCase();
  const allCategories = optionList(initialDocument, "#mainContent_ddlCategoryList").filter(
    (option) => option.value && option.label !== "All Categories",
  );
  const categories = allCategories.filter(
    (option) =>
      (includeInventory || !INVENTORY_CATEGORIES.has(option.label)) &&
      (!campsOnly || /^CAMPS(?:\s|$)/i.test(option.label)) &&
      (!categoryFilter || option.label.toLowerCase() === categoryFilter),
  );
  if (categoryFilter && categories.length === 0) {
    throw new Error(`Unknown or excluded FCPA category: ${process.env.FCPA_CATEGORY}`);
  }
  if (categories.length === 0) throw new Error("No FCPA categories found to refresh.");
  const scope = categories.map((category) => category.label).sort().join("|");
  const refreshedCategories = new Set(categories.map((category) => category.label));
  const partialRefresh = campsOnly || Boolean(categoryFilter);
  // A targeted refresh must retain every category that was not requested.
  const previous = partialRefresh ? JSON.parse(await readFile(OUTPUT, "utf8")) : null;
  if (previous && !Array.isArray(previous.activities)) {
    throw new Error("Cannot perform a partial refresh without an existing activity catalog.");
  }
  const months = optionList(initialDocument, "#mainContent_ddlMonths").filter(
    (option) => option.value && option.label !== "All Months",
  );
  const places = optionList(initialDocument, "#mainContent_ddlPlaceList").filter(
    (option) => option.value && option.label !== "All Places",
  );
  const days = optionList(initialDocument, "#ddlDayOfWeek");
  const ages = optionList(initialDocument, "#mainContent_ddlAgeRange").filter(
    (option) => option.value && option.label !== "All Ages",
  );

  const activities = new Map();
  const completedCategories = new Set();
  try {
    const checkpoint = JSON.parse(await readFile(CHECKPOINT, "utf8"));
    if (
      checkpoint.version === CHECKPOINT_VERSION &&
      checkpoint.scope === scope &&
      checkpoint.startDate === startDate &&
      checkpoint.includeInventory === includeInventory
    ) {
      addUnique(activities, checkpoint.activities ?? []);
      for (const category of checkpoint.completedCategories ?? []) completedCategories.add(category);
      console.log(`Resuming with ${activities.size} activities from ${completedCategories.size} categories.`);
    }
  } catch {
    // No compatible checkpoint; start clean.
  }

  for (const [index, category] of categories.entries()) {
    if (completedCategories.has(category.label)) {
      console.log(`[${index + 1}/${categories.length}] ${category.label}: already collected`);
      continue;
    }
    const categoryActivities = await collectCategory(category, {
      months,
      places,
      days,
      ages,
      startDate,
    });
    addUnique(activities, categoryActivities.values());
    completedCategories.add(category.label);
    await writeFile(
      CHECKPOINT,
      JSON.stringify({
        version: CHECKPOINT_VERSION,
        scope,
        startDate,
        includeInventory,
        completedCategories: [...completedCategories],
        activities: [...activities.values()],
      }),
    );
    console.log(`[${index + 1}/${categories.length}] ${category.label}: ${categoryActivities.size}`);
  }

  await mergeCampWorkbook(activities, usDateToISO(startDate), refreshedCategories);
  if (partialRefresh) {
    preserveUnrefreshedActivities(activities, previous.activities, refreshedCategories);
  }
  const sorted = [...activities.values()].sort(
    (a, b) =>
      a.startDate.localeCompare(b.startDate) ||
      a.title.localeCompare(b.title) ||
      a.catalogId.localeCompare(b.catalogId),
  );
  const generatedAt = new Date().toISOString();
  const categoryRefreshedAt = { ...(previous?.categoryRefreshedAt ?? {}) };
  for (const activity of previous?.activities ?? []) {
    categoryRefreshedAt[activity.category] ??= previous.generatedAt;
  }
  for (const category of refreshedCategories) categoryRefreshedAt[category] = generatedAt;
  const payload = {
    version: 1,
    generatedAt,
    sourceUrl: SEARCH_URL,
    startDate: previous?.startDate || usDateToISO(startDate),
    categoryRefreshedAt,
    excludedCategories: previous?.excludedCategories ?? (includeInventory
      ? []
      : allCategories.filter((option) => INVENTORY_CATEGORIES.has(option.label)).map((option) => option.label)),
    activities: sorted,
  };
  await writeFile(OUTPUT, `${JSON.stringify(payload)}\n`);
  // Keep checkpoints only for interrupted runs; a later refresh must fetch again.
  await rm(CHECKPOINT, { force: true });
  console.log(`Wrote ${sorted.length} activities after ${requestCount} requests to ${OUTPUT.pathname}`);
}

await main();
