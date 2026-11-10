#!/usr/bin/env python3
"""Render Real Estate housing guides from components/real-estate/guides.json.

These pages keep the same Tailwind/navy-amber chrome as the existing topic guides.
Edit the JSON, then run:

  python3 tools/build_real_estate_guides.py
  python3 tools/build_site_blocks.py

Use --check to exit 1 if a rendered page is out of date.
"""
from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "components" / "real-estate" / "guides.json"


def esc(text: str) -> str:
    return html.escape(text or "", quote=True)


def esc_keep(text: str) -> str:
    """Escape but allow a small set of trusted inline tags already in JSON."""
    # Content in JSON uses plain text; links are structured separately.
    return html.escape(text or "", quote=False)


HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} | WealthLanding</title>
  <meta property="og:site_name" content="WealthLanding">
  <meta property="og:type" content="website">
  <meta property="og:title" content="{og_title}">
  <meta property="og:description" content="{og_desc}">
  <meta property="og:url" content="https://www.wealthlanding.com{url}">
    <meta name="description" content="{desc}">
    <link rel="canonical" href="https://www.wealthlanding.com{url}" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <script src="https://cdn.tailwindcss.com"></script>
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-9JMJJ5CJR4"></script>
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6884752548862771"
         crossorigin="anonymous"></script>
    <script>
        window.dataLayer = window.dataLayer || [];
        function gtag(){{dataLayer.push(arguments);}}
        gtag('js', new Date());
        gtag('config', 'G-9JMJJ5CJR4');
      </script>
    <script>
        tailwind.config = {{
            theme: {{
                extend: {{
                    fontFamily: {{ sans: ['Inter', 'sans-serif'] }},
                    colors: {{
                        brand: {{ 50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d' }},
                        navy: {{ 800: '#1e293b', 900: '#0f172a' }}
                    }}
                }}
            }}
        }}
    </script>
    <style>
        body {{ font-family: 'Inter', sans-serif; background-color: #f8fafc; color: #334155; }}
        .t-card {{ background: #ffffff; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1.5rem; }}
        section.anchor {{ scroll-margin-top: 150px; }}
        .wl-src a {{ color: #b45309; text-decoration: underline; text-underline-offset: 2px; }}
        .wl-src a:hover {{ color: #92400e; }}
    </style>
</head>
<body class="min-h-screen flex flex-col">
    <div id="global-header-target"></div>
"""

FOOT = """
    <wealthlanding-footer></wealthlanding-footer>
    <script src="/components/footer.js"></script>
    <script src="/components/header.js"></script>
</body>
</html>
"""


def pills_html(pills):
    if not pills:
        return ""
    bits = []
    for p in pills:
        bits.append(
            f'<span class="bg-white/10 border border-white/20 rounded-xl px-4 py-3">'
            f'<span class="block text-xs text-slate-400 font-semibold uppercase tracking-wider">{esc(p.get("label",""))}</span>'
            f'<span class="text-xl font-extrabold text-brand-400">{esc(p.get("value",""))}</span> '
            f'<span class="text-slate-300">{esc(p.get("note",""))}</span></span>'
        )
    return '<div class="mt-6 flex flex-wrap gap-3 text-sm">' + "".join(bits) + "</div>"


def paragraphs(items, cls="text-gray-600 leading-relaxed mb-4"):
    return "".join(f'<p class="{cls}">{esc_keep(p)}</p>' for p in items)


def cards_grid(cards):
    out = ['<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">']
    colors = ["blue", "emerald", "amber", "purple", "rose", "slate"]
    icons = {
        "calendar": "fa-calendar-days",
        "map": "fa-map-location-dot",
        "bank": "fa-piggy-bank",
        "percent": "fa-percent",
        "compass": "fa-compass",
        "home": "fa-house",
        "shield": "fa-shield-halved",
        "file": "fa-file-invoice-dollar",
        "wrench": "fa-screwdriver-wrench",
        "users": "fa-users",
        "scale": "fa-scale-balanced",
        "clock": "fa-clock",
        "heart": "fa-heart-pulse",
        "chart": "fa-chart-line",
        "warning": "fa-triangle-exclamation",
        "key": "fa-key",
        "building": "fa-building",
        "handshake": "fa-handshake",
        "coins": "fa-coins",
        "move": "fa-truck-moving",
        "search": "fa-magnifying-glass",
        "list": "fa-list-check",
    }
    for i, c in enumerate(cards):
        color = colors[i % len(colors)]
        icon = icons.get(c.get("icon", "home"), "fa-house")
        out.append(
            f'<div class="t-card"><div class="flex items-center gap-2 mb-1">'
            f'<span class="w-8 h-8 rounded-lg bg-{color}-100 text-{color}-600 flex items-center justify-center text-sm flex-shrink-0">'
            f'<i class="fa-solid {icon}"></i></span>'
            f'<h3 class="font-bold text-navy-900 text-sm">{esc(c["title"])}</h3></div>'
            f'<p class="text-sm text-gray-600 leading-relaxed">{esc_keep(c["body"])}</p></div>'
        )
    out.append("</div>")
    return "".join(out)


def checklist(items, title="Practical checklist"):
    lis = "".join(
        f'<li class="flex items-start gap-3"><span class="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-sm flex-shrink-0"><i class="fa-solid fa-check"></i></span><span class="text-sm leading-relaxed pt-1">{esc_keep(x)}</span></li>'
        for x in items
    )
    return f'<div class="t-card border-l-4 !border-l-emerald-500 mb-10"><h2 class="text-2xl font-bold text-navy-900 mb-4">{esc(title)}</h2><ul class="space-y-3 text-gray-700">{lis}</ul></div>'


def watchouts(items):
    lis = "".join(
        f'<li class="flex items-start gap-3"><span class="w-8 h-8 rounded-lg bg-white border border-rose-200 text-rose-500 flex items-center justify-center text-sm flex-shrink-0"><i class="fa-solid fa-ban"></i></span><span class="text-sm leading-relaxed pt-1">{esc_keep(x)}</span></li>'
        for x in items
    )
    return f'<div class="bg-rose-50 border border-rose-200 rounded-xl p-6 mb-10"><h2 class="text-2xl font-bold text-navy-900 mb-4">Watch out for</h2><ul class="space-y-3 text-gray-700">{lis}</ul></div>'


def sources(items):
    lis = "".join(
        f'<li class="text-sm leading-relaxed"><a href="{esc(s["url"])}" rel="noopener" target="_blank">{esc(s["label"])}</a>'
        + (f' — {esc(s["note"])}' if s.get("note") else "")
        + "</li>"
        for s in items
    )
    return f'<section class="anchor mb-10 wl-src"><h2 class="text-2xl font-bold text-navy-900 mb-4">Primary sources</h2><ul class="space-y-2 text-gray-700">{lis}</ul><p class="text-xs text-gray-500 mt-3">Rules and figures can change. Confirm on the linked pages before you act.</p></section>'


def next_steps(items):
    cards = []
    for n in items:
        cards.append(
            f'<a href="{esc(n["href"])}" class="t-card flex items-center justify-between gap-4 hover:border-brand-500 transition-colors group">'
            f'<div><p class="text-xs font-bold text-brand-700 uppercase tracking-wider mb-1">{esc(n.get("kicker",""))}</p>'
            f'<p class="font-bold text-navy-900 group-hover:text-brand-700">{esc(n["label"])}</p></div>'
            f'<i class="fa-solid fa-arrow-right text-brand-600"></i></a>'
        )
    return f'<section class="anchor mb-10"><h2 class="text-2xl font-bold text-navy-900 mb-4">What should you look at next?</h2><div class="space-y-4">{"".join(cards)}</div></section>'


def render_sections(guide):
    parts = []
    # short answer
    parts.append(
        '<section class="anchor" aria-label="Short answer">'
        '<div class="bg-brand-50 border-l-4 border-brand-500 p-6 rounded-r-xl mb-10">'
        '<p class="text-xs font-bold text-brand-700 uppercase tracking-wider mb-2">Short answer</p>'
        f'<p class="text-lg text-gray-800 leading-relaxed">{esc_keep(guide["short_answer"])}</p></div></section>'
    )
    for sec in guide.get("sections", []):
        kind = sec.get("kind", "prose")
        title = sec.get("title")
        if title:
            parts.append(f'<section class="anchor mb-10"><h2 class="text-2xl font-bold text-navy-900 mb-4">{esc(title)}</h2>')
        else:
            parts.append('<section class="anchor mb-10">')
        if kind == "callout":
            parts.append(
                '<div class="t-card border-l-4 !border-l-brand-500">'
                f'<p class="text-xs font-bold text-brand-700 uppercase tracking-wider mb-2">{esc(sec.get("kicker","Framework"))}</p>'
                f'<p class="text-gray-700 leading-relaxed">{esc_keep(sec["body"])}</p></div>'
            )
        elif kind == "cards":
            if sec.get("intro"):
                parts.append(paragraphs([sec["intro"]]))
            parts.append(cards_grid(sec["cards"]))
        elif kind == "example":
            if sec.get("intro"):
                parts.append(paragraphs([sec["intro"]]))
            grid = ['<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">']
            for box in sec.get("boxes", []):
                grid.append(
                    f'<div class="t-card border-t-4 !border-t-{box.get("color","amber")}-500">'
                    f'<p class="text-xs font-bold text-{box.get("color","amber")}-700 uppercase tracking-wider mb-1">{esc(box["label"])}</p>'
                    f'<p class="text-2xl font-extrabold text-navy-900 mb-1">{esc(box["value"])}'
                    f'<span class="text-sm font-medium text-gray-500">{esc(box.get("unit",""))}</span></p>'
                    f'<p class="text-sm text-gray-600">{esc_keep(box["note"])}</p></div>'
                )
            grid.append("</div>")
            parts.append("".join(grid))
            if sec.get("footer_box"):
                fb = sec["footer_box"]
                parts.append(
                    f'<div class="t-card !bg-navy-900"><p class="text-xs font-bold text-brand-400 uppercase tracking-wider mb-1">{esc(fb["label"])}</p>'
                    f'<p class="text-gray-200 leading-relaxed text-sm">{esc_keep(fb["body"])}</p></div>'
                )
            if sec.get("disclaimer"):
                parts.append(f'<p class="text-sm text-gray-500 mt-3">{esc(sec["disclaimer"])}</p>')
        elif kind == "list_blocks":
            if sec.get("intro"):
                parts.append(paragraphs([sec["intro"]]))
            for block in sec.get("blocks", []):
                parts.append(
                    f'<div class="t-card mb-4"><h3 class="font-bold text-navy-900 mb-2">{esc(block["title"])}</h3>'
                    f'<p class="text-sm text-gray-600 leading-relaxed">{esc_keep(block["body"])}</p></div>'
                )
        elif kind == "raw_html":
            parts.append(sec.get("html", ""))
        else:
            parts.append(paragraphs(sec.get("paras", [])))
            if sec.get("bullets"):
                lis = "".join(f'<li class="text-sm text-gray-700 leading-relaxed">{esc_keep(b)}</li>' for b in sec["bullets"])
                parts.append(f'<ul class="list-disc pl-5 space-y-2 mb-4">{lis}</ul>')
        parts.append("</section>")

    if guide.get("checklist"):
        parts.append(checklist(guide["checklist"], guide.get("checklist_title", "Practical checklist")))
    if guide.get("watchouts"):
        parts.append(watchouts(guide["watchouts"]))
    if guide.get("sources"):
        parts.append(sources(guide["sources"]))
    if guide.get("next"):
        parts.append(next_steps(guide["next"]))
    return "\n".join(parts)


def render_guide(guide: dict) -> str:
    url = guide["url"]
    title = guide["title"]
    desc = guide["description"]
    hero = guide["hero"]
    head = HEAD.format(
        title=esc(title),
        og_title=esc(title),
        og_desc=esc(desc),
        desc=esc(desc),
        url=esc(url),
    )
    # breadcrumb markers left empty for build_site_blocks to fill/replace
    crumb_placeholder = "<!-- wl:breadcrumb:start -->\n<!-- wl:breadcrumb:end -->\n"
    body = f"""{crumb_placeholder}    <main class="flex-grow flex flex-col w-full">
        <div class="bg-navy-900 text-white pt-12 pb-12 px-4">
            <div class="max-w-3xl mx-auto">
                <nav aria-label="Breadcrumb" class="text-sm text-slate-400 mb-6 font-medium">
                    <a href="/real-estate/" class="hover:text-brand-400 transition-colors">Real Estate</a>
                    <span class="mx-2">/</span><span class="text-slate-300">{esc(hero.get("crumb","Housing"))}</span>
                </nav>
                <div class="inline-block bg-brand-500/20 text-brand-400 font-semibold px-3 py-1 rounded-full text-xs mb-5 border border-brand-500/30 tracking-wide">
                    {esc(hero.get("badge","GUIDE · Housing"))}
                </div>
                <h1 class="text-3xl md:text-5xl font-bold mb-4 leading-tight">{esc(hero["h1"])}</h1>
                <p class="text-lg text-slate-300 max-w-2xl">{esc(hero["dek"])}</p>
                {pills_html(hero.get("pills", []))}
            </div>
        </div>

        <article class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
            {render_sections(guide)}
            <div class="border-t border-gray-200 pt-8 flex justify-between items-center">
                <a href="/real-estate/" class="text-gray-500 hover:text-navy-900 font-medium"><i class="fa-solid fa-arrow-left mr-2"></i> Back to Real Estate</a>
            </div>
            <p class="text-xs text-gray-400 mt-8">Last updated {esc(guide.get("updated","November 2026"))}. Educational content for U.S. households ages 45–65 and anyone making a housing decision — not tax, legal, or investment advice.</p>
        </article>
    </main>
"""
    # life-stage and next-steps markers for generators
    extras = ""
    if guide.get("life_stage_marker", True):
        extras += "    <!-- wl:life-stage:start -->\n<!-- wl:life-stage:end -->\n"
    extras += "<!-- wl:next-steps:start -->\n<!-- wl:next-steps:end -->\n"
    return head + body + extras + FOOT


WL_BLOCK_NAMES = ("breadcrumb", "life-stage", "next-steps", "footer-links")


def strip_wl_blocks(html_text: str) -> str:
    """Normalize generator-owned blocks so guides.json checks ignore site-map fills."""
    out = html_text
    for name in WL_BLOCK_NAMES:
        start, end = f"<!-- wl:{name}:start -->", f"<!-- wl:{name}:end -->"
        out = re.sub(
            re.escape(start) + r".*?" + re.escape(end),
            f"{start}\n{end}",
            out,
            flags=re.S,
        )
    # footer element may gain filled links from build_site_blocks
    out = re.sub(
        r"<wealthlanding-footer>.*?</wealthlanding-footer>",
        "<wealthlanding-footer></wealthlanding-footer>",
        out,
        flags=re.S,
    )
    return out


def preserve_wl_blocks(existing: str, rendered: str) -> str:
    """Keep filled wl blocks from an existing page when regenerating body content."""
    if not existing:
        return rendered
    out = rendered
    for name in WL_BLOCK_NAMES:
        start, end = f"<!-- wl:{name}:start -->", f"<!-- wl:{name}:end -->"
        m = re.search(re.escape(start) + r".*?" + re.escape(end), existing, flags=re.S)
        if not m:
            continue
        out, n = re.subn(
            re.escape(start) + r".*?" + re.escape(end),
            lambda _m, blk=m.group(0): blk,
            out,
            count=1,
            flags=re.S,
        )
        if n == 0 and f"{start}\n{end}" in out:
            out = out.replace(f"{start}\n{end}", m.group(0), 1)
    mfoot = re.search(r"<wealthlanding-footer>.*?</wealthlanding-footer>", existing, flags=re.S)
    if mfoot:
        out = re.sub(
            r"<wealthlanding-footer>.*?</wealthlanding-footer>",
            mfoot.group(0),
            out,
            count=1,
            flags=re.S,
        )
    return out


def main():
    check = "--check" in sys.argv
    data = json.loads(DATA.read_text(encoding="utf-8"))
    stale = []
    written = []
    for guide in data["guides"]:
        path = ROOT / guide["path"]
        path.parent.mkdir(parents=True, exist_ok=True)
        html_out = render_guide(guide)
        existing = path.read_text(encoding="utf-8") if path.exists() else ""
        if check:
            if strip_wl_blocks(existing) != strip_wl_blocks(html_out):
                stale.append(str(guide["path"]))
        else:
            merged = preserve_wl_blocks(existing, html_out)
            path.write_text(merged, encoding="utf-8")
            written.append(str(guide["path"]))
    if check:
        if stale:
            print("Out of date:", ", ".join(stale))
            return 1
        print("OK: real-estate guides match guides.json")
        return 0
    print("Wrote", len(written), "guides:")
    for w in written:
        print(" ", w)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
