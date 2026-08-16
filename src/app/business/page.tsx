import { searchBusinesses } from "./actions";
import AppHeader from "@/components/AppHeader";
import styles from "./page.module.css";
import BusinessSearch from "./BusinessSearch";
import Link from "next/link";

export default async function BusinessDirectoryPage() {
  const initial = await searchBusinesses("");

  return (
    <main className={styles.wrapper}>
      <AppHeader />
      <h1 className={styles.heading}>Businesses</h1>
      <Link
        href="/marketplace"
        style={{ display: "block", marginBottom: 16, fontSize: 13, color: "var(--coral)", fontWeight: 600 }}
      >
        → Browse the marketplace
      </Link>
      <BusinessSearch initial={initial as any} />
    </main>
  );
}