import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCommunityTasks } from "../../actions";
import styles from "./page.module.css";
import TaskBoard from "./TaskBoard";
import { ArrowLeft } from "lucide-react";
import BackButton from "@/components/BackButton";

export default async function TasksPage({
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

  const tasks = await getCommunityTasks(id);

  return (
    <main className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <BackButton href={`/communities/${id}`} />
          <div className={styles.name}>{community?.name} · Tasks</div>
        </div>
        <Link href={`/communities/${id}/tasks/new`} className={styles.createBtn}>
          + Task
        </Link>
      </div>

      <TaskBoard
        communityId={id}
        currentUserId={user.id}
        currentUserName={user.user_metadata?.full_name || "You"}
        initialTasks={tasks as any}
      />
    </main>
  );
}