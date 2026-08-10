import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";
import AppHeader from "@/components/AppHeader";

export default async function CommunitiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: communities } = await supabase
    .from("communities")
    .select("id, name, description, cover_color")
    .order("created_at", { ascending: false });

  const { data: memberCounts } = await supabase
    .from("community_members")
    .select("community_id");

  const countMap = new Map<string, number>();
  (memberCounts || []).forEach((m) => {
    countMap.set(m.community_id, (countMap.get(m.community_id) || 0) + 1);
  });

  return (
    <main className={styles.wrapper}>
      <AppHeader />
      <div className={styles.headerRow}>
        <h1 className={styles.heading}>Communities</h1>
        <Link href="/communities/new" className={styles.createBtn}>
          + Create
        </Link>
      </div>

      {communities && communities.length > 0 ? (
        communities.map((c) => (
          <Link key={c.id} href={`/communities/${c.id}`} className={styles.card}>
            <div className={styles.cardTop}>
              <div
                className={styles.cover}
                style={{ background: c.cover_color || "#FF6F59" }}
              />
              <div>
                <div className={styles.name}>{c.name}</div>
                <div className={styles.memberCount}>
                  {countMap.get(c.id) || 0} member
                  {(countMap.get(c.id) || 0) === 1 ? "" : "s"}
                </div>
              </div>
            </div>
            {c.description && (
              <div className={styles.description}>{c.description}</div>
            )}
          </Link>
        ))
      ) : (
        <p className={styles.empty}>
          No communities yet — create the first one.
        </p>
      )}
    </main>
  );
}