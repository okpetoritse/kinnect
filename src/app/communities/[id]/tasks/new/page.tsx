import { createTask } from "../../../actions";
import PageHeader from "@/components/PageHeader";
import styles from "./page.module.css";

export default async function NewTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className={styles.wrapper}>
      <PageHeader title="Create a task" />

      <form action={createTask}>
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
            placeholder="Write the onboarding guide"
            required
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
            placeholder="What needs to happen here?"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="priority">
            Priority
          </label>
          <select className={styles.select} id="priority" name="priority" defaultValue="medium">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="dueDate">
            Due date (optional)
          </label>
          <input
            className={styles.input}
            id="dueDate"
            name="dueDate"
            type="datetime-local"
          />
        </div>

        <button className={styles.submit} type="submit">
          Create task
        </button>
      </form>
    </main>
  );
}