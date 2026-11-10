#!/usr/bin/env python3
"""Validate Real Estate binary flow destinations, SVG extents, and mobile layout."""
import json
import re
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import site_structure as ss  # noqa: E402

cfg = json.loads((ROOT / "components/site-map/site-map.json").read_text(encoding="utf-8"))
sec = next(s for s in cfg["sections"] if s["id"] == "real-estate")
assert "flow" in sec
pages = ss.list_pages(cfg)

hrefs = []
questions = []


def walk(n):
    if "q" in n:
        questions.append(n["q"])
        assert "yes" in n and "no" in n
        walk(n["yes"])
        walk(n["no"])
    else:
        assert n.get("href"), n
        hrefs.append(n["href"])


walk(sec["flow"]["root"])
missing = []
for h in hrefs + [i["href"] for i in sec["flow"].get("secondary", [])]:
    rel = ss.rel_for(h)
    if rel not in pages and not (ROOT / rel).exists():
        missing.append(h)

html = ss.flow_html(sec, pages)
assert "wl-flow-svg" in html
assert "marker-end" in html
assert "Yes" in html and "No" in html
assert "wl-flow-fallback" in html
assert "wl-flow-mobile" in html and "wl-mtree" in html
assert "wl-flow-desktop" in html
assert "wl-flow-scroll-hint" not in html
assert not missing, missing
assert len(questions) >= 3
assert len(hrefs) >= 4

# Every painted node and Yes/No pill must sit inside the viewBox (with padding).
viewbox, node_boxes, edge_boxes = ss.flow_svg_boxes(sec["flow"]["root"])
vx, vy, vw, vh = viewbox
vr, vb = vx + vw, vy + vh
assert vx == 0 and vy == 0, viewbox
assert vw > 0 and vh > 0

PAD = ss.FLOW_PAD
for left, top, right, bottom, nid in node_boxes:
    assert left >= vx, (nid, left, viewbox)
    assert top >= vy, (nid, top, viewbox)
    assert right <= vr, (nid, right, viewbox)
    assert bottom <= vb, (nid, bottom, viewbox)
    # layout also keeps padding so branches are not flush with the crop
    assert left >= vx + PAD - 0.5, (nid, "left padding", left, PAD)
    assert right <= vr - PAD + 0.5, (nid, "right padding", right, PAD)

for left, top, right, bottom, label in edge_boxes:
    assert left >= vx and right <= vr and top >= vy and bottom <= vb, (label, (left, top, right, bottom), viewbox)

# The emitted SVG viewBox and <rect> attributes must agree with the layout boxes.
svg_m = re.search(r'<svg class="wl-flow-svg" viewBox="([^"]+)"', html)
assert svg_m, "missing svg viewBox"
nums = [float(x) for x in svg_m.group(1).split()]
assert nums == [vx, vy, vw, vh] or (
    nums[0] == vx and nums[1] == vy and abs(nums[2] - vw) < 1 and abs(nums[3] - vh) < 1
), (nums, viewbox)

svg_xml = re.search(r'<svg class="wl-flow-svg".*</svg>', html, re.S).group(0)
# Namespace-safe parse
svg_xml = svg_xml.replace('xmlns="http://www.w3.org/2000/svg"', "")
tree = ET.fromstring(svg_xml)
rects = list(tree.iter("rect"))
assert len(rects) >= len(node_boxes) + len(edge_boxes)
for rect in rects:
    x, y = float(rect.get("x")), float(rect.get("y"))
    w, h = float(rect.get("width")), float(rect.get("height"))
    # stroke can extend a couple of px; viewBox must still contain the fill box
    assert x >= vx - 0.01 and y >= vy - 0.01, (x, y, viewbox)
    assert x + w <= vr + 0.01 and y + h <= vb + 0.01, (x, y, w, h, viewbox)

# Mobile tree lists the same clickable outcomes (not a scaled wide SVG).
assert '<div class="wl-flow-mobile">' in html
# Question and outcome counts on the stacked tree (class names are unique to it).
assert html.count("wl-mtree-q") == len(questions)
assert html.count("wl-mtree-out") == len(hrefs)
# The mobile tree itself must not embed the desktop SVG.
mobile_start = html.index('<div class="wl-flow-mobile">')
mobile_svg = html.find("wl-flow-svg", mobile_start)
desktop_svg = html.find("wl-flow-svg")
assert desktop_svg != -1 and desktop_svg < mobile_start
assert mobile_svg == -1 or mobile_svg < mobile_start
for h in hrefs:
    assert h in html[mobile_start:], h

# CSS: narrow viewports hide the desktop SVG and do not force a wide min-width canvas.
css = (ROOT / "components/site-map/site-blocks.css").read_text(encoding="utf-8")
assert "min-width: 48rem" not in css
assert "min-width: 56rem" not in css
# Isolate the narrow-viewport flow rules (brace-aware) and confirm layout.
mq = re.search(r"@media \(max-width: 800px\) \{((?:[^{}]|\{[^{}]*\})*)\}", css, re.S)
assert mq, "missing max-width 800px flow rules"
block = re.sub(r"\s+", " ", mq.group(1))
assert ".wl-flow-desktop { display: none; }" in block
assert ".wl-flow-mobile { display: block; }" in block
assert "min-width: 0" in block
assert "overflow: visible" in block

# Header/logo decorative mark should not use the post-IA gold accent.
header_css = (ROOT / "components/header.css").read_text(encoding="utf-8")
assert "#fbbf24" not in header_css
assert "#b45309" not in header_css
favicon = (ROOT / "favicon.svg").read_text(encoding="utf-8")
assert "#fbbf24" not in favicon
assert "#4ade80" in favicon

print(
    f"OK: {len(questions)} questions, {len(hrefs)} outcomes, "
    f"viewBox={int(vw)}x{int(vh)}, {len(node_boxes)} nodes inside padded canvas, mobile tree present"
)
