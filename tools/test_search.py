#!/usr/bin/env python3
"""Validate the site search index, header search box, and /search/ page."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import search_index as si  # noqa: E402
import site_structure as ss  # noqa: E402

cfg = json.loads((ROOT / "components/site-map/site-map.json").read_text(encoding="utf-8"))
pages = ss.list_pages(cfg)
rows, excluded = si.entries(cfg, pages, ss.classify)
by_url = {row["url"]: row for row in rows}

INDEX_PATH = ROOT / si.INDEX_REL
PAGE_PATH = ROOT / si.PAGE_REL
NAV_PATH = ROOT / "components/header-nav.html"
HEADER_JS = ROOT / "components/header.js"
SITEMAP = ROOT / "sitemap.xml"

REQUIRED_URLS = (
    "/real-estate/",
    "/money/",
    "/tools/credit-card/",
    "/retirement/",
    "/investment/",
    "/tools/",
    "/plan-by-age/",
    "/",
)

FORBIDDEN_PREFIXES = (
    "/Talent/",
    "/life_stage/18_25/",
    "/blogs/18_25",
    "/learn/early-career/",
    "/blogs/12_18/",
    "/_layouts/",
    "/search/",
)


def fail(msg):
    raise AssertionError(msg)


assert INDEX_PATH.exists(), "missing search/search-index.json"
assert PAGE_PATH.exists(), "missing search/index.html"
committed = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
assert committed == si.index_payload(rows), "search index is out of date; run tools/build_site_blocks.py"
assert [row["url"] for row in committed["pages"]] == sorted(by_url), "index URLs must be unique and sorted"

for url in REQUIRED_URLS:
    assert url in by_url, f"index missing required page {url}"

for page in pages.values():
    if page.noindex or page.redirect or si.hidden_rel(page.rel):
        assert page.url not in by_url, f"excluded page leaked into index: {page.url}"

for url in by_url:
    for prefix in FORBIDDEN_PREFIXES:
        assert not (url == prefix or url.startswith(prefix)), f"forbidden url in index: {url}"
    rel = ss.rel_for(url)
    assert rel in pages or (ROOT / rel).exists() or (ROOT / rel / "index.html").exists(), f"broken index url {url}"
    row = by_url[url]
    assert row["title"], f"empty title {url}"
    assert "monetization" not in json.dumps(row).lower(), f"monetization wording in {url}"

# Younger-stage topic guides stay searchable; the hidden playbooks do not.
assert "/life_stage/25_40/topics/roth-ira.html" in by_url
assert "/life_stage/25_40/playbook_hub.html" not in by_url
assert "/life_stage/25_40/step_1.html" not in by_url

nav = NAV_PATH.read_text(encoding="utf-8")
assert 'data-wl-search' in nav, "generated header is missing the search box"
assert 'action="/search/"' in nav
assert 'id="wlSearchInput-nav"' in nav
assert 'id="wlSearchInput-drawer"' in nav
assert 'aria-label="Search WealthLanding"' in nav or "Search WealthLanding" in nav
assert 'id="wlSearchToggle"' in nav
assert 'aria-label="Open search"' in nav
# Search should appear on desktop (header tools) and in the mobile drawer.
desktop, mobile = nav.split('id="wlMobileDrawer"')
assert "wl-header-tools" in desktop and "wlSearchInput-nav" in desktop
assert "wl-md-search" in mobile and "wlSearchInput-drawer" in mobile

header_js = HEADER_JS.read_text(encoding="utf-8")
assert "WL_SEARCH_TOOLS" in header_js
assert "wl-header-tools" in header_js
assert "data-wl-search" in header_js
assert "/components/search.js" in header_js
assert "WLSearch" in header_js

page = PAGE_PATH.read_text(encoding="utf-8")
assert 'name="robots"' in page and "noindex" in page
assert "Educational content only" in page
assert 'id="wlSearchPageInput"' in page
assert "/components/search.js" in page
assert "/components/header.js" in page
sitemap = SITEMAP.read_text(encoding="utf-8")
assert "wealthlanding.com/search" not in sitemap, "search page must stay out of the sitemap"

# Credit card tool is findable by ordinary wording, not only its short title.
card = by_url["/tools/credit-card/"]
blob = " ".join([card["title"], card["desc"], " ".join(card["keywords"])]).lower()
assert "card" in blob and ("credit" in blob or "rewards" in blob), card

print(
    "OK: search index has "
    + str(len(rows))
    + " pages "
    + f"(excluded noindex={excluded['noindex']}, redirects={excluded['redirect']}, hidden={excluded['hidden']}); "
    + "header search present; /search/ is noindex and out of the sitemap"
)
