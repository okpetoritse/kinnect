import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}/home`);
    }

    if (error.message.includes("ACCOUNT_EXISTS")) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(
          "An account with this email already exists. Please sign in with your original method instead."
        )}`
      );
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Could not sign in with Google`);
}