import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCommunityEvents, getEventRsvps } from "../../actions";
import styles from "./page.module.css";
import BackButton from "@/components/BackButton";
import EventsList from "./EventsList";

export default async function CalendarPage({
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

  const events = await getCommunityEvents(id);
  const rsvps = await getEventRsvps(events.map((e) => e.id));

  return (
    <main className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <BackButton href={`/communities/${id}`} />
          <div className={styles.name}>{community?.name} · Calendar</div>
        </div>
        <Link
          href={`/communities/${id}/calendar/new`}
          className={styles.createBtn}
        >
          + Event
        </Link>
      </div>

      <EventsList events={events as any} rsvps={rsvps as any} userId={user.id} />
    </main>
  );
}