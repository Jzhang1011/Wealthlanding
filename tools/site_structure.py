"""Site structure blocks generated from components/site-map/site-map.json.

Called by tools/build_site_blocks.py; not meant to be run on its own.
"""
import html
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITEMAP_JSON = ROOT / "components" / "site-map" / "site-map.json"
BASE = "https://www.wealthlanding.com"
CSS = '<link rel="stylesheet" href="/components/site-map/site-blocks.css">'


def esc(text):
    return html.escape(text or "", quote=True)


# ---------------------------------------------------------------- page index

def url_for(rel):
    if rel == "index.html":
        return "/"
    if rel.endswith("/index.html"):
        return "/" + rel[: -len("index.html")]
    return "/" + rel


def rel_for(url):
    path = url.split("#")[0].split("?")[0].lstrip("/")
    if path == "" or path.endswith("/"):
        path += "index.html"
    return path


def front_matter(text):
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            fm = text[3:end]
            return fm, end + 4
    return None, 0


def fm_value(fm, key):
    m = re.search(r"^" + key + r":\s*\"?(.*?)\"?\s*$", fm, re.M)
    return html.unescape(m.group(1)) if m else ""


def short_title(title):
    title = html.unescape(re.sub(r"\s+", " ", title)).strip()
    title = re.sub(r"\s*\|\s*WealthLanding.*$", "", title)
    title = re.sub(r"\s*\|.*$", "", title)
    for sep in [":", " — ", " – ", " - "]:
        if sep in title and len(title.split(sep)[0]) >= 12:
            title = title.split(sep)[0]
            break
    if len(title) > 64:
        title = title[:61].rsplit(" ", 1)[0] + "…"
    return title.strip()


class Page:
    def __init__(self, rel, text):
        self.rel = rel
        self.url = url_for(rel)
        self.text = text
        fm, _ = front_matter(text)
        self.layout = bool(fm and re.search(r"^layout:", fm, re.M))
        if self.layout:
            raw_title, desc = fm_value(fm, "title"), fm_value(fm, "description")
            self.noindex = fm_value(fm, "noindex").lower() == "true"
        else:
            m = re.search(r"<title>(.*?)</title>", text, re.S | re.I)
            raw_title = m.group(1) if m else ""
            m = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', text, re.I)
            desc = html.unescape(m.group(1)) if m else ""
            self.noindex = bool(re.search(r'<meta[^>]+name="robots"[^>]+noindex', text, re.I))
        self.redirect = bool(re.search(r'http-equiv="refresh"', text, re.I)) or "location.replace(" in text[:3000]
        self.title = short_title(raw_title)
        self.desc = desc


def list_pages(cfg):
    out = subprocess.run(["git", "ls-files", "-z", "--", "*.html"], cwd=ROOT, capture_output=True, text=True).stdout
    rels = [r for r in out.split("\0") if r]
    # include new, not-yet-tracked generated hubs
    for sec in cfg["sections"]:
        if sec.get("page") and sec["page"]["path"] not in rels and (ROOT / sec["page"]["path"]).exists():
            rels.append(sec["page"]["path"])
    pages = {}
    for rel in sorted(set(rels)):
        if any(rel.startswith(x) for x in cfg["exclude"]):
            continue
        path = ROOT / rel
        if not path.exists():
            continue
        pages[rel] = Page(rel, path.read_text(encoding="utf-8"))
    return pages


# ---------------------------------------------------------------- classification

def all_groups(cfg):
    for sec in cfg["sections"]:
        for g in sec.get("groups", []):
            yield sec, g
    learn = dict(cfg["learn"], id="learn")
    for g in learn.get("groups", []):
        yield learn, g


def classify(rel, cfg):
    best = None
    for sec, g in all_groups(cfg):
        for prefix in g["match"]:
            if rel == prefix or (prefix.endswith("/") and rel.startswith(prefix)):
                if best is None or len(prefix) > best[2]:
                    best = (sec, g, len(prefix))
    return (best[0], best[1]) if best else (None, None)


def hub_urls(cfg):
    urls = {"/"}
    for sec, g in all_groups(cfg):
        urls.add(sec["hub"])
        urls.add(g["hub"])
    return urls


# ---------------------------------------------------------------- block helpers

def replace_block(page_html, name, block, anchors, after=False):
    start, end = f"<!-- wl:{name}:start -->", f"<!-- wl:{name}:end -->"
    wrapped = f"{start}\n{block}\n{end}"
    pattern = re.compile(re.escape(start) + r".*?" + re.escape(end) + r"\n?", re.S)
    if pattern.search(page_html):
        return pattern.sub(lambda _m: wrapped + "\n", page_html, count=1)
    for anchor in anchors:
        m = re.search(anchor, page_html, re.I)
        if m:
            pos = m.end() if after else m.start()
            return page_html[:pos] + ("\n" if after else "") + wrapped + ("" if after else "\n") + page_html[pos:]
    return None


def remove_block(page_html, name):
    start, end = f"<!-- wl:{name}:start -->", f"<!-- wl:{name}:end -->"
    return re.sub(re.escape(start) + r".*?" + re.escape(end) + r"\n?", "", page_html, flags=re.S)


def link_label(url, pages, fallback=""):
    p = pages.get(rel_for(url))
    return fallback or (p.title if p else url)


def link_desc(url, pages):
    p = pages.get(rel_for(url))
    d = p.desc if p else ""
    if len(d) > 120:
        d = d[:117].rsplit(" ", 1)[0] + "…"
    return d


# ---------------------------------------------------------------- footer links

