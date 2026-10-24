(function () {
  var C = window.CONFIG;
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
    });
  }

  function dayKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

  function calendar() {
    get("events.json", function (err, data) {
      var box = $("events");
      if (err || !data || !data.events) { box.innerHTML = '<div class="empty">Ingen kalender kopplad ännu</div>'; return; }
      var now = new Date();
      var end = new Date(now.getTime() + C.daysAhead * 86400000);
      var byDay = {}, keys = [];
      data.events.forEach(function (e) {
        var s = new Date(e.start), f = new Date(e.end || e.start);
        if (f < now || s > end) return;
        var k = dayKey(s < now && e.allDay ? now : s);
        if (!byDay[k]) { byDay[k] = []; keys.push(k); }
        byDay[k].push(e);
      });
      keys.sort();
      if (!keys.length) { box.innerHTML = '<div class="empty">Inga händelser de närmaste dagarna</div>'; return; }
      var html = "", n = 0;
      keys.forEach(function (k) {
        if (n >= 6) return;
        var d = new Date(k + "T12:00:00");
        var label = k === dayKey(now) ? "Idag" : DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()];
        html += '<div class="day"><h3>' + label + "</h3>";
        byDay[k].sort(function (a, b) { return a.start < b.start ? -1 : 1; }).forEach(function (e) {
          if (n++ >= 6) return;
          var s = new Date(e.start);
          var t = e.allDay ? "Heldag" : pad(s.getHours()) + ":" + pad(s.getMinutes());
          html += '<div class="ev"><span class="t">' + t + "</span><span>" + esc(e.title) + "</span></div>";
        });
        html += "</div>";
      });
      box.innerHTML = html;
    });
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }

  tick(); setInterval(tick, 1000);
  function refresh() { weather(); calendar(); }
  refresh(); setInterval(refresh, C.refreshMinutes * 60000);
})();
