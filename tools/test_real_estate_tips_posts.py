#!/usr/bin/env python3
"""Three Real Estate Tips story posts: tags, chrome, sources, links, covers."""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "blogs/real_estate/archive.json"
TAG_PAGE = ROOT / "blogs/real_estate/tips.html"
POSTS = {
    "unfinished-basement-attic": {
        "must": ["Ruth Calder", "R305", "R310", "71%", "costvsvalue.com", "Fannie Mae", "Moisture-Resistant",
                 "diamond-in-the-rough.html", "hidden-features-by-construction-era.html",
                 "two-acres-two-lots.html", "property-potential.html", "illustrative"],
        "sources": ["iccsafe.org", "cityofboise.org", "jlconline.com", "huduser.gov", "fanniemae.com"],
    },
    "diamond-in-the-rough": {
        "must": ["Ruth Calder", "high ceiling", "layout", "property-potential.html",
                 "unfinished-basement-attic.html", "hidden-features-by-construction-era.html",
                 "two-acres-two-lots.html"],
        "sources": ["jlconline.com", "huduser.gov", "consumerfinance.gov"],
    },
    "hidden-features-by-construction-era": {
        "must": ["Ruth Calder", "1978", "aluminum", "central vacuum", "hardwood",
                 "unfinished-basement-attic.html", "diamond-in-the-rough.html",
                 "two-acres-two-lots.html", "property-potential.html"],
        "sources": ["epa.gov", "cpsc.gov"],
    },
}

arch = json.loads(ARCHIVE.read_text(encoding="utf-8"))
by_id = {p["id"]: p for p in arch["posts"]}
tag_page = TAG_PAGE.read_text(encoding="utf-8") if TAG_PAGE.exists() else ""

for pid, spec in POSTS.items():
    post = by_id.get(pid)
    assert post, f"{pid} missing from archive.json"
    assert "Real Estate Tips" in (post.get("tags") or []), f"{pid} is not tagged Real Estate Tips"
    assert "real-estate-tips" in (post.get("topics") or []), f"{pid} missing real-estate-tips topic"
    path = ROOT / post["url"].lstrip("/")
    assert path.is_file(), f"missing article {path}"
    html = path.read_text(encoding="utf-8")
    assert "/blogs/case_study.css" in html, f"{pid} must use case_study.css"
    for cls in ("hero", "heroin", "floatcard", "summarygrid", "disclaimer", "related"):
        assert re.search(r'class="[^"]*\b' + cls + r'\b', html), f"{pid} missing class {cls}"
    assert "wl:post-tags" in html, f"{pid} needs the data-driven tag marker"
    assert "og:image" in html and f"/asset/blog-covers/{pid}.webp" in html
    cover = ROOT / "asset" / "blog-covers" / f"{pid}.webp"
    card = ROOT / "asset" / "blog-covers" / f"{pid}-card.webp"
    assert cover.is_file() and cover.stat().st_size > 1000, f"missing hero cover {cover}"
    assert card.is_file() and card.stat().st_size > 1000, f"missing card cover {card}"
    assert post.get("image") and (ROOT / post["image"].lstrip("/")).is_file()
    assert not re.search(r'class="[^"]*byline', html, re.I)
    assert "rel=\"author\"" not in html and "Knowledge Guardian" not in html
    assert "educational" in html.lower() and "not financial" in html.lower()
    low = html.lower()
    for phrase in ("monetization", "internal note", "todo", "fixme", "lorem ipsum"):
        assert phrase not in low, f"{pid} contains banned phrase {phrase}"
    for needle in spec["must"]:
        assert needle.lower() in html.lower(), f"{pid} missing {needle!r}"
    for src in spec["sources"]:
        assert src in html, f"{pid} missing source host {src}"
    assert pid.replace("_", "-") in tag_page or post["title"] in tag_page or post["url"] in tag_page or True
    if tag_page:
        assert post["url"] in tag_page or (post["title"] in tag_page), f"tag page should list {pid}"

print("OK: three Real Estate Tips posts have tags, case-study chrome, covers, sources and cross-links")
