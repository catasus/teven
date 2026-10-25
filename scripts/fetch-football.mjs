// Hämtar kommande Champions League-matcher från football-data.org och sparar de där BÅDA lagen är storklubbar
// i docs/football.json. Nyckeln ligger i miljövariabeln FOOTBALL_API_KEY (GitHub-hemlighet).
// Test lokalt: FOOTBALL_FILE=svar.json node scripts/fetch-football.mjs
import { readFileSync, writeFileSync } from "node:fs";

// Vem matcherna visas för
const WHO = ["Otis"];
// Storklubbar. Ett lag räknas om dess namn matchar något av mönstren. Lägg till eller ta bort fritt.
const BIG = [
  /real madrid/i, /barcelona|barça/i, /bayern/i, /manchester city/i, /liverpool/i, /arsenal/i,
  /paris saint|psg/i, /intern(azionale)?(?! )|inter milan/i, /chelsea/i, /manchester united/i,
  /juventus/i, /\bmilan\b|ac milan/i, /atl[eé]tico/i, /dortmund/i, /napoli/i, /tottenham/i, /leverkusen/i,
];
const DAYS_AHEAD = 28;
const isBig = (t) => !!t && BIG.some((re) => re.test(`${t.name || ""} ${t.shortName || ""}`));

let data;
if (process.env.FOOTBALL_FILE) {
  data = JSON.parse(readFileSync(process.env.FOOTBALL_FILE, "utf8"));
} else {
  const key = process.env.FOOTBALL_API_KEY;
  if (!key) { console.log("Ingen FOOTBALL_API_KEY, hoppar över fotboll."); process.exit(0); }
  const iso = (d) => d.toISOString().slice(0, 10);
  const from = new Date(), to = new Date(Date.now() + DAYS_AHEAD * 86400000);
  const r = await fetch(`https://api.football-data.org/v4/competitions/CL/matches?dateFrom=${iso(from)}&dateTo=${iso(to)}`,
    { headers: { "X-Auth-Token": key } });
  if (!r.ok) throw new Error("football-data.org svarade " + r.status);
  data = await r.json();
}

const events = [];
for (const m of data.matches || []) {
  if (!isBig(m.homeTeam) || !isBig(m.awayTeam)) continue;
  if (m.status === "FINISHED" || m.status === "CANCELLED") continue;
  const nm = (t) => t.shortName || t.name;
  for (const who of WHO) {
    events.push({ who, title: `${nm(m.homeTeam)} – ${nm(m.awayTeam)}`, sub: "Champions League", start: new Date(m.utcDate).toISOString(), allDay: false });
  }
}
events.sort((a, b) => (a.start < b.start ? -1 : 1));
writeFileSync("docs/football.json", JSON.stringify({ updated: new Date().toISOString(), events }, null, 1));
console.log("docs/football.json: " + events.length + " matcher");
