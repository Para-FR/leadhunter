import { NextResponse } from "next/server";
import { getTask, runByTemplate } from "@/lib/browseract";
import { pick } from "@/lib/csv";
import { outputRows, extractContact } from "@/lib/extract";
import { analyzeSite, type SiteAnalysis } from "@/lib/site-analyzer";
import {
  getCampaign,
  patchCampaign,
  claimEnrich,
  claimAnalyze,
  saveLeads,
  getLeads,
  type Business,
  type Lead,
  type Campaign,
} from "@/lib/leads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

// Template "Google Business Contact Finder" : nom d'entreprise → site web.
const CONTACT_FINDER_TEMPLATE = "89720224238575367";
const TERMINAL = ["finished", "failed", "canceled"];

export async function GET(_req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  try {
    const campaign = await getCampaign(taskId);
    if (!campaign) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });

    // Campagnes pilotées par l'agent (v2) : le script remplit Mongo lui-même → lecture seule.
    if (campaign.source === "agent") return progress(taskId);

    if (campaign.phase === "maps") await advanceMaps(campaign);
    else if (campaign.phase === "enriching") await advanceEnriching(campaign);

    // La phase "analyzing" peut être déclenchée par advanceEnriching ci-dessus.
    const fresh = (await getCampaign(taskId)) as Campaign;
    if (fresh.phase === "analyzing") await runAnalysis(fresh);

    return progress(taskId);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}

// --- PHASE 1 : scrape Google Maps ---
async function advanceMaps(c: Campaign) {
  const task = await getTask(c.taskId);
  if (task.status === "failed" || task.status === "canceled") {
    await patchCampaign(c.taskId, { phase: "failed", status: task.status, finishedAt: new Date() });
    return;
  }
  await patchCampaign(c.taskId, { status: `maps:${task.status}` });
  if (task.status !== "finished") return;

  // On réserve le lancement de l'enrichissement pour ne le faire qu'une fois.
  if (!(await claimEnrich(c.taskId))) return;

  try {
    const rows = await outputRows(task.output);
    // On enregistre les business "en attente" — l'enrichissement est lancé en file
    // (phase enriching) pour respecter la limite de tâches concurrentes BrowserAct.
    const businesses: Business[] = rows
      .map((row) => ({
        name: pick(row, "name", "title", "businessname") || "(sans nom)",
        address: pick(row, "address", "fulladdress", "adresse", "location"),
        category: pick(row, "category", "categories", "type"),
        phone: cleanPhone(pick(row, "phone", "phonenumber", "tel")),
        rating: pick(row, "rating", "starrating", "stars", "note", "score"),
        reviews: pick(row, "reviews", "reviewcount", "numberofreviews"),
      }))
      .slice(0, c.limit);

    await patchCampaign(c.taskId, { phase: "enriching", status: "enriching", businesses });
  } catch (e) {
    await patchCampaign(c.taskId, { enrichLaunched: false });
    throw e;
  }
}

// Limite de tâches BrowserAct simultanées (plan) — on lance l'enrichissement en file.
const CONCURRENCY = 2;

// --- PHASE 2 : enrichissement en file (résolution des sites web) ---
async function advanceEnriching(c: Campaign) {
  const businesses = c.businesses ?? [];
  let changed = false;

  // 1) Poll les tâches Contact Finder en cours.
  await Promise.all(
    businesses.map(async (b) => {
      if (!b.contactTaskId || TERMINAL.includes(b.contactStatus ?? "")) return;
      try {
        const t = await getTask(b.contactTaskId);
        if (t.status !== b.contactStatus) {
          b.contactStatus = t.status;
          changed = true;
        }
        if (t.status === "finished" && !b.website && !b.email) {
          const { website, email } = await extractContact(t.output);
          b.website = website;
          b.email = email;
          changed = true;
        }
      } catch {
        /* on retentera */
      }
    }),
  );

  // 2) Lance des business en attente tant qu'il reste des slots.
  let running = businesses.filter((b) => b.contactTaskId && !TERMINAL.includes(b.contactStatus ?? "")).length;
  for (const b of businesses) {
    if (running >= CONCURRENCY) break;
    if (b.contactTaskId || b.contactStatus === "failed") continue; // déjà lancé / échec définitif
    try {
      const { id } = await runByTemplate(CONTACT_FINDER_TEMPLATE, [
        { name: "Company_name", value: `${b.name} ${c.area}`.trim() },
      ]);
      b.contactTaskId = id;
      b.contactStatus = "created";
      running++;
      changed = true;
    } catch (e) {
      // 10118 "Running tasks number exceeds" = slots pleins → on réessaiera au prochain poll.
      if (/exceed|running tasks/i.test((e as Error).message)) break;
      b.contactStatus = "failed";
      changed = true;
    }
  }

  const allDone = businesses.every((b) => TERMINAL.includes(b.contactStatus ?? ""));
  if (changed || allDone) {
    await patchCampaign(c.taskId, {
      businesses,
      phase: allDone ? "analyzing" : "enriching",
      status: allDone ? "analyzing" : `enriching:${enrichedCount(businesses)}/${businesses.length}`,
    });
  }
}

// --- PHASE 3 : analyse des sites + sauvegarde des leads ---
async function runAnalysis(c: Campaign) {
  if (!(await claimAnalyze(c.taskId))) return;
  const businesses = c.businesses ?? [];
  const now = new Date();
  const leads: Lead[] = await Promise.all(
    businesses.map(async (b): Promise<Lead> => {
      let analysis: SiteAnalysis;
      if (b.website) {
        analysis = await analyzeSite(b.website);
      } else if (b.contactStatus === "failed") {
        // On n'a pas pu vérifier → "unknown" plutôt que de prétendre qu'il n'y a pas de site.
        analysis = {
          url: "",
          reachable: false,
          score: -1,
          grade: "unknown",
          issues: ["Enrichissement échoué — site non vérifié"],
        };
      } else {
        // Contact Finder a abouti mais aucun site trouvé → réellement pas de site.
        analysis = await analyzeSite("");
      }
      return { ...b, taskId: c.taskId, analysis, createdAt: now };
    }),
  );
  await saveLeads(c.taskId, leads);
}

async function progress(taskId: string) {
  const campaign = (await getCampaign(taskId)) as Campaign;
  const leads = campaign.phase === "done" ? await getLeads(taskId) : [];
  const businesses = campaign.businesses ?? [];
  return NextResponse.json({
    taskId,
    phase: campaign.phase,
    status: campaign.status,
    found: businesses.length,
    enriched: enrichedCount(businesses),
    leads,
    campaign: { ...campaign, businesses: undefined },
    done: campaign.phase === "done" || campaign.phase === "failed",
  });
}

function enrichedCount(businesses: Business[]) {
  return businesses.filter((b) => TERMINAL.includes(b.contactStatus ?? "")).length;
}

function cleanPhone(p: string) {
  return /^(no\s?phone|n\/a|none)$/i.test(p.trim()) ? "" : p.trim();
}
