import { NextResponse } from "next/server";
import { getPublicUserCount } from "@/app/public-stats/actions";

export const dynamic = "force-dynamic";

export async function GET() {
  const count = await getPublicUserCount();
  return NextResponse.json({ count }, {
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}