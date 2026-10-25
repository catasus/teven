(function () {
  var C = window.CONFIG;
  var CHILDREN = ["Otis", "Melker"];
  var $ = function (id) { return document.getElementById(id); };
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var DAYS = ["söndag","måndag","tisdag","onsdag","torsdag","fredag","lördag"];
  var MONTHS = ["januari","februari","mars","april","maj","juni","juli","augusti","september","oktober","november","december"];

  function isoWeek(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    var y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y0) / 86400000 + 1) / 7);
  }

  // Dag/kväll: ?theme=night eller ?theme=day i adressen tvingar fram ett läge (för test)
  var forced = /[?&]theme=(night|day)/.exec(location.search);
  var isNight = null;
  function applyTheme() {
    var h = new Date().getHours();
    var night = forced ? forced[1] === "night" : (C.nightFrom > C.nightTo ? (h >= C.nightFrom || h < C.nightTo) : (h >= C.nightFrom && h < C.nightTo));
    if (night === isNight) return;
    isNight = night;
    document.documentElement.className = night ? "night" : "";
    $("dim").style.opacity = night ? (C.dimNight || 0) : (C.dim || 0);
  }

  function tick() {
    applyTheme();
    var d = new Date();
    $("clock").textContent = pad(d.getHours()) + ":" + pad(d.getMinutes());
    $("date").textContent = DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()];
    $("week").textContent = "Vecka " + isoWeek(d);
  }

  // WMO-koder från Open-Meteo
  function wmo(c) {
    if (c === 0) return "Klart";
    if (c <= 2) return "Mest klart";
    if (c === 3) return "Mulet";
    if (c === 45 || c === 48) return "Dimma";
    if (c >= 51 && c <= 57) return "Duggregn";
    if (c >= 61 && c <= 67) return "Regn";
    if (c >= 71 && c <= 77) return "Snö";
    if (c >= 80 && c <= 82) return "Regnskurar";
    if (c === 85 || c === 86) return "Snöbyar";
    if (c >= 95) return "Åska";
    return "";
  }

  function get(url, cb) {
    var x = new XMLHttpRequest();
    x.open("GET", url + (url.indexOf("?") < 0 ? "?" : "&") + "_=" + Date.now());
    x.onload = function () {
      try { cb(null, JSON.parse(x.responseText)); } catch (e) { cb(e); }
    };
    x.onerror = function () { cb(new Error("network")); };
    x.send();
  }

  function weather() {
    var url = "https://api.open-meteo.com/v1/forecast?latitude=" + C.lat + "&longitude=" + C.lon +
      "&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min" +
      "&timezone=auto&forecast_days=4";
    get(url, function (err, w) {
      if (err || !w.current) return;
      $("wtemp").textContent = Math.round(w.current.temperature_2m) + "°";
      $("wdesc").textContent = C.city + " · " + wmo(w.current.weather_code);
      var html = "";
      for (var i = 1; i < w.daily.time.length; i++) {
        var dd = new Date(w.daily.time[i] + "T12:00:00");
        html += "<div><b>" + DAYS[dd.getDay()].slice(0, 3) + "</b>" +
          Math.round(w.daily.temperature_2m_max[i]) + "° / " +
          Math.round(w.daily.temperature_2m_min[i]) + "°<br>" + wmo(w.daily.weather_code[i]) + "</div>";
      }
      $("wdays").innerHTML = html;
      drawGeneral();
    });
  }

  function dayKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

  // ---- Gympakläder: gäller bara på skoldagar (se config.js) ----
  var GYM_SVG = '<svg class="gymi" viewBox="0 0 24 24" role="img" aria-label="Gympakläder"><path d="M8 3 3 6l2 4 2-1v12h10V9l2 1 2-4-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z"/></svg>';
  function inRange(key, r) { return key >= r[0] && key <= r[1]; }
  function isSchoolDay(key) {
    var terms = C.schoolTerms || [], off = C.noSchool || [], inTerm = false, i;
    for (i = 0; i < terms.length; i++) if (inRange(key, terms[i])) inTerm = true;
    if (!inTerm) return false;
    for (i = 0; i < off.length; i++) if (inRange(key, off[i])) return false;
    var wd = new Date(key + "T12:00:00").getDay();
    return wd >= 1 && wd <= 5;
  }
  function isGymDay(name, key) {
    var g = (C.gym || {})[name];
    return !!g && g.indexOf(new Date(key + "T12:00:00").getDay()) >= 0 && isSchoolDay(key);
  }

  // Vilka barn en händelse gäller, utifrån titeln: namn, eller "barnen"/"pojkarna" m.fl. betyder båda
  function whoFor(title) {
    var t = String(title);
    if (/\b(barnen|barna|pojkarna|grabbarna|killarna|bröderna|syskonen)\b/i.test(t)) return ["Otis", "Melker"];
    var out = [];
    if (/\botis/i.test(t)) out.push("Otis");
    if (/\bmelker/i.test(t)) out.push("Melker");
    return out;
  }

  function calendar() {
    get("events.json", function (err, data) {
      var box = $("events");
      var kidEv = { Otis: [], Melker: [] };
      var general = [];
      if (!err && data && data.events) {
        var now = new Date();
        var end = new Date(now.getTime() + C.daysAhead * 86400000);
        data.events.forEach(function (e) {
          var s = new Date(e.start), f = new Date(e.end || e.start);
          if (f < now || s > end) return;
          var w = whoFor(e.title);
          if (!w.length) { general.push(e); return; }
          w.forEach(function (name) { kidEv[name].push(e); });
        });
      }
      K.cal = kidEv; drawKids();
      calState = { ok: !(err || !data || !data.events), general: general };
      drawGeneral();
    });
  }

  // Ritas om när vädret kommit, eftersom det ändrar hur mycket plats kalendern har
  var calState = null;
  function drawGeneral() {
    var box = $("events");
    if (!calState) return;
    if (!calState.ok) { box.innerHTML = '<div class="empty">Ingen kalender kopplad ännu</div>'; return; }
    var byDay = {}, keys = [];
    calState.general.forEach(function (e) {
      var s = new Date(e.start);
      var k = dayKey(s < new Date() && e.allDay ? new Date() : s);
      if (!byDay[k]) { byDay[k] = []; keys.push(k); }
      byDay[k].push(e);
    });
    keys.sort();
    if (!keys.length) { box.innerHTML = '<div class="empty">Inga händelser de närmaste dagarna</div>'; return; }
    var html = "", n = 0, today = dayKey(new Date());
    keys.forEach(function (k) {
      if (n >= C.calendarRows) return;
      var d = new Date(k + "T12:00:00");
      var label = k === today ? "Idag" : DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()];
      html += '<div class="day"><h3>' + label + "</h3>";
      byDay[k].sort(function (a, b) { return a.start < b.start ? -1 : 1; }).forEach(function (e) {
        if (n++ >= C.calendarRows) return;
        var s = new Date(e.start);
        var t = e.allDay ? "Heldag" : pad(s.getHours()) + ":" + pad(s.getMinutes());
        html += '<div class="ev"><span class="t">' + t + "</span><span>" + esc(e.title) + "</span>" + peopleIn(e.title) + "</div>";
      });
      html += "</div>";
    });
    box.innerHTML = html;
    fit(box, box.parentNode);
  }

  // Tar bort sista raderna tills kolumnen ryms, så skärmen fylls utan att något klipps
  function fit(box, container) {
    while (container.scrollHeight > container.clientHeight + 1) {
      var evs = box.querySelectorAll(".ev");
      if (!evs.length) break;
      var last = evs[evs.length - 1], day = last.parentNode;
      day.removeChild(last);
      if (!day.querySelector(".ev")) box.removeChild(day);
    }
  }

  var PHOTOS = { otis: 1, melker: 1, keps: 1, hector: 1 };
  function avatar(who) {
    var k = String(who || "").toLowerCase();
    if (C.avatarPhotos && PHOTOS[k]) return '<img class="av ' + k + '" src="img/' + k + '.jpg" alt="">';
    return who ? '<span class="av avl ' + k + '">' + esc(String(who).charAt(0).toUpperCase()) + "</span>" : "";
  }
  // Vuxna i kalenderns titlar: Keps/Jessica och Hector får en liten bild vid raden
  function peopleIn(title) {
    var t = String(title), out = "";
    if (/\b(keps|jessica)\b/i.test(t)) out += avatar("Keps");
    if (/\bhector\b/i.test(t)) out += avatar("Hector");
    return out;
  }

  function evDate(e) { return new Date(e.allDay ? e.start + "T12:00:00" : e.start); }
  function dayLabel(d) {
    var t = new Date(), k = dayKey(d);
    if (k === dayKey(t)) return "Idag";
    if (k === dayKey(new Date(t.getTime() + 86400000))) return "Imorgon";
    return DAYS[d.getDay()].slice(0, 3) + " " + d.getDate() + "/" + (d.getMonth() + 1);
  }

  // ---- Barnens veckomatris: en liggande ruta per barn, en kolumn per dag ----
  var K = { cal: { Otis: [], Melker: [] }, sport: [], hw: [] };
  var TYPE_ORDER = { school: 0, sport: 1, cal: 2 };

  function nextKey(k) { var d = new Date(k + "T12:00:00"); return dayKey(new Date(d.getTime() + 86400000)); }
  function onDay(e, key) {
    if (e.allDay) {
      var end = e.end && e.end > e.start ? e.end : nextKey(e.start);
      return e.start <= key && key < end;
    }
    return dayKey(new Date(e.start)) === key;
  }
  function clock(e) { if (e.allDay) return ""; var s = new Date(e.start); return pad(s.getHours()) + ":" + pad(s.getMinutes()); }
  function sportTitle(t) {
    if (/träning/i.test(t) && /(P13|innebandy|Högalids)/i.test(t)) return "Innebandyträning";
    return String(t).replace(/\s*[-–]\s*Högalids IF.*$/i, "");
  }

  function itemsFor(name, key) {
    var out = [];
    K.hw.forEach(function (e) {
      if (e.who === name && onDay(e, key)) out.push({ type: "school", title: e.title, time: "" });
    });
    K.sport.forEach(function (e) {
      if (e.who === name && onDay(e, key)) out.push({ type: "sport", title: sportTitle(e.title), time: clock(e),
        loc: String(e.location || "").replace(/\s*\(.*\)\s*$/, "") });
    });
    K.cal[name].forEach(function (e) {
      if (onDay(e, key)) out.push({ type: "cal", title: e.title, time: clock(e) });
    });
    return out.sort(function (a, b) {
      return (TYPE_ORDER[a.type] - TYPE_ORDER[b.type]) || (a.time < b.time ? -1 : a.time > b.time ? 1 : 0);
    });
  }

  function drawKids() {
    var t0 = new Date(), base = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate());
    var days = [];
    for (var i = 0; i < 7; i++) days.push(new Date(base.getFullYear(), base.getMonth(), base.getDate() + i));
    var lastKey = dayKey(days[6]);
    CHILDREN.forEach(function (name) {
      var html = "";
      days.forEach(function (d, i) {
        var key = dayKey(d);
        html += '<div class="dcol' + (i === 0 ? " today" : "") + '"><div class="dh"><span><b>' +
          (i === 0 ? "Idag" : DAYS[d.getDay()].slice(0, 3)) + "</b> " + d.getDate() + "/" + (d.getMonth() + 1) + "</span>" +
          (isGymDay(name, key) ? GYM_SVG : "") + "</div>";
        itemsFor(name, key).forEach(function (it) {
          html += '<div class="it ' + it.type + '">' + (it.time ? '<span class="tm">' + it.time + "</span> " : "") +
            esc(it.title) + (it.loc ? '<div class="loc">' + esc(it.loc) + "</div>" : "") + "</div>";
        });
        html += "</div>";
      });
      $("days-" + name.toLowerCase()).innerHTML = html;
      // Läxor och prov längre fram än veckan
      var later = K.hw.filter(function (e) { return e.who === name && dayKey(evDate(e)) > lastKey; })
        .sort(function (x, y) { return evDate(x) - evDate(y); }).slice(0, 3);
      var lh = "";
      later.forEach(function (e) {
        var d = evDate(e);
        lh += '<span class="lt"><b>' + DAYS[d.getDay()].slice(0, 3) + " " + d.getDate() + "/" + (d.getMonth() + 1) + "</b> " + esc(e.title) + "</span>";
      });
      $("later-" + name.toLowerCase()).innerHTML = lh ? '<span class="ll">Senare</span>' + lh : "";
    });
  }

  function loadKids() {
    get("kids.json", function (err, data) { K.sport = err || !data ? [] : (data.events || []); drawKids(); });
    get("homework.json", function (err, data) { K.hw = err || !data ? [] : (data.events || []); drawKids(); });
  }

  function heads() {
    CHILDREN.forEach(function (name) {
      $("head-" + name.toLowerCase()).innerHTML = avatar(name) + "<span>" + name + "</span>" +
        '<div class="leg"><div><i class="school"></i>Skola</div><div><i class="sport"></i>Sport</div><div><i class="cal"></i>Övrigt</div><div>' + GYM_SVG + 'Gympa</div></div>';
    });
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }

  tick(); setInterval(tick, 1000);
  heads();
  window.addEventListener("load", function () { drawGeneral(); });
  // Laddar om sidan om en nyare version finns ute (bumpa build i index.html och build.json vid ändringar)
  function checkBuild() {
    var m = document.querySelector('meta[name="build"]');
    if (!m) return;
    get("build.json", function (err, d) {
      if (!err && d && d.build && d.build !== m.content) location.reload();
    });
  }
  function refresh() { checkBuild(); weather(); calendar(); loadKids(); }
  refresh(); setInterval(refresh, C.refreshMinutes * 60000);
})();
