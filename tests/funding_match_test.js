// Behaviour tests for site/funding/match.js, run by tests/test_funding.py.
const assert = require("assert");
const M = require("../site/funding/match.js");

const today = new Date("2026-10-22T00:00:00Z");
const base = {
  id: "x", name: "X", provider: "P", region: "AU", kind: "grant", summary: "", amount: "",
  equity: false, applicant: { sole_trader: true, company_required: false, company_in: [],
    citizenship: [], residence: [], age_max: null },
  stages: ["idea", "prototype", "revenue"], sectors: ["any"], deadline: { type: "rolling" },
  stacks_with: [], next_steps: ["a"], url: "https://x", checked: "2026-10-22"
};
const prog = (o) => Object.assign({}, base, o, { applicant: Object.assign({}, base.applicant, o.applicant || {}) });
const luca = { citizenship: ["AU", "IT", "CA"], residence: ["AU"], company: "none", stage: "prototype",
  equityOk: false, age: 50, sectors: ["ai"] };

// Plain eligible.
assert.strictEqual(M.assess(prog({}), luca, today).status, "eligible");
// Italian citizenship satisfies an EU citizenship rule.
assert.strictEqual(M.assess(prog({ region: "EU", applicant: { citizenship: ["EU"] } }), { ...luca, residence: ["IT"] }, today).status, "eligible");
// Residence elsewhere is a condition, never a hard no.
const r = M.assess(prog({ region: "CA-BC", applicant: { residence: ["CA"] } }), luca, today);
assert.strictEqual(r.status, "conditional");
assert.ok(/based in CA/.test(r.conditions[0]));
// Company required, individual applicant: condition naming the country.
const c = M.assess(prog({ applicant: { sole_trader: false, company_required: true, company_in: ["AU"] } }), luca, today);
assert.strictEqual(c.status, "conditional");
assert.ok(/company registered in AU/.test(c.conditions[0]));
// Hard noes: equity refused, age, stage, passed deadline, citizenship, sector.
assert.strictEqual(M.assess(prog({ equity: true }), luca, today).status, "no");
assert.strictEqual(M.assess(prog({ applicant: { age_max: 35 } }), luca, today).status, "no");
assert.strictEqual(M.assess(prog({ stages: ["revenue"] }), luca, today).status, "no");
assert.strictEqual(M.assess(prog({ deadline: { type: "date", date: "2026-10-01" } }), luca, today).status, "no");
assert.strictEqual(M.assess(prog({ applicant: { citizenship: ["US"] } }), luca, today).status, "no");
assert.strictEqual(M.assess(prog({ sectors: ["health"] }), luca, today).status, "no");
// Days left counts the deadline day itself.
assert.strictEqual(M.assess(prog({ deadline: { type: "date", date: "2026-10-31" } }), luca, today).days, 10);

// Ranking: eligible before conditional, money before tax.
const rows = M.rank([
  prog({ id: "tax", name: "T", kind: "tax" }),
  prog({ id: "cond", name: "C", applicant: { residence: ["NL"] }, region: "NL" }),
  prog({ id: "grant", name: "G", kind: "grant" }),
  prog({ id: "acc", name: "A", kind: "accelerator" })
], luca, today).map((x) => x.p.id);
assert.deepStrictEqual(rows, ["grant", "acc", "tax", "cond"]);

// Free text to sectors, with short words matched whole.
assert.deepStrictEqual(M.sectorsFromText("An AI app for farms").sort(), ["agrifood", "ai", "software"]);
assert.ok(!M.sectorsFromText("said the main train").includes("ai"));
// Programs only for open source maintainers or women-led businesses need the tag, not just "software".
assert.ok(M.sectorsFromText("an open source library I maintain").includes("opensource"));
assert.strictEqual(M.assess(prog({ sectors: ["opensource"] }), { ...luca, sectors: ["software", "ai"] }, today).status, "no");

// Stems start words: no edtech from "machine learning", no health from "environmental".
assert.ok(!M.sectorsFromText("machine learning for environmental reporting").includes("edtech"));
assert.ok(!M.sectorsFromText("machine learning for environmental reporting").includes("health"));
assert.ok(M.sectorsFromText("early diagnosis of skin cancer").includes("health"));
// No sector known: a sector-specific program is not ruled out on sector.
assert.notStrictEqual(M.assess(prog({ sectors: ["health"] }), { ...luca, sectors: [] }, today).status, "no");

console.log("funding matcher ok");
