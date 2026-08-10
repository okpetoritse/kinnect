import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getMessages } from "../actions";
import styles from "./page.module.css";
import ChatThread from "./ChatThread";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ friendId: string }>;
}) {
  const { friendId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: friend } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("id", friendId)
    .single();

  const messages = await getMessages(friendId);

  return (
    <main className={styles.wrapper}>
      <ChatThread
        friendId={friendId}
        friendName={friend?.full_name || "Unknown"}
        friendAvatarUrl={friend?.avatar_url || null}
        currentUserId={user.id}
        initialMessages={messages}
      />
    </main>
  );
}