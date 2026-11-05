import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getDb } from "@/lib/db";
import type { SearchProfile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSchema();
    const result = await getDb().execute("SELECT data FROM profiles ORDER BY updated_at DESC");
    const profiles = result.rows.map((row) => JSON.parse(String(row.data)) as SearchProfile);
    return NextResponse.json({ profiles });
  } catch (error) {
    console.error("Turso profile read failed:", error);
    return NextResponse.json({ error: "Suchprofile konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as { profiles?: SearchProfile[] } | null;
    if (!body || !Array.isArray(body.profiles) || body.profiles.length > 500) {
      return NextResponse.json({ error: "Ungültige Profildaten." }, { status: 400 });
    }
    const profiles = body.profiles;
    for (const profile of profiles) {
      if (!profile || typeof profile.id !== "string" || typeof profile.name !== "string" || typeof profile.url !== "string" || !profile.url.trim() ||
          !["ticket", "drop"].includes(profile.kind) || !Array.isArray(profile.keywords) ||
          !Number.isFinite(profile.quantity) || !["active", "paused"].includes(profile.status)) {
        return NextResponse.json({ error: "Ein Suchprofil enthält ungültige Daten." }, { status: 400 });
      }
    }

    await ensureSchema();
    const db = getDb();
    const transaction = await db.transaction("write");
    try {
      await transaction.execute("DELETE FROM profiles");
      for (const profile of profiles) {
        await transaction.execute({
          sql: "INSERT INTO profiles (id, data, updated_at) VALUES (?, ?, ?)",
          args: [profile.id, JSON.stringify(profile), new Date().toISOString()],
        });
      }
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    return NextResponse.json({ ok: true, count: profiles.length });
  } catch (error) {
    console.error("Turso profile write failed:", error);
    return NextResponse.json({ error: "Suchprofile konnten nicht gespeichert werden." }, { status: 500 });
  }
}
