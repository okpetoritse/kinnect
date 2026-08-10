import { updatePassword } from "@/app/auth/actions";
import styles from "@/app/auth/auth.module.css";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.mark}>🔑</div>
        <h1 className={styles.title}>Set a new password</h1>
        <p className={styles.subtitle}>Choose something you&apos;ll remember</p>

        {params.error && <div className={styles.error}>{params.error}</div>}

        <form action={updatePassword}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              New password
            </label>
            <input
              className={styles.input}
              id="password"
              name="password"
              type="password"
              minLength={6}
              required
            />
          </div>

          <button className={styles.submit} type="submit">
            Update password
          </button>
        </form>
      </div>
    </main>
  );
}