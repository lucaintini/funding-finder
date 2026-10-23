#!/usr/bin/env python3
"""Every program the funding finder shows must be checkable by the visitor.

The finder at lucaintini.ai/funding (22 Oct 2026) is only worth more than a
Google AI answer if each program it lists is real, current and eligible as
stated. A search summary that names a closed grant, or a link that 404s, is
exactly what we promise not to ship. So a program goes live only when it has
an official link, the date someone read that page, and its eligibility spelled
out in fields the matcher can test.

This guard fails the build when any record under site/funding/data/ breaks
that contract, when two records share an id, or when stacks_with names a
program that does not exist.

Run it:
    python tools/check_funding_data.py              # check site/funding/data
    python tools/check_funding_data.py --self-test  # prove the rules work

Exit code 0 = clean, 1 = violations found, 2 = bad usage.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "site", "funding", "data")

# Ranking follows Luca's funding rule (17 Oct 2026): money and credits first,
# tax incentives last.
KINDS = ["grant", "prize", "credits", "accelerator", "loan", "equity", "tax"]
STAGES = ["idea", "prototype", "revenue"]
REGION = re.compile(r"^(GLOBAL|EU|[A-Z]{2}(-[A-Z0-9]{2,3})?)$")
COUNTRY = re.compile(r"^[A-Z]{2}$")
ID = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
DASHES = re.compile("[–—]")
MAX_AGE_DAYS = 120

REQUIRED = {
    "id": str, "name": str, "provider": str, "region": str, "kind": str,
    "summary": str, "amount": str, "equity": bool, "applicant": dict,
    "stages": list, "sectors": list, "deadline": dict, "stacks_with": list,
    "next_steps": list, "url": str, "checked": str,
}
APPLICANT = {
    "sole_trader": bool, "company_required": bool, "company_in": list,
    "citizenship": list, "residence": list, "age_max": (int, type(None)),
}


def check_record(r: dict, today: dt.date) -> list[str]:
    out = []
    for k, t in REQUIRED.items():
        if k not in r:
            out.append(f"missing {k}")
        elif not isinstance(r[k], t):
            out.append(f"{k} must be {t.__name__}")
    if out:
        return out
    if not ID.match(r["id"]):
        out.append("id must be lowercase-kebab")
    if not REGION.match(r["region"]):
        out.append(f"region {r['region']!r} is not GLOBAL, EU, XX or XX-YY")
    if r["kind"] not in KINDS:
        out.append(f"kind must be one of {KINDS}")
    if not r["url"].startswith("https://"):
        out.append("url must be the official https page")
    try:
        checked = dt.date.fromisoformat(r["checked"])
        if checked > today:
            out.append("checked is in the future")
        elif (today - checked).days > MAX_AGE_DAYS:
            out.append(f"checked {r['checked']} is older than {MAX_AGE_DAYS} days: recheck the official page")
    except ValueError:
        out.append("checked must be YYYY-MM-DD")
    if not r["stages"] or any(s not in STAGES for s in r["stages"]):
        out.append(f"stages must be a non-empty subset of {STAGES}")
    if not r["sectors"]:
        out.append('sectors must list sectors or ["any"]')
    if not r["next_steps"]:
        out.append("next_steps must give the visitor at least one step")
    a = r["applicant"]
    for k, t in APPLICANT.items():
        if k not in a:
            out.append(f"applicant.{k} missing")
        elif not isinstance(a[k], t):
            out.append(f"applicant.{k} has the wrong type")
    for k in ("company_in", "citizenship", "residence"):
        for c in a.get(k, []) or []:
            if not (c == "EU" or COUNTRY.match(str(c))):
                out.append(f"applicant.{k} entry {c!r} must be an ISO country code or EU")
    d = r["deadline"]
    if d.get("type") not in ("rolling", "date", "cohort"):
        out.append("deadline.type must be rolling, date or cohort")
    elif d["type"] == "date":
        try:
            dt.date.fromisoformat(d.get("date", ""))
        except ValueError:
            out.append("deadline.date must be YYYY-MM-DD when type is date")
    for k in ("name", "summary", "amount"):
        if DASHES.search(r[k]):
            out.append(f"{k} contains an em or en dash")
    for s in r["next_steps"]:
        if DASHES.search(s):
            out.append("next_steps contains an em or en dash")
    return out


def check_all(records: list[dict], today: dt.date) -> list[str]:
    out, seen = [], set()
    for r in records:
        rid = r.get("id", "?")
        out += [f"{rid}: {p}" for p in check_record(r, today)]
        if rid in seen:
            out.append(f"{rid}: duplicate id")
        seen.add(rid)
    for r in records:
        for s in r.get("stacks_with", []) or []:
            if s not in seen:
                out.append(f"{r.get('id')}: stacks_with names unknown program {s!r}")
    return out


def load(folder: str) -> tuple[list[dict], list[str]]:
    records, errs = [], []
    for name in sorted(os.listdir(folder)):
        if not name.endswith(".json"):
            continue
        try:
            with open(os.path.join(folder, name), encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            errs.append(f"{name}: {e}")
            continue
        if not isinstance(data, list):
            errs.append(f"{name}: must be a JSON list of programs")
            continue
        records += data
    return records, errs


GOOD = {
    "id": "example-grant", "name": "Example Grant", "provider": "Example Agency",
    "region": "AU", "kind": "grant", "summary": "Up to A$50k for early prototypes.",
    "amount": "Up to A$50,000", "equity": False,
    "applicant": {"sole_trader": True, "company_required": False, "company_in": [],
                  "citizenship": [], "residence": ["AU"], "age_max": None},
    "stages": ["idea", "prototype"], "sectors": ["any"],
    "deadline": {"type": "rolling"}, "stacks_with": [],
    "next_steps": ["Read the guidelines"], "url": "https://example.gov.au/grant",
    "checked": "2026-10-22",
}


def self_test() -> int:
    today = dt.date(2026, 10, 22)
    assert check_all([GOOD], today) == [], check_all([GOOD], today)
    bad = {
        "no url": {**GOOD, "url": ""},
        "search summary": {**GOOD, "url": "http://blog.example.com"},
        "stale": {**GOOD, "checked": "2026-01-01"},
        "bad kind": {**GOOD, "kind": "vibes"},
        "dash": {**GOOD, "summary": "Grant \u2014 big"},
        "no steps": {**GOOD, "next_steps": []},
        "bad country": {**GOOD, "applicant": {**GOOD["applicant"], "residence": ["Italy"]}},
        "dangling stack": {**GOOD, "stacks_with": ["nope"]},
        "missing applicant field": {**GOOD, "applicant": {"sole_trader": True}},
    }
    for name, rec in bad.items():
        assert check_all([rec], today), f"{name} was not caught"
    assert any("duplicate" in p for p in check_all([GOOD, GOOD], today))
    print(f"self-test ok: 1 good record passes, {len(bad) + 1} bad shapes caught")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--self-test", action="store_true")
    ap.add_argument("--root", default=DATA)
    args = ap.parse_args()
    if args.self_test:
        return self_test()
    if not os.path.isdir(args.root):
        print(f"no data folder {args.root}")
        return 2
    records, errs = load(args.root)
    errs += check_all(records, dt.date.today())
    for e in errs:
        print(e)
    print(f"{len(records)} programs, {len(errs)} problems")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
