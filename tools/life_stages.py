"""Plan by age (45-65) pages generated from components/life-stages/stages.json.

Called by tools/site_structure.py (via tools/build_site_blocks.py); not meant to be run on its own.
Renders:
  /plan-by-age/                  hub with the whole 45-65 journey and a pick-your-age entry
  /plan-by-age/<45-49 ...>/      one page per stage, one block per life event
  wl:age-journey                 compact stage strip on the homepage
  wl:life-stage                  "Where this fits" links on every article or tool a stage links to
"""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "components" / "life-stages" / "stages.json"
CSS = '<link rel="stylesheet" href="/components/life-stages/life-stages.css">'
BASE = "https://www.wealthlanding.com"
DISCLAIMER = ("Educational content only, not personalized financial, tax, legal, or insurance advice. "
              "Figures are 2026 values from the official sources linked on each item; they change, often every January.")


def esc(t):
    return html.escape(t or "", quote=True)


def load():
    return json.loads(DATA.read_text(encoding="utf-8"))


def stage_url(s):
    return f"/plan-by-age/{s['id']}/"


def stage_rel(s):
    return f"plan-by-age/{s['id']}/index.html"


def hub_rel(data):
    return data["hub"]["path"]


def rels(data):
    return [hub_rel(data)] + [stage_rel(s) for s in data["stages"]]


def src_link(data, key, cls="wl-ls-src"):
    s = data["sources"][key]
    return f'<a class="{cls}" href="{esc(s["url"])}" rel="noopener" target="_blank">{esc(s["name"])}</a>'


def check_links(data, pages, rel_for):
    """Every internal link must point at an existing, indexable page."""
    bad = []
    for s in data["stages"]:
        for ev in s["events"]:
            for h in ev["helps"]:
                p = pages.get(rel_for(h["href"]))
                if not p or p.noindex or p.redirect:
                    bad.append(f'{s["id"]}/{ev["id"]}: {h["href"]}')
            for n in ev["numbers"]:
                if n["src"] not in data["sources"]:
                    bad.append(f'{s["id"]}/{ev["id"]}: unknown source {n["src"]}')
    for h in data["after65"]["links"]:
        p = pages.get(rel_for(h["href"]))
        if not p or p.noindex or p.redirect:
            bad.append("after65: " + h["href"])
    if bad:
        raise ValueError("life-stages: bad links:\n  " + "\n  ".join(bad))


# ---------------------------------------------------------------- pieces

def timeline_nav(data, current=None):
    items = []
    for i, s in enumerate(data["stages"], 1):
        cur = ' aria-current="page"' if current == s["id"] else ""
        items.append(f'<li><a href="{stage_url(s)}"{cur}><span class="wl-ls-tl-age">{esc(s["ages"])}</span>'
                     f'<span class="wl-ls-tl-name">{esc(s["name"])}</span></a></li>')
    return f'<nav class="wl-ls-timeline" aria-label="Stages from 45 to 65"><ol>{"".join(items)}</ol></nav>'


def help_list(links, pages, rel_for, link_label):
    out = []
    for h in links:
        label = link_label(h["href"], pages)
        show = h.get("note") and h["note"].strip(" .").lower() != label.strip(" .").lower()
        note = f'<span class="wl-ls-help-note">{esc(h["note"])}</span>' if show else ""
        out.append(f'<li><a href="{esc(h["href"])}"><span class="wl-ls-kind">{esc(h["kind"])}</span>'
                   f'<strong>{esc(label)}</strong>{note}</a></li>')
    return "<ul class=\"wl-ls-helps\">" + "".join(out) + "</ul>"


