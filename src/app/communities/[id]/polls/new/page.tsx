import { createPoll } from "../../../actions";
import PageHeader from "@/components/PageHeader";
import styles from "./page.module.css";

export default async function NewPollPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className={styles.wrapper}>
      <PageHeader title="Create a poll" />

      <form action={createPoll}>
        <input type="hidden" name="communityId" value={id} />

        <div className={styles.field}>
          <label className={styles.label} htmlFor="question">
            Question
          </label>
          <input
            className={styles.input}
            id="question"
            name="question"
            type="text"
            placeholder="Where should we host the next meetup?"
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Options</label>
          <input className={styles.input} name="options" placeholder="Option 1" required />
          <input className={styles.input} name="options" placeholder="Option 2" required />
          <input className={styles.input} name="options" placeholder="Option 3 (optional)" />
          <input className={styles.input} name="options" placeholder="Option 4 (optional)" />
        </div>

        <label className={styles.checkboxRow}>
          <input type="checkbox" name="allowMultiple" />
          Allow selecting multiple options
        </label>

        <button className={styles.submit} type="submit">
          Create poll
        </button>
      </form>
    </main>
  );
}