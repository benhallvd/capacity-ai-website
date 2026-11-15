"""Proof, spread across the site: one cleared result per page, each in a
different shape, and the venue logo row on the industry pages.

    python3 tools/seo/proof.py

Idempotent: each block carries data-proof="strip" or "tick" and is replaced
in place on rerun. The numbers are the three Ben cleared (see the home
Results section); no quotes, because none are signed off.
"""
from __future__ import annotations

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools" / "compare"))
from build import PROOF, VENUES, proof_card  # noqa: E402

ARROW = '<svg class="ic" aria-hidden="true"><use href="#i-arrow-right"/></svg>'


def strip(key: str, theme: str) -> str:
    return f'''<section class="band {theme} nx-tight" data-proof="strip">
  <div class="wrap">
    {proof_card("", key)}
  </div>
</section>
'''


def tick(theme: str) -> str:
    li = "".join(f'<li><img src="assets/clients/{f}" alt="{n}" loading="lazy" /></li>' for f, n in VENUES)
    return f'''<section class="band {theme} nx-tick" data-proof="tick" aria-label="Venues running on Capacity">
  <p class="nx-tick__k" data-r>Running in <b>24 venues</b> across the UK</p>
  <div class="vt__row nx-tick__row" data-r style="--rd:1"><ul class="vt__track">{li}</ul><ul class="vt__track" aria-hidden="true">{li}</ul></div>
</section>
'''


# page: (result key, before-this-anchor) for the strip, plus whether the
# venue row goes in after the dashboard band.
PLAN = {
    "ticketing": ("ebc", '<section class="band on-light nx-photo"', False),
    "enquiries": ("fritz", '<section class="band on-light nx-photo"', False),
    "forms": ("botanic2", '<section class="band on-light nx-photo"', False),
    "nightclubs": ("botanic", '<section class="band on-light fgrid-band">', True),
    "bars": ("fritz", '<section class="band on-light fgrid-band">', True),
    "competitive-socialising": (None, None, True),
    "festivals": ("ebc2", '<section class="band on-light fgrid-band">', True),
    "promoters": ("ebc", '<section class="band on-light fgrid-band">', True),
}


def put(text: str, kind: str, block: str, anchor: str) -> str:
    marked = re.compile(rf'<section[^>]*data-proof="{kind}".*?</section>\n?', re.S)
    text = marked.sub("", text, count=1)
    i = text.index(anchor)
    return text[:i] + block + "\n" + text[i:]


DASH = re.compile(r'<section class="band on-light nclub-dash">.*?</section>\n', re.S)


def put_tick(text: str) -> str:
    """The venue row goes straight after the dashboard band under the hero."""
    text = re.sub(r'<section[^>]*data-proof="tick".*?</section>\n?', "", text, count=1, flags=re.S)
    at = DASH.search(text).end()
    return text[:at] + tick("on-light") + text[at:]


def main():
    for slug, (key, anchor, row) in PLAN.items():
        p = ROOT / f"{slug}.html"
        t = p.read_text()
        if key:
            t = put(t, "strip", strip(key, "on-light"), anchor)
        if row:
            t = put_tick(t)
        p.write_text(t)
        print(slug, "ok")


if __name__ == "__main__":
    main()
