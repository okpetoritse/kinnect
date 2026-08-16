import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getOrCreateMoment, getMomentItems } from "../../moment-actions";
import BackButton from "@/components/BackButton";
import styles from "./page.module.css";
import MomentBoard from "./MomentBoard";

export default async function MomentPage({
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

  const moment = await getOrCreateMoment(friendId);
  if (!moment) redirect(`/messages/${friendId}`);

  const items = await getMomentItems(moment.id);

  return (
    <main className={styles.wrapper}>
      <div className={styles.header}>
        <BackButton href={`/messages/${friendId}`} />
        <div className={styles.title}>{moment.title} ❤️</div>
      </div>

      <MomentBoard momentId={moment.id} currentUserId={user.id} initialItems={items as any} />
    </main>
  );
}