def event_html(data, s, ev, pages, rel_for, link_label):
    todo = "".join(
        f'<li><label><input type="checkbox" data-ls-check="{esc(s["id"])}:{esc(ev["id"])}:{i}"> <span>{esc(t)}</span></label></li>'
        for i, t in enumerate(ev["todo"]))
    dec = "".join(f"<li>{esc(t)}</li>" for t in ev["decisions"])
    mis = "".join(f"<li>{esc(t)}</li>" for t in ev["mistakes"])
    nums = "".join(
        f'<li class="wl-ls-num"><span class="wl-ls-num-value">{esc(n["value"])}</span>'
        f'<span class="wl-ls-num-label">{esc(n["label"])}</span>'
        f'<span class="wl-ls-num-detail">{esc(n["detail"])}</span>'
        f'<span class="wl-ls-num-src">Source: {src_link(data, n["src"])}</span></li>'
        for n in ev["numbers"])
    gap = ""
    if ev.get("gap"):
        off = ""
        if ev.get("official"):
            off = " Official resources: " + ", ".join(src_link(data, k) for k in ev["official"]) + "."
        gap = f'<p class="wl-ls-gap"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> {esc(ev["gap"])}{off}</p>'
    return f'''
    <article class="wl-ls-event" id="{esc(ev["id"])}">
      <header class="wl-ls-event-head"><i class="fa-solid {esc(ev["icon"])}" aria-hidden="true"></i><h2>{esc(ev["title"])}</h2></header>
      <div class="wl-ls-block wl-ls-happening"><h3>What's happening</h3><p>{esc(ev["happening"])}</p></div>
      <div class="wl-ls-grid">
        <div class="wl-ls-block wl-ls-todo"><h3>What to do now</h3><ul class="wl-ls-checklist">{todo}</ul></div>
        <div class="wl-ls-block"><h3>Key decisions</h3><ul class="wl-ls-list">{dec}</ul>
          <h3 class="wl-ls-mt">Common mistakes</h3><ul class="wl-ls-list wl-ls-warn">{mis}</ul></div>
      </div>
      <div class="wl-ls-block"><h3>Key numbers for 2026</h3><ul class="wl-ls-nums">{nums}</ul></div>
      <div class="wl-ls-block wl-ls-help-block"><h3>How WealthLanding helps</h3>{help_list(ev["helps"], pages, rel_for, link_label)}{gap}</div>
    </article>'''


def head(title, desc, url, og):
    import site_structure as S
    return (S.HUB_HEAD.replace("__TITLE__", esc(title)).replace("__DESC__", esc(desc))
            .replace("__CANON__", BASE + url).replace("__OGTITLE__", esc(og))
            .replace("</head>", f"  {CSS}\n</head>").replace('<body class="wl-hub-page">', '<body class="wl-hub-page wl-ls-page">'))


FOOT = """  <wealthlanding-footer></wealthlanding-footer>
  <script src="/components/life-stages/life-stages.js" defer></script>
  <script src="/components/footer.js"></script>
  <script src="/components/header.js"></script>
</body>
</html>
"""


def after65_html(data, pages, rel_for, link_label):
    a = data["after65"]
    off = ", ".join(src_link(data, k) for k in a.get("official", []))
    return f'''
    <section class="wl-ls-after" aria-labelledby="wl-ls-after-title">
      <h2 id="wl-ls-after-title">{esc(a["title"])}</h2>
      <p>{esc(a["text"])}</p>
      {help_list(a["links"], pages, rel_for, link_label)}
      <p class="wl-ls-small">Official resources: {off}.</p>
    </section>'''


