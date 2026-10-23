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

  function card(row) {
    var p = row.p, v = row.v;
    var c = el("article", "ff-card ff-" + v.status);
    c.dataset.id = p.id;
    var head = el("div", "ff-card-head");
    head.appendChild(el("span", "ff-kind ff-kind-" + p.kind,
      p.investor_type ? INVESTOR_LABEL[p.investor_type] : KIND_LABEL[p.kind]));
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
    var verdict = el("p", "ff-verdict");
    verdict.textContent = v.status === "eligible" ? "You look eligible."
      : v.status === "conditional" ? "Eligible if: " + v.conditions.join("; ") + "."
      : "Not for you now: " + v.reasons.join("; ") + ".";
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
