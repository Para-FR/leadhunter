/**
 * Agent de prospection v2 — Claude Code pilote le CLI browser-act.
 * Flux : Google Maps → fiche de chaque business → site web → analyse "éclaté" → MongoDB (live).
 *
 * Usage : bun run scripts/prospect.ts "<métier>" "<zone>" [limit]
 *   ex.  : bun run scripts/prospect.ts "plombier" "Roubaix" 5
 * Env   : BROWSER_ID (id du navigateur stealth browser-act, défaut = leadhunt-fr-1)
 */
import { openMaps, handleConsent, listResults, getDetail, closeSession } from "@/lib/maps-agent";
import { analyzeSite } from "@/lib/site-analyzer";
import { createAgentCampaign, upsertLead, patchCampaign, type Lead } from "@/lib/leads";

const keyword = process.argv[2];
const area = process.argv[3];
const limit = Math.max(1, Math.min(20, Number(process.argv[4] ?? 5)));
const browserId = process.env.BROWSER_ID ?? "98129092535983650"; // leadhunt-fr-1

if (!keyword || !area) {
  console.error('Usage : bun run scripts/prospect.ts "<métier>" "<zone>" [limit]');
  process.exit(1);
}

function splitRating(raw: string): { rating: string; reviews: string } {
  // ex. "4,8(37 756)" → rating "4,8", reviews "37 756"
  const rating = raw.match(/[0-9]+[.,][0-9]+/)?.[0] ?? "";
  const reviews = raw.match(/\(([\d  ]+)\)/)?.[1]?.trim() ?? "";
  return { rating, reviews };
}

const taskId = `agent-${Date.now()}`;
const session = taskId;

async function main() {
  console.log(`🎯 Campagne ${taskId} — ${keyword} à ${area} (limit ${limit}), browser ${browserId}`);
  await createAgentCampaign({ taskId, keyword, area, limit });

  try {
    console.log("🌐 Ouverture Google Maps…");
    openMaps(session, browserId, keyword, area);
    handleConsent(session);

    const results = listResults(session, limit);
    console.log(`📋 ${results.length} business trouvés`);
    await patchCampaign(taskId, { status: `scraping:0/${results.length}` });

    for (const [i, r] of results.entries()) {
      let detail;
      try {
        detail = getDetail(session, r.href);
      } catch {
        detail = { name: r.name, website: "", phone: "", rating: "", reviews: "" };
      }
      const { rating, reviews } = splitRating(detail.rating);
      const website = detail.website || undefined;
      const analysis = await analyzeSite(website ?? "");

      const lead: Lead = {
        taskId,
        name: detail.name || r.name,
        website,
        phone: detail.phone || undefined,
        rating,
        reviews,
        analysis,
        createdAt: new Date(),
      };
      await upsertLead(lead);
      console.log(
        `  ${i + 1}/${results.length} ${lead.name} → score ${analysis.score} [${analysis.grade}] ${website ?? "(pas de site)"}`,
      );
      await patchCampaign(taskId, { status: `scraping:${i + 1}/${results.length}` });
    }

    await patchCampaign(taskId, { phase: "done", status: "done", finishedAt: new Date() });
    console.log(`✅ Terminé — campagne ${taskId}`);
  } catch (e) {
    await patchCampaign(taskId, { phase: "failed", status: `failed: ${(e as Error).message}` });
    console.error("❌ Échec :", (e as Error).message);
    process.exitCode = 1;
  } finally {
    closeSession(session);
    process.exit(process.exitCode ?? 0);
  }
}

main();
