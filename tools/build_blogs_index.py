#!/usr/bin/env python3
"""Render /blogs/index.html from public section archive.json files.

Each section lists its 3 most recent posts (see tools/blog_archives.py for
the date rules) and a Read more link to that section's full archive hub.
Run from the repo root, typically via tools/build_blog_hubs.py.
"""
from __future__ import annotations

import html
from pathlib import Path

from blog_archives import LATEST_COUNT, ROOT, latest_across, load_public_sections

e = lambda s: html.escape(str(s if s is not None else ""), quote=True)


CHART_OF_THE_MONTH = '''
      <section class="mb-14 bg-slate-50 -mx-4 sm:-mx-6 px-4 sm:px-6 py-10 border-y border-slate-200">
        <div class="max-w-[1200px] mx-auto">
          <div class="category-header border-slate-900">
            <h2 class="category-title">Chart of the Month</h2>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            <a href="/Retirement-simulator/overseas_retirement_hub.html" class="story-card bg-transparent">
              <div class="story-image-wrapper shadow-lg border border-slate-200">
                <img src="/asset/Overseas.png" alt="2 Million USD Global Retirement Lifestyle list" class="w-full h-full object-cover">
              </div>
            </a>
            <div>
              <h3 class="text-2xl font-bold text-slate-900 leading-snug mb-3">
                <a href="/Retirement-simulator/overseas_retirement_hub.html" class="hover:text-emerald-700 transition-colors"> Global Overseas Retirement-Lifestyle &amp; Cost Directory</a>
              </h3>
              <p class="text-slate-600 text-base leading-relaxed mb-4">
Based on the 4% Withdrawal Rule, a $2 Million USD Nest Egg generates approximately $80,000 USD/Year (~$6,700/Month). Explore how your budget performs across 18 world-class cities categorized by cost efficiency.
              </p>
            </div>
          </div>
        </div>
      </section>
'''


def _href(url: str) -> str:
    return url or "#"


def _date_label(post: dict) -> str:
    r = post.get("_resolved")
    if r and r.precision == "year":
        # A bare year is flagged as imprecise; don't present it as a pub date.
        return ""
    if r and r.label:
        return r.label
    return post.get("date") or ""


def story_card(post: dict) -> str:
    href = _href(post.get("url"))
    title = post.get("title") or "Untitled"
    desc = post.get("desc") or ""
    label = _date_label(post)
    date_html = (
        f'<div class="mt-auto text-[11px] font-bold text-slate-400 tracking-wide uppercase">{e(label)}</div>'
        if label else ""
    )
    if post.get("image"):
        media = (
            f'<div class="story-image-wrapper">'
            f'<img src="{e(post["image"])}" alt="{e(post.get("imageAlt") or title)}" loading="lazy" class="w-full h-full object-cover">'
            f'</div>'
        )
    else:
        tile = post.get("tileLabel") or "Article"
        media = (
            f'<div class="story-image-wrapper bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-100">'
            f'<span class="text-xs font-bold uppercase tracking-widest">{e(tile)}</span>'
            f'</div>'
        )
    return (
        f'<a href="{e(href)}" class="story-card">'
        f'{media}'
        f'<h3 class="text-xl font-bold text-slate-900 leading-snug mb-2">{e(title)}</h3>'
        f'<p class="text-slate-600 text-sm line-clamp-3 mb-4">{e(desc)}</p>'
        f'{date_html}'
        f'</a>'
    )


def featured_block(post: dict) -> str:
    href = _href(post.get("url"))
    title = post.get("title") or "Untitled"
    desc = post.get("desc") or ""
    label = _date_label(post)
    date_html = (
        f'<div class="text-sm font-medium text-slate-500 pt-2 uppercase tracking-wide">{e(label)}</div>'
        if label else ""
    )
    if post.get("image"):
        media = (
            f'<div class="aspect-video overflow-hidden bg-slate-100">'
            f'<img src="{e(post["image"])}" alt="{e(post.get("imageAlt") or title)}" class="w-full h-full object-cover hover:scale-105 transition-transform duration-700">'
            f'</div>'
        )
    else:
        tile = post.get("tileLabel") or "Article"
        media = (
            f'<div class="aspect-video overflow-hidden bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-100">'
            f'<span class="text-sm font-bold uppercase tracking-widest">{e(tile)}</span>'
            f'</div>'
        )
    return f'''      <div class="mb-16">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {media}
          <div class="space-y-4">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Latest Blog</span>
            </div>
            <h2 class="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight hover:text-emerald-700 transition-colors">
              <a href="{e(href)}">{e(title)}</a>
            </h2>
            <p class="text-slate-600 text-base leading-relaxed">{e(desc)}</p>
            {date_html}
          </div>
        </div>
      </div>
'''


