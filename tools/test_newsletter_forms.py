#!/usr/bin/env python3
"""Check shared Kit newsletter markup and that leftover embed scripts are gone."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KIT_ACTION = "https://app.kit.com/forms/9874203/subscriptions"
KIT_ID = "9874203"
WORKER = "https://api.wealthlanding.com/api/subscribe"
DEAD_EMBED = "https://wealthlanding.kit.com/2b35717445/index.js"
CK5 = "https://f.convertkit.com/ckjs/ck.5.js"


def main() -> int:
    errors: list[str] = []
    footer = (ROOT / "components/footer.js").read_text(encoding="utf-8")
    if KIT_ACTION not in footer:
        errors.append("footer.js missing Kit form action")
    if f'data-wl-kit-form="{KIT_ID}"' not in footer and f"9874203" not in footer:
        errors.append("footer.js missing Kit form id 9874203")
    if 'name="email_address"' not in footer:
        errors.append("footer.js missing email_address input")
    if 'type="email"' not in footer:
        errors.append("footer.js missing type=email")
    if "required" not in footer:
        errors.append("footer.js missing required on email input")
    if 'type="submit"' not in footer or "Subscribe" not in footer:
        errors.append("footer.js missing Subscribe submit button")
    if 'method="post"' not in footer.lower():
        errors.append("footer.js form is not method=post")
    if WORKER not in footer:
        errors.append("footer.js missing worker subscribe URL")
    if "useNativeFallback" not in footer and "form.submit()" not in footer:
        errors.append("footer.js missing native Kit form fallback")
    if "formkit-form" in footer:
        errors.append("footer.js still uses formkit-form class (ck.5.js can hijack it)")
    if CK5 in footer:
        errors.append("footer.js should not load ck.5.js")

    offers = json.loads((ROOT / "components/monetization/offers.json").read_text())
    if offers.get("kitFormAction") != KIT_ACTION:
        errors.append(f"offers.json kitFormAction is {offers.get('kitFormAction')}")
    if str(offers.get("kitFormId")) != KIT_ID:
        errors.append(f"offers.json kitFormId is {offers.get('kitFormId')}")

    mon = (ROOT / "components/monetization/monetize.js").read_text(encoding="utf-8")
    if KIT_ACTION not in mon or WORKER not in mon:
        errors.append("monetize.js missing Kit action or worker subscribe URL")
    if "coming soon" in mon.lower():
        errors.append("monetize.js still has a coming-soon stub")

    leftover = []
    for p in ROOT.rglob("*"):
        if not p.is_file() or ".git" in p.parts or p.suffix in {".png", ".jpg", ".webp", ".ico", ".svg", ".woff", ".woff2"}:
            continue
        if p.name.startswith("test_") and "tools" in p.parts:
            continue
        try:
            text = p.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        rel = str(p.relative_to(ROOT))
        if CK5 in text:
            leftover.append(f"ck.5.js still referenced in {rel}")
        if DEAD_EMBED in text:
            leftover.append(f"404 Kit embed still referenced in {rel}")
    errors.extend(leftover)

    if errors:
        print("FAIL: newsletter form checks:")
        for e in errors:
            print("  -", e)
        return 1
    print("OK: footer/offers/monetize Kit form 9874203 markup present; leftover ck.5.js and 404 embed gone")
    return 0


if __name__ == "__main__":
    sys.exit(main())
