#!/usr/bin/env python3
"""Rewrite the ?v= cache-busting hashes on local CSS/JS references.

Vercel serves site.css and site.js as immutable for a year (vercel.json), so a
stale reference would pin a visitor to the previous build. The hash is the first
ten hex characters of the file's SHA-256, which is what the existing markup
already carries. Run after every edit to site.css, site.js or hiring.js.
"""

import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).parent
STAMPED = ("site.css", "site.js", "tokens.css", "hiring.js")

REF = re.compile(r'((?:href|src)=")([A-Za-z0-9_.\-]+\.(?:css|js))(\?v=[0-9a-f]+)?(")')


def digest(name: str) -> str:
    return hashlib.sha256((ROOT / name).read_bytes()).hexdigest()[:10]


def main() -> int:
    hashes = {name: digest(name) for name in STAMPED if (ROOT / name).exists()}
    changed = []

    for page in sorted(ROOT.glob("*.html")):
        text = page.read_text()

        def swap(m: "re.Match[str]") -> str:
            name = m.group(2)
            if name not in hashes:
                return m.group(0)
            return f"{m.group(1)}{name}?v={hashes[name]}{m.group(4)}"

        updated = REF.sub(swap, text)
        if updated != text:
            page.write_text(updated)
            changed.append(page.name)

    for name, h in sorted(hashes.items()):
        print(f"{name} -> {h}")
    print(f"restamped {len(changed)} page(s)" if changed else "already current")
    return 0


if __name__ == "__main__":
    sys.exit(main())
