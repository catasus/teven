// Hämtar iCal-länkar och skriver kommande händelser (inkl. återkommande) till en JSON-fil.
// Användning: node scripts/fetch-calendar.mjs <ENV_VARIABEL> <utfil> [dagar]
// Variabeln innehåller en länk per rad, gärna med etikett: "Otis|https://..." (webcal:// funkar också).
import ICAL from "ical.js";
import { readFileSync, writeFileSync } from "node:fs";

const [envName, outFile, days] = process.argv.slice(2);
const DAYS_AHEAD = Number(days) || 14;
const sources = (process.env[envName] || "")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean)
  .map((l) => {
    const i = l.indexOf("|");
    const [label, url] = i >= 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : ["", l];
    return { label, url: url.replace(/^webcal:\/\//i, "https://") };
  });

const now = new Date();
const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const to = new Date(from.getTime() + DAYS_AHEAD * 86400000);
const events = [];

async function load(s) {
  if (process.env.ICS_FILE) return readFileSync(process.env.ICS_FILE, "utf8"); // test lokalt
  const r = await fetch(s.url);
  if (!r.ok) throw new Error("Kunde inte hämta kalendern" + (s.label ? " (" + s.label + ")" : "") + ": " + r.status);
  return r.text();
}

function add(s, ev, start, end) {
  const allDay = start.isDate;
  const a = start.toJSDate(), b = end.toJSDate();
  if (b <= now && !allDay) return;
  if (b <= from || a >= to) return;
  events.push({
    who: s.label,
    title: ev.summary || "(utan titel)",
    location: ev.location || "",
    start: allDay ? start.toString() : a.toISOString(),
    end: allDay ? end.toString() : b.toISOString(),
    allDay,
  });
}

for (const s of sources) {
  const comp = new ICAL.Component(ICAL.parse(await load(s)));
  const vevents = comp.getAllSubcomponents("vevent").map((c) => new ICAL.Event(c));
  for (const ev of vevents) {
    if (ev.isRecurrenceException()) continue;
    if (!ev.isRecurring()) { add(s, ev, ev.startDate, ev.endDate); continue; }
    const it = ev.iterator();
    for (let n = it.next(), i = 0; n && i < 2000; n = it.next(), i++) {
      if (n.toJSDate() >= to) break;
      const d = ev.getOccurrenceDetails(n);
      add(s, d.item, d.startDate, d.endDate);
    }
  }
}

events.sort((a, b) => (a.start < b.start ? -1 : 1));
writeFileSync(outFile, JSON.stringify({ updated: now.toISOString(), events }, null, 1));
console.log(outFile + ": " + events.length + " händelser");
