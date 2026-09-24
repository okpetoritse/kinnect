import styles from "@/app/auth/auth.module.css";
import Link from "next/link";
import GoogleSignInButton from "@/components/GoogleSignInButton";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.mark}>🤝</div>
        <h1 className={styles.title}>Create your account</h1>
        <p className={styles.subtitle}>Join Kinnect</p>

        {params.error && <div className={styles.error}>{params.error}</div>}

        <p style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", margin: "16px 0" }}>
          Sign up takes one tap — Kinnect uses Google to keep your account secure.
        </p>

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