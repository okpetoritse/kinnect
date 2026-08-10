import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCommunityEvents, getEventRsvps } from "../../actions";
import styles from "./page.module.css";
import RsvpButtons from "./RsvpButtons";
import { ArrowLeft } from "lucide-react";
import BackButton from "@/components/BackButton";

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

      <div className={styles.list}>
        {events.length > 0 ? (
          events.map((event) => {
            const date = new Date(event.event_date);
            const eventRsvps = rsvps.filter((r) => r.event_id === event.id);
            const myRsvp = eventRsvps.find((r) => r.user_id === user.id);
            const goingCount = eventRsvps.filter(
              (r) => r.status === "going"
            ).length;

            return (
              <div key={event.id} className={styles.eventCard}>
                <div className={styles.dateBlock}>
                  <div className={styles.dateBadge}>
                    <div className={styles.dateMonth}>
                      {date.toLocaleDateString("en-US", { month: "short" })}
                    </div>
                    <div className={styles.dateDay}>{date.getDate()}</div>
                  </div>
                  <div>
                    <div className={styles.eventTitle}>{event.title}</div>
                    <div className={styles.eventMeta}>
                      {date.toLocaleString("en-US", {
                        weekday: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {event.location ? ` · ${event.location}` : ""}
                    </div>
                  </div>
                </div>

                {event.description && (
                  <div className={styles.eventDescription}>
                    {event.description}
                  </div>
                )}

                <RsvpButtons
                  eventId={event.id}
                  initialStatus={myRsvp?.status || null}
                  goingCount={goingCount}
                />
              </div>
            );
          })
        ) : (
          <p className={styles.empty}>
            No events yet — create the first one.
          </p>
        )}
      </div>
    </main>
  );
}