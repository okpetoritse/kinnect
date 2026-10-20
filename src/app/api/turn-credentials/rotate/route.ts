import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CREDENTIAL_LIFETIME_SECONDS = 172800;
const CREDENTIAL_LABEL = "kinnect-turn-rotating";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (
    !cronSecret ||
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const meteredDomain = process.env.METERED_DOMAIN?.replace(/\/+$/, "");
  const meteredSecretKey = process.env.METERED_SECRET_KEY;

  if (!meteredDomain || !meteredSecretKey) {
    return NextResponse.json(
      { error: "Metered server configuration is missing." },
      { status: 500 }
    );
  }

  try {
    const domainUrl = new URL(meteredDomain);

    if (domainUrl.protocol !== "https:" || domainUrl.pathname !== "/") {
      return NextResponse.json(
        { error: "METERED_DOMAIN must be an HTTPS origin." },
        { status: 500 }
      );
    }

    const response = await fetch(
      `${meteredDomain}/api/v1/turn/credential?secretKey=${encodeURIComponent(
        meteredSecretKey
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expiryInSeconds: CREDENTIAL_LIFETIME_SECONDS,
          label: CREDENTIAL_LABEL,
        }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error(
        "[TURN rotation] Metered returned status:",
        response.status
      );

      return NextResponse.json(
        { error: "Could not create a TURN credential." },
        { status: 502 }
      );
    }

    const result = (await response.json()) as Record<string, unknown>;

    if (
      typeof result.apiKey !== "string" ||
      typeof result.username !== "string" ||
      typeof result.expiryInSeconds !== "number" ||
      !Number.isFinite(result.expiryInSeconds) ||
      result.expiryInSeconds <= 0
    ) {
      console.error("[TURN rotation] Metered returned an invalid response.");

      return NextResponse.json(
        { error: "Metered returned an invalid credential response." },
        { status: 502 }
      );
    }

    const createdAt = new Date();
    const expiresAt = new Date(
      createdAt.getTime() + result.expiryInSeconds * 1000
    );

    const admin = createAdminClient();

    const { error: saveError } = await admin
      .from("turn_credentials")
      .upsert(
        {
          id: 1,
          api_key: result.apiKey,
          username: result.username,
          created_at: createdAt.toISOString(),
          expires_at: expiresAt.toISOString(),
        },
        { onConflict: "id" }
      );

    if (saveError) {
      console.error("[TURN rotation] Could not save the credential.");
      return NextResponse.json(
        { error: "Could not save the TURN credential." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        expiresAt: expiresAt.toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch {
    console.error("[TURN rotation] Unexpected rotation failure.");

    return NextResponse.json(
      { error: "TURN credential rotation failed." },
      { status: 500 }
    );
  }
}