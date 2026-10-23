#!/usr/bin/env python3
"""Weekly freshness check for the funding finder's programs.

Opens every official link and flags the ones that no longer answer, plus every
dated deadline that has passed and every record due for a recheck within two
weeks. The Funding links workflow runs it each Monday and opens an issue with
the list, so a dead program is caught before a visitor finds it.

Run it:
    python tools/check_funding_links.py            # prints problems, exit 1 if any
"""

from __future__ import annotations

import datetime as dt
import os
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from check_funding_data import DATA, MAX_AGE_DAYS, load  # noqa: E402

UA = "Mozilla/5.0 (lucaintini.ai funding finder link check; hello@lucaintini.ai)"


def link_ok(url: str) -> str | None:
    for method in ("HEAD", "GET"):
        req = urllib.request.Request(url, method=method, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=25) as r:
                if r.status < 400:
                    return None
        except urllib.error.HTTPError as e:
            # Many government sites refuse HEAD or bots with 403/405; a 404 or
            # 410 on GET means gone, a 5xx means broken this week.
            if method == "GET" and (e.code in (404, 410) or e.code >= 500):
                return f"HTTP {e.code}"
        except Exception as e:  # noqa: BLE001
            if method == "GET":
                return f"unreachable ({type(e).__name__})"
    return None


def main() -> int:
    today = dt.date.today()
    records, errs = load(DATA)
    problems = list(errs)
    for r in records:
        d = r["deadline"]
        if d.get("type") == "date" and dt.date.fromisoformat(d["date"]) < today:
            problems.append(f"{r['id']}: deadline {d['date']} has passed")
        age = (today - dt.date.fromisoformat(r["checked"])).days
        if age > MAX_AGE_DAYS - 14:
            problems.append(f"{r['id']}: last checked {r['checked']}, recheck before day {MAX_AGE_DAYS}")
        bad = link_ok(r["url"])
        if bad:
            problems.append(f"{r['id']}: {r['url']} {bad}")
    for p in problems:
        print(f"- {p}")
    print(f"{len(records)} programs, {len(problems)} need attention")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
