import { createEvent } from "../../../actions";
import styles from "./page.module.css";
import PageHeader from "@/components/PageHeader";

export default async function NewEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className={styles.wrapper}>
      <PageHeader title="Create an event" />

      <form action={createEvent}>
        <input type="hidden" name="communityId" value={id} />

        <div className={styles.field}>
          <label className={styles.label} htmlFor="title">
            Title
          </label>
          <input
            className={styles.input}
            id="title"
            name="title"
            type="text"
            placeholder="Weekly coding meetup"
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="eventDate">
            Date & time
          </label>
          <input
            className={styles.input}
            id="eventDate"
            name="eventDate"
            type="datetime-local"
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="location">
            Location
          </label>
          <input
            className={styles.input}
            id="location"
            name="location"
            type="text"
            placeholder="Online or physical address"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="description">
            Description
          </label>
          <textarea
            className={styles.textarea}
            id="description"
            name="description"
            placeholder="What's this event about?"
          />
        </div>

        <button className={styles.submit} type="submit">
          Create event
        </button>
      </form>
    </main>
  );
}