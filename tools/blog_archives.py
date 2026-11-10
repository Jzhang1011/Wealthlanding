#!/usr/bin/env python3
"""Load public blog section archives and resolve a sort date for each post.

Date source (first match wins), then we take the *latest* among publish-like
and review/update-like dates found:

  1. Explicit ISO fields on the archive entry: sortDate, dateISO,
     datePublished, dateModified, reviewed (YYYY-MM-DD, YYYY-MM, or YYYY).
  2. The archive display string in `date` (e.g. "November 9, 2026",
     "Updated October 2026", "Reviewed October 15, 2026").
  3. The post HTML: <time datetime>, JSON-LD datePublished/dateModified,
     the article meta line, and phrases such as "Updated …", "Reviewed …",
     "Last reviewed …", "Figures recalculated …".
  4. The archive `year` field as a year-only date.

Precision:
  - Day-level dates are used as written.
  - Month-only dates use the 15th of that month and are flagged.
  - Year-only dates use July 1 of that year and are flagged.

Posts with no usable date sort after dated posts and are flagged as missing.
This module does not invent calendar days from filenames or from the
hand-maintained /blogs/ index.
"""
from __future__ import annotations

import calendar
import json
import re
from dataclasses import dataclass, field
from datetime import date
from html import unescape
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12,
}

# Public sections that appear on /blogs/. Hidden/noindex younger-reader
# sections (blogs/18_25, blogs/12_18) are intentionally omitted.
INDEX_SECTIONS = [
    {
        "id": "happy_retirement",
        "title": "Happy Retirement",
        "archive": "blogs/Happy_retirement/archive.json",
        "chart_after": False,
    },
    {
        "id": "travel",
        "title": "Travel",
        "archive": "blogs/Travel/archive.json",
        "chart_after": True,
    },
    {
        "id": "investment",
        "title": "Investment",
        "archive": "blogs/investment/archive.json",
        "chart_after": False,
    },
    {
        "id": "budget_spending",
        "title": "Budget and Spending",
        "archive": "blogs/budget_spending/archive.json",
        "chart_after": False,
    },
    {
        "id": "spending_smart",
        "title": "Spending Smart",
        "archive": "blogs/spending_smart/archive.json",
        "chart_after": False,
    },
    {
        "id": "real_estate",
        "title": "Real Estate",
        "archive": "blogs/real_estate/archive.json",
        "chart_after": False,
    },
]

LATEST_COUNT = 3
HIDDEN_PATH_PREFIXES = ("/blogs/18_25", "/blogs/12_18", "blogs/18_25", "blogs/12_18")


@dataclass(order=False)
class ResolvedDate:
    value: Optional[date]
    precision: str  # "day" | "month" | "year" | "missing"
    label: str
    source: str
    flagged: bool = False

    @property
    def sort_key(self):
        # Missing dates sink to the bottom.
        if self.value is None:
            return (0, 0, 0, self.precision)
        rank = {"day": 2, "month": 1, "year": 0}.get(self.precision, 0)
        return (self.value.year, self.value.month, self.value.day, rank)


def _iso(text: str) -> Optional[ResolvedDate]:
    text = (text or "").strip()
    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", text)
    if m:
        y, mo, d = map(int, m.groups())
        try:
            return ResolvedDate(date(y, mo, d), "day", text, "iso")
        except ValueError:
            return None
    m = re.fullmatch(r"(\d{4})-(\d{2})", text)
    if m:
        y, mo = map(int, m.groups())
        if 1 <= mo <= 12:
            return ResolvedDate(date(y, mo, 15), "month", text, "iso-month", flagged=True)
        return None
    m = re.fullmatch(r"(\d{4})", text)
    if m:
        y = int(m.group(1))
        return ResolvedDate(date(y, 7, 1), "year", text, "iso-year", flagged=True)
    return None


