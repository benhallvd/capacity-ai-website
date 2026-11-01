#!/usr/bin/env python3
"""Keep the site's copy in one editable file, site-copy.md.

    python3 tools/copy/copy.py extract   write site-copy.md from the pages
    python3 tools/copy/copy.py apply     write edits in site-copy.md to the pages

Each line in site-copy.md ends in an id, in a comment that a Markdown preview
hides. apply finds that string in the pages by id, swaps in the edited text and
re-extracts, because a changed string gets a new id. Nothing else in the HTML is
touched, so an apply with no edits changes no files.

Coded product mockups are left out: their names and numbers are demo data, not
copy. So are the legal pages, which are checked separately, and the brand page.
Strings used across most pages (nav, footer, the main button) are listed once
under Shared and change everywhere at once.
"""

import hashlib
import html
import pathlib
import re
import sys
from collections import Counter, defaultdict
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "site-copy.md"

PAGES = {
    "index": "Home",
    "ticketing": "Ticketing", "enquiries": "Enquiries", "profiles": "Customer profiles",
    "whatsapp": "WhatsApp", "social": "Social media", "forms": "Forms and WiFi",
    "analytics": "Website", "till": "Till", "reports": "Reports", "files": "Files",
    "intelligence": "Capacity Intelligence",
    "nightclubs": "Nightclubs", "bars": "Bars", "competitive-socialising": "Competitive socialising",
    "festivals": "Festivals", "promoters": "Promoters",
    "integrations": "Integrations", "discovery": "Book an audit", "hiring": "Careers",
    "waitlist": "Waitlist", "404": "404",
}
SHARED_FROM = 5  # a string on this many pages or more is listed once

VOID = {"img", "br", "input", "meta", "link", "hr", "area", "base", "col", "embed", "source", "track", "wbr"}
SKIP_TAGS = {"head", "script", "style", "svg", "noscript", "template", "select", "option", "textarea"}
KEEP_INLINE = {"b", "strong", "em", "i", "br"}
# Coded product UI and labels on photos. Anything inside these is demo data.
MOCKUP = re.compile(r"^(ui|ui-.*|tx|tx-.*|bx-.*|bt__vis.*|st3d.*|tag|dm|dm-.*|hw__card|hw__panel|hw__stage|fq-.*|fa-.*|ft-.*"
                    r"|fw-.*|fs-.*|ff-.*|fl-.*|fr-.*|fi-.*|fp-.*|xb-.*|xc-.*|xf-.*|xp-.*|nx-.*|px-.*|fx-.*|phero__visual.*"
                    r"|nclub-.*|chg__over|chg__ui.*|flip.*|ly__map|ticker.*|brand-tile|logo.*|pf__big.*|istack|icard__ic)$")

TYPOGRAPHY = {"’": "&rsquo;", "‘": "&lsquo;", "“": "&ldquo;", "”": "&rdquo;", "£": "&pound;",
              "·": "&middot;", "×": "&times;", "ä": "&auml;", "é": "&eacute;", " ": "&nbsp;"}


class Node:
    def __init__(self, tag, attrs, parent, start, inner):
        self.tag, self.parent, self.start, self.inner = tag, parent, start, inner
        self.attrs = dict(attrs)
        self.classes = (self.attrs.get("class") or "").split()
        self.kids = []
        self.end = None

    def is_mockup(self):
        return self.tag in SKIP_TAGS or any(MOCKUP.match(c) for c in self.classes) or self.attrs.get("aria-hidden") == "true"


class Text:
    def __init__(self, start, end, raw):
        self.start, self.end, self.raw = start, end, raw


class Tree(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=False)
        self.source = source
        self.lines = [0]
        for m in re.finditer("\n", source):
            self.lines.append(m.end())
        self.root = Node("root", [], None, 0, 0)
        self.at = self.root
        self.feed(source)

    def here(self):
        line, col = self.getpos()
        return self.lines[line - 1] + col

    def handle_starttag(self, tag, attrs):
        start = self.here()
        node = Node(tag, attrs, self.at, start, start + len(self.get_starttag_text()))
        self.at.kids.append(node)
        if tag in VOID:
            node.end = node.inner
        else:
            self.at = node

    def handle_startendtag(self, tag, attrs):
        start = self.here()
        node = Node(tag, attrs, self.at, start, start + len(self.get_starttag_text()))
        node.end = node.inner
        self.at.kids.append(node)

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        n = self.at
        while n is not self.root and n.tag != tag:
            n = n.parent
        if n is self.root:
            return
        start = self.here()
        n.end = self.source.index(">", start) + 1
        self.at = n.parent

    def _text(self, raw):
        start = self.here()
        self.at.kids.append(Text(start, start + len(raw), raw))

    def handle_data(self, data):
        self._text(data)

    def handle_entityref(self, name):
        self._text(f"&{name};")

    def handle_charref(self, name):
        self._text(f"&#{name};")


