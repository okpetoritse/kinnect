import { requestPasswordReset } from "@/app/auth/actions";
import styles from "@/app/auth/auth.module.css";
import Link from "next/link";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.mark}>🔑</div>
        <h1 className={styles.title}>Reset your password</h1>
        <p className={styles.subtitle}>
          We&apos;ll email you a link to reset it
        </p>

        {params.error && <div className={styles.error}>{params.error}</div>}
        {params.sent && (
          <div className={styles.success}>
            Check your email for a reset link.
          </div>
        )}

        <form action={requestPasswordReset}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <input
              className={styles.input}
              id="email"
              name="email"
              type="email"
              required
            />
          </div>

          <button className={styles.submit} type="submit">
            Send reset link
          </button>
        </form>

        <p className={styles.switchText}>
          Remembered it?{" "}
          <Link className={styles.switchLink} href="/login">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}