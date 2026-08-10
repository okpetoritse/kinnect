import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCommunityMembersWithFriendStatus } from "../../actions";
import styles from "./page.module.css";
import MembersList from "./MembersList";
import { ArrowLeft } from "lucide-react";
import BackButton from "@/components/BackButton";


export default async function MembersPage({
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

  const members = await getCommunityMembersWithFriendStatus(id);

  return (
    <main className={styles.wrapper}>
      <div className={styles.header}>
        <BackButton href={`/communities/${id}`} />
        <div className={styles.name}>{community?.name} · Members</div>
      </div>

      <MembersList members={members} />
    </main>
  );
}