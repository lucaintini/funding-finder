// Funding finder page logic (lucaintini.ai/funding, 22 Oct 2026).
// Everything here runs in the visitor's browser. The page's security policy
// (connect-src 'none', form-action 'none') means it cannot send anything
// anywhere, even if this file wanted to.
(function () {
  "use strict";
  var M = window.FundingMatch, PROGRAMS = window.FUNDING_PROGRAMS || [];
  var KEY = "funding-finder-answers";
  var KIND_LABEL = { grant: "Grant", prize: "Prize", credits: "Credits", accelerator: "Accelerator",
    loan: "Loan", equity: "Investment", tax: "Tax incentive" };
  var INVESTOR_LABEL = { angel: "Angel network", government: "Public co-investor", vc: "Venture fund",
    crowdfunding: "Equity crowdfunding" };
  var $ = function (id) { return document.getElementById(id); };
  var form = $("ff-form");

  function checked(name) {
    return Array.prototype.slice.call(form.querySelectorAll("input[name=" + name + "]:checked"))
      .map(function (i) { return i.value; });
  }

  // Every country (23 Oct 2026: programs worldwide). Names come from the browser
  // (Intl.DisplayNames), so the page still needs nothing from the network.
  var COUNTRIES = ("AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF " +
    "CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ " +
    "GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KR KW KZ LA LB LC LI LK LR LS " +
    "LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG " +
    "PH PK PL PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM " +
    "TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS XK YE ZA ZM ZW").split(" ");
  var regionName = (function () {
    try { var dn = new Intl.DisplayNames(["en"], { type: "region" }); return function (c) { return dn.of(c) || c; }; }
    catch (e) { return function (c) { return c; }; }
  })();
  var byName = COUNTRIES.slice().sort(function (a, b) { return regionName(a).localeCompare(regionName(b)); });

  function addChip(name, code) {
    if (form.querySelector("input[name=" + name + "][value=" + code + "]")) return;
    var box = form.querySelector("select.ff-add[data-for=" + name + "]").previousElementSibling;
    var lab = document.createElement("label"), inp = document.createElement("input");
    inp.type = "checkbox"; inp.name = name; inp.value = code; inp.checked = true;
    lab.appendChild(inp); lab.appendChild(document.createTextNode(" " + regionName(code)));
    box.appendChild(lab);
  }

  form.querySelectorAll("select.ff-add").forEach(function (sel) {
    byName.forEach(function (c) {
      if (!form.querySelector("input[name=" + sel.dataset.for + "][value=" + c + "]")) {
        sel.appendChild(new Option(regionName(c), c));
      }
    });
    sel.addEventListener("change", function () {
      if (sel.value) { addChip(sel.dataset.for, sel.value); sel.value = ""; }
    });
  });
  (function () {
    var co = $("ff-company"), have = {};
    Array.prototype.forEach.call(co.options, function (o) { have[o.value] = true; });
    byName.forEach(function (c) { if (!have[c]) co.appendChild(new Option("Yes, registered in " + regionName(c), c)); });
  })();

  function profile() {
    var age = parseInt($("ff-age").value, 10);
    var picked = checked("sector");
    var fromText = M.sectorsFromText($("ff-idea").value);
    return {
      idea: $("ff-idea").value,
      citizenship: checked("cit"),
      residence: checked("res"),
      company: $("ff-company").value,
      stage: (form.querySelector("input[name=stage]:checked") || {}).value || "idea",
      equityOk: $("ff-equity").checked,
      age: isNaN(age) ? null : age,
      student: $("ff-student").checked,
      sectors: picked.concat(fromText.filter(function (s) { return picked.indexOf(s) === -1; })),
      textSectors: fromText
    };
  }

  function save(p) {
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* storage blocked: fine */ }
  }

  function restore() {
    var p;
    try { p = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { p = null; }
    if (!p) return false;
    $("ff-idea").value = p.idea || "";
    $("ff-company").value = p.company || "none";
    $("ff-equity").checked = !!p.equityOk;
    $("ff-age").value = p.age || "";
    $("ff-student").checked = !!p.student;
    ["cit", "res"].forEach(function (n) {
      var vals = n === "cit" ? p.citizenship : p.residence;
      (vals || []).forEach(function (c) { if (COUNTRIES.indexOf(c) !== -1) addChip(n, c); });
      form.querySelectorAll("input[name=" + n + "]").forEach(function (i) { i.checked = (vals || []).indexOf(i.value) !== -1; });
    });
    form.querySelectorAll("input[name=sector]").forEach(function (i) {
      i.checked = (p.sectors || []).indexOf(i.value) !== -1 && (p.textSectors || []).indexOf(i.value) === -1;
    });
    var st = form.querySelector("input[name=stage][value=" + (p.stage || "idea") + "]");
    if (st) st.checked = true;
    return true;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  var byId = {};
  PROGRAMS.forEach(function (p) { byId[p.id] = p; });

  // Lucide icons (ISC licence, lucide.dev, lucide-static 0.460.0), drawn with DOM calls so the
  // page needs no icon font or network. 23 Oct 2026: emoji and the coloured left stripe were
  // replaced on a visitor's feedback.
  var ICONS = {"grant":[["rect",{"width":"20","height":"12","x":"2","y":"6","rx":"2"}],["circle",{"cx":"12","cy":"12","r":"2"}],["path",{"d":"M6 12h.01M18 12h.01"}]],"prize":[["path",{"d":"M6 9H4.5a2.5 2.5 0 0 1 0-5H6"}],["path",{"d":"M18 9h1.5a2.5 2.5 0 0 0 0-5H18"}],["path",{"d":"M4 22h16"}],["path",{"d":"M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"}],["path",{"d":"M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"}],["path",{"d":"M18 2H6v7a6 6 0 0 0 12 0V2Z"}]],"credits":[["path",{"d":"M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"}]],"accelerator":[["path",{"d":"M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"}],["path",{"d":"m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"}],["path",{"d":"M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"}],["path",{"d":"M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"}]],"loan":[["line",{"x1":"3","x2":"21","y1":"22","y2":"22"}],["line",{"x1":"6","x2":"6","y1":"18","y2":"11"}],["line",{"x1":"10","x2":"10","y1":"18","y2":"11"}],["line",{"x1":"14","x2":"14","y1":"18","y2":"11"}],["line",{"x1":"18","x2":"18","y1":"18","y2":"11"}],["polygon",{"points":"12 2 20 7 4 7"}]],"equity":[["path",{"d":"m11 17 2 2a1 1 0 1 0 3-3"}],["path",{"d":"m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"}],["path",{"d":"m21 3 1 11h-2"}],["path",{"d":"M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"}],["path",{"d":"M3 4h8"}]],"tax":[["path",{"d":"M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"}],["path",{"d":"M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"}],["path",{"d":"M12 17.5v-11"}]],"eligible":[["path",{"d":"M20 6 9 17l-5-5"}]],"conditional":[["circle",{"cx":"12","cy":"12","r":"10"}],["path",{"d":"M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"}],["path",{"d":"M12 17h.01"}]],"no":[["path",{"d":"M18 6 6 18"}],["path",{"d":"m6 6 12 12"}]]};
  function icon(name) {
    var NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg");
    var base = { viewBox: "0 0 24 24", width: "14", height: "14", fill: "none", stroke: "currentColor",
      "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", "class": "ff-ico" };
    Object.keys(base).forEach(function (k) { svg.setAttribute(k, base[k]); });
    (ICONS[name] || []).forEach(function (d) {
      var e = document.createElementNS(NS, d[0]);
      Object.keys(d[1]).forEach(function (k) { e.setAttribute(k, d[1][k]); });
      svg.appendChild(e);
    });
    return svg;
  }

  function card(row) {
    var p = row.p, v = row.v;
    var c = el("article", "ff-card ff-" + v.status);
    c.dataset.id = p.id;
    var head = el("div", "ff-card-head");
    var kind = el("span", "ff-kind ff-kind-" + p.kind,
      p.investor_type ? INVESTOR_LABEL[p.investor_type] : KIND_LABEL[p.kind]);
    kind.insertBefore(icon(p.kind), kind.firstChild);
    head.appendChild(kind);
    head.appendChild(el("span", "ff-region", p.region === "GLOBAL" ? "Worldwide" : p.region));
    if (v.days !== null && v.days >= 0) head.appendChild(el("span", "ff-days" + (v.days <= 30 ? " ff-soon" : ""), v.days + " days left"));
    else if (p.deadline.type === "rolling") head.appendChild(el("span", "ff-days", "Open all year"));
    else if (p.deadline.type === "cohort") head.appendChild(el("span", "ff-days", "Intakes" + (p.deadline.note ? ": " + p.deadline.note : "")));
    c.appendChild(head);
    var h = el("h3");
    var a = el("a", "", p.name);
    a.href = p.url; a.target = "_blank"; a.rel = "noopener noreferrer";
    h.appendChild(a);
    c.appendChild(h);
    c.appendChild(el("p", "ff-provider", p.provider));
    c.appendChild(el("p", "ff-amount", p.amount + (p.equity ? " (takes equity)" : "")));
    c.appendChild(el("p", "ff-summary", p.summary));
    var verdict = el("p", "ff-verdict ff-verdict-" + v.status);
    verdict.appendChild(icon(v.status));
    verdict.appendChild(document.createTextNode(v.status === "eligible" ? "You look eligible."
      : v.status === "conditional" ? "Eligible if: " + v.conditions.join("; ") + "."
      : "Not for you now: " + v.reasons.join("; ") + "."));
    c.appendChild(verdict);
    var stack = (p.stacks_with || []).filter(function (id) { return byId[id]; });
    if (stack.length) c.appendChild(el("p", "ff-stack", "Can be combined with: " + stack.map(function (id) { return byId[id].name; }).join(", ")));
    var why = el("p", "ff-why");
    why.hidden = true;
    c.appendChild(why);
    if (v.status !== "no") {
      var steps = el("ol", "ff-steps");
      p.next_steps.forEach(function (s) { steps.appendChild(el("li", "", s)); });
      c.appendChild(steps);
    }
    c.appendChild(el("p", "ff-checked", "Official page checked " + p.checked));
    return c;
  }

  var lastRows = [];

  function render(p) {
    var rows = M.rank(PROGRAMS, p, new Date());
    lastRows = rows;
    var out = $("ff-results");
    out.textContent = "";
    var groups = [
      ["eligible", "You look eligible"],
      ["conditional", "Eligible with a condition"],
      ["no", "Not for you right now"]
    ];
    var counts = {};
    groups.forEach(function (g) {
      var list = rows.filter(function (r) { return r.v.status === g[0]; });
      counts[g[0]] = list.length;
      if (!list.length) return;
      var sec = g[0] === "no" ? el("details", "ff-group ff-group-no") : el("section", "ff-group");
      var title = g[0] === "no" ? el("summary", "", g[1] + " (" + list.length + ")") : el("h2", "", g[1] + " (" + list.length + ")");
      sec.appendChild(title);
      list.forEach(function (r) { sec.appendChild(card(r)); });
      out.appendChild(sec);
    });
    var sum = $("ff-summary");
    sum.textContent = counts.eligible + " programs you look eligible for, " + counts.conditional
      + " more with a condition, out of " + PROGRAMS.length + " checked programs."
      + (p.textSectors.length ? " From your idea we read: " + p.textSectors.join(", ") + "." : "");
    $("ff-out").hidden = false;
    $("ff-ai-row").hidden = !aiPossible;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var p = profile();
    save(p);
    render(p);
    $("ff-out").scrollIntoView({ behavior: "smooth", block: "start" });
    $("ff-summary").focus({ preventScroll: true });
  });

  $("ff-forget").addEventListener("click", function () {
    try { localStorage.removeItem(KEY); } catch (e) { /* nothing stored */ }
    form.reset();
    $("ff-out").hidden = true;
    $("ff-results").textContent = "";
    $("ff-restored").hidden = true;
    $("ff-forgot").hidden = false;
  });

  $("ff-print").addEventListener("click", function () { window.print(); });

  // On-device AI (Chrome's built-in model). The model runs on the visitor's
  // machine; the page still has no network access. Where it is missing, the
  // rules above already did the whole job.
  var aiPossible = false;
  (async function () {
    try {
      if (!("LanguageModel" in self)) return;
      var a = await self.LanguageModel.availability();
      aiPossible = a !== "unavailable";
      // Results may already be on screen when the answer arrives.
      if (lastRows.length) $("ff-ai-row").hidden = !aiPossible;
    } catch (e) { aiPossible = false; }
  })();

  $("ff-ai").addEventListener("click", async function () {
    var btn = $("ff-ai"), note = $("ff-ai-note");
    btn.disabled = true;
    note.textContent = "Starting the AI model on your device (the first time it may download, handled by your browser)...";
    try {
      var session = await self.LanguageModel.create({
        monitor: function (m) {
          m.addEventListener("downloadprogress", function (ev) { note.textContent = "Downloading the on-device model: " + Math.round(ev.loaded * 100) + "%"; });
        }
      });
      var idea = $("ff-idea").value.slice(0, 1500);
      var top = lastRows.filter(function (r) { return r.v.status !== "no"; }).slice(0, 8);
      for (var i = 0; i < top.length; i++) {
        var p = top[i].p;
        note.textContent = "Explaining match " + (i + 1) + " of " + top.length + "...";
        var answer = await session.prompt(
          "A founder describes their idea: \"" + idea + "\".\n" +
          "Program: " + p.name + ". " + p.summary + " Amount: " + p.amount + ".\n" +
          "In one or two plain sentences, say how this idea could fit this program and what to stress in the application. " +
          "Do not invent facts about the program. No dashes.");
        var c = document.querySelector('.ff-card[data-id="' + p.id + '"] .ff-why');
        if (c) { c.textContent = "On-device AI: " + answer.trim(); c.hidden = false; }
      }
      note.textContent = "Done. The explanations were written on your device; nothing was sent anywhere.";
      session.destroy();
    } catch (e) {
      note.textContent = "The on-device AI is not available in this browser. Your matches above are complete without it.";
    }
    btn.disabled = false;
  });

  $("ff-count").textContent = PROGRAMS.length;
  $("ff-built").textContent = window.FUNDING_BUILT || "";
  if (restore()) $("ff-restored").hidden = false;
})();
