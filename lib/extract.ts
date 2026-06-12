import { parseCsv } from "@/lib/csv";

type Output = { string?: string; files?: string[] } | undefined;

/** Normalise la sortie d'une tâche BrowserAct en tableau d'objets. */
export async function outputRows(output: Output): Promise<Record<string, unknown>[]> {
  if (output?.string?.trim()) {
    try {
      const p = JSON.parse(output.string);
      if (Array.isArray(p)) return p as Record<string, unknown>[];
      if (p && typeof p === "object") {
        const obj = p as Record<string, unknown>;
        for (const v of Object.values(obj)) {
          if (Array.isArray(v)) return v as Record<string, unknown>[];
        }
        return [obj]; // objet unique
      }
    } catch {
      /* pas du JSON */
    }
  }
  if (output?.files?.length) {
    try {
      const csv = await fetch(output.files[0]).then((r) => r.text());
      return parseCsv(csv);
    } catch {
      /* ignore */
    }
  }
  return [];
}

/** Aplatit une ligne : les valeurs qui sont elles-mêmes du JSON (ex. script_result_1)
 *  sont parsées et fusionnées. Renvoie une map clé→texte + le texte concaténé. */
function flatten(row: Record<string, unknown>): { fields: Record<string, string>; blob: string } {
  const fields: Record<string, string> = {};
  const parts: string[] = [];
  const ingest = (obj: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(obj)) {
      if (v == null) continue;
      if (typeof v === "string") {
        const t = v.trim();
        // Valeur = objet JSON imbriqué ?
        if ((t.startsWith("{") || t.startsWith("[")) && t.length > 2) {
          try {
            const inner = JSON.parse(t);
            if (Array.isArray(inner)) inner.forEach((x) => x && typeof x === "object" && ingest(x));
            else if (typeof inner === "object") ingest(inner as Record<string, unknown>);
            parts.push(t);
            continue;
          } catch {
            /* texte normal */
          }
        }
        fields[k] = v;
        parts.push(v);
      } else if (typeof v === "object") {
        ingest(v as Record<string, unknown>);
      } else {
        fields[k] = String(v);
        parts.push(String(v));
      }
    }
  };
  ingest(row);
  return { fields, blob: parts.join("\n") };
}

export type Contact = { website?: string; email?: string };

/** Extrait site web + email depuis la sortie du Contact Finder. */
export async function extractContact(output: Output): Promise<Contact> {
  const rows = await outputRows(output);
  for (const row of rows) {
    const { fields, blob } = flatten(row);
    let website: string | undefined;

    // champ explicite (URL / Website / Homepage…)
    for (const [k, v] of Object.entries(fields)) {
      if (/website|^url$|homepage/i.test(k)) {
        const c = cleanUrl(v);
        if (c) { website = c; break; }
      }
    }
    // sinon, 1re URL plausible dans le texte
    if (!website) {
      for (const m of blob.matchAll(/https?:\/\/[^\s"'\\]+/gi)) {
        const c = cleanUrl(m[0]);
        if (c) { website = c; break; }
      }
    }

    const email = blob.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0];
    if (website || email) return { website, email: email?.toLowerCase() };
  }
  return {};
}

// Domaines à exclure (réseaux sociaux / agrégateurs) — comparés par DOMAINE EXACT
// pour éviter qu'un "x.com" matche "labouchee-aix.com".
const BLOCKED_DOMAINS = [
  "google.com", "google.fr", "goo.gl", "maps.google.com",
  "facebook.com", "fb.com", "instagram.com", "linkedin.com",
  "yelp.com", "yelp.fr", "twitter.com", "x.com",
  "tripadvisor.com", "tripadvisor.fr", "youtube.com", "youtu.be",
  "bbb.org", "foursquare.com", "pinterest.com", "pinterest.fr",
  "tiktok.com", "wa.me", "whatsapp.com", "pagesjaunes.fr",
  "thefork.fr", "thefork.com", "lafourchette.com", "zenchef.com",
];

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return BLOCKED_DOMAINS.some((d) => host === d || host.endsWith("." + d));
}

function cleanUrl(raw: string): string | null {
  let u = raw.trim().replace(/^["'<(]+|["'>)]+$/g, "");
  if (!u || /^(no|n\/a|none|null|nophone|not found)$/i.test(u)) return null;
  if (!/^https?:\/\//i.test(u)) {
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(u)) u = "https://" + u;
    else return null;
  }
  try {
    const url = new URL(u);
    if (isBlockedHost(url.hostname)) return null;
    return url.origin + (url.pathname === "/" ? "" : url.pathname);
  } catch {
    return null;
  }
}