class Entry:
    def __init__(self, page, kind, section, source, spans, chrome):
        self.page, self.kind, self.section, self.source, self.spans = page, kind, section, source, spans
        self.chrome = chrome
        self.text, self.keeps = display(source)
        self.id = ""


def display(source):
    """Turn a slice of HTML into editable text, with anything structural held
    back as {keep1} so it can't be broken by an edit."""
    keeps = []

    def keep(m):
        keeps.append(m.group(0))
        return "{keep%d}" % len(keeps)

    text = re.sub(r"<span\b[^>]*data-rot.*?</span>\s*</span>", keep, source, flags=re.S)
    text = re.sub(r"\s*<br\s*/?>\s*", " / ", text)
    text = re.sub(r"</?(?!b>|/b>|strong>|/strong>|em>|/em>|i>|/i>)[a-zA-Z][^>]*>", keep, text)
    text = re.sub(r"\s+", " ", html.unescape(text)).strip()
    return text, keeps


def encode(text, keeps):
    text = text.replace(" / ", " <br />")
    text = re.sub(r"(?<=\w)'(?=\w)|(?<=s)'(?=\s)", "’", text)
    text = re.sub(r"&(?![a-zA-Z#][a-zA-Z0-9]*;)", "&amp;", text)
    for char, entity in TYPOGRAPHY.items():
        text = text.replace(char, entity)
    for i, kept in enumerate(keeps, 1):
        text = text.replace("{keep%d}" % i, kept)
    return text


def collect(page, source):
    tree = Tree(source)
    found = []

    def label(node):
        if node.tag in ("h1", "h2", "h3", "h4"):
            return node.tag.upper()
        if node.tag == "p":
            return "Text"
        if node.tag == "summary" or "qa__q" in node.classes:
            return "FAQ question"
        if node.tag == "label":
            return "Field label"
        if node.tag == "button" or "btn" in node.classes:
            return "Button"
        if node.tag == "a":
            return "Link"
        return "Label"

    def rolling(node, section, chrome):
        """The hero's rolling words sit in an attribute inside the heading."""
        for kid in node.kids:
            if isinstance(kid, Node):
                if "data-rot" in kid.attrs:
                    raw = kid.attrs["data-rot"]
                    at = source.index(raw, kid.start, kid.inner)
                    found.append(Entry(page, "Rolling words", section, raw, [(at, at + len(raw))], chrome))
                rolling(kid, section, chrome)

    def walk(node, section, chrome):
        for kid in node.kids:
            if not isinstance(kid, Node) or kid.is_mockup():
                continue
            here = chrome or kid.tag in ("nav", "footer") or any(c == "nav" or c.startswith(("nav__", "footer")) for c in kid.classes)
            if kid.tag in ("section", "header", "footer", "main"):
                section = {"name": None}
            direct = [k for k in kid.kids if isinstance(k, Text) and k.raw.strip()]
            if direct:
                inner = [k for k in kid.kids if isinstance(k, Text) and k.raw.strip()
                         or isinstance(k, Node) and k.tag not in SKIP_TAGS and k.tag != "br"]
                first, last = inner[0], inner[-1]
                start = first.start + (len(first.raw) - len(first.raw.lstrip()) if isinstance(first, Text) else 0)
                end = last.end - (len(last.raw) - len(last.raw.rstrip()) if isinstance(last, Text) else 0)
                raw = source[start:end]
                entry = Entry(page, label(kid), section, raw, [(start, end)], here)
                if entry.text and re.search(r"[A-Za-z]", entry.text):
                    if section.get("name") is None and kid.tag in ("h1", "h2") and not here:
                        section["name"] = entry.text.replace(" / ", " ")
                    found.append(entry)
                rolling(kid, section, here)
                continue
            walk(kid, section, here)

    walk(tree.root, {"name": None}, False)

    for name, kind in (("title", "Page title"), ("description", "Search description")):
        if name == "title":
            m = re.search(r"<title>(.*?)</title>", source, re.S)
        else:
            m = re.search(r'<meta name="description" content="(.*?)"', source, re.S)
        if m:
            value = m.group(1)
            spans = [(x.start(), x.end()) for x in re.finditer(re.escape(value), source)]
            found.insert(0, Entry(page, kind, {"name": "Search and sharing"}, value, spans, False))
    return found


