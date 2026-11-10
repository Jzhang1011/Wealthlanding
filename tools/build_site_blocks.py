#!/usr/bin/env python3
"""Render shared, data-driven HTML blocks into static pages.

Blocks are written between marker comments so the script can be re-run safely:

  <!-- wl:tool-guide:start --> ... <!-- wl:tool-guide:end -->
      Explanatory guide under a calculator, from components/tool-guides/tool-guides.json

From components/site-map/site-map.json (see tools/site_structure.py):
  wl:footer-links   plain-HTML section links inside every <wealthlanding-footer>
  wl:breadcrumb     breadcrumb trail plus BreadcrumbList JSON-LD on articles and tools
  wl:next-steps     "Keep going" links on articles and tools without a guide
  wl:start-here     goal grid on the homepage and section routes on hub pages
  components/header-nav.html, the header.js fallback, and the Money, Real estate
  and Travel hub pages are generated in full.
  search/search-index.json and search/index.html  site search index and results page

From components/life-stages/stages.json (see tools/life_stages.py):
  /plan-by-age/ and its five stage pages (45-49 ... 63-65) are generated in full
  wl:age-journey    "Plan by age: 45-65" stage cards on the homepage
  wl:life-stage     "Where this fits in your 45-65 plan" on every page a stage links to
  Test: node components/life-stages/life-stages.test.js

Usage (from the repo root):
  python3 tools/build_site_blocks.py          # write blocks
  python3 tools/build_site_blocks.py --check  # exit 1 if any page is out of date
"""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.dont_write_bytecode = True
GUIDES = ROOT / "components" / "tool-guides" / "tool-guides.json"

DISCLAIMER = (
    "Educational content only, not personalized investment, tax, legal, or insurance advice. "
    "Results depend on the inputs and simplified assumptions described above."
)


def esc(text):
    return html.escape(text or "", quote=True)


def replace_block(page_html, name, block, anchor_patterns):
    """Replace an existing marked block, or insert it before the first matching anchor."""
    start, end = f"<!-- wl:{name}:start -->", f"<!-- wl:{name}:end -->"
    wrapped = f"{start}\n{block}\n{end}"
    pattern = re.compile(re.escape(start) + r".*?" + re.escape(end), re.S)
    if pattern.search(page_html):
        return pattern.sub(lambda _m: wrapped, page_html, count=1)
    for anchor in anchor_patterns:
        m = re.search(anchor, page_html, re.I)
        if m:
            return page_html[: m.start()] + wrapped + "\n" + page_html[m.start():]
    raise ValueError(f"no anchor found for block {name}")


def render_guide(guide):
    cards = []
    for section in guide["sections"]:
        cls = "wl-guide-card"
        if section.get("example"):
            cls += " wl-guide-example"
        elif section.get("wide"):
            cls += " wl-guide-wide"
        cards.append(
            f'      <div class="{cls}">\n        <h3>{esc(section["title"])}</h3>\n        {section["html"]}\n      </div>'
        )
    related = ""
    if guide.get("related"):
        items = []
        for link in guide["related"]:
            note = f'<span>{esc(link["note"])}</span>' if link.get("note") else ""
            items.append(f'        <li><a href="{esc(link["href"])}">{esc(link["label"])}{note}</a></li>')
        related = (
            '    <nav class="wl-guide-related" aria-label="Related guides">\n'
            "      <h3>Related guides and tools</h3>\n      <ul>\n" + "\n".join(items) + "\n      </ul>\n    </nav>\n"
        )
    return (
        '<link rel="stylesheet" href="/components/tool-guides/tool-guides.css">\n'
        '<section class="wl-guide" aria-labelledby="wl-guide-title">\n  <div class="wl-guide-inner">\n'
        '    <span class="wl-guide-kicker">Guide</span>\n'
        f'    <h2 id="wl-guide-title">{esc(guide["heading"])}</h2>\n'
        f'    <p class="wl-guide-intro">{esc(guide.get("intro", ""))}</p>\n'
        '    <div class="wl-guide-grid">\n' + "\n".join(cards) + "\n    </div>\n" + related +
        f'    <p class="wl-guide-disclaimer">{esc(guide.get("disclaimer", DISCLAIMER))}</p>\n  </div>\n</section>'
    )


FOOTER_ANCHORS = [r"<wealthlanding-footer", r"<footer\b", r"</body>"]


def build(check=False):
    data = json.loads(GUIDES.read_text(encoding="utf-8"))
    stale = []
    import site_structure
    stale += site_structure.build(check=check, guide_pages=set(data["pages"]))
    for rel, guide in data["pages"].items():
        path = ROOT / rel
        original = path.read_text(encoding="utf-8")
        updated = replace_block(original, "tool-guide", render_guide(guide), FOOTER_ANCHORS)
        if updated != original:
            stale.append(rel)
            if not check:
                path.write_text(updated, encoding="utf-8")
    return stale


if __name__ == "__main__":
    check = "--check" in sys.argv
    changed = build(check=check)
    for rel in changed:
        print(("out of date: " if check else "updated: ") + rel)
    if check and changed:
        sys.exit(1)
