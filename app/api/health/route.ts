import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    // Ping serveur : valide que la connexion MongoDB est bien établie.
    await db.command({ ping: 1 });
    const collections = await db.listCollections().toArray();

    return NextResponse.json({
      ok: true,
      db: db.databaseName,
      collections: collections.map((c) => c.name),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
