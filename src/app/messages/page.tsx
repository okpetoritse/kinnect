import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import styles from "./page.module.css";
import MessagesList from "./MessagesList";

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: friendRows } = await supabase
    .from("friend_requests")
    .select(
      "sender_id, receiver_id, sender:profiles!friend_requests_sender_id_fkey(id, full_name, username, avatar_url), receiver:profiles!friend_requests_receiver_id_fkey(id, full_name, username, avatar_url)"
    )
    .eq("status", "accepted")
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

  const friendMap = new Map<string, any>();
  (friendRows || []).forEach((row) => {
    const isSender = row.sender_id === user.id;
    const friend = isSender ? row.receiver : row.sender;
    if (friend && !friendMap.has((friend as any).id)) {
      friendMap.set((friend as any).id, friend);
    }
  });
  const friends = Array.from(friendMap.values());

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
      />
    </main>
  );
}