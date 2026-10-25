(function () {
  var C = window.CONFIG || {};
  var CHILDREN = ["Otis", "Melker"];
  var DAYS = ["söndag","måndag","tisdag","onsdag","torsdag","fredag","lördag"];
  var MONTHS = ["januari","februari","mars","april","maj","juni","juli","augusti","september","oktober","november","december"];
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  var $ = function (id) { return document.getElementById(id); };
  var S = { events: [], kids: [], hw: [], updated: "" };
  var tab = (location.hash || "#otis").slice(1);
  if (["otis", "melker", "keps"].indexOf(tab) < 0) tab = "otis";

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  // Gör webbadresser klickbara. Texten escapas först, så inget annat kan köras.
  function linkify(text) {
    return esc(text).replace(/(https?:\/\/[^\s<]+)/g, function (u) {
      var tail = "";
      var m = /[.,;:!?)\]]+$/.exec(u);
      if (m) { tail = m[0]; u = u.slice(0, -tail.length); }
      return '<a href="' + u + '" target="_blank" rel="noopener">' + u + "</a>" + tail;
    });
  }

  function dayKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function nextKey(k) { var d = new Date(k + "T12:00:00"); return dayKey(new Date(d.getTime() + 86400000)); }
  function evDate(e) { return new Date(e.allDay ? e.start + "T12:00:00" : e.start); }
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
  function whoFor(title) {
    var t = String(title);
    if (/\b(barnen|barna|pojkarna|grabbarna|killarna|bröderna|syskonen)\b/i.test(t)) return ["Otis", "Melker"];
    var out = [];
    if (/\botis/i.test(t)) out.push("Otis");
    if (/\bmelker/i.test(t)) out.push("Melker");
    return out;
  }

  var ORDER = { school: 0, sport: 1, cal: 2 };
  function itemsFor(name, key) {
    var out = [];
    S.hw.forEach(function (e) {
      if (e.who === name && onDay(e, key)) out.push({ type: "school", title: e.title, time: clock(e), desc: e.description, url: e.url, loc: e.location });
    });
    S.kids.forEach(function (e) {
      if (e.who === name && onDay(e, key)) out.push({ type: "sport", title: sportTitle(e.title), time: clock(e), loc: String(e.location || "") });
    });
    S.events.forEach(function (e) {
      if (whoFor(e.title).indexOf(name) >= 0 && onDay(e, key)) out.push({ type: "cal", title: e.title, time: clock(e), loc: e.location, desc: e.description });
    });
    return out.sort(function (a, b) { return (ORDER[a.type] - ORDER[b.type]) || (a.time < b.time ? -1 : a.time > b.time ? 1 : 0); });
  }

  function itemHtml(it) {
    var head = (it.time ? '<span class="tm">' + it.time + "</span>" : "") + '<span class="ti">' + esc(it.title) +
      (it.loc ? '<span class="loc">' + esc(it.loc) + "</span>" : "") + "</span>";
    var body = "";
    if (it.desc) body += "<p>" + linkify(it.desc) + "</p>";
    if (it.url) body += '<a class="btn" href="' + esc(it.url) + '" target="_blank" rel="noopener">Öppna länk</a>';
    if (!body) return '<div class="it ' + it.type + '"><div class="row">' + head + "</div></div>";
    return '<details class="it ' + it.type + '"><summary>' + head + '<span class="chev"></span></summary><div class="body">' + body + "</div></details>";
  }

  function dayLabel(d, i) {
    if (i === 0) return "Idag";
    if (i === 1) return "Imorgon";
    return DAYS[d.getDay()] + " " + d.getDate() + "/" + (d.getMonth() + 1);
  }
  function days(n) {
    var t = new Date(), out = [];
    for (var i = 0; i < n; i++) out.push(new Date(t.getFullYear(), t.getMonth(), t.getDate() + i));
    return out;
  }

  function childView(name) {
    var html = "", ds = days(7);
    ds.forEach(function (d, i) {
      var items = itemsFor(name, dayKey(d));
      if (!items.length && i > 0) return;
      html += '<h2' + (i === 0 ? ' class="today"' : "") + ">" + dayLabel(d, i) + "</h2>";
      html += items.length ? items.map(itemHtml).join("") : '<div class="empty">Inget planerat</div>';
    });
    var last = dayKey(ds[6]);
    var later = S.hw.filter(function (e) { return e.who === name && dayKey(evDate(e)) > last; })
      .sort(function (a, b) { return evDate(a) - evDate(b); });
    if (later.length) {
      html += '<div class="later"><h2>Senare: läxor och prov</h2>';
      later.forEach(function (e) {
        var d = evDate(e);
        html += itemHtml({ type: "school", title: e.title, time: DAYS[d.getDay()].slice(0, 3) + " " + d.getDate() + "/" + (d.getMonth() + 1), desc: e.description, url: e.url, loc: e.location });
      });
      html += "</div>";
    }
    return html;
  }

  function familyView() {
    var html = "", any = false;
    days(14).forEach(function (d, i) {
      var key = dayKey(d), items = [];
      S.events.forEach(function (e) {
        if (!whoFor(e.title).length && onDay(e, key)) items.push({ type: "cal", title: e.title, time: clock(e), loc: e.location, desc: e.description });
      });
      items.sort(function (a, b) { return a.time < b.time ? -1 : 1; });
      if (!items.length && i > 0) return;
      any = any || items.length > 0;
      html += '<h2' + (i === 0 ? ' class="today"' : "") + ">" + dayLabel(d, i) + "</h2>";
      html += items.length ? items.map(itemHtml).join("") : '<div class="empty">Inget planerat</div>';
    });
    return html;
  }

  var PHOTOS = { otis: 1, melker: 1 };
  function drawTabs() {
    var defs = [["otis", "Otis"], ["melker", "Melker"], ["keps", "Keps & Hector"]];
    $("tabs").innerHTML = defs.map(function (t) {
      var img = C.avatarPhotos && PHOTOS[t[0]] ? '<img src="img/' + t[0] + '.jpg" alt="">'
        : '<span class="ph">' + esc(t[1].charAt(0)) + "</span>";
      if (t[0] === "keps") img = C.avatarPhotos ? '<img src="img/keps.jpg" alt="">' : '<span class="ph">K</span>';
      return '<button class="tab' + (tab === t[0] ? " on" : "") + '" data-tab="' + t[0] + '">' + img + t[1] + "</button>";
    }).join("");
  }

  function draw() {
    var v = tab === "keps" ? familyView() : childView(tab === "otis" ? "Otis" : "Melker");
    $("view").innerHTML = v;
    var u = S.updated ? new Date(S.updated) : null;
    $("now").textContent = "Familjen Catasús" + (u ? " · uppdaterad " + pad(u.getHours()) + ":" + pad(u.getMinutes()) : "");
    drawTabs();
  }

  $("tabs").addEventListener("click", function (e) {
    var b = e.target; while (b && b !== this && !b.getAttribute("data-tab")) b = b.parentNode;
    if (!b || b === this) return;
    tab = b.getAttribute("data-tab");
    location.hash = tab;
    window.scrollTo(0, 0);
    draw();
  });

  function j(name) {
    return fetch(name + "?_=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); })
      .catch(function () { return { events: [] }; });
  }
  function load() {
    Promise.all([j("events.json"), j("kids.json"), j("homework.json")]).then(function (r) {
      S.events = r[0].events || []; S.kids = r[1].events || []; S.hw = r[2].events || [];
      S.updated = [r[0].updated, r[1].updated, r[2].updated].filter(Boolean).sort().pop() || "";
      draw();
    });
    fetch("build.json?_=" + Date.now(), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) {
      var m = document.querySelector('meta[name="build"]');
      if (m && d.build && d.build !== m.content) location.reload();
    }).catch(function () {});
  }
  load();
  setInterval(load, (C.refreshMinutes || 15) * 60000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) load(); });
})();
