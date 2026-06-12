// Pilote le CLI browser-act pour prospecter Google Maps (v2 — Claude Code = l'agent).
// Extraction via `eval` (sélecteurs stables) plutôt que le clic par index (fragile).
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";

const BIN = `${homedir()}/.local/bin/browser-act`;

function ba(session: string | null, args: string[], timeoutMs = 90_000): string {
  const full = session ? ["--session", session, ...args] : args;
  return execFileSync(BIN, full, {
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** eval dans la page + parsing robuste du résultat JSON. */
function evalJson<T>(session: string, expr: string): T {
  const out = ba(session, ["eval", expr]).trim();
  const last = out.split("\n").map((l) => l.trim()).filter(Boolean).pop() ?? "";
  let v: unknown;
  try {
    v = JSON.parse(last);
  } catch {
    return last as unknown as T;
  }
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return v as unknown as T;
    }
  }
  return v as T;
}

export type MapsResult = { name: string; href: string };
export type MapsDetail = { name: string; website: string; phone: string; rating: string; reviews: string };

export function openMaps(session: string, browserId: string, keyword: string, area: string) {
  const url = `https://www.google.com/maps/search/${encodeURIComponent(`${keyword} ${area}`)}`;
  ba(session, ["browser", "open", browserId, url], 120_000);
}

/** Passe le mur de consentement Google si présent (bouton repéré par aria-label, pas par index figé). */
export function handleConsent(session: string) {
  const href = evalJson<string>(session, "location.href");
  if (!/consent\.google\./.test(href)) return;
  ba(session, ["scroll", "down", "--amount", "1200"]);
  const state = ba(session, ["state"]);
  const m = state.match(/\[(\d+)\]<button aria-label=Tout accepter/);
  if (m) {
    ba(session, ["click", m[1]]);
    ba(session, ["wait", "stable", "--timeout", "45000"]);
  }
}

/** Liste les résultats (nom + lien fiche). Scrolle le feed pour en charger assez. */
export function listResults(session: string, limit: number): MapsResult[] {
  const rounds = Math.max(0, Math.ceil(limit / 6) - 1);
  for (let i = 0; i < rounds; i++) {
    ba(session, ["eval", `document.querySelector('div[role="feed"]')?.scrollBy(0, 3000)`]);
    ba(session, ["wait", "stable", "--timeout", "8000"]);
  }
  const expr =
    `JSON.stringify([...document.querySelectorAll('a.hfpxzc')]` +
    `.map(a=>({name:a.getAttribute('aria-label')||'',href:a.href}))` +
    `.filter(x=>x.name))`;
  const all = evalJson<MapsResult[]>(session, expr) || [];
  return all.slice(0, limit);
}

/** Ouvre une fiche et extrait nom, site web, téléphone, note. */
export function getDetail(session: string, href: string): MapsDetail {
  ba(session, ["navigate", href]);
  ba(session, ["wait", "stable", "--timeout", "25000"]);
  const expr =
    `JSON.stringify({` +
    `name:(document.querySelector('h1')?.textContent||'').trim(),` +
    `website:document.querySelector('a[data-item-id=authority]')?.href||'',` +
    `phone:(document.querySelector('button[data-item-id^=phone]')?.getAttribute('aria-label')||'').replace(/Num[ée]ro de t[ée]l[ée]phone\\s*:\\s*/i,'').trim(),` +
    `rating:(document.querySelector('div.F7nice')?.textContent||'').trim()` +
    `})`;
  const d = evalJson<MapsDetail>(session, expr);
  return { name: d.name || "", website: d.website || "", phone: d.phone || "", rating: d.rating || "", reviews: "" };
}

export function closeSession(session: string) {
  try {
    ba(null, ["session", "close", session]);
  } catch {
    /* déjà fermée */
  }
}
