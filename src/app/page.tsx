import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import LandingContent from "./LandingContent";

export default async function RootPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/home");

  return <LandingContent />;
}