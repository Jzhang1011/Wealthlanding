#!/usr/bin/env python3
"""Validate Money & Lifestyle combined nav, benefit-led Tools labels, and Blogs links."""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import site_structure as ss  # noqa: E402

cfg = json.loads((ROOT / "components/site-map/site-map.json").read_text(encoding="utf-8"))
pages = ss.list_pages(cfg)

BANNED = ("router", "Router", "Credit card rewards router")

EXPECTED_TOOLS = {
    "/tools/credit-card/": "Maximize spending with the right card",
    "/tools/health-plan-compare/": "Find your lowest-cost health plan",
    "/tools/debt_payoff_calculator.html": "Plan a faster debt payoff",
    "/tools/compound_interest_calculator.html": "See how savings could grow",
    "/Retirement-simulator/OptimizeRoth.html": "Compare Roth conversion strategies",
    "/Retirement-simulator/retirement_scenario_lab.html": "Test your retirement plan",
    "/investment/real_estate_vs_stocks_model.html": "Compare property and stock returns",
    "/travel/airlines/status-calculator.html": "Is airline status worth the cost?",
}

BLOG_ALLOWED = {
    "/blogs/",
    "/blogs/happy_retirement.html",
    "/blogs/market_investment.html",
    "/blogs/budget_spending.html",
    "/blogs/real_estate.html",
    "/blogs/travel.html",
}
BLOG_FORBIDDEN = {"/blogs/blog_hub.html", "/blogs/18_25.html"}

REQUIRED_GROUPS = ("Health costs", "Everyday money", "Travel & rewards")

TRAVEL_NAV_HREFS = {
    "/travel/",
    "/travel/airlines/",
    "/travel/hotels/",
    "/travel/airlines/status-calculator.html",
    "/tools/credit-card/",
}


def exists(href):
    rel = ss.rel_for(href)
    return rel in pages or (ROOT / rel).exists() or (ROOT / rel / "index.html").exists()


def collect_links(section):
    out = []
    for key in ("start", "popular"):
        out.extend(section.get(key, []))
    return out


def top_button_labels(nav_html):
    # Top-level dropdown labels live on the nav buttons, before the mobile drawer.
    desktop = nav_html.split('id="wlMobileDrawer"')[0]
    return re.findall(r'<button class="wl-nav-btn"[^>]*>\s*<span>([^<]+)</span>', desktop)


tools = next(s for s in cfg["sections"] if s["id"] == "tools")
money = next(s for s in cfg["sections"] if s["id"] == "money")
travel = next(s for s in cfg["sections"] if s["id"] == "travel")
blogs = cfg.get("blogs")
assert blogs, "site-map.json must define a blogs dropdown source"

# Travel remains a child taxonomy with its hub, but not a root nav item.
assert travel["hub"] == "/travel/"
assert travel.get("root_nav") is False
assert exists("/travel/")
for item in collect_links(travel):
    assert exists(item["href"]), item["href"]

# Combined Money & Lifestyle root
assert money["label"] == "Money & Lifestyle"
assert money["hub"] == "/money/"
assert money.get("root_nav", True) is True
group_labels = [g["label"] for g in money["nav_groups"]]
assert group_labels == list(REQUIRED_GROUPS), group_labels
grouped_hrefs = []
for g in money["nav_groups"]:
    for it in g["items"]:
        assert exists(it["href"]), it
        grouped_hrefs.append(it["href"])
for href in TRAVEL_NAV_HREFS:
    assert href in grouped_hrefs, href

# Travel section pages still classify under Travel (breadcrumbs stay intact)
trav_rel = "travel/airlines/united.html"
sec, grp = ss.classify(trav_rel, cfg)
assert sec and sec["id"] == "travel", sec
assert grp and "Airline" in grp["label"], grp

# Tools labels (Tools menu still uses benefit-led names)
for item in collect_links(tools):
    assert item["href"] in EXPECTED_TOOLS, item
    assert item["label"] == EXPECTED_TOOLS[item["href"]], (item, EXPECTED_TOOLS[item["href"]])
    assert exists(item["href"]), item["href"]
    for bad in BANNED:
        assert bad not in item["label"], item

# Blogs dropdown: only real hubs
blog_items = collect_links(blogs) + [{"href": blogs["hub"], "label": blogs["label"]}]
for item in blog_items:
    assert item["href"] in BLOG_ALLOWED, item
    assert item["href"] not in BLOG_FORBIDDEN, item
    assert exists(item["href"]), item["href"]

nav = ss.nav_html(cfg)
tops = top_button_labels(nav)
assert "Money &amp; Lifestyle" in tops or "Money & Lifestyle" in tops, tops
assert "Travel" not in tops, tops
assert "Travel &amp; Rewards" not in tops and "Travel & Rewards" not in tops, tops
assert "Money &amp; Health" not in tops and "Money & Health" not in tops, tops
assert "Blogs" in tops and "Tools" in tops and "Plan by age" in tops, tops

# Group headings in the combined mega
for label in REQUIRED_GROUPS:
    assert ss.esc(label.upper()) in nav, (label, ss.esc(label.upper()))

# Old root entries must not appear as top-level fallback links
fallback = ss.nav_fallback_js(cfg)
assert "Money & Lifestyle" in fallback or "Money &amp; Lifestyle" in fallback
assert 'href="/travel/">Travel' not in fallback
assert "Money & Health" not in fallback
assert "/blogs/" in fallback and "Blogs" in fallback
assert "Maximize spending with the right card" in nav
assert "router" not in nav.lower()

# Travel destinations remain reachable from the combined desktop + mobile nav
mobile = nav.split('id="wlMobileDrawer"')[1]
for href in TRAVEL_NAV_HREFS:
    assert href in nav, href
    assert href in mobile, f"missing from mobile nav: {href}"

# Start here and footer list Money & Lifestyle once, not a separate Travel card
sh = ss.start_here_html(cfg, pages)
assert "Money &amp; Lifestyle" in sh or "Money & Lifestyle" in sh
assert "Open Travel" not in sh
assert 'href="/travel/"' in sh or "/travel/airlines/" in sh  # travel still linked from the combined card
footer = ss.footer_links_html(cfg)
assert "Money &amp; Lifestyle" in footer or "Money & Lifestyle" in footer
# Footer Sections column should not list Travel as a peer of Retirement/Investing
sec_col = re.search(r"<h4>Sections</h4><ul>(.*?)</ul>", footer, re.S).group(1)
assert "/money/" in sec_col
assert 'href="/travel/"' not in sec_col
assert "Money &amp; Health" not in footer and "Money & Health" not in footer

# Every href in generated nav and mobile drawer exists
for href in re.findall(r'href="([^"]+)"', nav):
    if href.startswith("/#") or href == "/":
        continue
    assert exists(href), f"broken nav href {href}"
    assert href not in BLOG_FORBIDDEN

# Compact start-here cards (no long section blurbs)
for s in ss.root_nav_sections(cfg):
    assert f'<p>{ss.esc(s["desc"])}</p>' not in sh, s["id"]

css = (ROOT / "components/site-map/site-blocks.css").read_text(encoding="utf-8")
assert ".wl-start-here .wl-sh-ages a { color: #4ade80; }" in css

# 5 root sections (no Travel) + Blogs + Plan by age
assert nav.count('class="wl-nav-btn"') == 7, nav.count('class="wl-nav-btn"')

print(
    "OK: Money & Lifestyle groups "
    + ", ".join(REQUIRED_GROUPS)
    + "; Travel root entry removed; travel links reachable; Blogs + Tools labels intact"
)
