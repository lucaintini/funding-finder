// Funding finder matcher (lucaintini.ai/funding, 22 Oct 2026).
// Pure functions, no DOM and no network: the page and the tests both load this
// file. A profile goes in, ranked programs with a verdict for each come out.
(function (root) {
  "use strict";

  var EU = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
    "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];

  // Money and credits first, tax incentives last (Luca's funding rule, 17 Oct 2026).
  var KIND_ORDER = ["grant", "prize", "credits", "accelerator", "loan", "equity", "tax"];
  // Academic track (23 Oct 2026): money for the person first, then for the project.
  var ACADEMIC_ORDER = ["scholarship", "fellowship", "grant", "prize"];
  function track(p) { return p.track || "founder"; }
  function kindRank(p) {
    var order = track(p) === "academic" ? ACADEMIC_ORDER : KIND_ORDER;
    return order.indexOf(p.kind);
  }

  // Free-text research description to fields, for the academic track.
  var FIELD_WORDS = {
    "natural-sciences": ["physics", "chemistry", "mathematic", "astronom", "geolog", "earth science", "climate science", "oceanograph", "ecolog", "material science", "quantum"],
    "engineering-computing": ["engineering", "computer science", "computing", "software", "robot", "machine learning", "artificial intelligence", "ai ", "data science", "electronics", "semiconductor", "aerospace", "civil engineering"],
    "life-sciences-medicine": ["biolog", "medicine", "medical", "clinical", "neuroscience", "genetic", "genom", "cancer", "oncolog", "immunolog", "public health", "epidemiolog", "pharmac", "biomedical", "health"],
    "social-sciences": ["economic", "sociolog", "psycholog", "political", "law", "legal", "education", "anthropolog", "geograph", "demograph", "policy", "management", "business studies"],
    "humanities": ["history", "philosoph", "literature", "linguistic", "archaeolog", "theolog", "classics", "religio", "cultural studies"],
    "arts": ["music", "visual art", "fine art", "film", "theatre", "theater", "dance", "design", "performing", "creative writing", "architecture"]
  };
  function fieldsFromText(text) {
    var t = " " + String(text || "").toLowerCase() + " ", out = [];
    Object.keys(FIELD_WORDS).forEach(function (f) {
      if (FIELD_WORDS[f].some(function (w) { return t.indexOf(w) !== -1; })) out.push(f);
    });
    return out;
  }

  // Free-text idea to sectors. Plain keyword stems, so it works in every
  // browser; the on-device AI, where present, only adds to this.
  var SECTOR_WORDS = {
    ai: ["ai", "artificial intelligence", "machine learning", "ml", "llm", "agent", "neural", "computer vision", "nlp", "chatbot", "gpt"],
    software: ["app", "saas", "software", "platform", "web", "mobile", "api", "marketplace", "tool"],
    health: ["health", "medical", "medic", "clinic", "patient", "hospital", "wellbeing", "mental health", "biotech", "pharma", "diagnos"],
    cleantech: ["climate", "energy", "solar", "wind power", "wind farm", "wind turbine", "battery", "carbon", "emission", "renewable", "hydrogen", "recycl", "circular", "green"],
    agrifood: ["farm", "agri", "food", "crop", "soil", "livestock", "fish", "water"],
    fintech: ["finance", "fintech", "payment", "bank", "crypto", "blockchain", "insurance", "lending"],
    edtech: ["education", "edtech", "e-learning", "school", "student", "teach", "course", "tutor"],
    deeptech: ["quantum", "semiconductor", "photonic", "robot", "drone", "space tech", "spacecraft", "satellite", "aerospace", "material", "nano", "hardware", "sensor", "iot"],
    cyber: ["security", "cyber", "privacy", "encryption", "post-quantum", "identity"],
    creative: ["music", "film", "game", "art", "design", "media", "culture", "creative", "fashion"],
    social: ["social", "nonprofit", "community", "impact", "inclusion", "accessibility", "disab", "refugee"],
    tourism: ["tourism", "travel", "hospitality", "hotel", "visa"],
    manufacturing: ["manufactur", "factory", "industrial", "supply chain", "logistics", "3d print"],
    // Not sectors but who or what is behind the idea; some programs exist only for them.
    opensource: ["open source", "open-source", "oss", "maintainer"],
    "women-led": ["women-led", "woman-led", "female founder", "women founder", "woman founder"]
  };

  function sectorsFromText(text) {
    var t = " " + String(text || "").toLowerCase() + " ";
    var out = [];
    Object.keys(SECTOR_WORDS).forEach(function (s) {
      // Words of 3 letters or less must match whole; longer ones are stems that
      // must start a word ("diagnos" matches "diagnosis", "mental" no longer
      // matches "environmental").
      var hit = SECTOR_WORDS[s].some(function (w) {
        var e = w.replace(/[-]/g, "\-");
        return new RegExp("[^a-z]" + e + (w.length <= 3 ? "[^a-z]" : "")).test(t);
      });
      if (hit) out.push(s);
    });
    return out;
  }

  function expand(codes) {
    var set = {};
    (codes || []).forEach(function (c) {
      set[c] = true;
      if (EU.indexOf(c) !== -1) set.EU = true;
      if (c === "EU") EU.forEach(function (e) { set[e] = true; });
    });
    return set;
  }

  function overlaps(required, haveSet) {
    return required.some(function (c) { return haveSet[c]; });
  }

  function regionCountry(region) {
    return region === "GLOBAL" || region === "EU" ? region : region.slice(0, 2);
  }

  function daysLeft(deadline, today) {
    if (!deadline || deadline.type !== "date") return null;
    var d = new Date(deadline.date + "T23:59:59Z");
    return Math.ceil((d - today) / 86400000);
  }

  function names(list) {
    if (list.indexOf("EU") !== -1) return "an EU country";
    return list.join(" or ");
  }

  // profile: {track:"founder"|"academic", citizenship:[], residence:[], company:"none"|"XX", host:"any"|"XX",
  //   stage, student, equityOk, age, sectors:[], idea}
  // returns {status:"eligible"|"conditional"|"no", reasons:[], conditions:[], sectorFit, days}
  function assess(p, prof, today) {
    var a = p.applicant, reasons = [], conditions = [];
    var cit = expand(prof.citizenship), res = expand(prof.residence);
    var hasCompany = prof.company && prof.company !== "none";
    var days = daysLeft(p.deadline, today);

    if (days !== null && days < 0) reasons.push("The last deadline has passed");
    if (p.deadline.type === "closed") conditions.push("The current round is closed" + (p.deadline.note ? " (" + p.deadline.note + ")" : "") + ": watch the page for the next call");
    if (track(p) === "academic") return assessAcademic(p, prof, reasons, conditions, cit, res, days);
    if (prof.stage === "established" && p.stages.indexOf("established") === -1 && p.stages.indexOf("revenue") !== -1) {
      // Many "revenue" programs have no age limit, some are for young firms only.
      conditions.push("May be only for younger businesses: check the age or revenue limit");
    } else if (p.stages.indexOf(prof.stage) === -1) {
      reasons.push("Not open at your stage (" + p.stages.join(", ") + ")");
    }
    if (p.equity && !prof.equityOk) reasons.push("The funder takes equity");
    if (a.citizenship.length && !overlaps(a.citizenship, cit)) reasons.push("Needs citizenship of " + names(a.citizenship));
    if (a.age_max && prof.age && prof.age > a.age_max) reasons.push("Age limit " + a.age_max);
    if (a.student === "only" && !prof.student) reasons.push("Only for students and recent graduates");
    if (p.kind === "accelerator" && p.remote === false && p.region !== "GLOBAL") {
      var home = expand([].concat(prof.residence || []));
      if (!home[regionCountry(p.region)]) conditions.push("In person: you would need to be there for the program");
    }
    if (!a.sole_trader && !hasCompany && !a.company_required) conditions.push("Not open to individuals: you need a business entity");

    if (a.residence.length && !overlaps(a.residence, res)) {
      conditions.push("You must live or be based in " + names(a.residence));
    } else if (!a.residence.length && p.region !== "GLOBAL") {
      var rc = regionCountry(p.region);
      var anyTie = expand([].concat(prof.residence || [], prof.citizenship || [], hasCompany ? [prof.company] : []));
      if (!anyTie[rc]) conditions.push("Run by " + (rc === "EU" ? "the EU" : rc) + ": usually needs a local base");
    }
    if (a.company_required) {
      if (!hasCompany) {
        conditions.push("Needs a company" + (a.company_in.length ? " registered in " + names(a.company_in) : ""));
      } else if (a.company_in.length && !overlaps(a.company_in, expand([prof.company]))) {
        conditions.push("Needs a company registered in " + names(a.company_in));
      }
    }

    // With no sector known at all we cannot rule a program out on sector.
    var known = (prof.sectors || []).length > 0;
    var sectorFit = p.sectors.indexOf("any") !== -1 || !known ? 1
      : prof.sectors.some(function (s) { return p.sectors.indexOf(s) !== -1; }) ? 2 : 0;
    if (sectorFit === 0) reasons.push("Aimed at " + p.sectors.join(", "));

    var status = reasons.length ? "no" : conditions.length ? "conditional" : "eligible";
    return { status: status, reasons: reasons, conditions: conditions, sectorFit: sectorFit, days: days };
  }

  // The academic track: stage, citizenship, age and field as for founders; the
  // host country replaces the company questions, and a mobility rule is a condition.
  function assessAcademic(p, prof, reasons, conditions, cit, res, days) {
    var a = p.applicant;
    if (p.stages.indexOf(prof.stage) === -1) reasons.push("Not open at your stage (" + p.stages.join(", ") + ")");
    if (a.citizenship.length && !overlaps(a.citizenship, cit)) reasons.push("Needs citizenship of " + names(a.citizenship));
    if (a.age_max && prof.age && prof.age > a.age_max) reasons.push("Age limit " + a.age_max);
    if (a.residence.length && !overlaps(a.residence, res)) conditions.push("You must live or be based in " + names(a.residence));
    var host = p.host_in || [];
    if (host.length && prof.host && prof.host !== "any" && !expand(host)[prof.host]) {
      conditions.push("The research must be done in " + names(host));
    }
    if (p.mobility) conditions.push(p.mobility.replace(/\.$/, ""));
    var known = (prof.sectors || []).length > 0;
    var sectorFit = p.sectors.indexOf("any") !== -1 || !known ? 1
      : prof.sectors.some(function (s) { return p.sectors.indexOf(s) !== -1; }) ? 2 : 0;
    if (sectorFit === 0) reasons.push("Aimed at " + p.sectors.join(", "));
    var status = reasons.length ? "no" : conditions.length ? "conditional" : "eligible";
    return { status: status, reasons: reasons, conditions: conditions, sectorFit: sectorFit, days: days };
  }

  // Only the programs of the visitor's track are ranked: a founder never sees
  // a PhD scholarship, a researcher never sees an accelerator.
  function forTrack(programs, prof) {
    var t = (prof && prof.track) || "founder";
    return programs.filter(function (p) { return track(p) === t; });
  }

  function rank(programs, prof, today) {
    var rows = forTrack(programs, prof).map(function (p) { return { p: p, v: assess(p, prof, today || new Date()) }; });
    var statusOrder = { eligible: 0, conditional: 1, no: 2 };
    rows.sort(function (x, y) {
      return statusOrder[x.v.status] - statusOrder[y.v.status]
        || kindRank(x.p) - kindRank(y.p)
        || y.v.sectorFit - x.v.sectorFit
        || x.v.conditions.length - y.v.conditions.length
        || (x.v.days === null ? 9999 : x.v.days) - (y.v.days === null ? 9999 : y.v.days)
        || x.p.name.localeCompare(y.p.name);
    });
    return rows;
  }

  var api = { assess: assess, rank: rank, sectorsFromText: sectorsFromText, fieldsFromText: fieldsFromText, forTrack: forTrack, KIND_ORDER: KIND_ORDER, EU: EU };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FundingMatch = api;
})(this);
