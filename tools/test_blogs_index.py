#!/usr/bin/env python3
"""Blogs index shows at most 3 newest posts per section, with working Read more links."""
from __future__ import annotations

import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from blog_archives import (  # noqa: E402
    INDEX_SECTIONS,
    LATEST_COUNT,
    HIDDEN_PATH_PREFIXES,
    load_public_sections,
    latest_across,
    url_to_path,
)

INDEX = ROOT / "blogs/index.html"


class SectionParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.sections = []
        self._cur = None
        self._href = None
        self._capture_link = False
        self._link_text = []
        self.featured_href = None
        self._in_featured = False
        self._feat_level = 0

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "section" and d.get("data-blog-section"):
            self._cur = {"id": d["data-blog-section"], "cards": [], "read_more": None}
        if tag == "a" and self._cur is not None:
            href = d.get("href") or ""
            self._href = href
            self._is_card = "story-card" in (d.get("class") or "")
            self._capture_link = True
            self._link_text = []
        if tag == "div" and "mb-16" in (d.get("class") or "") and self._cur is None:
            self._in_featured = True

    def handle_data(self, data):
        if self._capture_link:
            self._link_text.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self._capture_link:
            text = re.sub(r"\s+", " ", "".join(self._link_text)).strip()
            href = self._href
            if self._cur is not None:
                if text.lower().startswith("read more"):
                    self._cur["read_more"] = {"href": href, "text": text}
                elif getattr(self, "_is_card", False) and href:
                    self._cur["cards"].append(href)
            self._capture_link = False
            self._href = None
        if tag == "section" and self._cur is not None:
            # dedupe card hrefs (image + title may both wrap, but our cards are one <a>)
            seen = []
            for h in self._cur["cards"]:
                if self._cur["read_more"] and h == self._cur["read_more"]["href"]:
                    continue
                if h not in seen:
                    seen.append(h)
            self._cur["cards"] = seen
            self.sections.append(self._cur)
            self._cur = None


def _exists(href: str) -> bool:
    if href.startswith("http"):
        path = urlparse(href).path
    else:
        path = href
    p = url_to_path(path)
    return bool(p and p.exists())


def main() -> int:
    html = INDEX.read_text(encoding="utf-8")
    errors = []

    if re.search(r'href=["\'][^"\']*blogs/18_25', html) or re.search(r'href=["\'][^"\']*blogs/12_18', html):
        errors.append("index links to hidden 18_25 or 12_18 blogs")

    parser = SectionParser()
    parser.feed(html)
    rendered = {s["id"]: s for s in parser.sections}

    sections = load_public_sections()
    expected_ids = [s["id"] for s in INDEX_SECTIONS]
    if [s["id"] for s in sections] != expected_ids:
        errors.append(f"section order mismatch: {[s['id'] for s in sections]} vs {expected_ids}")

    for sec in sections:
        rid = sec["id"]
        block = rendered.get(rid)
        if not block:
            errors.append(f"section {rid} missing from index")
            continue
        newest = sec["posts"][:LATEST_COUNT]
        if len(block["cards"]) > LATEST_COUNT:
            errors.append(f"{rid} shows {len(block['cards'])} cards, limit is {LATEST_COUNT}")
        if len(block["cards"]) != min(LATEST_COUNT, len(sec["posts"])):
            errors.append(
                f"{rid} shows {len(block['cards'])} cards, expected {min(LATEST_COUNT, len(sec['posts']))}: {block['cards']}"
            )
        expected_hrefs = [p["url"] for p in newest]
        # Allow relative or absolute
        def norm(h):
            h = h.split("?")[0]
            if h.startswith("https://www.wealthlanding.com"):
                h = h[len("https://www.wealthlanding.com"):]
            if not h.startswith("/"):
                h = "/blogs/" + h.lstrip("./")
            return h
        got = [norm(h) for h in block["cards"]]
        exp = [norm(h) for h in expected_hrefs]
        if got != exp:
            errors.append(f"{rid} card order/hrefs {got} != newest {exp}")
        # Confirm these really are the newest
        if len(sec["posts"]) > LATEST_COUNT:
            cutoff = newest[-1]["_resolved"].sort_key
            for p in sec["posts"][LATEST_COUNT:]:
                if p["_resolved"].sort_key > cutoff:
                    errors.append(f"{rid} omitted a newer post: {p['url']}")
        rm = block["read_more"]
        if not rm:
            errors.append(f"{rid} missing Read more link")
        else:
            if not re.search(r"Read more .+ posts", rm["text"]):
                errors.append(f"{rid} Read more text is {rm['text']!r}")
            if sec["title"] not in rm["text"]:
                errors.append(f"{rid} Read more does not name the section: {rm['text']!r}")
            href = rm["href"]
            if norm(href) != norm(sec["hub_href"]):
                errors.append(f"{rid} Read more href {href} != {sec['hub_href']}")
            if not _exists(href):
                errors.append(f"{rid} Read more href does not resolve: {href}")
        for href in expected_hrefs:
            if not _exists(href):
                errors.append(f"{rid} card href does not resolve: {href}")

    if "18_25" in rendered or "12_18" in rendered:
        errors.append("hidden sections rendered on the index")

    featured = latest_across(sections)
    if featured and featured["url"] not in html:
        errors.append(f"featured latest post {featured['url']} not on the index")

    # Every public post must have a local cover file and descriptive alt text.
    seen_urls = set()
    for sec in sections:
        for post in sec["posts"]:
            url = post.get("url")
            key = (url, post.get("id"))
            if url in seen_urls:
                # Listed in more than one archive (e.g. Roth / ACA). Same cover required.
                pass
            seen_urls.add(url)
            pid = post.get("id")
            src = post.get("image") or ""
            alt = (post.get("imageAlt") or "").strip()
            if not src:
                errors.append(f"{pid} has no cover image")
                continue
            if src.startswith("http://") or src.startswith("https://"):
                errors.append(f"{pid} cover is a remote hotlink: {src}")
                continue
            path = url_to_path(src)
            if not path or not path.is_file():
                errors.append(f"{pid} cover file does not exist: {src}")
            elif path.stat().st_size < 1024:
                errors.append(f"{pid} cover file is suspiciously small: {src}")
            if not alt:
                errors.append(f"{pid} is missing imageAlt text")
            elif len(alt) < 12:
                errors.append(f"{pid} imageAlt is too short: {alt!r}")
            # Card on the generated index uses this src when the post is among the latest three
            if src and src not in html and url in [c for s in sections for c in [x["url"] for x in s["posts"][:3]]]:
                # The featured block and latest-three cards should reference the cover.
                if url in html:
                    errors.append(f"{pid} is on /blogs/ but its cover {src} is not")

    if errors:
        print("FAIL:")
        for err in errors:
            print("  -", err)
        return 1
    print(
        f"OK: {len(sections)} sections on /blogs/, each with ≤{LATEST_COUNT} newest posts and a resolving Read more link"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
