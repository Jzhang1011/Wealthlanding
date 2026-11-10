#!/usr/bin/env python3
"""Arithmetic and link checks for the fictional Two Acres real-estate story."""
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "blogs/real_estate/two-acres-two-lots.example.json"
HTML = ROOT / "blogs/real_estate/two-acres-two-lots.html"
GUIDE = ROOT / "real-estate/property-potential.html"
ARCHIVE = ROOT / "blogs/real_estate/archive.json"
HUB = ROOT / "blogs/real_estate.html"
SITEMAP = ROOT / "sitemap.xml"

d = json.loads(DATA.read_text(encoding="utf-8"))
assert d["tax_treatment"] == "pretax"
m, h = d["mara"], d["helen"]
comp = d["comparable_one_lot_house"]

dil_m = sum(m["diligence"].values())
sell = int(round(m["lot_sale_gross"] * m["selling_expense_rate"]))
lot_cash = m["lot_sale_gross"] - sell - m["partial_release_fee"]
incremental = dil_m + m["carry_taxes_insurance_9_months"]
mara_net = -m["purchase_price"] - incremental + lot_cash + m["remaining_home_value"] + comp - comp
# Explicit expansion used in the article
assert dil_m == 10_000
assert sell == 10_150
assert lot_cash == 133_650
assert incremental == 13_600
assert m["premium_vs_comparable"] == m["purchase_price"] - comp
assert mara_net == 30_050, mara_net
# Residual-value loss must be in the model (not ignored)
assert m["remaining_home_value"] < comp
# Paydown is recorded but must not be subtracted from net worth
assert m["partial_release_principal_paydown"] == 40_000
assert mara_net == -m["purchase_price"] - incremental + lot_cash + m["remaining_home_value"]

dil_h = sum(h["diligence"].values())
assert dil_h == 11_300
assert h["walked_away"] is True
assert h["premium_vs_comparable"] == h["intended_purchase_price"] - comp

article = HTML.read_text(encoding="utf-8")
guide = GUIDE.read_text(encoding="utf-8")
# Fictional labeling and key totals appear in the article
assert "Fictional" in article or "fictional" in article
assert "$30,050" in article
assert "$11,300" in article
assert "$133,650" in article
assert "pretax" in article.lower()
# Do not automatically apply §121 to the vacant parcel
assert "do not apply §121 to the vacant parcel" in article.lower() or "We do not apply §121 to the vacant parcel" in article
assert "Publication 523" in article
# Reciprocal links
assert "/real-estate/property-potential.html" in article
assert "/blogs/real_estate/two-acres-two-lots.html" in guide
assert "Two Acres Looked the Same" in guide
# Verified official sources
for url in (
    "https://www.irs.gov/publications/p523",
    "https://msc.fema.gov/portal/home",
    "https://www.fema.gov/flood-maps",
    "https://www.epa.gov/cwa-404/permit-program-under-cwa-section-404",
    "https://www.consumerfinance.gov/owning-a-home/",
):
    assert url in article, url
    # Host is official
    host = urlparse(url).hostname or ""
    assert host.endswith(".gov") or host.endswith(".mil"), host

# Conceptual illustration disclaimer
assert "not a survey or zoning plan" in article.lower()
assert "Mara Ellison" in article and "Helen Cho" in article
assert "Bill Left" not in article  # do not alter or reuse the Bill story

# Archive, hub, sitemap, blog index
arch = json.loads(ARCHIVE.read_text(encoding="utf-8"))
assert any(p["id"] == "two-acres-two-lots" for p in arch["posts"])
assert "two-acres-two-lots.html" in HUB.read_text(encoding="utf-8")
assert "two-acres-two-lots.html" in SITEMAP.read_text(encoding="utf-8")
assert "two-acres-two-lots.html" in (ROOT / "blogs/index.html").read_text(encoding="utf-8")

# Existing relative links in the article resolve on disk
for href in re.findall(r'href="(/[^"]+)"', article):
    if href.startswith("/#"):
        continue
    rel = href.lstrip("/")
    if rel.endswith("/"):
        ok = (ROOT / rel / "index.html").exists() or (ROOT / rel.rstrip("/")).exists()
    else:
        ok = (ROOT / rel).exists() or (ROOT / rel / "index.html").exists()
    assert ok, f"broken internal link {href}"

print(f"OK: Mara pretax net ${mara_net:,} vs comparable; Helen diligence ${dil_h:,}; sources and reciprocal links present")
