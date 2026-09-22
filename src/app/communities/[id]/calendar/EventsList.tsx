"use client";

import { useState } from "react";
import styles from "./page.module.css";
import RsvpButtons from "./RsvpButtons";

type EventItem = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
};

type RsvpItem = {
  id: string;
  event_id: string;
  user_id: string;
  status: string;
};

export default function EventsList({
  events,
  rsvps,
  userId,
}: {
  events: EventItem[];
  rsvps: RsvpItem[];
  userId: string;
}) {
  const [showPast, setShowPast] = useState(false);

  if (events.length === 0) {
    return <p className={styles.empty}>No events yet — create the first one.</p>;
  }

  const now = new Date();
  const upcoming = events
    .filter((e) => new Date(e.event_date) >= now)
    .sort(
      (a, b) =>
        new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
    );

  const past = events
    .filter((e) => new Date(e.event_date) < now)
    .sort(
      (a, b) =>
        new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
    );

  const renderEventCard = (event: EventItem) => {
    const date = new Date(event.event_date);
    const eventRsvps = rsvps.filter((r) => r.event_id === event.id);
    const myRsvp = eventRsvps.find((r) => r.user_id === userId);
    const goingCount = eventRsvps.filter((r) => r.status === "going").length;

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
          <div className={styles.eventDescription}>{event.description}</div>
        )}

        <RsvpButtons
          eventId={event.id}
          initialStatus={myRsvp?.status || null}
          goingCount={goingCount}
        />
      </div>
    );
  };

  return (
    <div className={styles.list}>
      {upcoming.map(renderEventCard)}

      {past.length > 0 && (
        <>
          <button
            className={styles.pastToggle}
            onClick={() => setShowPast((p) => !p)}
          >
            {showPast ? "▲" : "▼"} Past events ({past.length})
          </button>
          {showPast && past.map(renderEventCard)}
        </>
      )}
    </div>
  );
}