def footer_links_html(cfg):
    cols = []
    sec_items = "".join(f'<li><a href="{esc(s["hub"])}">{esc(s["label"])}</a></li>' for s in cfg["sections"])
    cols.append(f'<div class="wl-fl-col"><h4>Sections</h4><ul>{sec_items}</ul></div>')
    tools = []
    for s in cfg["sections"]:
        if s["id"] == "tools":
            tools = s["start"] + s["popular"][:2]
    tool_items = "".join(f'<li><a href="{esc(l["href"])}">{esc(l["label"])}</a></li>' for l in tools)
    cols.append(f'<div class="wl-fl-col"><h4>Popular tools</h4><ul>{tool_items}</ul></div>')
    learn = cfg["learn"]
    learn_items = "".join(f'<li><a href="{esc(l["href"])}">{esc(l["label"])}</a></li>' for l in learn["links"])
    cols.append(f'<div class="wl-fl-col"><h4>{esc(learn["label"])}</h4><ul>{learn_items}</ul></div>')
    about_items = "".join(f'<li><a href="{esc(l["href"])}">{esc(l["label"])}</a></li>' for l in cfg["about"])
    cols.append(f'<div class="wl-fl-col wl-fl-about"><h4>WealthLanding</h4><ul>{about_items}</ul></div>')
    return ('<nav class="wl-footer-links" aria-label="Site sections">' + "".join(cols) +
            '<p class="wl-fl-disclaimer">Educational content only, not personalized investment, tax, legal, or insurance advice.</p></nav>')


def apply_footer_links(text, block):
    start, end = "<!-- wl:footer-links:start -->", "<!-- wl:footer-links:end -->"
    wrapped = f"{start}{CSS}{block}{end}"
    pattern = re.compile(r"(<wealthlanding-footer\b[^>]*>)(.*?)(</wealthlanding-footer>)", re.S | re.I)
    m = pattern.search(text)
    if not m:
        return text
    inner = m.group(2)
    if inner.strip() and start not in inner:
        return text  # unexpected custom content: leave it alone
    return text[: m.start()] + m.group(1) + wrapped + m.group(3) + text[m.end():]


# ---------------------------------------------------------------- breadcrumbs

def trail_for(page, cfg, pages):
    sec, grp = classify(page.rel, cfg)
    if not sec:
        return None
    trail = [("Home", "/")]
    if page.url != sec["hub"]:
        trail.append((sec["label"], sec["hub"]))
    if grp and grp["hub"] not in (sec["hub"], page.url):
        trail.append((grp["label"], grp["hub"]))
    if len(trail) == 1:
        return None
    trail.append((page.title, page.url))
    return trail


