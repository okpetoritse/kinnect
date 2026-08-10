import { login } from "@/app/auth/actions";
import styles from "@/app/auth/auth.module.css";
import Link from "next/link";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.mark}>🤝</div>
        <h1 className={styles.title}>Welcome back</h1>
        <p className={styles.subtitle}>Log in to Kinnect</p>

        {params.error && <div className={styles.error}>{params.error}</div>}

        {params.reset === "success" && (
          <div className={styles.success}>
            Password updated — log in with your new password.
          </div>
        )}

        <form action={login}>
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

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              Password
            </label>
            <input
              className={styles.input}
              id="password"
              name="password"
              type="password"
              required
            />
          </div>

          <button className={styles.submit} type="submit">
            Log in
          </button>
        </form>

        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          or
          <span className={styles.dividerLine} />
        </div>

        <GoogleSignInButton />

        <p className={styles.switchText}>
          <Link className={styles.switchLink} href="/forgot-password">
            Forgot password?
          </Link>
        </p>

        <p className={styles.switchText}>
          Don&apos;t have an account?{" "}
          <Link className={styles.switchLink} href="/signup">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}