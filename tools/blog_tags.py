#!/usr/bin/env python3
"""Reusable, data-driven blog tags.

Tag labels live on each post in archive.json (`tags: ["Real Estate Tips"]`).
Optional `meta.tagPages` entries give a tag a listing page and make its
pills link there:

    "tagPages": [
      {
        "label": "Real Estate Tips",
        "slug": "tips",
        "path": "/blogs/real_estate/tips.html",
        "description": "..."
      }
    ]

This module:
  - renders tag pills for hub cards, the /blogs/ index, and articles
  - writes each tag listing page
  - stamps `<!-- wl:post-tags -->` blocks into matching article HTML

Run from the repo root (also called from tools/build_blog_hubs.py):

    python3 tools/blog_tags.py
"""
from __future__ import annotations

import html
import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Keep in sync with blogs/archive.js and the fallback in tools/build_blog_hubs.py.
TAG_STYLES = {
    "Tax Strategy": "bg-emerald-50 text-emerald-800 border-emerald-200",
    "Healthcare": "bg-amber-50 text-amber-800 border-amber-200",
    "Lifestyle": "bg-sky-50 text-sky-800 border-sky-200",
    "Social Security": "bg-indigo-50 text-indigo-800 border-indigo-200",
    "Savings": "bg-teal-50 text-teal-800 border-teal-200",
    "Income Planning": "bg-violet-50 text-violet-800 border-violet-200",
    "Airline Status": "bg-sky-50 text-sky-800 border-sky-200",
    "United": "bg-blue-50 text-blue-800 border-blue-200",
    "Family Travel": "bg-rose-50 text-rose-800 border-rose-200",
    "Markets": "bg-slate-100 text-slate-800 border-slate-300",
    "Currencies": "bg-amber-50 text-amber-800 border-amber-200",
    "Healthcare and Biotech": "bg-teal-50 text-teal-800 border-teal-200",
    "Housing Market": "bg-orange-50 text-orange-800 border-orange-200",
    "Estate Planning": "bg-indigo-50 text-indigo-800 border-indigo-200",
    "Economy and Labor": "bg-sky-50 text-sky-800 border-sky-200",
    "Case Study": "bg-blue-50 text-blue-800 border-blue-200",
    "Real Estate Tips": "bg-green-50 text-green-800 border-green-200",
}
DEFAULT_STYLE = TAG_STYLES["Case Study"]

# Article chrome (case_study.css) uses these classes, not Tailwind.
ARTICLE_PILL = (
    "display:inline-flex;align-items:center;padding:6px 11px;border-radius:999px;"
    "border:1px solid #bbf7d0;background:#f0fdf4;color:#166534;font-size:11px;"
    "font-weight:800;letter-spacing:.06em;text-transform:uppercase;text-decoration:none"
)
ARTICLE_PILL_MUTED = (
    "display:inline-flex;align-items:center;padding:6px 11px;border-radius:999px;"
    "border:1px solid #d7e1ea;background:#fff;color:#3f4f63;font-size:11px;"
    "font-weight:800;letter-spacing:.06em;text-transform:uppercase;text-decoration:none"
)

MARK_START = "<!-- wl:post-tags:start -->"
MARK_END = "<!-- wl:post-tags:end -->"
MARK_RE = re.compile(
    re.escape(MARK_START) + r".*?" + re.escape(MARK_END),
    re.S,
)

SECTIONS = [
    "blogs/investment/archive.json",
    "blogs/budget_spending/archive.json",
    "blogs/real_estate/archive.json",
    "blogs/Happy_retirement/archive.json",
    "blogs/Travel/archive.json",
    "blogs/spending_smart/archive.json",
]

e = lambda s: html.escape(str(s if s is not None else ""), quote=True)


def load_archive(rel: str) -> dict:
    return json.loads((ROOT / rel).read_text(encoding="utf-8"))


