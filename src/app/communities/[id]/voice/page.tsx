import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import styles from "./page.module.css";
import VoiceRoom from "./VoiceRoom";

export default async function VoicePage({
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

  return (
    <main className={styles.wrapper}>
      <div className={styles.header}>
        <Link href={`/communities/${id}`}>←</Link>
        <div className={styles.name}>{community?.name} · Voice room</div>
      </div>

      <VoiceRoom
        communityId={id}
        currentUserId={user.id}
        currentUserName={user.user_metadata?.full_name || "You"}
      />
    </main>
  );
}