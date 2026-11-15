"""FAQ markup for search engines, written from each page's own FAQ accordion.

    python3 tools/seo/faqld.py

Reads every <details class="qa"> on a page and writes (or rewrites) one
FAQPage JSON-LD block in the head, marked data-faq, so the
questions people can read and the ones machines read never drift apart.
Pages that already carry a hand-written FAQPage block (faq.html, the
comparison pages) are left alone.
"""
from __future__ import annotations

import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
QA = re.compile(r'<summary class="qa__q">(.*?)<svg.*?</summary>\s*<div class="qa__a"><div class="qa__inner">(.*?)</div></div>', re.S)
TAG = re.compile(r"<[^>]+>")
MARK = re.compile(r'<script type="application/ld\+json" data-faq>.*?</script>\n?', re.S)


def clean(s: str) -> str:
    return html.unescape(TAG.sub("", s)).replace("’", "'").strip()


def main():
    pages = sorted(ROOT.glob("*.html"))
    for p in pages:
        t = p.read_text()
        if "<details class=\"qa\"" not in t:
            continue
        if '"FAQPage"' in MARK.sub("", t):
            continue
        qas = [(clean(q), clean(a)) for q, a in QA.findall(t)]
        if not qas:
            continue
        ld = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in qas]}
        block = f'<script type="application/ld+json" data-faq>{json.dumps(ld, ensure_ascii=False)}</script>\n'
        t = MARK.sub("", t, count=1)
        t = t.replace("</head>", block + "</head>", 1)
        p.write_text(t)
        print(p.name, len(qas))


if __name__ == "__main__":
    main()