def parse_date_string(text: str, source: str = "display") -> Optional[ResolvedDate]:
    if not text:
        return None
    raw = unescape(re.sub(r"\s+", " ", str(text))).strip()
    iso = _iso(raw)
    if iso:
        iso.source = source
        return iso

    # Optional leading verbs: Updated / Reviewed / Last reviewed / Published / Figures recalculated
    body = re.sub(
        r"^(?:last\s+reviewed|reviewed|updated|published|figures\s+recalculated|recalculated)\s+",
        "",
        raw,
        flags=re.I,
    ).strip(" ·•,")

    iso = _iso(body)
    if iso:
        iso.source = source
        iso.label = raw
        return iso

    # Month D, YYYY or Month D YYYY
    m = re.search(r"\b([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\b", body)
    if m:
        mo = MONTHS.get(m.group(1).lower())
        d, y = int(m.group(2)), int(m.group(3))
        if mo:
            try:
                return ResolvedDate(date(y, mo, d), "day", raw, source)
            except ValueError:
                return None

    # Month YYYY
    m = re.search(r"\b([A-Za-z]+)\s+(\d{4})\b", body)
    if m:
        mo = MONTHS.get(m.group(1).lower())
        y = int(m.group(2))
        if mo:
            return ResolvedDate(date(y, mo, 15), "month", raw, source, flagged=True)

    # Bare year, but only if the string is essentially just a year (or Year 2026)
    m = re.fullmatch(r"(?:year\s+)?(\d{4})", body, flags=re.I)
    if m:
        y = int(m.group(1))
        return ResolvedDate(date(y, 7, 1), "year", raw, source, flagged=True)
    return None


def _dates_from_html(html: str) -> list[ResolvedDate]:
    found: list[ResolvedDate] = []
    for m in re.finditer(r"<time[^>]*datetime=[\"']([^\"']+)", html, re.I):
        d = parse_date_string(m.group(1)[:10] if len(m.group(1)) >= 10 else m.group(1), "html-time")
        if d:
            found.append(d)
    for key in ("datePublished", "dateModified"):
        for m in re.finditer(r'"%s"\s*:\s*"([^"]+)"' % key, html):
            val = m.group(1)
            d = parse_date_string(val[:10] if len(val) >= 10 and val[4] == "-" else val, f"jsonld-{key}")
            if d:
                found.append(d)
    # Article meta line: <div class="meta">…<span>October 20, 2026</span>
    for block in re.findall(r'<div class="meta">.*?</div>', html, re.S | re.I):
        text = re.sub(r"<[^>]+>", " ", block)
        d = parse_date_string(text, "html-meta")
        # parse_date_string on a blob with "10 minute read" + date: search inside
        if not d:
            for cand in re.findall(
                r"(?:Updated|Reviewed|Last reviewed|Published|Figures recalculated)\s+[A-Za-z]+(?:\s+\d{1,2},?)?\s+\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4}|[A-Za-z]+\s+\d{4}",
                text,
                re.I,
            ):
                d = parse_date_string(cand, "html-meta")
                if d:
                    found.append(d)
        else:
            found.append(d)
    # Visible labels anywhere in the first 12k / last 2k (avoid bibliography years)
    window = html[:12000] + "\n" + html[-2000:]
    for cand in re.findall(
        r"(?:Last reviewed|Reviewed|Updated|Published|Figures recalculated)\s*[:·•]?\s*[A-Za-z]+\s+\d{1,2},?\s+\d{4}|"
        r"(?:Last reviewed|Reviewed|Updated|Published|Figures recalculated)\s*[:·•]?\s*[A-Za-z]+\s+\d{4}",
        window,
        re.I,
    ):
        d = parse_date_string(cand, "html-label")
        if d:
            found.append(d)
    # Unlabeled "November 9, 2026 · …" kickers: only a short line near the top
    # of the file (hero / typographic date line). Do not harvest dates that
    # appear later in the narrative (trip dates, data years, etc.).
    head = html[:2000]
    for block in re.findall(r"<p[^>]*>.*?</p>|<div[^>]*>.*?</div>", head, re.S | re.I):
        text = re.sub(r"<[^>]+>", " ", block)
        text = unescape(re.sub(r"\s+", " ", text)).strip()
        if len(text) > 120:
            continue
        m = re.search(r"[A-Z][a-z]+\s+\d{1,2},?\s+\d{4}", text)
        if m:
            d = parse_date_string(m.group(0), "html-kicker")
            if d and d.precision == "day":
                found.append(d)
    return found


def resolve_post_date(post: dict, html: Optional[str] = None) -> ResolvedDate:
    candidates: list[ResolvedDate] = []
    for key in ("sortDate", "dateISO", "datePublished", "dateModified", "reviewed"):
        if post.get(key):
            d = parse_date_string(str(post[key]), f"archive-{key}")
            if d:
                candidates.append(d)
    if post.get("date"):
        d = parse_date_string(str(post["date"]), "archive-date")
        if d:
            candidates.append(d)
    if html:
        candidates.extend(_dates_from_html(html))
    if post.get("year") and not any(c.precision in {"day", "month"} for c in candidates):
        d = parse_date_string(str(post["year"]), "archive-year")
        if d:
            candidates.append(d)

    if not candidates:
        return ResolvedDate(None, "missing", "", "missing", flagged=True)

    # Prefer the latest calendar date; if a tie, prefer higher precision.
    best = max(candidates, key=lambda c: c.sort_key)
    if best.precision != "day":
        best.flagged = True
    return best


