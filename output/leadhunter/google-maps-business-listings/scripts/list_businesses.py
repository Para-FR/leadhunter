#!/usr/bin/env python3
"""Forge: Google Maps business listings extractor.
Prints a JS snippet to run via `browser-act --session <s> eval "$(python list_businesses.py ...)"`.
The snippet returns a JSON array of {name, href} for the businesses on the current Maps results page.
"""
import argparse

def build_js(limit: int) -> str:
    # Selectors hardcoded (verified during exploration). Plain string, only `limit` injected.
    return (
        "JSON.stringify("
        "[...document.querySelectorAll('a.hfpxzc')]"
        ".map(a => ({name: a.getAttribute('aria-label') || '', href: a.href}))"
        ".filter(x => x.name)"
        ".slice(0, " + str(int(limit)) + ")"
        ")"
    )

if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Google Maps business listings extractor (JS emitter)")
    p.add_argument("--limit", type=int, default=20, help="max number of businesses to return")
    args = p.parse_args()
    print(build_js(args.limit))
