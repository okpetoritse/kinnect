import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getGoalLeaderboard } from "../../actions";
import Avatar from "@/components/Avatar";
import BackButton from "@/components/BackButton";
import styles from "./page.module.css";
import LogProgressForm from "./LogProgressForm";
import { Trophy } from "lucide-react";
import LeaderboardRow from "./LeaderboardRow";

export default async function ProgressPage({
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
    .select("id, name, is_goal, goal_target, goal_metric_label, goal_deadline")
    .eq("id", id)
    .single();

  if (!community?.is_goal) redirect(`/communities/${id}`);

  const { goalTarget, goalMetricLabel, milestoneThresholds, leaderboard } =
    await getGoalLeaderboard(id);
  const me = leaderboard.find((m) => m.userId === user.id);

  return (
    <main className={styles.wrapper}>
      <div className={styles.header}>
        <BackButton href={`/communities/${id}`} />
        <div className={styles.name}>{community.name} · Progress</div>
      </div>

      <p className={styles.reminder}>
        Everyone here tracks their own number toward the same kind of goal.
      </p>
      <div className={styles.myProgressCard}>
        <div className={styles.myProgressLabel}>Your progress</div>
        <div className={styles.myProgressValue}>
          {me?.value || 0} / {goalTarget} {goalMetricLabel}
        </div>
        <div className={styles.progressBarTrack}>
          <div
            className={styles.progressBarFill}
            style={{ width: `${me?.percent || 0}%` }}
          />
        </div>
        <div className={styles.progressPercent}>{me?.percent || 0}% there</div>

        <div className={styles.milestoneRow}>
          {milestoneThresholds.map((t) => {
            const reached = (me?.milestonesReached || []).includes(t);
            return (
              <div key={t}>
                <div
                  className={`${styles.milestoneBadge} ${
                    reached ? styles.milestoneBadgeReached : ""
                  }`}
                >
                  <Trophy size={15} />
                </div>
                <div className={styles.milestoneLabel}>{t}%</div>
              </div>
            );
          })}
        </div>

        <LogProgressForm
          communityId={id}
          currentPercent={me?.percent || 0}
          milestoneThresholds={milestoneThresholds}
        />
      </div>

      <div className={styles.sectionTitle}>Leaderboard</div>
      <div className={styles.list}>
        {leaderboard.map((entry, i) => (
                    <LeaderboardRow key={entry.userId} entry={entry} rank={i + 1} isMe={entry.userId === user.id} />
        ))}
      </div>
    </main>
  );
}