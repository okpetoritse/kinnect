import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import styles from "./page.module.css";
import SearchBar from "./SearchBar";
import RequestActions from "./RequestActions";
import Avatar from "@/components/Avatar";
import AppHeader from "@/components/AppHeader";
import FriendsList from "./FriendsList";

export default async function FriendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: incoming } = await supabase
    .from("friend_requests")
    .select(
      "id, sender:profiles!friend_requests_sender_id_fkey(id, full_name, username, avatar_url)"
    )
    .eq("receiver_id", user.id)
    .eq("status", "pending");

  const { data: friendRows } = await supabase
    .from("friend_requests")
    .select(
      "id, sender_id, receiver_id, sender:profiles!friend_requests_sender_id_fkey(id, full_name, username, avatar_url), receiver:profiles!friend_requests_receiver_id_fkey(id, full_name, username, avatar_url)"
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

  return (
    <main className={styles.wrapper}>
      <AppHeader />
      <h1 className={styles.heading}>Friends</h1>

      <SearchBar />

      <div className={styles.sectionTitle}>Friend requests</div>
      {incoming && incoming.length > 0 ? (
        incoming.map((req) => (
          <div key={req.id} className={styles.row}>
            <div className={styles.rowLeft}>
              <Avatar
                name={(req.sender as any)?.full_name || "?"}
                avatarUrl={(req.sender as any)?.avatar_url}
                size={40}
              />
              <div>
                <div className={styles.name}>
                  {(req.sender as any)?.full_name || "Unnamed"}
                </div>
                <div className={styles.email}>
                  {(req.sender as any)?.username
                    ? `@${(req.sender as any).username}`
                    : "No username set"}
                </div>
              </div>
            </div>
            <RequestActions requestId={req.id} />
          </div>
        ))
      ) : (
        <p className={styles.empty}>No pending requests</p>
      )}

      <div className={styles.sectionTitle}>Your friends</div>
      <FriendsList friends={friends} currentUserId={user.id} />
    </main>
  );
}