def tag_pages(meta: dict | None) -> list[dict]:
    pages = []
    for item in (meta or {}).get("tagPages") or []:
        label = (item.get("label") or "").strip()
        path = (item.get("path") or "").strip()
        if not label or not path:
            continue
        pages.append({
            "label": label,
            "slug": item.get("slug") or Path(path).stem,
            "path": path,
            "description": item.get("description") or "",
        })
    return pages


def href_for(label: str, meta: dict | None = None, pages: dict | None = None) -> str:
    if pages is None:
        pages = {p["label"]: p["path"] for p in tag_pages(meta)}
    return pages.get(label, "")


def style_for(label: str) -> str:
    return TAG_STYLES.get(label, DEFAULT_STYLE)


def pills_html(tags: list, meta: dict | None = None, *, linked: bool = True) -> str:
    """Tailwind pills used on hub / index / tag-page cards."""
    if not tags:
        return ""
    pages = {p["label"]: p["path"] for p in tag_pages(meta)}
    bits = []
    for label in tags:
        cls = f"text-xs font-semibold px-2.5 py-1 rounded-full border {style_for(label)}"
        href = href_for(label, pages=pages) if linked else ""
        if href:
            bits.append(f'<a href="{e(href)}" class="{cls}">{e(label)}</a>')
        else:
            bits.append(f'<span class="{cls}">{e(label)}</span>')
    return '<div class="mt-4 flex flex-wrap items-center gap-2 tagrow">' + "".join(bits) + "</div>"


def article_pills_html(tags: list, meta: dict | None = None) -> str:
    if not tags:
        return f"{MARK_START}\n{MARK_END}"
    pages = {p["label"]: p["path"] for p in tag_pages(meta)}
    bits = []
    for label in tags:
        href = href_for(label, pages=pages)
        style = ARTICLE_PILL if href else ARTICLE_PILL_MUTED
        if href:
            bits.append(f'<a class="tagpill" href="{e(href)}" style="{style}">{e(label)}</a>')
        else:
            bits.append(f'<span class="tagpill" style="{style}">{e(label)}</span>')
    inner = '<div class="tagrow">' + "".join(bits) + "</div>"
    return f"{MARK_START}\n      {inner}\n      {MARK_END}"


def all_tag_page_map() -> dict[str, str]:
    out = {}
    for src in SECTIONS:
        path = ROOT / src
        if not path.exists():
            continue
        for page in tag_pages(load_archive(src).get("meta")):
            out[page["label"]] = page["path"]
    return out


def _post_file(post: dict) -> Path | None:
    url = (post.get("url") or "").split("?")[0]
    if not url.startswith("/"):
        return None
    rel = url.lstrip("/")
    path = ROOT / rel
    if path.is_file():
        return path
    if (path / "index.html").is_file():
        return path / "index.html"
    return None


def inject_article_tags(data: dict) -> list[str]:
    """Stamp tag pills into articles that already have the marker pair."""
    meta = data.get("meta") or {}
    updated = []
    for post in data.get("posts") or []:
        path = _post_file(post)
        if path is None:
            continue
        text = path.read_text(encoding="utf-8")
        if MARK_START not in text or MARK_END not in text:
            continue
        block = article_pills_html(post.get("tags") or [], meta)
        new = MARK_RE.sub(block, text, count=1)
        if new != text:
            path.write_text(new, encoding="utf-8")
            updated.append(os.path.relpath(path, ROOT))
    return updated


