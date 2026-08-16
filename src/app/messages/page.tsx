import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import styles from "./page.module.css";
import MessagesList from "./MessagesList";
import { getMessagesFriendsPaginated } from "./actions";

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { friends, nextCursor } = await getMessagesFriendsPaginated();

  const { data: unreadRows } = await supabase
    .from("messages")
    .select("sender_id")
    .eq("receiver_id", user.id)
    .is("read_at", null);

  const unreadCounts: Record<string, number> = {};
  (unreadRows || []).forEach((m) => {
    unreadCounts[m.sender_id] = (unreadCounts[m.sender_id] || 0) + 1;
  });

  return (
    <main className={styles.wrapper}>
      <AppHeader />
      <h1 className={styles.heading}>Messages</h1>
      <MessagesList
        friends={friends}
        currentUserId={user.id}
        initialUnreadCounts={unreadCounts}
        initialCursor={nextCursor}
      />
    </main>
  );
}