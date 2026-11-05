import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, createSessionToken } from "@/lib/session";

export async function POST(request: NextRequest) {
  const secret = process.env.DROPPILOT_ACCESS_KEY;
  if (!secret) {
    return NextResponse.json({ error: "Zugangsschlüssel ist serverseitig nicht konfiguriert." }, { status: 500 });
  }

  const body = await request.json().catch(() => null) as { key?: string } | null;
  if (!body?.key || body.key !== secret) {
    return NextResponse.json({ error: "Der Zugangsschlüssel ist nicht korrekt." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, await createSessionToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