def _item(post: dict, meta: dict) -> str:
    if post.get("image"):
        w = int(post["imageWidth"]) if post.get("imageWidth") else 720
        h = int(post["imageHeight"]) if post.get("imageHeight") else 378
        media = (
            f'<img src="{e(post["image"])}" alt="{e(post.get("imageAlt") or post.get("title") or "")}" '
            f'width="{w}" height="{h}" loading="lazy" '
            f'class="w-full h-full object-cover aspect-video sm:aspect-[4/3]">'
        )
    else:
        media = (
            f'<div class="w-full h-full aspect-video sm:aspect-[4/3] bg-emerald-50 text-emerald-800 '
            f'flex items-center justify-center text-xs font-bold uppercase tracking-widest">'
            f'{e(post.get("tileLabel", "Article"))}</div>'
        )
    tags = pills_html(post.get("tags") or [], meta, linked=True)
    return (
        '<article class="archive-item group flex flex-col sm:flex-row gap-6 py-8 border-b border-slate-200 first:pt-0">'
        f'<a href="{e(post["url"])}" class="block w-full sm:w-1/3 lg:w-1/4 shrink-0 overflow-hidden bg-slate-100 rounded-xl" tabindex="-1" aria-hidden="true">{media}</a>'
        '<div class="flex flex-col justify-center">'
        + (f'<div class="text-[11px] font-bold text-emerald-700 uppercase tracking-wide mb-1">{e(post["series"])}</div>' if post.get("series") else "")
        + (f'<div class="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">{e(post["date"])}</div>' if post.get("date") else "")
        + f'<a href="{e(post["url"])}"><h2 class="text-xl sm:text-2xl font-bold text-slate-900 leading-tight mb-3 group-hover:text-emerald-700">{e(post["title"])}</h2></a>'
        f'<p class="text-slate-600 text-sm sm:text-base leading-relaxed line-clamp-3">{e(post["desc"])}</p>'
        f"{tags}</div></article>"
    )


def tag_page_html(src: str, data: dict, page: dict, posts: list[dict]) -> str:
    meta = data.get("meta") or {}
    section = meta.get("title") or "Blog"
    hub = meta.get("hub") or ""
    hub_href = hub if str(hub).startswith("/") else f"/blogs/{hub}"
    label = page["label"]
    desc = page.get("description") or f"Articles tagged {label}."
    n = len(posts)
    count = f"{n} article" + ("" if n == 1 else "s")
    items = "\n        ".join(_item(p, meta) for p in posts) if posts else (
        '<p class="py-8 text-slate-600">No articles have this tag yet.</p>'
    )
    return f'''<!DOCTYPE html>
<!-- Generated by tools/blog_tags.py from /{src}. Edit the JSON, then re-run the script. -->
<html lang="en">
<head>
  <meta charset="UTF-8">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{e(label)} | {e(section)} | WealthLanding</title>
  <meta property="og:site_name" content="WealthLanding">
  <meta property="og:type" content="website">
  <meta property="og:title" content="{e(label)}">
  <meta property="og:description" content="{e(desc)}">
  <meta property="og:url" content="https://www.wealthlanding.com{e(page["path"])}">
  <meta name="description" content="{e(desc)}">
  <link rel="canonical" href="https://www.wealthlanding.com{e(page["path"])}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
  <style>
    :root {{ --emerald: #02B17D; --navy: #0f172a; }}
    body {{ margin: 0; font-family: Inter, system-ui, -apple-system, sans-serif; background: #ffffff; color: var(--navy); }}
    .archive-item {{ transition: all 0.2s ease-in-out; }}
    .archive-item:hover h2 {{ color: var(--emerald); }}
    .archive-item img {{ transition: transform 0.5s ease; }}
    .archive-item:hover img {{ transform: scale(1.03); }}
  </style>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-9JMJJ5CJR4"></script>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6884752548862771"
       crossorigin="anonymous"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){{dataLayer.push(arguments);}}
    gtag('js', new Date());
    gtag('config', 'G-9JMJJ5CJR4');
  </script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="antialiased">

  <div id="global-header-target"></div>

  <main class="w-full">
    <section class="bg-slate-50 border-b border-slate-200 py-10 px-4 sm:px-6">
      <div class="max-w-[1000px] mx-auto">
        <nav class="text-sm text-slate-500 mb-3" aria-label="Breadcrumb"><a class="hover:text-emerald-700 underline" href="/blogs/">Blogs</a> <span aria-hidden="true">/</span> <a class="hover:text-emerald-700 underline" href="{e(hub_href)}">{e(section)}</a> <span aria-hidden="true">/</span> {e(label)}</nav>
        <div class="text-sm font-semibold text-emerald-700 uppercase tracking-wider mb-2">Tagged group</div>
        <h1 class="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">{e(label)}</h1>
        <p class="text-slate-600 text-base mt-3 max-w-2xl">{e(desc)}</p>
      </div>
    </section>

    <section class="max-w-[1000px] mx-auto px-4 sm:px-6 py-8 sm:py-12" aria-labelledby="tag-archive-h">
      <h2 id="tag-archive-h" class="sr-only">{e(label)} articles</h2>
      <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{e(count)}</p>
      <div class="flex flex-col">
        {items}
      </div>
      <p class="mt-10 text-sm text-slate-600"><a class="font-bold text-emerald-700 hover:underline" href="{e(hub_href)}">See all {e(section)} posts →</a></p>
    </section>

    <section class="max-w-[1000px] mx-auto px-4 sm:px-6 pb-12">
      <p class="text-xs text-slate-500 leading-relaxed border-t border-slate-200 pt-6"><strong>Disclaimer:</strong> WealthLanding articles are for educational and informational purposes only and are not financial, investment, tax or legal advice. Consult a qualified professional about your own situation.</p>
    </section>
  </main>

  <wealthlanding-footer></wealthlanding-footer>
  <script src="/components/footer.js"></script>
  <script src="/components/header.js"></script>
</body>
</html>
'''


