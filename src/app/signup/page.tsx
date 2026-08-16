import { signup } from "@/app/auth/actions";
import styles from "@/app/auth/auth.module.css";
import Link from "next/link";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; check_email?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.mark}>🤝</div>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.subtitle}>Join Kinnect</p>

        {params.error && <div className={styles.error}>{params.error}</div>}
        {params.check_email && (
          <div className={styles.success}>
            Check your email to confirm your account.
          </div>
        )}

        <form action={signup}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="fullName">
              Full name
            </label>
            <input
              className={styles.input}
              id="fullName"
              name="fullName"
              type="text"
              required
            />
          </div>

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
              minLength={6}
              required
            />
          </div>

          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
            <input type="checkbox" name="agreeTerms" required style={{ marginTop: 2 }} />
            <span>
              I agree to the{" "}
              <a href="/terms" target="_blank" style={{ color: "var(--coral)" }}>
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" target="_blank" style={{ color: "var(--coral)" }}>
                Privacy Policy
              </a>
            </span>
          </label>

          <button className={styles.submit} type="submit">
            Sign up
          </button><label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
            <input type="checkbox" name="agreeTerms" required style={{ marginTop: 2 }} />
            <span>
              I agree to the{" "}
              <a href="/terms" target="_blank" style={{ color: "var(--coral)" }}>
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" target="_blank" style={{ color: "var(--coral)" }}>
                Privacy Policy
              </a>
            </span>
          </label>

          
        </form>

        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          or
          <span className={styles.dividerLine} />
        </div>

        <GoogleSignInButton />

        <p className={styles.switchText}>
          Already have an account?{" "}
          <Link className={styles.switchLink} href="/login">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}