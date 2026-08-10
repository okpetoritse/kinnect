import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCommunityLeaderboard } from "../../actions";
import styles from "./page.module.css";
import { ArrowLeft } from "lucide-react";
import BackButton from "@/components/BackButton";

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("community_members")
    .select("id")
    .eq("community_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) redirect(`/communities/${id}`);

  const { data: community } = await supabase
    .from("communities")
    .select("id, name")
    .eq("id", id)
    .single();

  const leaderboard = await getCommunityLeaderboard(id);

  return (
    <main className={styles.wrapper}>
      <div className={styles.header}>
        <BackButton href={`/communities/${id}`} />
        <div className={styles.name}>{community?.name} · Leaderboard</div>
      </div>

      <div className={styles.list}>
        {leaderboard.map((entry, i) => (
          <div
            key={entry.userId}
            className={`${styles.row} ${i === 0 ? styles.rowTop : ""}`}
          >
            <div className={`${styles.rank} ${i === 0 ? styles.rankGold : ""}`}>
              #{i + 1}
            </div>
            <div className={styles.avatar}>
              {entry.name.charAt(0).toUpperCase()}
            </div>
            <div className={styles.body}>
              <div className={styles.memberName}>
                {entry.userId === user.id ? "You" : entry.name}
              </div>
              {entry.achievements.length > 0 && (
                <div className={styles.badges}>
                  {entry.achievements.map((a) => (
                    <span key={a.label} className={styles.badge} title={a.label}>
                      {a.icon}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className={styles.points}>{entry.points}</div>
              <span className={styles.pointsLabel}>points</span>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.legend}>
        <div className={styles.legendTitle}>How points work</div>
        <div className={styles.legendRow}>📝 Post created — 5 pts</div>
        <div className={styles.legendRow}>✅ Task completed — 10 pts</div>
        <div className={styles.legendRow}>💬 Chat message — 1 pt</div>
        <div className={styles.legendRow}>📅 Event created — 5 pts</div>
      </div>
    </main>
  );
}