def breadcrumb_html(trail):
    items = []
    for i, (label, url) in enumerate(trail):
        if i == len(trail) - 1:
            items.append(f'<li aria-current="page">{esc(label)}</li>')
        else:
            items.append(f'<li><a href="{esc(url)}">{esc(label)}</a></li>')
    ld = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": label, "item": BASE + url}
            for i, (label, url) in enumerate(trail)
        ],
    }
    return (CSS + '\n<nav class="wl-breadcrumb" aria-label="Breadcrumb"><ol>' + "".join(items) + "</ol></nav>\n"
            '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + "</script>")


# ---------------------------------------------------------------- next steps

def next_steps_html(page, cfg, pages):
    sec, grp = classify(page.rel, cfg)
    if not sec:
        return None
    picks, seen = [], {page.url}

    def add(url, label="", tag=""):
        if url in seen or len(picks) >= 4:
            return
        if rel_for(url) not in pages or pages[rel_for(url)].noindex or pages[rel_for(url)].redirect:
            return
        seen.add(url)
        picks.append((url, label or link_label(url, pages), tag))

    path = sec.get("start", [])
    urls = [l["href"] for l in path]
    if page.url in urls:
        i = urls.index(page.url)
        if i + 1 < len(urls):
            add(urls[i + 1], path[i + 1]["label"], "Next step")
    # same group siblings
    if grp:
        hubs = hub_urls(cfg)
        sib = [p for r, p in pages.items() if classify(r, cfg)[1] is grp and not p.noindex and not p.redirect and p.url not in hubs]
        for p in sib[:6]:
            if len([x for x in picks if x[2] != "Next step"]) >= 2:
                break
            add(p.url)
    for l in sec.get("start", []) + sec.get("popular", []):
        add(l["href"], l.get("label", ""))
    if not picks:
        return None
    cards = []
    for url, label, tag in picks:
        d = link_desc(url, pages)
        cards.append(
            f'<li><a href="{esc(url)}">' + (f'<span class="wl-ns-tag">{esc(tag)}</span>' if tag else "") +
            f'<strong>{esc(label)}</strong>' + (f'<span class="wl-ns-desc">{esc(d)}</span>' if d else "") + "</a></li>"
        )
    return (CSS + f'\n<section class="wl-next-steps" aria-label="Keep going">\n  <div class="wl-ns-inner">\n'
            f'    <h2>Keep going: {esc(sec["label"])}</h2>\n    <ul>' + "".join(cards) + "</ul>\n"
            f'    <p class="wl-ns-more"><a href="{esc(sec["hub"])}">See everything in {esc(sec["label"])} &rarr;</a></p>\n  </div>\n</section>')


# ---------------------------------------------------------------- start here / routes

def start_here_html(cfg, pages):
    cards = []
    for s in cfg["sections"]:
        quick = "".join(f'<li><a href="{esc(l["href"])}">{esc(l["label"])}</a></li>' for l in s["start"][:3])
        cards.append(
            f'<div class="wl-sh-card"><a class="wl-sh-head" href="{esc(s["hub"])}"><i class="fa-solid {esc(s["icon"])}" aria-hidden="true"></i>'
            f'<span><strong>{esc(s["label"])}</strong><em>{esc(s["tagline"])}</em></span></a>'
            f'<p>{esc(s["desc"])}</p><ul>{quick}</ul>'
            f'<a class="wl-sh-more" href="{esc(s["hub"])}">Open {esc(s["label"])} &rarr;</a></div>'
        )
    learn = cfg["learn"]
    ages = " · ".join(f'<a href="{esc(l["href"])}">{esc(l["label"])}</a>' for l in learn["links"])
    return (CSS + '\n<section class="wl-start-here" id="start-here" aria-labelledby="wl-sh-title">\n  <div class="wl-sh-inner">\n'
            '    <span class="wl-sh-kicker">Start here</span>\n'
            '    <h2 id="wl-sh-title">What do you want to work on?</h2>\n'
            '    <p class="wl-sh-intro">Pick the goal closest to your question. Each section starts with a short reading path, then the tools to run your own numbers.</p>\n'
            '    <div class="wl-sh-grid">' + "".join(cards) + "</div>\n"
            f'    <p class="wl-sh-ages">Between 45 and 65? Plan by age: {ages}</p>\n  </div>\n</section>')



def _flow_collect(node, path="R"):
    """Flatten binary tree into layout rows: questions and outcomes with parent links."""
    nodes = {}
    edges = []

    def walk(n, pid, depth, side):
        nid = pid
        if "q" in n:
            nodes[nid] = {"kind": "q", "text": n["q"], "depth": depth, "side": side}
            for label, child in (("Yes", n["yes"]), ("No", n["no"])):
                cid = f"{nid}{'Y' if label == 'Yes' else 'N'}"
                edges.append({"frm": nid, "to": cid, "label": label})
                walk(child, cid, depth + 1, "L" if label == "No" else "R")
        else:
            nodes[nid] = {
                "kind": "out",
                "text": n.get("label") or "",
                "note": n.get("note") or "",
                "href": n.get("href") or "",
                "depth": depth,
                "side": side,
            }

    walk(node, path, 0, "C")
    return nodes, edges


FLOW_Q_W_ROOT = 300
FLOW_Q_W = 260
FLOW_OUT_W = 250
FLOW_Q_H = 72
FLOW_OUT_H = 64
FLOW_GAP_X = 32
FLOW_GAP_Y = 96
FLOW_PAD = 40


def _flow_node_size(n):
    """Return (width, height, title_lines, note_lines) for a laid-out node."""
    if n["kind"] == "q":
        w = FLOW_Q_W_ROOT if n["depth"] == 0 else FLOW_Q_W
        lines = _wrap_lines(n["text"], 32 if n["depth"] == 0 else 28)
        h = max(FLOW_Q_H, 28 + 18 * len(lines))
        return w, h, lines, []
    w = FLOW_OUT_W
    lines = _wrap_lines(n["text"], 28)
    note_lines = _wrap_lines(n.get("note") or "", 34)[:2] if n.get("note") else []
    h = max(FLOW_OUT_H, 34 + 16 * len(lines) + 14 * len(note_lines))
    return w, h, lines, note_lines


def _flow_layout(nodes):
    """Assign x,y centers and sizes so every node fits inside the canvas."""
    by_depth = {}
    for nid, n in nodes.items():
        by_depth.setdefault(n["depth"], []).append(nid)

    def sort_key(nid):
        key = []
        for ch in nid[1:]:
            key.append(0 if ch == "N" else 1)
        return tuple(key)

    sizes = {nid: _flow_node_size(n) for nid, n in nodes.items()}
    max_depth = max(by_depth) if by_depth else 0

    row_ids = {}
    max_row_w = 0
    for d in range(0, max_depth + 1):
        ids = sorted(by_depth.get(d, []), key=sort_key)
        row_ids[d] = ids
        if ids:
            row_w = sum(sizes[i][0] for i in ids) + FLOW_GAP_X * (len(ids) - 1)
            max_row_w = max(max_row_w, row_w)

    content_w = max(max_row_w, FLOW_Q_W_ROOT)
    width = content_w + 2 * FLOW_PAD

    positions = {}
    y = FLOW_PAD
    for d in range(0, max_depth + 1):
        ids = row_ids.get(d, [])
        if not ids:
            continue
        row_h = max(sizes[i][1] for i in ids)
        row_w = sum(sizes[i][0] for i in ids) + FLOW_GAP_X * (len(ids) - 1)
        x = (width - row_w) / 2
        cy = y + row_h / 2
        for nid in ids:
            w, h, lines, note_lines = sizes[nid]
            cx = x + w / 2
            positions[nid] = {
                "x": cx,
                "y": cy,
                "w": w,
                "h": h,
                "left": cx - w / 2,
                "top": cy - h / 2,
                "right": cx + w / 2,
                "bottom": cy + h / 2,
                "lines": lines,
                "note_lines": note_lines,
            }
            x += w + FLOW_GAP_X
        y += row_h + FLOW_GAP_Y

    height = y - FLOW_GAP_Y + FLOW_PAD
    return positions, width, height


def _svg_escape(s):
    return esc(s).replace("&#x27;", "'")


def _wrap_lines(text, width=28):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if len(trial) <= width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines or [text]


def flow_svg_boxes(root):
    """Return (viewBox tuple, node boxes, edge-label boxes) in SVG units.

    Used by tests to assert every painted node and Yes/No pill sits inside
    the viewBox with padding, so desktop branches are not clipped.
    """
    nodes, edges = _flow_collect(root)
    positions, W, H = _flow_layout(nodes)
    node_boxes = []
    for nid, pos in positions.items():
        node_boxes.append((pos["left"], pos["top"], pos["right"], pos["bottom"], nid))
    edge_boxes = []
    pill_w, pill_h = 36, 20
    for e in edges:
        a, b = positions[e["frm"]], positions[e["to"]]
        y1b = a["y"] + a["h"] / 2 - 4
        y2t = b["y"] - b["h"] / 2 + 4
        mx, my = (a["x"] + b["x"]) / 2, (y1b + y2t) / 2
        lx, ly = mx, my - 10
        edge_boxes.append((lx - pill_w / 2, ly - 11, lx + pill_w / 2, ly - 11 + pill_h, e["label"]))
    return (0.0, 0.0, float(W), float(H)), node_boxes, edge_boxes


def flow_svg_html(root, pages):
    nodes, edges = _flow_collect(root)
    positions, W, H = _flow_layout(nodes)

    parts = [
        f'<svg class="wl-flow-svg" viewBox="0 0 {W:.0f} {H:.0f}" role="img" aria-labelledby="wl-flow-svg-title wl-flow-svg-desc" xmlns="http://www.w3.org/2000/svg">',
        '<title id="wl-flow-svg-title">Housing decision path</title>',
        '<desc id="wl-flow-svg-desc">A branching yes-or-no diagram for retirement housing moves. Follow Yes and No arrows from the top question to a linked next guide.</desc>',
        '<defs>',
        '<marker id="wl-flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">',
        '<path d="M 0 0 L 10 5 L 0 10 z" fill="#166534"></path>',
        "</marker>",
        "</defs>",
    ]

    for e in edges:
        a, b = positions[e["frm"]], positions[e["to"]]
        y1b = a["y"] + a["h"] / 2 - 4
        y2t = b["y"] - b["h"] / 2 + 4
        mx, my = (a["x"] + b["x"]) / 2, (y1b + y2t) / 2
        path = f"M {a['x']:.1f} {y1b:.1f} Q {a['x']:.1f} {my:.1f} {mx:.1f} {my:.1f} T {b['x']:.1f} {y2t:.1f}"
        parts.append(
            f'<path class="wl-flow-edge-line" d="{path}" fill="none" stroke="#166534" stroke-width="2" marker-end="url(#wl-flow-arrow)"></path>'
        )
        lx, ly = mx, my - 10
        pill_w = 36
        parts.append(
            f'<rect x="{lx - pill_w/2:.1f}" y="{ly - 11:.1f}" width="{pill_w}" height="20" rx="10" class="wl-flow-edge-pill" fill="#f0fdf4" stroke="#16a34a" stroke-width="1.5"></rect>'
        )
        parts.append(
            f'<text x="{lx:.1f}" y="{ly + 3:.1f}" text-anchor="middle" class="wl-flow-edge-label">{_svg_escape(e["label"])}</text>'
        )

    for nid, n in nodes.items():
        pos = positions[nid]
        x, y, w, h = pos["x"], pos["y"], pos["w"], pos["h"]
        if n["kind"] == "q":
            lines = pos["lines"]
            parts.append(
                f'<g class="wl-flow-qnode">'
                f'<rect x="{x - w/2:.1f}" y="{y - h/2:.1f}" width="{w}" height="{h}" rx="14" ry="14" fill="#ffffff" stroke="#16a34a" stroke-width="2.5"></rect>'
            )
            ty = y - (len(lines) - 1) * 9
            for i, line in enumerate(lines):
                parts.append(
                    f'<text x="{x:.1f}" y="{ty + i * 18:.1f}" text-anchor="middle" class="wl-flow-qtext">{_svg_escape(line)}</text>'
                )
            parts.append("</g>")
        else:
            href = n.get("href") or ""
            lines = pos["lines"]
            note_lines = pos["note_lines"]
            open_tag = f'<a href="{esc(href)}" class="wl-flow-outnode">' if href else '<g class="wl-flow-outnode">'
            close_tag = "</a>" if href else "</g>"
            parts.append(open_tag)
            parts.append(
                f'<rect x="{x - w/2:.1f}" y="{y - h/2:.1f}" width="{w}" height="{h}" rx="{h/2:.1f}" ry="{h/2:.1f}" fill="#ffffff" stroke="#16a34a" stroke-width="2.25"></rect>'
            )
            ty = y - ((len(lines) + len(note_lines) - 1) * 8)
            for i, line in enumerate(lines):
                parts.append(
                    f'<text x="{x:.1f}" y="{ty + i * 16:.1f}" text-anchor="middle" class="wl-flow-outtext">{_svg_escape(line)}</text>'
                )
            base = ty + len(lines) * 16
            for j, line in enumerate(note_lines):
                parts.append(
                    f'<text x="{x:.1f}" y="{base + j * 14:.1f}" text-anchor="middle" class="wl-flow-outnote">{_svg_escape(line)}</text>'
                )
            parts.append(close_tag)

    parts.append("</svg>")
    return "\n".join(parts)


def flow_mobile_html(root, pages):
    """Vertical, readable yes/no tree for narrow viewports (not a scaled SVG)."""

    def render(n):
        if "q" in n:
            return (
                '<div class="wl-mtree-node">'
                f'<div class="wl-mtree-q">{esc(n["q"])}</div>'
                '<div class="wl-mtree-branches">'
                '<div class="wl-mtree-branch">'
                '<div class="wl-mtree-edge" aria-hidden="true"><span>Yes</span></div>'
                + render(n["yes"])
                + "</div>"
                '<div class="wl-mtree-branch">'
                '<div class="wl-mtree-edge" aria-hidden="true"><span>No</span></div>'
                + render(n["no"])
                + "</div></div></div>"
            )
        href = n.get("href") or "#"
        label = n.get("label") or link_label(href, pages)
        note = n.get("note") or ""
        return (
            f'<a class="wl-mtree-out" href="{esc(href)}">'
            f"<strong>{esc(label)}</strong>"
            + (f"<span>{esc(note)}</span>" if note else "")
            + "</a>"
        )

    return (
        '<div class="wl-flow-mobile">'
        '<div class="wl-mtree" role="group" aria-label="Housing decision path, stacked for small screens">'
        + render(root)
        + "</div></div>"
    )


def _flow_fallback_list(node, pages, path_labels=None):
    """Accessible text alternative listing every path to an outcome."""
    path_labels = path_labels or []
    items = []

    def walk(n, labels):
        if "q" in n:
            walk(n["yes"], labels + [f"Yes ← {n['q']}"])
            walk(n["no"], labels + [f"No ← {n['q']}"])
        else:
            href = n.get("href") or "#"
            label = n.get("label") or link_label(href, pages)
            trail = " → ".join(labels) if labels else "Start"
            items.append(
                f'<li><a href="{esc(href)}">{esc(label)}</a>'
                f'<span class="wl-flow-trail">{esc(trail)}</span></li>'
            )

    walk(node, [])
    return '<ol class="wl-flow-fallback">' + "".join(items) + "</ol>"


def flow_html(sec, pages):
    flow = sec["flow"]
    title = flow.get("title") or "Find your next housing question"
    intro = flow.get("intro") or ""
    secondary = flow.get("secondary") or []
    sec_bits = []
    for item in secondary:
        sec_bits.append(
            f'<li><a href="{esc(item["href"])}">{esc(item["label"])}</a>'
            + (f'<span>{esc(item["note"])}</span>' if item.get("note") else "")
            + "</li>"
        )
    secondary_html = ""
    if sec_bits:
        secondary_html = (
            '<div class="wl-flow-secondary">'
            f'<h3>{esc(flow.get("secondary_title") or "Other entry points")}</h3>'
            f'<ul>{"".join(sec_bits)}</ul></div>'
        )
    more = "".join(f'<a href="{esc(l["href"])}">{esc(l["label"])}</a>' for l in sec.get("popular", []))
    svg = flow_svg_html(flow["root"], pages)
    mobile = flow_mobile_html(flow["root"], pages)
    fallback = _flow_fallback_list(flow["root"], pages)
    return (
        CSS
        + f'\n<section class="wl-flow" aria-label="{esc(title)}">\n  <div class="wl-ns-inner">\n'
        f'    <span class="wl-sh-kicker">{esc(flow.get("kicker") or "Decision path")}</span>\n'
        f'    <h2>{esc(title)}</h2>\n'
        + (f'    <p class="wl-flow-intro">{esc(intro)}</p>\n' if intro else "")
        + '    <div class="wl-flow-desktop">\n'
        + '    <div class="wl-flow-viewport">\n'
        + f'      <div class="wl-flow-canvas" role="group" aria-label="Binary housing decision path">\n{svg}\n      </div>\n'
        + "    </div>\n"
        + "    </div>\n"
        + f"    {mobile}\n"
        + '    <details class="wl-flow-a11y"><summary>Text version of every path</summary>\n'
        + f"      {fallback}\n"
        + "    </details>\n"
        + secondary_html
        + (f'    <p class="wl-rt-more"><span>Also explore:</span>{more}</p>\n' if more else "")
        + '    <p class="wl-flow-note">This path is a planning aid, not advice. Your facts, local rules and risk tolerance decide the next step.</p>\n'
        + "  </div>\n</section>"
    )


def routes_html(sec, pages, title=None):
    if sec.get("flow"):
        return flow_html(sec, pages)
    items = []
    for i, l in enumerate(sec["start"], 1):
        note = l.get("note") or link_desc(l["href"], pages)
        items.append(f'<li><a href="{esc(l["href"])}"><span class="wl-rt-n">{i}</span><strong>{esc(l["label"])}</strong>'
                     + (f'<span class="wl-ns-desc">{esc(note)}</span>' if note else "") + "</a></li>")
    more = "".join(f'<a href="{esc(l["href"])}">{esc(l["label"])}</a>' for l in sec.get("popular", []))
    return (CSS + f'\n<section class="wl-routes" aria-label="Start here">\n  <div class="wl-ns-inner">\n'
            f'    <span class="wl-sh-kicker">Start here</span>\n    <h2>{esc(title or sec.get("routes_intro") or "New here? Start with these, in order.")}</h2>\n'
            '    <ol>' + "".join(items) + "</ol>\n" +
            (f'    <p class="wl-rt-more"><span>Also popular:</span>{more}</p>\n' if more else "") +
            "  </div>\n</section>")


def goals_html(cfg, current=None, title="Browse by goal"):
    cards = "".join(
        f'<li><a href="{esc(s["hub"])}"><i class="fa-solid {esc(s["icon"])}" aria-hidden="true"></i><strong>{esc(s["label"])}</strong><span>{esc(s["tagline"])}</span></a></li>'
        for s in cfg["sections"] if s["id"] != current
    )
    return (CSS + f'\n<section class="wl-goals" aria-label="{esc(title)}">\n  <div class="wl-ns-inner">\n    <h2>{esc(title)}</h2>\n'
            f'    <ul>{cards}</ul>\n  </div>\n</section>')


# ---------------------------------------------------------------- header nav

def nav_html(cfg):
    items, mobile = [], []
    for s in cfg["sections"]:
        col1 = "".join(f'<li><a href="{esc(l["href"])}">{esc(l["label"])}</a></li>' for l in s["start"])
        col2 = "".join(f'<li><a href="{esc(l["href"])}">{esc(l["label"])}</a></li>' for l in s["popular"])
        items.append(f'''<li class="wl-nav-item">
 <button class="wl-nav-btn" type="button" aria-haspopup="true"><span>{esc(s.get("nav_label", s["label"]))}</span><i class="fa-solid fa-caret-down" style="font-size:10px;"></i></button>
 <div class="wl-nav-mega">
 <div class="wl-mega-left"><div><div class="wl-mega-tag">{esc(s["tagline"].upper())}</div><h3 class="wl-mega-title">{esc(s["label"])}</h3><p class="wl-mega-desc">{esc(s["desc"])}</p></div>
 <div class="wl-mega-foot"><a href="{esc(s["hub"])}">Open the {esc(s["label"])} hub &rarr;</a></div></div>
 <div class="wl-mega-right"><div><div class="wl-mega-col-title">START HERE</div><ul class="wl-mega-list">{col1}</ul></div>
 <div><div class="wl-mega-col-title">POPULAR</div><ul class="wl-mega-list">{col2}</ul></div></div>
 </div>
</li>''')
        links = f'<a href="{esc(s["hub"])}" class="wl-md-hub">{esc(s["label"])} hub</a>' + "".join(
            f'<a href="{esc(l["href"])}">{esc(l["label"])}</a>' for l in s["start"][:3])
        mobile.append(f'<div><div class="wl-md-title">{esc(s["label"])}</div><div class="wl-md-links">{links}</div></div>')
    learn = cfg["learn"]
    lcol = "".join(f'<li><a href="{esc(l["href"])}">{esc(l["label"])}</a></li>' for l in learn["links"])
    acol = "".join(f'<li><a href="{esc(l["href"])}">{esc(l["label"])}</a></li>' for l in cfg["about"][:3] + [cfg["about"][-1]])
    items.append(f'''<li class="wl-nav-item">
 <button class="wl-nav-btn" type="button" aria-haspopup="true"><span>Plan by age</span><i class="fa-solid fa-caret-down" style="font-size:10px;"></i></button>
 <div class="wl-nav-mega wl-nav-mega-right">
 <div class="wl-mega-left"><div><div class="wl-mega-tag">PLAN BY AGE: 45–65</div><h3 class="wl-mega-title">Plan by age</h3><p class="wl-mega-desc">The money decisions from 45 to 65 in the order they arrive: catch-up savings, early access, Social Security, the healthcare bridge and Medicare.</p></div>
 <div class="wl-mega-foot"><a href="{esc(learn["hub"])}">See the whole 45–65 journey &rarr;</a></div></div>
 <div class="wl-mega-right"><div><div class="wl-mega-col-title">BY STAGE</div><ul class="wl-mega-list">{lcol}</ul></div>
 <div><div class="wl-mega-col-title">ABOUT</div><ul class="wl-mega-list">{acol}</ul></div></div>
 </div>
</li>''')
    llinks = f'<a href="{esc(learn["hub"])}" class="wl-md-hub">All stages, 45–65</a>' + "".join(f'<a href="{esc(l["href"])}">{esc(l["label"])}</a>' for l in learn["links"])
    mobile.append(f'<div><div class="wl-md-title">Plan by age: 45–65</div><div class="wl-md-links">{llinks}</div></div>')
    alinks = "".join(f'<a href="{esc(l["href"])}">{esc(l["label"])}</a>' for l in cfg["about"])
    mobile.append(f'<div><div class="wl-md-title">WealthLanding</div><div class="wl-md-links">{alinks}</div></div>')
    return f'''<!-- Generated by tools/build_site_blocks.py from components/site-map/site-map.json. Edit the JSON, then re-run the script. -->
<header class="wl-header-root">
 <div class="wl-header-container">
 <div class="wl-header-inner">
 <a href="/" class="wl-brand-link">
 <img class="wl-brand-logo" src="/favicon.svg" alt="" width="40" height="40">
 <div>
 <span class="wl-brand-text">Wealth<span class="wl-brand-accent">Landing</span></span>
 <span class="wl-brand-sub">Financial Education</span>
 </div>
 </a>
 <nav aria-label="Main">
 <ul class="wl-nav-list">
{chr(10).join(items)}
 </ul>
 </nav>
 <div>
 <button id="wlMobileMenuBtn" class="wl-mobile-toggle" aria-label="Open menu">
 <i class="fa-solid fa-bars"></i>
 </button>
 </div>
 </div>
 </div>
 </header>
 <div id="wlMobileDrawer" class="wl-mobile-drawer">
 <div class="wl-mobile-panel">
 <div class="wl-md-top"><span>WealthLanding Menu</span><button id="wlCloseMobileDrawerBtn" aria-label="Close menu"><i class="fa-solid fa-xmark"></i></button></div>
 <a href="/#start-here" class="wl-md-start">Start here: pick your goal &rarr;</a>
 <div class="wl-md-sections">
{chr(10).join(mobile)}
 </div>
 </div>
 </div>
'''


def nav_fallback_js(cfg):
    lis = "".join(f'<li class="wl-nav-item"><a class="wl-nav-link-direct" href="{s["hub"]}">{html.escape(s["label"], quote=False)}</a></li>' for s in cfg["sections"])
    lis += f'<li class="wl-nav-item"><a class="wl-nav-link-direct" href="{cfg["learn"]["hub"]}">Plan by age</a></li>'
    return "        var WL_NAV_FALLBACK = " + json.dumps(lis, ensure_ascii=False) + ";"


# ---------------------------------------------------------------- hub pages

HUB_HEAD = """<!DOCTYPE html>
<!-- Generated by tools/build_site_blocks.py from components/site-map/site-map.json. Edit the JSON, then re-run the script. -->
<html lang="en">
<head>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-9JMJJ5CJR4"></script>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6884752548862771"
       crossorigin="anonymous"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-9JMJJ5CJR4');
  </script>
  <meta charset="UTF-8">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>__TITLE__</title>
  <meta name="description" content="__DESC__">
  <link rel="canonical" href="__CANON__">
  <meta property="og:site_name" content="WealthLanding">
  <meta property="og:type" content="website">
  <meta property="og:title" content="__OGTITLE__">
  <meta property="og:description" content="__DESC__">
  <meta property="og:url" content="__CANON__">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link rel="stylesheet" href="/components/site-map/site-blocks.css">
</head>
<body class="wl-hub-page">
  <div id="global-header-target"></div>
"""


def hub_page_html(sec, cfg, pages):
    pg = sec["page"]
    url = url_for(pg["path"])
    head = (HUB_HEAD.replace("__TITLE__", esc(pg["title"])).replace("__DESC__", esc(pg["description"]))
            .replace("__CANON__", BASE + url).replace("__OGTITLE__", esc(pg["title"].split(" | ")[0])))
    intro = "".join(f"<p>{esc(p)}</p>" for p in pg["intro"])
    qs = []
    links_only = pg.get("questions_style") == "links_only"
    for q in pg["questions"]:
        valid_links = [h for h in q["links"] if rel_for(h) in pages or h in hub_urls(cfg)]
        if not valid_links:
            continue
        if links_only:
            # Question text itself is the clickable link (first destination).
            href = valid_links[0]
            qs.append(f'<li><a href="{esc(href)}">{esc(q["q"])}</a></li>')
        else:
            links = "".join(
                f'<li><a href="{esc(h)}">{esc(link_label(h, pages))}</a></li>' for h in valid_links
            )
            body = q.get("a") or ""
            qs.append(f'<div class="wl-hub-q"><h3>{esc(q["q"])}</h3>' + (f'<p>{body}</p>' if body else '') + f'<ul>{links}</ul></div>')
    if pg.get("questions_style") == "links_only":
        q_block = '<ul class="wl-hub-qlist">' + "".join(qs) + "</ul>"
    else:
        q_block = '<div class="wl-hub-qgrid">' + "".join(qs) + "</div>"

    # everything in this section, grouped
    groups = []
    for g in sec["groups"]:
        members = [p for r, p in pages.items() if classify(r, cfg)[1] is g and not p.noindex and not p.redirect and p.url != url]
        if not members:
            continue
        lis = "".join(
            f'<li><a href="{esc(p.url)}"><strong>{esc(p.title)}</strong>'
            + (f'<span>{esc(link_desc(p.url, pages))}</span>' if p.desc else "") + "</a></li>"
            for p in members
        )
        groups.append(f'<div class="wl-hub-group"><h3>{esc(g["label"])}</h3><ul>{lis}</ul></div>')
    body = f"""  <main class="wl-hub">
    <section class="wl-hub-hero">
      <div class="wl-hub-inner">
        <span class="wl-sh-kicker">{esc(pg["kicker"])}</span>
        <h1>{esc(pg["h1"])}</h1>
        <div class="wl-hub-intro">{intro}</div>
      </div>
    </section>
<!-- wl:start-here:start -->
{routes_html(sec, pages)}
<!-- wl:start-here:end -->
    <section class="wl-hub-questions">
      <div class="wl-hub-inner">
        <h2>Common questions</h2>
        {q_block}
      </div>
    </section>
    <section class="wl-hub-all">
      <div class="wl-hub-inner">
        <h2>Everything in {esc(sec["label"])}</h2>
        {"".join(groups)}
      </div>
    </section>
{goals_html(cfg, sec["id"], "Other sections")}
    <p class="wl-hub-disclaimer">Educational content only, not personalized investment, tax, legal, or insurance advice. Rules and figures come from the sources linked on each page and can change.</p>
  </main>
  <wealthlanding-footer></wealthlanding-footer>
  <script src="/components/footer.js"></script>
  <script src="/components/header.js"></script>
</body>
</html>
"""
    return head + body


# ---------------------------------------------------------------- build

def write(rel, new, old, stale, check):
    if new != old:
        stale.append(rel)
        if not check:
            path = ROOT / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(new, encoding="utf-8")


def build(check=False, guide_pages=()):
    cfg = json.loads(SITEMAP_JSON.read_text(encoding="utf-8"))
    stale = []

    # 1. generated hub pages (two passes so the hubs can list each other)
    pages = list_pages(cfg)
    for sec in cfg["sections"]:
        if sec.get("page"):
            rel = sec["page"]["path"]
            if rel not in pages:
                pages[rel] = Page(rel, "<title>" + esc(sec["page"]["title"]) + "</title>")
    for sec in cfg["sections"]:
        if sec.get("page"):
            rel = sec["page"]["path"]
            old = (ROOT / rel).read_text(encoding="utf-8") if (ROOT / rel).exists() else ""
            new = hub_page_html(sec, cfg, pages)
            pages[rel] = Page(rel, new)
            # footer links are applied below like any page
            pages[rel]._generated = (new, old)

    # 2. Plan by age (45-65) pages from components/life-stages/stages.json
    import life_stages
    ls_pages = life_stages.generate(pages, rel_for, link_label)
    for rel, new in ls_pages.items():
        old = (ROOT / rel).read_text(encoding="utf-8") if (ROOT / rel).exists() else ""
        pages[rel] = Page(rel, new)
        pages[rel]._generated = (new, old)
    ls_backlinks = {rel_for(h): block for h, block in life_stages.backlinks().items()}

    hubs = hub_urls(cfg) | {url_for(r) for r in ls_pages}
    footer_block = footer_links_html(cfg)
    no_bc = cfg["no_breadcrumb"]
    sec_by_hub = {s["hub"]: s for s in cfg["sections"]}

    for rel, page in pages.items():
        generated = getattr(page, "_generated", None)
        old = generated[1] if generated else page.text
        text = generated[0] if generated else page.text
        if page.redirect:
            write(rel, text, old, stale, check)
            continue
        text = apply_footer_links(text, footer_block)
        if rel.startswith("_layouts/"):
            write(rel, text, old, stale, check)
            continue
        is_hub = page.url in hubs
        skip_bc = any(rel == x or (x.endswith("/") and rel.startswith(x)) for x in no_bc)
        if page.layout:
            fm, end = front_matter(text)
            head, body = text[:end], text[end:]
            trail = None if skip_bc else trail_for(page, cfg, pages)
            if trail:
                body = remove_block(body, "breadcrumb")
                body = "\n<!-- wl:breadcrumb:start -->\n" + breadcrumb_html(trail) + "\n<!-- wl:breadcrumb:end -->" + body
            else:
                body = re.sub(r"\n?<!-- wl:breadcrumb:start -->.*?<!-- wl:breadcrumb:end -->", "", body, count=1, flags=re.S)
            ns = None if is_hub else next_steps_html(page, cfg, pages)
            if ns:
                body = remove_block(body, "next-steps").rstrip("\n") + "\n<!-- wl:next-steps:start -->\n" + ns + "\n<!-- wl:next-steps:end -->\n"
            else:
                body = remove_block(body, "next-steps")
            body = remove_block(body, "life-stage")
            if rel in ls_backlinks:
                blk = "<!-- wl:life-stage:start -->\n" + ls_backlinks[rel] + "\n<!-- wl:life-stage:end -->\n"
                i = body.find("<!-- wl:next-steps:start -->")
                body = body[:i] + blk + body[i:] if i >= 0 else body.rstrip("\n") + "\n" + blk
            text = head + body
            write(rel, text, old, stale, check)
            continue
        trail = None if skip_bc else trail_for(page, cfg, pages)
        if trail:
            t = replace_block(text, "breadcrumb", breadcrumb_html(trail), [r'<div id="global-header-target"></div>'], after=True)
            text = t or text
        else:
            text = remove_block(text, "breadcrumb")
        if rel in ls_backlinks and not page.noindex:
            t = replace_block(text, "life-stage", ls_backlinks[rel], [r"<!-- wl:next-steps:start -->", r"<!-- wl:tool-guide:start -->", r"<wealthlanding-footer"])
            text = t or text
        else:
            text = remove_block(text, "life-stage")
        ns = None
        if not is_hub and rel not in guide_pages and not skip_bc:
            ns = next_steps_html(page, cfg, pages)
        if ns:
            t = replace_block(text, "next-steps", ns, [r"<wealthlanding-footer"])
            text = t or text
        else:
            text = remove_block(text, "next-steps")
        # section routes on existing hub pages
        if rel == "index.html":
            t = replace_block(text, "start-here", start_here_html(cfg, pages), [r'<!-- wl:age-journey:start -->', r'<section id="life-stages-explorer"'])
            text = t or text
            t = replace_block(text, "age-journey", life_stages.homepage_block(), [r'<section id="life-stages-explorer"'])
            text = t or text
        elif page.url in sec_by_hub and not generated:
            sec = sec_by_hub[page.url]
            if sec["id"] == "tools":
                t = replace_block(text, "start-here", goals_html(cfg, "tools", "Tools and guides by goal"), [r"<wealthlanding-footer"])
            else:
                t = replace_block(text, "start-here", routes_html(sec, pages), [r"</section>"], after=True)
            text = t or text
        elif rel in ("learn/index.html", "blogs/index.html"):
            t = replace_block(text, "start-here", goals_html(cfg, None, "Or browse by goal"), [r"</section>"], after=True)
            text = t or text
        write(rel, text, old, stale, check)

    # header nav + fallback
    nav_rel = "components/header-nav.html"
    old = (ROOT / nav_rel).read_text(encoding="utf-8")
    write(nav_rel, nav_html(cfg), old, stale, check)
    js_rel = "components/header.js"
    old = (ROOT / js_rel).read_text(encoding="utf-8")
    new = re.sub(r"(/\* wl:nav-fallback:start \*/\n).*?(\n\s*/\* wl:nav-fallback:end \*/)",
                 lambda m: m.group(1) + nav_fallback_js(cfg) + m.group(2), old, flags=re.S)
    write(js_rel, new, old, stale, check)
    js_rel = "components/footer.js"
    old = (ROOT / js_rel).read_text(encoding="utf-8")
    new = re.sub(r"(/\* wl:footer-links:start \*/\n).*?(\n\s*/\* wl:footer-links:end \*/)",
                 lambda m: m.group(1) + "const WL_FOOTER_LINKS = " + json.dumps(footer_block, ensure_ascii=False) + ";" + m.group(2), old, flags=re.S)
    write(js_rel, new, old, stale, check)
    return stale
