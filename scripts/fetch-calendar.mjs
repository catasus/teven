// Hämtar en iCal-länk (Google Calendar "hemlig adress i iCal-format") och skriver docs/events.json
// med kommande händelser, inklusive återkommande. Länken ligger i miljövariabeln CALENDAR_ICS_URL.
import ICAL from "ical.js";
import { readFileSync, writeFileSync } from "node:fs";

const DAYS_AHEAD = 14;
const urls = (process.env.CALENDAR_ICS_URL || "").split(/\s+/).filter(Boolean);
const src = process.env.ICS_FILE; // för test lokalt

async function load() {
  if (src) return [readFileSync(src, "utf8")];
  const out = [];
  for (const u of urls) {
    const r = await fetch(u);
    if (!r.ok) throw new Error("Kunde inte hämta kalendern: " + r.status);
    out.push(await r.text());
  }
  return out;
}

const now = new Date();
const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const to = new Date(from.getTime() + DAYS_AHEAD * 86400000);
const events = [];

function add(ev, start, end) {
  const allDay = start.isDate;
  const s = start.toJSDate(), e = end.toJSDate();
  if (e <= from || s >= to) return;
  events.push({
    title: ev.summary || "(utan titel)",
    start: allDay ? start.toString() : s.toISOString(),
    end: allDay ? end.toString() : e.toISOString(),
    allDay,
  });
}

for (const text of await load()) {
  const comp = new ICAL.Component(ICAL.parse(text));
  const vevents = comp.getAllSubcomponents("vevent").map((c) => new ICAL.Event(c));
  for (const ev of vevents) {
    if (ev.isRecurrenceException()) continue;
    if (!ev.isRecurring()) { add(ev, ev.startDate, ev.endDate); continue; }
    const it = ev.iterator();
    for (let n = it.next(), i = 0; n && i < 2000; n = it.next(), i++) {
      if (n.toJSDate() >= to) break;
      const d = ev.getOccurrenceDetails(n);
      add(d.item, d.startDate, d.endDate);
    }
  }
}

events.sort((a, b) => (a.start < b.start ? -1 : 1));
writeFileSync("docs/events.json", JSON.stringify({ updated: now.toISOString(), events }, null, 1));
console.log(events.length + " händelser");
