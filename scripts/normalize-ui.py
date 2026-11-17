#!/usr/bin/env python3
"""One-off readability pass for older dashboard screens.

Brings Tailwind classes in line with the shared kit (components/ui/kit.tsx):
- no text under 12px (7-11px become text-xs)
- body greys dark enough to read (slate-300/400 text become slate-500/600)
- no all-caps or letter-spaced labels; font-black becomes font-bold
- one corner radius family

Usage: python3 scripts/normalize-ui.py FILE [FILE...]
"""
import re, sys

TOKEN_EDGE = r'(?<=[\s"\'`{])'
TOKEN_END = r'(?=[\s"\'`}])'

RULES = [
    (r'text-\[(7|8|9|10|11)px\]', 'text-xs'),
    (r'(?<![\w:-])text-slate-300(?![\w/-])', 'text-slate-500'),
    (r'(?<![\w:-])text-slate-400(?![\w/-])', 'text-slate-600'),
    (r'(?<=placeholder:)text-slate-300', 'text-slate-500'),
    (TOKEN_EDGE + r'font-black' + TOKEN_END, 'font-bold'),
    (TOKEN_EDGE + r'uppercase' + TOKEN_END, ''),
    (TOKEN_EDGE + r'tracking-(widest|wider|tighter)' + TOKEN_END, ''),
    (r'rounded-\[(2\.5rem|2rem|1\.5rem)\]', 'rounded-2xl'),
]

def normalize(src: str) -> str:
    out = src
    for pat, rep in RULES:
        out = re.sub(pat, rep, out)
    # tidy double spaces left inside class strings
    out = re.sub(r'(className=["`{][^"`]*?)  +', lambda m: m.group(1) + ' ', out)
    out = re.sub(r'className="\s+', 'className="', out)
    out = re.sub(r'\s+"(?=[\s>/])', '"', out) if False else out
    return out

for path in sys.argv[1:]:
    s = open(path).read()
    n = normalize(s)
    if n != s:
        open(path, 'w').write(n)
        print(f"normalized {path}")