def build_tag_pages() -> list[str]:
    written = []
    for src in SECTIONS:
        path = ROOT / src
        if not path.exists():
            continue
        data = load_archive(src)
        meta = data.get("meta") or {}
        posts = data.get("posts") or []
        for page in tag_pages(meta):
            matched = [p for p in posts if page["label"] in (p.get("tags") or [])]
            out_url = page["path"]
            if not out_url.startswith("/"):
                raise SystemExit(f"{src} tag page path must be absolute: {out_url}")
            out = ROOT / out_url.lstrip("/")
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(tag_page_html(src, data, page, matched), encoding="utf-8")
            written.append(os.path.relpath(out, ROOT))
            print("wrote", written[-1])
        for rel in inject_article_tags(data):
            print("updated tags in", rel)
            written.append(rel)
    return written


def ensure_sitemap(paths: list[str]) -> bool:
    """Add any missing tag-page URLs to the hand-maintained sitemap."""
    sitemap = ROOT / "sitemap.xml"
    text = sitemap.read_text(encoding="utf-8")
    added = False
    for rel in paths:
        loc = f"https://www.wealthlanding.com/{rel.replace(os.sep, '/')}"
        if loc in text:
            continue
        entry = f"  <url><loc>{loc}</loc></url>\n"
        # Prefer to sit with the matching section's other blog URLs.
        anchor = None
        if rel.startswith("blogs/"):
            section = rel.split("/")[1] if "/" in rel else ""
            needle = f"https://www.wealthlanding.com/blogs/{section}"
            idx = text.rfind(needle)
            if idx != -1:
                end = text.find("\n", idx)
                if end != -1:
                    anchor = end + 1
        if anchor is None:
            last = text.rfind("</urlset>")
            if last == -1:
                raise SystemExit("sitemap.xml is missing </urlset>")
            anchor = last
        text = text[:anchor] + entry + text[anchor:]
        added = True
        print("sitemap +", loc)
    if added:
        sitemap.write_text(text, encoding="utf-8")
    return added


def build() -> list[str]:
    written = build_tag_pages()
    listing = []
    for src in SECTIONS:
        path = ROOT / src
        if not path.exists():
            continue
        for page in tag_pages(load_archive(src).get("meta")):
            listing.append(page["path"].lstrip("/"))
    ensure_sitemap(listing)
    return written


if __name__ == "__main__":
    build()
