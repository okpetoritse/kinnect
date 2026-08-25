import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getListings } from "./actions";
import AppHeader from "@/components/AppHeader";
import Link from "next/link";
import styles from "./page.module.css";
import MarketplaceGrid from "./MarketplaceGrid";

export default async function MarketplacePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("country")
    .eq("id", user.id)
    .single();

  const myCountry = profile?.country || "";
  const { listings: initial, nextCursor } = await getListings({ country: myCountry });

  return (
    <main className={styles.wrapper}>
      <AppHeader />
      <div className={styles.headerRow}>
        <h1 className={styles.heading}>Marketplace</h1>
        <Link href="/marketplace/new" className={styles.sellBtn}>
          + Sell
        </Link>
      </div>
      <MarketplaceGrid initial={initial as any} initialCursor={nextCursor} myCountry={myCountry} />
    </main>
  );
}