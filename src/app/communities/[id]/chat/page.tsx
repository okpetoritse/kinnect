import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCommunityMessages } from "../../actions";
import styles from "./page.module.css";
import GroupChat from "./GroupChat";
import { ArrowLeft } from "lucide-react";
import BackButton from "@/components/BackButton";

export default async function CommunityChatPage({
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
    .select("id, name, cover_color")
    .eq("id", id)
    .single();

  const messages = await getCommunityMessages(id);

  return (
    <main className={styles.wrapper}>
      <div className={styles.header}>
        <BackButton href={`/communities/${id}`} />
        <div
          className={styles.cover}
          style={{ background: community?.cover_color || "#FF6F59" }}
        />
        <div className={styles.name}>{community?.name}</div>
      </div>

      <GroupChat
        communityId={id}
        currentUserId={user.id}
        currentUserName={user.user_metadata?.full_name || "You"}
        initialMessages={messages}
      />
    </main>
  );
}