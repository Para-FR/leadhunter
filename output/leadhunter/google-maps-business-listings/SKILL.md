---
name: google-maps-business-listings
description: "Extract business listings (name + Maps place URL) from a Google Maps search results page. Forged via browser-act-skill-forge. Reuse instead of re-exploring Google Maps."
metadata:
  forged-by: browser-act-skill-forge
  target: https://www.google.com/maps
  capability: extraction
---

# google-maps-business-listings

Reusable capability forged from a verified browser-act exploration of Google Maps.
**Explore once, reuse forever**: no need to re-discover the DOM selectors.

## Prerequisites
- `browser-act` configured + a stealth browser id
- An open session already navigated to a Maps search results page (consent accepted)

## Usage

```bash
# 1. Open Maps (stealth) and accept consent if shown (see playbook)
browser-act --session s1 browser open <browser_id> "https://www.google.com/maps/search/<keyword>+<area>"

# 2. Extract the listings (name + place URL)
browser-act --session s1 eval "$(python scripts/list_businesses.py --limit 20)"
```

Returns a JSON array:
```json
[{"name": "Carmelo", "href": "https://www.google.com/maps/place/Carmelo/..."}]
```

## Notes
- Selector `a.hfpxzc` is the stable results-anchor on Maps (verified May 2026).
- For per-business detail (website, phone), navigate to `href` then read
  `a[data-item-id="authority"]` (website) and `button[data-item-id^="phone"]` (phone).
- Error shape on failure: returns `[]` (empty) rather than throwing.
