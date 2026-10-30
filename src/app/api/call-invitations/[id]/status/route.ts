import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json(
      { active: false },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const siteOrigin = new URL(request.url).origin;

  try {
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("call_invitations")
      .select("id")
      .eq("id", id)
      .eq("site_origin", siteOrigin)
      .eq("status", "ringing")
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.error("[Call] Notification verification failed:", error);
      return NextResponse.json(
        { active: false },
        { status: 503, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      { active: Boolean(data) },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("[Call] Notification verification error:", error);
    return NextResponse.json(
      { active: false },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }
}