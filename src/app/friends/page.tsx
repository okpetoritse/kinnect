import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import styles from "./page.module.css";
import SearchBar from "./SearchBar";
import RequestActions from "./RequestActions";
import Avatar from "@/components/Avatar";
import AppHeader from "@/components/AppHeader";
import FriendsList from "./FriendsList";
import { getFriendsPaginated } from "./actions";

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

  const { friends, nextCursor } = await getFriendsPaginated();

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
      <FriendsList friends={friends} currentUserId={user.id} initialCursor={nextCursor} />
    </main>
  );
}