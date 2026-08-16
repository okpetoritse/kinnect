import { getCommunitiesList } from "./actions";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import styles from "./page.module.css";
import CommunitiesList from "./CommunitiesList";

export default async function CommunitiesPage() {
  const { communities, memberCounts, nextCursor } = await getCommunitiesList();

  return (
    <main className={styles.wrapper}>
      <AppHeader />
      <div className={styles.headerRow}>
        <h1 className={styles.heading}>Communities</h1>
        <Link href="/communities/new" className={styles.createBtn}>
          + Create
        </Link>
      </div>

      <CommunitiesList
        initial={communities}
        initialMemberCounts={memberCounts}
        initialCursor={nextCursor}
      />
    </main>
  );
}