def load():
    entries = []
    for page in PAGES:
        path = ROOT / f"{page}.html"
        entries += collect(page, path.read_text())
    on_pages = defaultdict(set)
    for e in entries:
        on_pages[e.text].add(e.page)
    for e in entries:
        e.shared = e.chrome or len(on_pages[e.text]) >= SHARED_FROM
    seen = Counter()
    for e in entries:
        key = e.text if e.shared else f"{e.page}|{e.kind}|{e.text}"
        if not e.shared:
            seen[key] += 1
            key += f"|{seen[key]}"
        e.id = "c-" + hashlib.sha256(key.encode()).hexdigest()[:8]
    return entries


HEADER = """# Capacity website copy

Edit the text on any line, leave everything else alone, then ask Claude to sync
it (or run `python3 tools/copy/copy.py apply`). Delete nothing: to drop a line
from a page, say so and it will be taken out of the page itself.

- ` / ` is a forced line break in a heading.
- `<b>` keeps text bold. `{keep1}` holds something that isn't text, such as the
  rolling word in the home heading, so leave it where it is.
- Rolling words are split with `|`.
- Heroes and closing lines show in capitals on the site whatever you type here,
  so write them in sentence case.
- Shared lines are used across the site and change on every page at once.
- Not in here: names and numbers inside product mockups, the legal pages and the
  brand page.
"""


def extract():
    entries = load()
    lines = [HEADER, "## Shared", ""]
    done = set()
    for e in entries:
        if e.shared and e.id not in done:
            done.add(e.id)
            lines.append(f"- **{e.kind}:** {e.text} <!-- {e.id} -->")
    for page, name in PAGES.items():
        lines += ["", f"## {name}", f"`{page}.html`"]
        section = None
        for e in entries:
            if e.page != page or e.shared:
                continue
            title = e.section.get("name") or "Other"
            if title != section:
                section = title
                lines += ["", f"### {section}", ""]
            lines.append(f"- **{e.kind}:** {e.text} <!-- {e.id} -->")
    OUT.write_text("\n".join(lines) + "\n")
    print(f"{OUT.name}: {len(done)} shared, {len(entries)} strings across {len(PAGES)} pages")


LINE = re.compile(r"^- \*\*[^*]+:\*\* (.*) <!-- (c-[0-9a-f]{8}) -->$")


def apply():
    edited = {}
    for line in OUT.read_text().splitlines():
        m = LINE.match(line)
        if m:
            edited[m.group(2)] = m.group(1).strip()

    entries = load()
    known = {e.id for e in entries}
    missing = sorted(set(edited) - known)
    if missing:
        print(f"{len(missing)} line(s) no longer match the pages, so nothing was changed. "
              "Save your edits, re-run extract, then copy them back in:")
        print("  " + ", ".join(missing))
        return 1

    problems = [t for t in edited.values() if "—" in t or "–" in t]
    if problems:
        print("Dashes aren't used in site copy. Rewrite these first:")
        for t in problems:
            print("  " + t)
        return 1

    changes = defaultdict(list)
    summary = []
    for e in entries:
        new = edited.get(e.id)
        if new is None or new == e.text:
            continue
        if sorted(re.findall(r"\{keep\d+\}", new)) != sorted(re.findall(r"\{keep\d+\}", e.text)):
            print(f"A {{keep}} marker was changed on: {e.text}")
            return 1
        value = new if e.kind == "Rolling words" else encode(new, e.keeps)
        if e.kind in ("Page title", "Search description"):
            value = value.replace('"', "&quot;")
        for start, end in e.spans:
            changes[e.page].append((start, end, value))
        summary.append((e.page, e.text, new))

    for page, edits in changes.items():
        path = ROOT / f"{page}.html"
        source = path.read_text()
        for start, end, value in sorted(set(edits), reverse=True):
            source = source[:start] + value + source[end:]
        path.write_text(source)

    for page, old, new in summary:
        print(f"{page}: {old}\n  -> {new}")
    print(f"{len(summary)} string(s) changed on {len(changes)} page(s)" if summary else "no edits found")
    extract()
    return 0


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "extract":
        sys.exit(extract())
    if command == "apply":
        sys.exit(apply())
    print(__doc__)
    sys.exit(2)
