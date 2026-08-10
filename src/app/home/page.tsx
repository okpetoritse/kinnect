import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getHomeData } from "./actions";
import styles from "./page.module.css";
import { MessageCircle, Users, Calendar } from "lucide-react";
import ReelStrip from "@/components/ReelStrip";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { conversations, communities, events } = await getHomeData(user.id);
  const firstName = (user.user_metadata?.full_name || "there").split(" ")[0];

  return (
    <main className={styles.wrapper}>
      <div className={styles.greetingCard}>
        <ReelStrip currentUserId={user.id} />
        <div className={styles.greetingText}>Hey, {firstName} 👋</div>
        <div className={styles.greetingSub}>
          {conversations.length > 0 || communities.length > 0
            ? "Here's what's happening"
            : "Let's get you connected"}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeaderRow}>
            <MessageCircle size={13} />
            <div className={styles.sectionTitle}>Recent messages</div>
          </div>
          <Link href="/messages" className={styles.seeAll}>
            See all
          </Link>
        </div>
        {conversations.length > 0 ? (
          conversations.map((c) => (
            <Link
              key={c.friendId}
              href={`/messages/${c.friendId}`}
              className={styles.conversationRow}
            >
              <div className={styles.avatar}>
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className={styles.conversationBody}>
                <div className={styles.conversationName}>{c.name}</div>
                <div className={styles.conversationPreview}>
                  {c.lastMessage}
                </div>
              </div>
            </Link>
          ))
        ) : (
          <p className={styles.empty}>No conversations yet</p>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeaderRow}>
            <Users size={13} />
            <div className={styles.sectionTitle}>Your communities</div>
          </div>
          <Link href="/communities" className={styles.seeAll}>
            See all
          </Link>
        </div>
        {communities.length > 0 ? (
          communities.map((c) => (
            <Link
              key={c.id}
              href={`/communities/${c.id}`}
              className={styles.communityRow}
            >
              <div
                className={styles.communityCover}
                style={{ background: c.cover_color || "#FF6F59" }}
              />
              <div className={styles.communityName}>{c.name}</div>
            </Link>
          ))
        ) : (
          <p className={styles.empty}>You haven&apos;t joined any communities yet</p>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionHeaderRow}>
            <Calendar size={13} />
            <div className={styles.sectionTitle}>Upcoming events</div>
          </div>
        </div>
        {events.length > 0 ? (
          events.map((e) => {
            const date = new Date(e.event_date);
            return (
              <Link
                key={e.id}
                href={`/communities/${e.community_id}/calendar`}
                className={styles.eventRow}
              >
                <div className={styles.eventDateBadge}>
                  <div className={styles.eventMonth}>
                    {date.toLocaleDateString("en-US", { month: "short" })}
                  </div>
                  <div className={styles.eventDay}>{date.getDate()}</div>
                </div>
                <div className={styles.eventTitle}>{e.title}</div>
              </Link>
            );
          })
        ) : (
          <p className={styles.empty}>No upcoming events you&apos;re attending</p>
        )}
      </div>
    </main>
  );
}