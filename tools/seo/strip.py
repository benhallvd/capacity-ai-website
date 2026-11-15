"""Strip comments from the served CSS and JS.

    python3 tools/seo/strip.py && python3 stamp.py

The site is static, so every comment in these files is public. This removes
them in place: CSS block comments, and JS line and block comments, leaving
strings, template literals and regex literals alone. Run node --check on the
JS afterwards (this script does).
"""
from __future__ import annotations

import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
CSS = ["site.css", "home-next.css", "tokens.css", "design-system.css"]
JS = ["site.js", "home-next.js", "ascii.js", "hiring.js", "design-system.js", "design-system/character.js"]

KEEP_SLASH_AFTER = set("(,=:[!&|?{};+-*%<>~^")
WORDS = ("return", "typeof", "case", "do", "else", "in", "of", "new", "delete", "void", "throw", "instanceof", "yield", "await")


def strip_css(s: str) -> str:
    out, i, n = [], 0, len(s)
    while i < n:
        c = s[i]
        if c in "\"'":
            j = i + 1
            while j < n and s[j] != c:
                j += 2 if s[j] == "\\" else 1
            out.append(s[i:j + 1]); i = j + 1
        elif s.startswith("/*", i):
            j = s.find("*/", i + 2)
            i = n if j < 0 else j + 2
        else:
            out.append(c); i += 1
    return tidy("".join(out))


def strip_js(s: str) -> str:
    out, i, n = [], 0, len(s)
    last = ""  # last meaningful non-space char, to tell / regex from division
    lastword = ""
    while i < n:
        c = s[i]
        if c in "\"'":
            j = i + 1
            while j < n and s[j] != c and s[j] != "\n":
                j += 2 if s[j] == "\\" else 1
            out.append(s[i:j + 1]); i = j + 1; last = c; lastword = ""
        elif c == "`":
            j, depth = i + 1, 0
            while j < n:
                if s[j] == "\\":
                    j += 2; continue
                if s.startswith("${", j):
                    depth += 1; j += 2; continue
                if s[j] == "}" and depth:
                    depth -= 1; j += 1; continue
                if s[j] == "`" and not depth:
                    break
                j += 1
            out.append(s[i:j + 1]); i = j + 1; last = "`"; lastword = ""
        elif s.startswith("//", i):
            j = s.find("\n", i)
            i = n if j < 0 else j
        elif s.startswith("/*", i):
            j = s.find("*/", i + 2)
            i = n if j < 0 else j + 2
        elif c == "/" and (last == "" or last in KEEP_SLASH_AFTER or lastword in WORDS):
            j, cls = i + 1, False
            while j < n and s[j] != "\n":
                if s[j] == "\\":
                    j += 2; continue
                if s[j] == "[":
                    cls = True
                elif s[j] == "]":
                    cls = False
                elif s[j] == "/" and not cls:
                    break
                j += 1
            out.append(s[i:j + 1]); i = j + 1; last = "/"; lastword = ""
        else:
            out.append(c)
            if not c.isspace():
                last = c
                if c.isalnum() or c in "_$":
                    lastword += c
                else:
                    lastword = ""
            elif lastword:
                lastword = lastword if c == " " and False else lastword  # a space ends the word below
                if c.isspace():
                    pass
            i += 1
            if c.isspace() and lastword and (i >= n or not (s[i].isalnum() or s[i] in "_$")):
                pass
    return tidy("".join(out))


def tidy(s: str) -> str:
    s = re.sub(r"[ \t]+\n", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip("\n") + "\n"


def main():
    for name in CSS:
        p = ROOT / name
        if p.exists():
            p.write_text(strip_css(p.read_text()))
            print(name, "css")
    for name in JS:
        p = ROOT / name
        if not p.exists():
            continue
        src = p.read_text()
        out = strip_js(src)
        r = subprocess.run(["node", "--check", "-"], input=out, text=True, capture_output=True)
        if r.returncode != 0:
            print(name, "FAILED node --check, left unchanged\n", r.stderr[:600])
            continue
        p.write_text(out)
        print(name, "js")


if __name__ == "__main__":
    main()
