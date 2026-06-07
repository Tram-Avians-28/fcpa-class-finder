/**
 * Re-check the Blue/Green registration-phase mapping (src/data/phase.json),
 * which is hand-transcribed from FCPA's map image and can't auto-update.
 *
 * Flags (exit code 1) when either:
 *   - the published map image changed (hash differs) -> re-transcribe, OR
 *   - the current spreadsheet has venues with no phase that aren't already
 *     acknowledged in phase.json -> add them.
 *
 *   npm run check-phase
 *
 * In CI it writes a summary and a report file the workflow uses to open an issue.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

const root = new URL("../", import.meta.url);
const phase = JSON.parse(readFileSync(new URL("src/data/phase.json", root)));
const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();

const known = new Set([...phase.green, ...phase.blue].map(norm));
const acknowledged = new Set((phase.knownUnknowns ?? []).map(norm));

// 1) Has the published map image changed since we transcribed it?
let mapChanged = null; // null = couldn't check
try {
  const res = await fetch(phase.mapImage);
  if (res.ok) {
    const sha = createHash("sha256").update(Buffer.from(await res.arrayBuffer())).digest("hex");
    mapChanged = sha !== phase.mapSha256;
    if (mapChanged) console.error(`map sha now ${sha}, expected ${phase.mapSha256}`);
  } else {
    console.error(`WARN: map image fetch returned HTTP ${res.status}`);
  }
} catch (e) {
  console.error("WARN: could not fetch map image:", e.message);
}

// 2) Do any current venues lack a phase (and aren't already acknowledged)?
const wb = XLSX.read(readFileSync(new URL("public/fcpa-camp-spreadsheet.xlsx", root)));
const sheet = wb.SheetNames.find((n) => /camp/i.test(n)) ?? wb.SheetNames[0];
const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, raw: true, blankrows: false });
let header = -1;
let locCol = -1;
for (let i = 0; i < Math.min(rows.length, 40); i++) {
  const lower = rows[i].map((c) => String(c ?? "").trim().toLowerCase());
  if (lower.includes("camp title") && lower.includes("location")) {
    header = i;
    locCol = lower.indexOf("location");
    break;
  }
}
const used = new Set();
for (let i = header + 1; i < rows.length; i++) {
  const v = String(rows[i][locCol] ?? "").trim();
  if (v && v.toLowerCase() !== "virtual fcpa") used.add(v);
}
const newUnknowns = [...used].filter((v) => !known.has(norm(v)) && !acknowledged.has(norm(v))).sort();

const report = [
  `Blue/Green phase re-check (${new Date().toISOString().slice(0, 10)})`,
  ``,
  `Map image changed: ${mapChanged === null ? "could not check" : mapChanged}`,
  `Distinct used venues: ${used.size}`,
  `Acknowledged-unknown venues: ${[...acknowledged].length}`,
  `New venues with no phase: ${newUnknowns.length}`,
  ...(newUnknowns.length ? ["", "These venues need a Green/Blue assignment:", ...newUnknowns.map((v) => `  - ${v}`)] : []),
  ...(mapChanged ? ["", "The map image changed — re-transcribe and update src/data/phase.json (green/blue + mapSha256)."] : []),
].join("\n");

console.log(report);
writeFileSync(new URL("phase-check-report.txt", root), report + "\n");
if (process.env.GITHUB_STEP_SUMMARY) {
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, "## Blue/Green phase re-check\n\n```\n" + report + "\n```\n", { flag: "a" });
}

const needsAttention = mapChanged === true || newUnknowns.length > 0;
process.exit(needsAttention ? 1 : 0);
