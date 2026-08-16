import { getListings } from "./actions";
import AppHeader from "@/components/AppHeader";
import Link from "next/link";
import styles from "./page.module.css";
import MarketplaceGrid from "./MarketplaceGrid";

export default async function MarketplacePage() {
  const { listings, nextCursor } = await getListings();

  return (
    <main className={styles.wrapper}>
      <AppHeader />
      <div className={styles.headerRow}>
        <h1 className={styles.heading}>Marketplace</h1>
        <Link href="/marketplace/new" className={styles.sellBtn}>
          + Sell
        </Link>
      </div>
      <MarketplaceGrid initial={listings as any} initialCursor={nextCursor} />
    </main>
  );
}