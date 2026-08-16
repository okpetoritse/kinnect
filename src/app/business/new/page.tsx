import { createBusinessProfile } from "../actions";
import PageHeader from "@/components/PageHeader";
import styles from "./page.module.css";

export default async function NewBusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className={styles.wrapper}>
      <PageHeader title="Create a business profile" />

      {params.error && <div className={styles.error}>{params.error}</div>}

      <form action={createBusinessProfile}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="name">
            Business name
          </label>
          <input className={styles.input} id="name" name="name" required />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="category">
            Category
          </label>
          <input
            className={styles.input}
            id="category"
            name="category"
            placeholder="e.g. Fashion, Food, Tech services"
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
            placeholder="What does this business do?"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="location">
            Location
          </label>
          <input className={styles.input} id="location" name="location" />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="phone">
            Phone (optional)
          </label>
          <input className={styles.input} id="phone" name="phone" />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="websiteUrl">
            Website (optional)
          </label>
          <input className={styles.input} id="websiteUrl" name="websiteUrl" type="url" />
        </div>

        <button className={styles.submit} type="submit">
          Create business profile
        </button>
      </form>
    </main>
  );
}