#!/usr/bin/env python3
"""Validate Real Estate binary flow destinations and SVG generation."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import site_structure as ss  # noqa: E402

cfg = json.loads((ROOT / "components/site-map/site-map.json").read_text(encoding="utf-8"))
sec = next(s for s in cfg["sections"] if s["id"] == "real-estate")
assert "flow" in sec
pages = ss.list_pages(cfg)

hrefs = []
questions = []

def walk(n):
    if "q" in n:
        questions.append(n["q"])
        assert "yes" in n and "no" in n
        walk(n["yes"])
        walk(n["no"])
    else:
        assert n.get("href"), n
        hrefs.append(n["href"])

walk(sec["flow"]["root"])
missing = []
for h in hrefs + [i["href"] for i in sec["flow"].get("secondary", [])]:
    rel = ss.rel_for(h)
    if rel not in pages and not (ROOT / rel).exists():
        missing.append(h)

html = ss.flow_html(sec, pages)
assert "wl-flow-svg" in html
assert "marker-end" in html
assert "Yes" in html and "No" in html
assert "wl-flow-fallback" in html
assert not missing, missing
assert len(questions) >= 3
assert len(hrefs) >= 4
print(f"OK: {len(questions)} questions, {len(hrefs)} outcomes, SVG+fallback present")
