// Hämtar iCal-länkar och skriver kommande händelser (inkl. återkommande) till en JSON-fil.
// Användning: node scripts/fetch-calendar.mjs <ENV_VARIABEL> <utfil> [dagar] [desc]
// "desc" tar med händelsens hela beskrivning och länk (används bara för läxor).
// Variabeln innehåller en länk per rad, gärna med etikett: "Otis|https://..." (webcal:// funkar också).
import ICAL from "ical.js";
import { readFileSync, writeFileSync } from "node:fs";

const [envName, outFile, days, withDesc] = process.argv.slice(2);
const DAYS_AHEAD = Number(days) || 14;
const sources = (process.env[envName] || "")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean)
  .map((l) => {
    const i = l.indexOf("|");
    const [label, url] = i >= 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : ["", l];
    return { label, url: url.replace(/^webcals?:\/\//i, "https://") };
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

const TZ = "Europe/Stockholm";
const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, hourCycle: "h23",
  year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",
});
function tzOffset(ms) { // ms som UTC -> offset (ms) för svensk tid just då
  const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - ms;
}
// Tid utan tidszon ("flytande") betyder klockslag på väggen, alltså svensk tid
function floatingToDate(t) {
  const guess = Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second);
  let ms = guess - tzOffset(guess);
  ms = guess - tzOffset(ms);
  return new Date(ms);
}
function toDate(t) {
  return t.zone === ICAL.Timezone.localTimezone ? floatingToDate(t) : t.toJSDate();
}

function add(s, ev, start, end) {
  const allDay = start.isDate;
  const a = toDate(start), b = toDate(end);
  if (b <= now && !allDay) return;
  if (b <= from || a >= to) return;
  events.push({
    who: s.label,
    title: ev.summary || "(utan titel)",
    location: ev.location || "",
    ...(withDesc === "desc" && ev.description
      ? { description: String(ev.description).replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000) }
      : {}),
    ...(withDesc === "desc" && ev.component.getFirstPropertyValue("url")
      ? { url: String(ev.component.getFirstPropertyValue("url")) }
      : {}),
    start: allDay ? start.toString() : a.toISOString(),
    end: allDay ? end.toString() : b.toISOString(),
    allDay,
  });
}

for (const s of sources) {
  const comp = new ICAL.Component(ICAL.parse(await load(s)));
  // Utan detta vet ical.js inte vad TZID=Europe/Stockholm betyder
  for (const vtz of comp.getAllSubcomponents("vtimezone")) ICAL.TimezoneService.register(vtz);
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
