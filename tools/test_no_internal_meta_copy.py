#!/usr/bin/env python3
"""Fail if reader-visible copy leaks editorial/internal meta phrasing."""
from __future__ import annotations

import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP_DIRS = {".git", "node_modules", "vendor", "__pycache__", "workers"}

# Phrases that should never appear in reader-visible copy.
BANNED = [
    (r"core readers", "core readers"),
    (r"lives under", "lives under"),
    (r"for continuity", "for continuity"),
    (r"hub[’']s default", "hub default"),
    (r"this guide prioritizes", "this guide prioritizes"),
    (r"Knowledge Guardian", "Knowledge Guardian"),
    (r"note to self", "note to self"),
    (r"instructions?-to-self", "instructions-to-self"),
    (r"internal note", "internal note"),
    (r"\bMonetization\b", "Monetization"),
    (r"\blorem ipsum\b", "lorem ipsum"),
    (r"\bcoming soon\b", "coming soon"),
    (r"\[(?:INSERT|ADD|TODO|FIXME|TBD|YOUR|PLACEHOLDER)[^\]]*\]", "bracketed editor stub"),
    (r"\bTODO\b", "TODO"),
    (r"\bFIXME\b", "FIXME"),
]

# Allowed in visible text (real page names, not internal notes).
ALLOW_WINDOWS = [
    re.compile(r"Editorial standards", re.I),
]

SOURCE_JSON = [
    ROOT / "components/real-estate/guides.json",
    ROOT / "components/life-stages/stages.json",
    ROOT / "components/retirement-confidence/series.json",
    ROOT / "components/site-map/site-map.json",
    ROOT / "components/monetization/offers.json",
]


class VisibleText(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.skip = 0
        self.parts: list[str] = []
        self.in_robots = False

    def handle_starttag(self, tag, attrs):
        d = {k.lower(): (v or "") for k, v in attrs}
        if tag.lower() in {"script", "style", "noscript", "template"}:
            self.skip += 1
            return
        if tag.lower() == "meta" and d.get("name", "").lower() == "robots":
            return  # robots content is not page copy
        for key in ("alt", "title", "aria-label"):
            if d.get(key):
                self.parts.append(d[key])
        # input/textarea placeholder attribute is a hint, but the literal
        # word "placeholder" as a visible instruction is not expected there.

    def handle_endtag(self, tag):
        if tag.lower() in {"script", "style", "noscript", "template"} and self.skip:
            self.skip -= 1

    def handle_data(self, data):
        if self.skip:
            return
        t = data.strip()
        if t:
            self.parts.append(t)

    def handle_comment(self, data):
        return


def strip_front_matter(text: str) -> str:
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            return text[end + 4 :]
    return text


def is_allowed(snippet: str) -> bool:
    return any(p.search(snippet) for p in ALLOW_WINDOWS)


def scan_text(text: str, origin: str, hits: list) -> None:
    for pat, label in BANNED:
        for m in re.finditer(pat, text, re.I):
            start, end = max(0, m.start() - 70), min(len(text), m.end() + 70)
            snippet = re.sub(r"\s+", " ", text[start:end])
            if label in {"TODO", "FIXME"} and re.search(
                r"data-ls-check|wl-ls-todo|class=\"[^\"]*todo", snippet, re.I
            ):
                continue
            if is_allowed(snippet) and label not in {
                "core readers",
                "lives under",
                "for continuity",
                "hub default",
                "this guide prioritizes",
                "Knowledge Guardian",
                "coming soon",
                "bracketed editor stub",
            }:
                continue
            hits.append((origin, label, snippet))


def main() -> int:
    hits: list[tuple[str, str, str]] = []
    html_files = [
        p
        for p in ROOT.rglob("*.html")
        if not any(part in SKIP_DIRS for part in p.parts)
    ]
    for p in html_files:
        raw = p.read_text(encoding="utf-8", errors="replace")
        body = strip_front_matter(raw)
        parser = VisibleText()
        try:
            parser.feed(body)
        except Exception as exc:
            hits.append((str(p.relative_to(ROOT)), "parse-error", str(exc)))
            continue
        visible = "\n".join(parser.parts)
        scan_text(visible, str(p.relative_to(ROOT)), hits)

    # Reader-facing source strings that generators copy into pages.
    import json

    def walk_strings(obj, path: str, acc: list[str]) -> None:
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k in {"todo", "_about", "voice"}:
                    # "todo" is a checklist key rendered as "What to do now"
                    if k == "todo":
                        walk_strings(v, path + "." + k, acc)
                    continue
                walk_strings(v, path + "." + k, acc)
        elif isinstance(obj, list):
            for i, v in enumerate(obj):
                walk_strings(v, f"{path}[{i}]", acc)
        elif isinstance(obj, str):
            acc.append(obj)

    for jp in SOURCE_JSON:
        if not jp.exists():
            continue
        strings: list[str] = []
        walk_strings(json.loads(jp.read_text(encoding="utf-8")), jp.name, strings)
        scan_text("\n".join(strings), str(jp.relative_to(ROOT)), hits)

    if hits:
        print(f"FAIL: {len(hits)} internal/meta phrase(s) in reader-visible copy:")
        for origin, label, snippet in hits:
            print(f"  [{label}] {origin}\n    …{snippet}…")
        return 1
    print(f"OK: no banned meta phrasing in {len(html_files)} HTML pages or source JSON")
    return 0


if __name__ == "__main__":
    sys.exit(main())