def url_to_path(url: str) -> Optional[Path]:
    if not url:
        return None
    path = url.split("?")[0].split("#")[0]
    if path.startswith("https://www.wealthlanding.com"):
        path = path[len("https://www.wealthlanding.com"):]
    if path.startswith("/"):
        path = path[1:]
    if not path:
        return None
    p = ROOT / path
    if p.is_dir():
        idx = p / "index.html"
        return idx if idx.exists() else p
    if p.exists():
        return p
    if not p.suffix:
        idx = Path(str(p) + "/index.html")
        if idx.exists():
            return idx
        html = Path(str(p) + ".html")
        if html.exists():
            return html
    return p if p.exists() else None


def is_hidden_url(url: str) -> bool:
    u = url or ""
    return any(x in u for x in HIDDEN_PATH_PREFIXES)


def load_archive(rel: str) -> dict:
    path = ROOT / rel
    return json.loads(path.read_text(encoding="utf-8"))


def enrich_posts(posts: list[dict]) -> list[dict]:
    out = []
    for post in posts:
        url = post.get("url") or ""
        if is_hidden_url(url):
            continue
        html = None
        fpath = url_to_path(url)
        if fpath and fpath.is_file():
            text = fpath.read_text(encoding="utf-8", errors="replace")
            if re.search(r'name=["\']robots["\'][^>]*noindex|noindex[^>]*robots', text, re.I):
                # Skip noindex posts (e.g. canonical duplicates).
                continue
            html = text
        resolved = resolve_post_date(post, html)
        item = dict(post)
        item["_resolved"] = resolved
        out.append(item)
    out.sort(key=lambda p: (p["_resolved"].sort_key, p.get("title") or ""), reverse=True)
    return out


def load_public_sections() -> list[dict]:
    sections = []
    for cfg in INDEX_SECTIONS:
        data = load_archive(cfg["archive"])
        meta = data.get("meta") or {}
        posts = enrich_posts(data.get("posts") or [])
        hub = meta.get("hub")
        if not hub:
            raise SystemExit(f"archive {cfg['archive']} is missing meta.hub")
        href = hub if str(hub).startswith("/") else f"/blogs/{hub}"
        sections.append({
            **cfg,
            "meta": meta,
            "hub": hub,
            "hub_href": href,
            "posts": posts,
            "title": cfg.get("title") or meta.get("title") or "Blog",
        })
    return sections


def missing_date_report(sections: Optional[list[dict]] = None) -> list[dict]:
    sections = sections or load_public_sections()
    rows = []
    for sec in sections:
        for p in sec["posts"]:
            r: ResolvedDate = p["_resolved"]
            if r.precision == "missing" or r.flagged or r.precision in {"month", "year"}:
                rows.append({
                    "section": sec["id"],
                    "url": p.get("url"),
                    "title": p.get("title"),
                    "precision": r.precision,
                    "label": r.label,
                    "source": r.source,
                    "sortDate": r.value.isoformat() if r.value else None,
                })
    return rows


def latest_across(sections: list[dict]) -> Optional[dict]:
    posts = []
    seen = set()
    for sec in sections:
        for p in sec["posts"]:
            url = p.get("url")
            if url in seen:
                continue
            seen.add(url)
            posts.append(p)
    if not posts:
        return None
    posts.sort(key=lambda p: (p["_resolved"].sort_key, p.get("title") or ""), reverse=True)
    return posts[0]


if __name__ == "__main__":
    secs = load_public_sections()
    for s in secs:
        print(f"\n== {s['title']} ({s['hub_href']}) {len(s['posts'])} posts ==")
        for p in s["posts"][:5]:
            r = p["_resolved"]
            print(f"  {r.value} [{r.precision}/{r.source}] {r.label!r}  {p.get('title')}")
    print("\n== flagged / missing dates ==")
    for row in missing_date_report(secs):
        print(f"  {row['precision']:7} {row['sortDate'] or '—':12} {row['source']:16} {row['url']}")