def section_block(sec: dict) -> str:
    posts = sec["posts"][:LATEST_COUNT]
    cards = "\n          ".join(story_card(p) for p in posts)
    read_more = (
        f'<a href="{e(sec["hub_href"])}" class="text-sm font-bold text-emerald-700 hover:underline">'
        f'Read more {e(sec["title"])} posts →</a>'
    )
    return f'''      <section class="mb-14" data-blog-section="{e(sec["id"])}">
        <div class="category-header">
          <h2 class="category-title">{e(sec["title"])}</h2>
          {read_more}
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          {cards}
        </div>
      </section>
'''


def render_index(sections=None) -> str:
    sections = sections or load_public_sections()
    featured = latest_across(sections)
    parts = []
    if featured:
        parts.append(featured_block(featured))
    for sec in sections:
        parts.append(section_block(sec))
        if sec.get("chart_after"):
            parts.append(CHART_OF_THE_MONTH)
    listing = "\n".join(parts)
    return f'''<!DOCTYPE html>
<!-- Generated by tools/build_blog_hubs.py from section archive.json files. Edit the JSON, then re-run the script. -->
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
  <title>WealthLanding Blog: Retirement, Investing &amp; Money Guides</title>
  <meta name="description" content="WealthLanding blog: insights on retirement strategies, market movements, budgeting, travel rewards, and generational wealth planning, organized by topic.">
  <meta property="og:site_name" content="WealthLanding">
  <meta property="og:type" content="website">
  <meta property="og:title" content="WealthLanding Blog: Retirement, Investing &amp; Money Guides">
  <meta property="og:description" content="WealthLanding blog: insights on retirement strategies, market movements, budgeting, travel rewards, and generational wealth planning, organized by topic.">
  <meta property="og:url" content="https://www.wealthlanding.com/blogs/">
  <link rel="canonical" href="https://www.wealthlanding.com/blogs/">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">

  <style>
    :root {{
      --bg: #f8fafc;
      --card: #ffffff;
      --border: #e2e8f0;
      --text: #0f172a;
      --muted: #64748b;
      --emerald: #02B17D;
      --navy: #0B132B;
    }}

    body {{
      margin: 0;
      font-family: Inter, system-ui, -apple-system, sans-serif;
      background: #ffffff;
      color: var(--text);
    }}

    .story-card {{
      display: flex;
      flex-direction: column;
      text-decoration: none;
      color: inherit;
      background: #ffffff;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }}

    .story-card:hover h3 {{
      color: var(--emerald);
    }}

    .story-image-wrapper {{
      width: 100%;
      aspect-ratio: 16 / 9;
      overflow: hidden;
      background-color: #e2e8f0;
      margin-bottom: 0.85rem;
      position: relative;
    }}

    .story-image-wrapper img {{
      transition: transform 0.5s ease;
    }}

    .story-card:hover .story-image-wrapper img {{
      transform: scale(1.05);
    }}

    .category-header {{
      border-bottom: 3px solid #0f172a;
      padding-bottom: 0.5rem;
      margin-bottom: 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }}
    .category-title {{
      font-size: 1.5rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #0f172a;
    }}
  </style>

  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config={{safelist:['bg-navy-900'],theme:{{extend:{{colors:{{brand:{{500:'#22c55e',600:'#16a34a'}},navy:{{900:'#0f172a'}}}}}}}}}}</script>
</head>
<body class="antialiased">

  <div class="bg-navy-900 hidden"></div>
  <div id="global-header-target"></div>

  <main class="w-full">

    <section class="bg-slate-50 border-b border-slate-200/80 py-10 sm:py-12 px-4 sm:px-6">
      <div class="max-w-[1200px] mx-auto text-center flex flex-col items-center space-y-4">
        <h1 class="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 uppercase">
          WealthLanding Blog
        </h1>
        <p class="text-slate-600 text-sm sm:text-base max-w-2xl font-normal px-2">
          Insights on retirement strategies, market movements, and generational wealth planning, organized by reader goal and sourced to primary documents.
        </p>
      </div>
    </section>
<!-- wl:start-here:start -->
<!-- wl:start-here:end -->

    <div class="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
{listing}
    </div>
  </main>

  <wealthlanding-footer></wealthlanding-footer>
  <script src="/components/footer.js"></script>
  <script src="/components/header.js"></script>
</body>
</html>
'''


def write_index(sections=None) -> Path:
    out = ROOT / "blogs" / "index.html"
    out.write_text(render_index(sections), encoding="utf-8")
    return out


if __name__ == "__main__":
    path = write_index()
    print("wrote", path.relative_to(ROOT))
