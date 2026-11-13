#!/usr/bin/env python3
"""Every tax-advantaged-accounts post has examples, sources, a disclaimer, and a cover."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "blogs/tax_accounts/archive.json"
HUB = ROOT / "blogs/tax-advantaged-accounts.html"


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    raise SystemExit(1)


def main() -> int:
    data = json.loads(ARCHIVE.read_text(encoding="utf-8"))
    posts = data.get("posts") or []
    if len(posts) != 10:
        fail(f"expected 10 posts in archive.json, found {len(posts)}")

    meta = data.get("meta") or {}
    if not meta.get("customHub"):
        fail("archive meta.customHub must be true so the hand-built hub is not overwritten")
    if meta.get("hub") != "tax-advantaged-accounts.html":
        fail("archive meta.hub must be tax-advantaged-accounts.html")

    if not HUB.is_file():
        fail("missing hand-built hub blogs/tax-advantaged-accounts.html")
    hub = HUB.read_text(encoding="utf-8")
    for needle, label in (
        ("id=\"who-it-fits\"", "category / who-it-fits section"),
        ("id=\"compare\"", "comparison table"),
        ("id=\"catch-up\"", "catch-up section"),
        ("id=\"sources\"", "sources"),
        ("disclaimer", "disclaimer"),
        ("/asset/blog-covers/tax-advantaged-accounts.webp", "hub cover"),
        ("tax-advantaged", "tax-advantaged wording"),
    ):
        if needle not in hub.lower() and needle not in hub:
            # case-sensitive for ids/paths; case-insensitive for wording
            if needle == "tax-advantaged":
                if "tax-advantaged" not in hub.lower():
                    fail(f"hub missing {label}")
            elif needle not in hub:
                fail(f"hub missing {label}")

    # Hub should not call the whole collection "tax-free accounts"
    if re.search(r"tax-free accounts", hub, re.I):
        fail("hub should not describe the collection as 'tax-free accounts'")

    errors = []
    for post in posts:
        url = post.get("url") or ""
        rel = url.lstrip("/")
        path = ROOT / rel
        if not path.is_file():
            errors.append(f"{url}: missing file")
            continue
        text = path.read_text(encoding="utf-8")
        title = post.get("title") or url

        if 'id="examples"' not in text and 'id="worked-examples"' not in text:
            errors.append(f"{title}: missing examples section")
        if 'id="sources"' not in text and not re.search(r"<h[23][^>]*>\s*Sources", text):
            errors.append(f"{title}: missing sources")
        if "disclaimer" not in text.lower() or not re.search(r"educational", text, re.I):
            errors.append(f"{title}: missing educational disclaimer")
        cover = post.get("image") or ""
        hero = cover.replace("-card.webp", ".webp") if cover.endswith("-card.webp") else cover
        if not hero or hero not in text:
            errors.append(f"{title}: missing cover image {hero}")
        if "og:image" not in text:
            errors.append(f"{title}: missing og:image")
        if "fictional" not in text.lower():
            errors.append(f"{title}: missing fictional label")
        if "/blogs/tax-advantaged-accounts.html" not in text:
            errors.append(f"{title}: missing link to the collection hub")
        if "<!-- wl:post-tags:start -->" not in text:
            errors.append(f"{title}: missing tag markers")

        img_path = ROOT / hero.lstrip("/")
        card_path = ROOT / cover.lstrip("/")
        if not img_path.is_file():
            errors.append(f"{title}: hero file missing on disk: {hero}")
        if cover and not card_path.is_file():
            errors.append(f"{title}: card file missing on disk: {cover}")

    if errors:
        for row in errors:
            print(f"FAIL: {row}", file=sys.stderr)
        raise SystemExit(1)

    print(f"OK: hub + {len(posts)} tax-advantaged-accounts posts have examples, sources, disclaimer, and covers")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