def stage_page(data, idx, pages, rel_for, link_label):
    s = data["stages"][idx]
    n = len(data["stages"])
    url = stage_url(s)
    summary = "".join(f"<p>{esc(p)}</p>" for p in s["summary"])
    bdays = "".join(f'<li><span class="wl-ls-bday-age">{esc(b["age"])}</span><span>{esc(b["text"])} {src_link(data, b["src"])}</span></li>'
                    for b in s["birthdays"])
    jump = "".join(f'<li><a href="#{esc(e["id"])}"><i class="fa-solid {esc(e["icon"])}" aria-hidden="true"></i>{esc(e["title"])}</a></li>'
                   for e in s["events"])
    events = "".join(event_html(data, s, e, pages, rel_for, link_label) for e in s["events"])
    if idx + 1 < n:
        nx = data["stages"][idx + 1]
        coming = "".join(f"<li>{esc(e['title'])}</li>" for e in nx["events"])
        nxt = f'''
    <section class="wl-ls-next" aria-labelledby="wl-ls-next-title">
      <span class="wl-ls-kicker">What's coming next</span>
      <h2 id="wl-ls-next-title">Ages {esc(nx["ages"])}: {esc(nx["name"])}</h2>
      <p>{esc(nx["summary"][0])}</p>
      <ul class="wl-ls-list">{coming}</ul>
      <a class="wl-ls-btn" href="{stage_url(nx)}">Go to ages {esc(nx["ages"])} &rarr;</a>
    </section>'''
    else:
        nxt = after65_html(data, pages, rel_for, link_label)
    prev = ""
    if idx > 0:
        pv = data["stages"][idx - 1]
        prev = f'<p class="wl-ls-small">Earlier stage: <a href="{stage_url(pv)}">Ages {esc(pv["ages"])}: {esc(pv["name"])}</a> · <a href="/plan-by-age/">All stages, 45–65</a></p>'
    else:
        prev = '<p class="wl-ls-small"><a href="/plan-by-age/">All stages, 45–65</a></p>'
    body = f'''  <main class="wl-ls">
    <section class="wl-ls-hero">
      <div class="wl-ls-inner">
        <span class="wl-ls-kicker">Plan by age · Stage {idx + 1} of {n}</span>
        <h1>Ages {esc(s["ages"])}: {esc(s["name"])}</h1>
        <div class="wl-ls-summary">{summary}</div>
        {timeline_nav(data, s["id"])}
      </div>
    </section>
    <div class="wl-ls-inner wl-ls-body">
      <section class="wl-ls-bdays" aria-labelledby="wl-ls-bdays-title">
        <h2 id="wl-ls-bdays-title">Birthdays that matter</h2>
        <ul>{bdays}</ul>
      </section>
      <nav class="wl-ls-jump" aria-label="Life events in this stage"><h2>Life events in this stage</h2><ol>{jump}</ol></nav>
{events}
{nxt}
      {prev}
      <p class="wl-ls-disclaimer">{esc(DISCLAIMER)} Checklist ticks are saved only in this browser. Last reviewed {esc(data["updated"])}.</p>
    </div>
  </main>
'''
    return head(s["title"] + " | WealthLanding", s["description"], url, s["title"]) + body + FOOT


def hub_page(data, pages, rel_for, link_label):
    h = data["hub"]
    intro = "".join(f"<p>{esc(p)}</p>" for p in h["intro"])
    ranges = json.dumps([{"min": int(s["id"].split("-")[0]), "max": int(s["id"].split("-")[1]), "url": stage_url(s), "ages": s["ages"]}
                         for s in data["stages"]], separators=(",", ":"))
    cards = []
    for i, s in enumerate(data["stages"], 1):
        evs = "".join(f'<li><a href="{stage_url(s)}#{esc(e["id"])}">{esc(e["title"])}</a></li>' for e in s["events"])
        bd = " · ".join(esc(b["age"]) for b in s["birthdays"] if "next" not in b["age"])
        cards.append(f'''
        <li class="wl-ls-stage" id="stage-{esc(s["id"])}">
          <div class="wl-ls-stage-dot" aria-hidden="true">{i}</div>
          <div class="wl-ls-stage-card">
            <a class="wl-ls-stage-head" href="{stage_url(s)}"><span class="wl-ls-tl-age">Ages {esc(s["ages"])}</span><strong>{esc(s["name"])}</strong></a>
            <p>{esc(s["summary"][0])}</p>
            {f'<p class="wl-ls-small"><strong>Key birthdays:</strong> {bd}</p>' if bd else ""}
            <ul class="wl-ls-list">{evs}</ul>
            <a class="wl-ls-btn" href="{stage_url(s)}">Open ages {esc(s["ages"])} &rarr;</a>
          </div>
        </li>''')
    body = f'''  <main class="wl-ls">
    <section class="wl-ls-hero">
      <div class="wl-ls-inner">
        <span class="wl-ls-kicker">{esc(h["kicker"])}</span>
        <h1>{esc(h["h1"])}</h1>
        <div class="wl-ls-summary">{intro}</div>
        <form class="wl-ls-pick" action="/plan-by-age/" method="get" data-ls-picker='{esc(ranges)}'>
          <label for="wl-ls-age">Pick your age</label>
          <div class="wl-ls-pick-row">
            <input id="wl-ls-age" name="age" type="number" min="18" max="100" inputmode="numeric" placeholder="e.g. 58">
            <button type="submit" class="wl-ls-btn">Show my stage</button>
          </div>
          <p class="wl-ls-pick-msg" aria-live="polite"></p>
          <noscript><p class="wl-ls-small">Or choose a stage below.</p></noscript>
        </form>
        {timeline_nav(data)}
      </div>
    </section>
    <div class="wl-ls-inner wl-ls-body">
      <h2 class="wl-ls-section-title">The journey from 45 to 65</h2>
      <ol class="wl-ls-journey">{"".join(cards)}
      </ol>
{after65_html(data, pages, rel_for, link_label)}
      <p class="wl-ls-disclaimer">{esc(DISCLAIMER)} Last reviewed {esc(data["updated"])}.</p>
    </div>
  </main>
'''
    return head(h["title"], h["description"], "/plan-by-age/", h["title"].split(" | ")[0]) + body + FOOT


