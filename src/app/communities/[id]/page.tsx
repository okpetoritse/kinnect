import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCommunityPosts, joinCommunity } from "../actions";
import styles from "./page.module.css";
import Feed from "./Feed";
import { ArrowLeft } from "lucide-react";
import BackButton from "@/components/BackButton";
import {
  MessageCircle,
  Calendar,
  CheckSquare,
  BarChart3,
  Paperclip,
  Trophy,
  Users,
  Target,
} from "lucide-react";

const BASE_ACTIONS = [
  { href: "chat", Icon: MessageCircle, label: "Chat" },
  { href: "calendar", Icon: Calendar, label: "Calendar" },
  { href: "tasks", Icon: CheckSquare, label: "Tasks" },
  { href: "polls", Icon: BarChart3, label: "Polls" },
  { href: "resources", Icon: Paperclip, label: "Resources" },
  { href: "leaderboard", Icon: Trophy, label: "Leaderboard" },
  { href: "members", Icon: Users, label: "Members" },
];

export default async function CommunityPage({
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

  const { data: community } = await supabase
    .from("communities")
    .select(
      "id, name, description, cover_color, is_goal, goal_target, goal_metric_label, goal_deadline"
    )
    .eq("id", id)
    .single();

  const ACTIONS = community?.is_goal
    ? [{ href: "progress", Icon: Target, label: "Progress" }, ...BASE_ACTIONS]
    : BASE_ACTIONS;

  const { data: membership } = await supabase
    .from("community_members")
    .select("id")
    .eq("community_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  const { count: memberCount } = await supabase
    .from("community_members")
    .select("id", { count: "exact", head: true })
    .eq("community_id", id);

  const isMember = !!membership;
  const posts = isMember ? await getCommunityPosts(id) : [];

  async function handleJoin() {
    "use server";
    await joinCommunity(id);
  }

  return (
    <main className={styles.wrapper}>
      <div className={styles.header}>
        <BackButton href="/communities" />
        <div
          className={styles.cover}
          style={{ background: community?.cover_color || "#FF6F59" }}
        />
        <div className={styles.name}>{community?.name}</div>
        {community?.description && (
          <div className={styles.description}>{community.description}</div>
        )}
        <div className={styles.memberCount}>{memberCount || 0} members</div>

        {community?.is_goal && (
          <div className={styles.memberCount}>
            🎯 Goal: {community.goal_target} {community.goal_metric_label}
            {community.goal_deadline &&
              ` by ${new Date(community.goal_deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
          </div>
        )}

        {!isMember ? (
          <form action={handleJoin}>
            <button className={styles.joinBtn} type="submit">
              Join community
            </button>
          </form>
        ) : (
          <div className={styles.actionsGrid}>
            {ACTIONS.map(({ href, Icon, label }) => (
              <Link
                key={href}
                href={`/communities/${id}/${href}`}
                className={styles.actionItem}
              >
                <Icon size={20} className={styles.actionIconLucide} />
                <span className={styles.actionLabel}>{label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className={styles.feed}>
        {isMember ? (
          <Feed
            communityId={id}
            currentUserId={user.id}
            currentUserName={user.user_metadata?.full_name || "You"}
            initialPosts={posts}
          />
        ) : (
          <p className={styles.notMemberNotice}>
            Join this community to see and share posts.
          </p>
        )}
      </div>
    </main>
  );
}