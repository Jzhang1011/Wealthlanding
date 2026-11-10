"""Build the site search index and /search/ page from reader-facing HTML.

Called by tools/site_structure.py during tools/build_site_blocks.py.
The index covers indexed pages only: noindex, redirects, Talent, and
hidden younger-stage paths are excluded.
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX_REL = "search/search-index.json"
PAGE_REL = "search/index.html"
INDEX_URL = "/search/search-index.json"
SEARCH_URL = "/search/"
BASE = "https://www.wealthlanding.com"

GENERIC_HEADINGS = {
    "common questions",
    "start here",
    "keep going",
    "related guides and tools",
    "related articles",
    "sources",
    "disclaimer",
    "educational content only",
    "on this page",
    "contents",
    "table of contents",
    "next steps",
    "also popular",
    "also explore",
    "browse by goal",
    "other sections",
    "guide",
    "faqs",
    "faq",
    "key takeaways",
    "the decision",
    "what it is",
    "new here? start with these, in order.",
    "money guides",
}

PATH_STOP = {
    "html", "index", "topics", "life", "stage", "blogs", "tools", "components",
    "happy", "retirement", "budget", "spending", "market", "investment",
}

COMMENT_RE = re.compile(r"<!--.*?-->", re.S)
SCRIPT_RE = re.compile(r"<script\b[^>]*>.*?</script>", re.I | re.S)
STYLE_RE = re.compile(r"<style\b[^>]*>.*?</style>", re.I | re.S)
TAG_RE = re.compile(r"<[^>]+>")
HEADING_RE = re.compile(r"<h([1-3])[^>]*>(.*?)</h\1>", re.I | re.S)

# Hidden from menus and search even if a noindex tag is later dropped.
HIDDEN_PREFIXES = (
    "Talent/",
    "life_stage/18_25/",
    "blogs/18_25",
    "learn/early-career/",
    "blogs/12_18/",
    "_layouts/",
    "search/",
)


def esc(text):
    return html.escape(text or "", quote=True)


def plain(fragment):
    text = COMMENT_RE.sub(" ", fragment or "")
    text = TAG_RE.sub(" ", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def hidden_rel(rel):
    return any(rel == p or rel.startswith(p) for p in HIDDEN_PREFIXES)


def include_page(page):
    if hidden_rel(page.rel):
        return False
    if page.noindex or page.redirect:
        return False
    if page.rel.startswith("_"):
        return False
    return True


def section_label(page, cfg, classify):
    sec, _grp = classify(page.rel, cfg)
    if sec:
        return sec["label"]
    if page.rel == "index.html":
        return "Home"
    if page.rel.startswith("learn/"):
        return "Learn"
    if page.rel.startswith("blogs/"):
        return "Blogs"
    if page.rel.startswith("plan-by-age/"):
        return "Plan by age"
    if page.rel.split("/")[0] in {"about", "contact", "methodology", "privacy", "terms"}:
        return "WealthLanding"
    return ""


def path_keywords(rel):
    raw = re.sub(r"\.[a-z0-9]+$", "", rel, flags=re.I)
    parts = re.split(r"[/_-]+", raw.lower())
    out = []
    for part in parts:
        if not part or part in PATH_STOP:
            continue
        if part.isdigit() and len(part) < 3:
            continue
        if len(part) < 2:
            continue
        out.append(part)
    return out


def heading_keywords(page, title):
    body = SCRIPT_RE.sub(" ", page.text)
    body = STYLE_RE.sub(" ", body)
    body = COMMENT_RE.sub(" ", body)
    found = []
    seen = {title.lower()}
    for match in HEADING_RE.finditer(body):
        text = plain(match.group(2))
        if not text:
            continue
        compact = re.sub(r"\s+", " ", text).strip()
        key = compact.lower()
        if key in seen or key in GENERIC_HEADINGS:
            continue
        if key.startswith("everything in ") or key.startswith("where this fits"):
            continue
        if len(compact) < 4 or len(compact) > 80:
            continue
        seen.add(key)
        found.append(compact)
        if len(found) >= 8:
            break
    return found


def keywords_for(page, title, section, group_label):
    items = []
    seen = set()

    def add(value):
        text = re.sub(r"\s+", " ", (value or "")).strip()
        if not text:
            return
        key = text.lower()
        if key in seen or key == title.lower():
            return
        seen.add(key)
        items.append(text)

    for heading in heading_keywords(page, title):
        add(heading)
    add(section)
    add(group_label)
    for part in path_keywords(page.rel):
        add(part)
    return items[:12]


def entries(cfg, pages, classify):
    rows = []
    excluded = {"noindex": 0, "redirect": 0, "hidden": 0}
    for page in pages.values():
        if hidden_rel(page.rel):
            excluded["hidden"] += 1
            continue
        if page.redirect:
            excluded["redirect"] += 1
            continue
        if page.noindex or page.rel.startswith("_"):
            excluded["noindex"] += 1
            continue
        if not include_page(page):
            excluded["hidden"] += 1
            continue
        sec, grp = classify(page.rel, cfg)
        section = section_label(page, cfg, classify)
        group_label = grp["label"] if grp else ""
        desc = page.desc or ""
        if len(desc) > 160:
            desc = desc[:157].rsplit(" ", 1)[0] + "…"
        rows.append({
            "title": page.title,
            "url": page.url,
            "desc": desc,
            "section": section,
            "keywords": keywords_for(page, page.title, section, group_label),
        })
    rows.sort(key=lambda row: row["url"])
    return rows, excluded


def index_payload(rows):
    return {"pages": rows}


def index_text(rows):
    return json.dumps(index_payload(rows), ensure_ascii=False, indent=2) + "\n"


def search_form_html(suffix, placeholder="Search"):
    input_id = f"wlSearchInput-{suffix}"
    results_id = f"wlSearchResults-{suffix}"
    return (
        f'<div class="wl-search" data-wl-search>\n'
        f' <form class="wl-search-form" action="{SEARCH_URL}" method="get" role="search">\n'
        f'  <label class="wl-sr-only" for="{esc(input_id)}">Search WealthLanding</label>\n'
        f'  <input id="{esc(input_id)}" class="wl-search-input" type="search" name="q" '
        f'placeholder="{esc(placeholder)}" autocomplete="off" aria-autocomplete="list" '
        f'aria-controls="{esc(results_id)}" aria-expanded="false" enterkeyhint="search">\n'
        f'  <button class="wl-search-submit" type="submit" aria-label="Submit search">'
        f'<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i></button>\n'
        f' </form>\n'
        f' <div id="{esc(results_id)}" class="wl-search-results" hidden role="listbox" '
        f'aria-label="Search suggestions"></div>\n'
        f'</div>'
    )


def header_tools_html():
    return (
        '<div class="wl-header-tools">\n'
        + search_form_html("nav") + "\n"
        + '<button type="button" class="wl-search-toggle" id="wlSearchToggle" '
        'aria-label="Open search" aria-expanded="false" aria-controls="wlSearchInput-nav">'
        '<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i></button>\n'
        + '<button id="wlMobileMenuBtn" class="wl-mobile-toggle" aria-label="Open menu">\n'
        + ' <i class="fa-solid fa-bars"></i>\n'
        + " </button>\n"
        + "</div>"
    )


def drawer_search_html():
    return (
        '<div class="wl-md-search">\n'
        + search_form_html("drawer", "Search the site") + "\n"
        + "</div>"
    )


def search_page_html(footer_block):
    title = "Search WealthLanding"
    desc = "Search WealthLanding guides, tools and articles on retirement, investing, money, real estate and travel."
    canon = BASE + SEARCH_URL
    return f'''<!DOCTYPE html>
<!-- Generated by tools/build_site_blocks.py. Edit tools/search_index.py, then re-run the script. -->
<html lang="en">
<head>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-9JMJJ5CJR4"></script>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6884752548862771"
       crossorigin="anonymous"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){{dataLayer.push(arguments);}}
    gtag('js', new Date());
    gtag('config', 'G-9JMJJ5CJR4');
  </script>
  <meta charset="UTF-8">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{esc(title)}</title>
  <meta name="description" content="{esc(desc)}">
  <meta name="robots" content="noindex, follow">
  <link rel="canonical" href="{esc(canon)}">
  <meta property="og:site_name" content="WealthLanding">
  <meta property="og:type" content="website">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(desc)}">
  <meta property="og:url" content="{esc(canon)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link rel="stylesheet" href="/components/site-map/site-blocks.css">
  <link rel="stylesheet" href="/components/search.css">
</head>
<body class="wl-hub-page wl-search-page">
  <div id="global-header-target"></div>
  <main class="wl-hub">
    <section class="wl-hub-hero">
      <div class="wl-hub-inner">
        <span class="wl-sh-kicker">Search</span>
        <h1>Find a guide or tool</h1>
        <form class="wl-search-page-form" action="{SEARCH_URL}" method="get" role="search" data-wl-search-page>
          <label class="wl-sr-only" for="wlSearchPageInput">Search WealthLanding</label>
          <input id="wlSearchPageInput" class="wl-search-page-input" type="search" name="q" placeholder="Try Roth, Medicare, or rent vs buy" autocomplete="off" enterkeyhint="search">
          <button class="wl-search-page-submit" type="submit">Search</button>
        </form>
      </div>
    </section>
    <section class="wl-search-page-body">
      <div class="wl-hub-inner">
        <p id="wlSearchPageStatus" class="wl-search-page-status" aria-live="polite"></p>
        <div id="wlSearchPageResults" class="wl-search-page-results"></div>
      </div>
    </section>
    <p class="wl-hub-disclaimer">Educational content only, not personalized investment, tax, legal, or insurance advice. Rules and figures come from the sources linked on each page and can change.</p>
  </main>
  <wealthlanding-footer>
{footer_block}
  </wealthlanding-footer>
  <script src="/components/footer.js"></script>
  <script src="/components/header.js"></script>
  <script src="/components/search.js"></script>
</body>
</html>
'''


def write_if_changed(rel, new, stale, check):
    path = ROOT / rel
    old = path.read_text(encoding="utf-8") if path.exists() else ""
    if new != old:
        stale.append(rel)
        if not check:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(new, encoding="utf-8")


def build(cfg, pages, classify, footer_block, stale, check):
    rows, _excluded = entries(cfg, pages, classify)
    write_if_changed(INDEX_REL, index_text(rows), stale, check)
    write_if_changed(PAGE_REL, search_page_html(footer_block), stale, check)
    return rows