def generate(pages, rel_for, link_label):
    """Return {rel: html} for the hub and stage pages."""
    data = load()
    check_links(data, pages, rel_for)
    out = {hub_rel(data): hub_page(data, pages, rel_for, link_label)}
    for i, s in enumerate(data["stages"]):
        out[stage_rel(s)] = stage_page(data, i, pages, rel_for, link_label)
    return out


def homepage_block():
    data = load()
    cards = "".join(
        f'<li><a href="{stage_url(s)}"><span class="wl-ls-tl-age">Ages {esc(s["ages"])}</span><strong>{esc(s["name"])}</strong>'
        f'<span class="wl-ls-help-note">{esc(" · ".join(e["title"] for e in s["events"][:3]))}</span></a></li>'
        for s in data["stages"])
    return (CSS + '\n<section id="life-stages-explorer" class="wl-ls-home" aria-labelledby="wl-ls-home-title">\n  <div class="wl-ls-inner">\n'
            '    <span class="wl-ls-kicker">Plan by age: 45–65</span>\n'
            '    <h2 id="wl-ls-home-title">The money decisions from 45 to 65, in the order they arrive</h2>\n'
            '    <p>Catch-up savings at 50, early access at 55 and 59½, Social Security from 62, Medicare at 65. Pick your stage for a checklist, the 2026 numbers from official sources and the tools that help.</p>\n'
            f'    <ol class="wl-ls-home-grid">{cards}</ol>\n'
            '    <p><a class="wl-ls-btn" href="/plan-by-age/">See the whole journey &rarr;</a></p>\n  </div>\n</section>')


def backlinks():
    """{rel: html} 'Where this fits' block for every page a stage links to."""
    data = load()
    hits = {}
    for s in data["stages"]:
        for ev in s["events"]:
            for h in ev["helps"]:
                hits.setdefault(h["href"], [])
                key = (s["id"], ev["id"])
                if key not in [(x[0]["id"], x[1]["id"]) for x in hits[h["href"]]]:
                    hits[h["href"]].append((s, ev))
    out = {}
    for href, items in hits.items():
        lis = "".join(f'<li><a href="{stage_url(s)}#{esc(ev["id"])}"><span class="wl-ls-tl-age">Ages {esc(s["ages"])}</span>{esc(ev["title"])}</a></li>'
                      for s, ev in items[:4])
        out[href] = (CSS + '\n<aside class="wl-ls-fits" aria-label="Where this fits in Plan by age">\n  <div class="wl-ls-inner">\n'
                     '    <h2>Where this fits in your 45–65 plan</h2>\n'
                     f'    <ul>{lis}</ul>\n'
                     '    <p class="wl-ls-small"><a href="/plan-by-age/">See every stage from 45 to 65 &rarr;</a></p>\n  </div>\n</aside>')
    return out
