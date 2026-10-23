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

// Students (23 Oct 2026): student-only programs need the student box.
const forStudents = prog({ applicant: { student: "only" } });
assert.strictEqual(M.assess(forStudents, { ...luca, student: false }, today).status, "no");
assert.notStrictEqual(M.assess(forStudents, { ...luca, student: true }, today).status, "no");

// Established businesses (Luke's case): a "revenue" program is a maybe, an idea-only one is out.
const est = { ...luca, stage: "established" };
const rev = M.assess(prog({ stages: ["revenue"] }), est, today);
assert.strictEqual(rev.status, "conditional");
assert.ok(rev.conditions.some((c) => /younger businesses/.test(c)));
assert.strictEqual(M.assess(prog({ stages: ["idea"] }), est, today).status, "no");
assert.notStrictEqual(M.assess(prog({ stages: ["established"] }), est, today).status, "no");

// In-person accelerators elsewhere are flagged, remote ones are not.
const away = prog({ kind: "accelerator", region: "US", remote: false });
assert.ok(M.assess(away, luca, today).conditions.some((c) => /In person/.test(c)));
assert.ok(!M.assess({ ...away, remote: true }, luca, today).conditions.some((c) => /In person/.test(c)));

console.log("funding matcher ok");

// Academic track (23 Oct 2026): its own stages, host country and mobility rule;
// a founder never sees academic programs and the other way round.
const phd = { track: "academic", citizenship: ["IT"], residence: ["AU"], company: "none", host: "any", stage: "phd",
  equityOk: false, age: 30, sectors: ["life-sciences-medicine"] };
const scholarship = prog({ track: "academic", kind: "scholarship", stages: ["phd"], host_in: ["GB"], mobility: "" });
assert.strictEqual(M.assess(scholarship, phd, today).status, "eligible", "happy to move: no host condition");
const stayHome = M.assess(scholarship, Object.assign({}, phd, { host: "AU" }), today);
assert.strictEqual(stayHome.status, "conditional");
assert.ok(/done in GB/.test(stayHome.conditions[0]));
const msca = prog({ track: "academic", kind: "fellowship", stages: ["postdoc"], region: "EU", host_in: ["EU"],
  mobility: "Must not have lived in the host country for more than 12 of the last 36 months." });
assert.strictEqual(M.assess(msca, phd, today).status, "no", "a PhD candidate is not a postdoc");
const pd = M.assess(msca, Object.assign({}, phd, { stage: "postdoc", host: "IT" }), today);
assert.strictEqual(pd.status, "conditional");
assert.ok(/12 of the last 36 months/.test(pd.conditions.join(" ")), "the mobility rule is a condition");
assert.strictEqual(M.assess(prog({ track: "academic", kind: "grant", stages: ["phd"], sectors: ["humanities"] }), phd, today).status, "no", "field mismatch");
assert.strictEqual(M.assess(prog({ track: "academic", kind: "grant", stages: ["phd"], applicant: { citizenship: ["US"] } }), phd, today).status, "no");
// A closed round is never "eligible" at the top (HELLO, 23 Oct 2026).
const closed = M.assess(prog({ deadline: { type: "closed", note: "next call not announced" } }), luca, today);
assert.strictEqual(closed.status, "conditional");
assert.ok(/round is closed/.test(closed.conditions[0]));
// Tracks never mix, and academic money for the person ranks first.
const mixed = [prog({ id: "f1" }), scholarship, prog({ id: "g1", track: "academic", kind: "grant", stages: ["phd"] }),
  prog({ id: "p1", track: "academic", kind: "prize", stages: ["phd"] })];
assert.deepStrictEqual(M.rank(mixed, luca, today).map((r) => r.p.id), ["f1"]);
assert.deepStrictEqual(M.rank(mixed, phd, today).map((r) => r.p.id), ["x", "g1", "p1"]);
assert.deepStrictEqual(M.fieldsFromText("A PhD on seagrass restoration in marine biology"), ["life-sciences-medicine"]);
console.log("academic track ok");
