import { getDb } from "@/lib/mongodb";
import type { SiteAnalysis } from "@/lib/site-analyzer";

export type Phase = "maps" | "scraping" | "enriching" | "analyzing" | "done" | "failed";

// Business issu du scrape Maps, enrichi au fil des phases.
export type Business = {
  name: string;
  address?: string;
  category?: string;
  phone?: string;
  rating?: string;
  reviews?: string;
  contactTaskId?: string; // tâche BrowserAct "Contact Finder"
  contactStatus?: string; // created/running/finished/failed
  website?: string; // résolu après enrichissement
  email?: string; // bonus : email de contact pour la prospection
};

export type Lead = Business & {
  taskId: string;
  analysis: SiteAnalysis;
  createdAt: Date;
};

export type Campaign = {
  taskId: string; // id de campagne (tâche Maps cloud, ou "agent-<ts>" pour la v2)
  keyword: string;
  area: string;
  limit: number;
  phase: Phase;
  status: string;
  source?: "cloud" | "agent"; // "agent" = piloté par Claude Code via le CLI browser-act
  businesses?: Business[];
  enrichLaunched?: boolean;
  analyzing?: boolean;
  leadCount?: number;
  createdAt: Date;
  updatedAt: Date;
  finishedAt?: Date;
};

async function campaignsCol() {
  return (await getDb()).collection<Campaign>("campaigns");
}
async function leadsCol() {
  return (await getDb()).collection<Lead>("leads");
}

export async function createCampaign(
  c: Pick<Campaign, "taskId" | "keyword" | "area" | "limit">,
) {
  const col = await campaignsCol();
  const now = new Date();
  await col.insertOne({
    ...c,
    phase: "maps",
    status: "created",
    createdAt: now,
    updatedAt: now,
  } as Campaign);
}

export async function getCampaign(taskId: string) {
  return (await campaignsCol()).findOne({ taskId }, { projection: { _id: 0 } });
}

export async function patchCampaign(taskId: string, patch: Partial<Campaign>) {
  const col = await campaignsCol();
  await col.updateOne({ taskId }, { $set: { ...patch, updatedAt: new Date() } });
}

/** Réserve atomiquement le lancement de l'enrichissement (anti-double). */
export async function claimEnrich(taskId: string): Promise<boolean> {
  const col = await campaignsCol();
  const res = await col.findOneAndUpdate(
    { taskId, enrichLaunched: { $ne: true } },
    { $set: { enrichLaunched: true } },
  );
  return res !== null;
}

/** Réserve atomiquement la phase d'analyse. */
export async function claimAnalyze(taskId: string): Promise<boolean> {
  const col = await campaignsCol();
  const res = await col.findOneAndUpdate(
    { taskId, analyzing: { $ne: true }, phase: { $ne: "done" } },
    { $set: { analyzing: true } },
  );
  return res !== null;
}

export async function saveLeads(taskId: string, leads: Lead[]) {
  const col = await leadsCol();
  await col.deleteMany({ taskId });
  if (leads.length) await col.insertMany(leads);
  await patchCampaign(taskId, {
    phase: "done",
    status: "done",
    analyzing: false,
    leadCount: leads.length,
    finishedAt: new Date(),
  });
}

// --- Mode agent (v2 : Claude Code pilote le CLI browser-act) ---

export async function createAgentCampaign(
  c: Pick<Campaign, "taskId" | "keyword" | "area" | "limit">,
) {
  const col = await campaignsCol();
  const now = new Date();
  await col.insertOne({
    ...c,
    phase: "scraping",
    status: "scraping",
    source: "agent",
    leadCount: 0,
    createdAt: now,
    updatedAt: now,
  } as Campaign);
}

/** Insère un lead au fil de l'eau (pour un affichage live du dashboard). */
export async function upsertLead(lead: Lead) {
  const lcol = await leadsCol();
  await lcol.updateOne(
    { taskId: lead.taskId, name: lead.name },
    { $set: lead },
    { upsert: true },
  );
  const ccol = await campaignsCol();
  const count = await lcol.countDocuments({ taskId: lead.taskId });
  await ccol.updateOne({ taskId: lead.taskId }, { $set: { leadCount: count, updatedAt: new Date() } });
}

export async function getLeads(taskId: string): Promise<Lead[]> {
  const col = await leadsCol();
  return col
    .find({ taskId }, { projection: { _id: 0 } })
    .sort({ "analysis.score": -1 })
    .toArray();
}

export async function listCampaigns(limit = 15): Promise<Campaign[]> {
  const col = await campaignsCol();
  return col
    .find({}, { projection: { _id: 0, businesses: 0 } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}
