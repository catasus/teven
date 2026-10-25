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

  function tick() {
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
      renderKidCal(kidEv);
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

  // Barnens egna kalenderposter, överst i deras kolumn
  function renderKidCal(kidEv) {
    CHILDREN.forEach(function (name) {
      var key = name.toLowerCase(), box = $("cal-" + key), head = $("calh-" + key);
      var list = kidEv[name].slice().sort(function (x, y) { return evDate(x) - evDate(y); }).slice(0, 4);
      head.style.display = list.length ? "block" : "none";
      var html = "";
      list.forEach(function (e) {
        var s = evDate(e);
        var t = e.allDay ? "Heldag" : pad(s.getHours()) + ":" + pad(s.getMinutes());
        html += '<div class="kid"><div class="kb"><div class="k1"><span class="d">' + dayLabel(s) +
          '</span><span class="t">' + t + '</span></div><div class="k2">' + esc(e.title) + "</div></div>" + peopleIn(e.title) + "</div>";
      });
      box.innerHTML = html;
    });
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

  function mine(data, name) {
    return (data.events || []).filter(function (e) { return String(e.who).toLowerCase() === name.toLowerCase(); });
  }
  function emptyMsg(t) { return '<div class="empty" style="font-size:2vh">' + t + "</div>"; }

  function kids() {
    get("kids.json", function (err, data) {
      CHILDREN.forEach(function (name) {
        var box = $("tr-" + name.toLowerCase());
        var list = err || !data ? [] : mine(data, name);
        if (!list.length) { box.innerHTML = emptyMsg("Inget planerat"); return; }
        var html = "";
        list.slice(0, 5).forEach(function (e) {
          var s = evDate(e);
          var t = e.allDay ? "Heldag" : pad(s.getHours()) + ":" + pad(s.getMinutes());
          html += '<div class="kid"><div class="kb"><div class="k1"><span class="d">' + dayLabel(s) +
            '</span><span class="t">' + t + '</span></div><div class="k2">' + esc(e.title) +
            (e.location ? '<span class="x">' + esc(e.location) + "</span>" : "") + "</div></div></div>";
        });
        box.innerHTML = html;
      });
    });
  }

  function homework() {
    get("homework.json", function (err, data) {
      CHILDREN.forEach(function (name) {
        var box = $("hw-" + name.toLowerCase());
        var list = err || !data ? [] : mine(data, name);
        if (!list.length) { box.innerHTML = emptyMsg("Inga läxor eller prov just nu"); return; }
        var html = "";
        list.sort(function (x, y) { return evDate(x) - evDate(y); }).slice(0, 5).forEach(function (e) {
          html += '<div class="kid"><div class="kb"><div class="k1"><span class="d">' + dayLabel(evDate(e)) +
            "</span><span>" + esc(e.title) + "</span></div>" +
            (e.description ? '<div class="desc">' + esc(e.description) + "</div>" : "") + "</div></div>";
        });
        box.innerHTML = html;
      });
    });
  }

  function heads() {
    CHILDREN.forEach(function (name) {
      $("head-" + name.toLowerCase()).innerHTML = avatar(name) + "<span>" + name + "</span>";
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
  function refresh() { checkBuild(); weather(); calendar(); kids(); homework(); }
  refresh(); setInterval(refresh, C.refreshMinutes * 60000);
})();
