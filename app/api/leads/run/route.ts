import { NextResponse } from "next/server";
import { runByTemplate } from "@/lib/browseract";
import { createCampaign } from "@/lib/leads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Template officiel "Google Maps Local Lead Finder" : nom, note, adresse, catégorie,
// (parfois téléphone). Le site web est résolu après coup via le Contact Finder.
const GOOGLE_MAPS_LEAD_TEMPLATE = "59877346620099216";

type Body = { keyword: string; area: string; limit?: number };

export async function POST(req: Request) {
  try {
    const { keyword, area, limit = 10 } = (await req.json()) as Body;
    if (!keyword?.trim() || !area?.trim()) {
      return NextResponse.json({ error: "keyword et area sont requis" }, { status: 400 });
    }
    const kw = keyword.trim();
    const loc = area.trim();

    // NB : ne PAS envoyer GoogleMap_Search — le template construit l'URL de recherche
    // depuis Bussines_Category + Location. Extracted_Data = NOMBRE de résultats visés.
    const { id: taskId } = await runByTemplate(GOOGLE_MAPS_LEAD_TEMPLATE, [
      { name: "Location", value: loc },
      { name: "Bussines_Category", value: kw },
      { name: "Extracted_Data", value: String(limit) },
    ]);

    await createCampaign({ taskId, keyword: kw, area: loc, limit });

    return NextResponse.json({ taskId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
