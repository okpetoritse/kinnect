
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  getListings,
  getMarketplaceDiscoveryData,
} from "./actions";
import AppHeader from "@/components/AppHeader";
import Link from "next/link";
import styles from "./page.module.css";
import MarketplaceGrid, {
  type Listing,
} from "./MarketplaceGrid";
import MarketplaceDiscovery from "./MarketplaceDiscovery";

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

  const [listingResult, discovery] = await Promise.all([
    getListings({
      country: myCountry,
      sort: "newest",
    }),
    getMarketplaceDiscoveryData(myCountry),
  ]);


  return (
    <main className={styles.wrapper}>
      <AppHeader />

      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.heading}>Marketplace</h1>
          <p className={styles.pageSubtitle}>
            Discover something interesting.
          </p>
        </div>

        <div className={styles.headerActions}>
  <Link
    href="/marketplace/my-listings"
    className={styles.manageBtn}
  >
    My listings
  </Link>

  <Link href="/marketplace/new" className={styles.sellBtn}>
    + Sell
  </Link>
</div>
      </div>

            <MarketplaceDiscovery
        featured={discovery.featured}
        local={discovery.local}
        businesses={discovery.businesses}
      />

      <MarketplaceGrid
        initial={listingResult.listings as unknown as Listing[]}
        initialCursor={listingResult.nextCursor}
        myCountry={myCountry}

      />
    </main>
  );
}
