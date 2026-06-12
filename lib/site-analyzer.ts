// Analyse "santé" d'un site web pour scorer le potentiel commercial.
// Score 0-100 : PLUS c'est haut, PLUS le site est éclaté → PLUS c'est un bon prospect.

export type SiteGrade = "no-site" | "hot" | "warm" | "cold" | "unknown";

export type SiteAnalysis = {
  url: string;
  finalUrl?: string;
  reachable: boolean;
  httpStatus?: number;
  score: number;
  grade: SiteGrade;
  issues: string[];
  elapsedMs?: number;
};

const TIMEOUT_MS = 8000;

function grade(score: number): SiteGrade {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

export async function analyzeSite(rawUrl?: string): Promise<SiteAnalysis> {
  const url = (rawUrl ?? "").trim();

  // Pas de site = le meilleur prospect possible.
  if (!url) {
    return {
      url: "",
      reachable: false,
      score: 100,
      grade: "no-site",
      issues: ["Aucun site web (présence en ligne quasi nulle)"],
    };
  }

  const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();

  try {
    const res = await fetch(normalized, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LeadHunterBot/1.0; +https://browseract.com)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const elapsedMs = Date.now() - start;
    const html = (await res.text()).slice(0, 400_000);
    const lower = html.toLowerCase();
    const finalUrl = res.url || normalized;

    const issues: string[] = [];
    let score = 0;

    if (!res.ok) {
      score += 60;
      issues.push(`Erreur HTTP ${res.status}`);
    }
    if (!finalUrl.startsWith("https://")) {
      score += 15;
      issues.push("Pas de HTTPS (site non sécurisé)");
    }
    if (!/<meta[^>]+name=["']?viewport/i.test(html)) {
      score += 25;
      issues.push("Pas responsive — illisible sur mobile");
    }
    const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim();
    if (!title) {
      score += 10;
      issues.push("Pas de balise <title> (SEO)");
    }
    if (!/<meta[^>]+name=["']?description/i.test(html)) {
      score += 10;
      issues.push("Pas de meta description (SEO)");
    }
    if (!/<meta[^>]+property=["']?og:/i.test(html)) {
      score += 8;
      issues.push("Pas d'Open Graph (mauvais partage réseaux)");
    }
    if (/wix\.com|weebly|jimdo|1and1|sitebuilder|godaddy.*website/i.test(lower)) {
      score += 12;
      issues.push("Construit sur un builder daté");
    }
    if (html.length < 1500 || /under construction|en construction|coming soon|site en cours/i.test(lower)) {
      score += 22;
      issues.push("Page quasi vide / en construction");
    }
    if (elapsedMs > 4000) {
      score += 10;
      issues.push(`Chargement lent (${(elapsedMs / 1000).toFixed(1)}s)`);
    }

    score = Math.min(100, score);
    if (issues.length === 0) issues.push("Site correct — peu d'arguments de vente");

    return {
      url: normalized,
      finalUrl,
      reachable: true,
      httpStatus: res.status,
      score,
      grade: grade(score),
      issues,
      elapsedMs,
    };
  } catch {
    return {
      url: normalized,
      reachable: false,
      score: 85,
      grade: "hot",
      issues: ["Site injoignable (down, expiré ou trop lent)"],
      elapsedMs: Date.now() - start,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Analyse une liste d'URLs avec une concurrence limitée. */
export async function analyzeMany(urls: (string | undefined)[], concurrency = 6) {
  const results: SiteAnalysis[] = new Array(urls.length);
  let cursor = 0;
  async function worker() {
    while (cursor < urls.length) {
      const i = cursor++;
      results[i] = await analyzeSite(urls[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return results;
}
