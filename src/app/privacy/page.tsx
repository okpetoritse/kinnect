import BackButton from "@/components/BackButton";
import styles from "../terms/page.module.css";

export default function PrivacyPage() {
  return (
    <main className={styles.wrapper}>
      <BackButton href="/profile" />
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, marginTop: 12 }}>
        Privacy Policy
      </h1>
      <p className={styles.updated}>Last updated: August 2026</p>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>What we collect</div>
        <p className={styles.body}>
          Your name, email, username, and profile photo. Messages, posts, and media you
          share. Progress you log toward goals. Marketplace listings and business
          profile details you create. Basic usage data needed to run features like
          presence (&quot;Active now&quot;) and unread indicators.
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>What we don&apos;t collect</div>
        <p className={styles.body}>
          Kinnect does not process payments and never sees your card, bank, or
          transaction details — Marketplace transactions happen entirely outside the app.
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Who can see your information</div>
        <p className={styles.body}>
          Your email is private and never shown to other users — your username is what
          people use to find and add you instead. Messages are visible only to you and
          the recipient. Community posts are visible to that community&apos;s members.
          Progress Reels are visible to your friends and the relevant community.
          Marketplace listings and business profiles are public by design, since
          they&apos;re meant to be discovered.
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>How we protect it</div>
        <p className={styles.body}>
          Data is stored with Supabase, using row-level security so the database
          itself enforces who can access what — not just the app&apos;s interface.
          We do not sell your personal data to third parties.
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Your controls</div>
        <p className={styles.body}>
          You can block or report any user, control who you&apos;re friends with, and
          delete your account entirely at any time from Profile — this permanently
          removes your data and cannot be undone.
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Third-party services</div>
        <p className={styles.body}>
          We use Supabase for authentication, database, and file storage, and Google
          for optional sign-in. GIF search, if enabled, uses Giphy. These providers
          only receive the minimum data needed to power the relevant feature.
        </p>
      </div>
    </main>
  );
}