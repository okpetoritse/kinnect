import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertCanMessage } from "@/lib/messaging/assertCanMessage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type IceServerEntry = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

function isIceServerArray(value: unknown): value is IceServerEntry[] {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  return value.every((item: unknown) => {
    if (typeof item !== "object" || item === null) {
      return false;
    }

    const entry = item as Record<string, unknown>;

    const validUrls =
      typeof entry.urls === "string" ||
      (Array.isArray(entry.urls) &&
        entry.urls.length > 0 &&
        entry.urls.every((url: unknown) => typeof url === "string"));

    const validUsername =
      entry.username === undefined ||
      typeof entry.username === "string";

    const validCredential =
      entry.credential === undefined ||
      typeof entry.credential === "string";

    return validUrls && validUsername && validCredential;
  });
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Sign in to start a call." },
        { status: 401 }
      );
    }

    const friendId = new URL(request.url).searchParams.get("friendId");

    if (!friendId) {
      return NextResponse.json(
        { error: "A call recipient is required." },
        { status: 400 }
      );
    }

    const permission = await assertCanMessage(supabase, friendId);

    if (!permission.ok) {
      return NextResponse.json(
        { error: permission.error },
        { status: 403 }
      );
    }

    const admin = createAdminClient();

    const { data: storedCredential, error: lookupError } = await admin
      .from("turn_credentials")
      .select("api_key, expires_at")
      .eq("id", 1)
      .maybeSingle();

    if (
      lookupError ||
      !storedCredential ||
      !storedCredential.api_key ||
      !storedCredential.expires_at
    ) {
      return NextResponse.json(
        { error: "Call connection settings are not ready." },
        { status: 503 }
      );
    }

    const expiresAt = Date.parse(storedCredential.expires_at);
    const minimumRemainingLifetime = 60 * 60 * 1000;

    if (
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now() + minimumRemainingLifetime
    ) {
      return NextResponse.json(
        { error: "Call connection settings need to be refreshed." },
        { status: 503 }
      );
    }

    const meteredDomain = process.env.METERED_DOMAIN?.replace(/\/+$/, "");

    if (!meteredDomain) {
      return NextResponse.json(
        { error: "Call connection settings are not configured." },
        { status: 503 }
      );
    }

    const meteredUrl = new URL(meteredDomain);

    if (meteredUrl.protocol !== "https:" || meteredUrl.pathname !== "/") {
      return NextResponse.json(
        { error: "Call connection settings are invalid." },
        { status: 503 }
      );
    }

    const response = await fetch(
      `${meteredDomain}/api/v1/turn/credentials?apiKey=${encodeURIComponent(
        storedCredential.api_key
      )}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      console.error(
        "[TURN configuration] Metered returned status:",
        response.status
      );

      return NextResponse.json(
        { error: "Could not load call connection settings." },
        { status: 502 }
      );
    }

    const iceServers: unknown = await response.json();

    if (!isIceServerArray(iceServers)) {
      console.error("[TURN configuration] Invalid ICE-server response.");

      return NextResponse.json(
        { error: "The call connection configuration is invalid." },
        { status: 502 }
      );
    }

    return NextResponse.json(iceServers, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch {
    console.error("[TURN configuration] Request failed.");

    return NextResponse.json(
      { error: "Could not load call connection settings." },
      { status: 500 }
    );
  }
}