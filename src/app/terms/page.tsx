import BackButton from "@/components/BackButton";
import styles from "./page.module.css";

export default function TermsPage() {
  return (
    <main className={styles.wrapper}>
      <BackButton href="/profile" />
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, marginTop: 12 }}>
        Terms of Service
      </h1>
      <p className={styles.updated}>Last updated: August 2026</p>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>1. Using Kinnect</div>
        <p className={styles.body}>
          Kinnect is a social platform for connecting with friends, joining communities,
          tracking personal goals, and buying or selling items locally through the
          Marketplace. You must be at least 13 years old to use Kinnect. You're
          responsible for keeping your account credentials secure and for anything
          that happens under your account.
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>2. Your Content</div>
        <p className={styles.body}>
          You own what you post — messages, photos, videos, community posts, and
          Marketplace listings. By posting, you give Kinnect permission to store and
          display that content to the people you've shared it with (friends, community
          members, or the public for Marketplace listings and business profiles).
          You're responsible for making sure you have the right to share anything you post.
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>3. Marketplace</div>
        <p className={styles.body}>
          Kinnect provides a space to list items for sale and connect with buyers
          through messaging. All payment, delivery, and the actual exchange of goods
          happens directly between buyer and seller, outside of Kinnect. Kinnect does
          not process payments, guarantee transactions, or mediate disputes between
          buyers and sellers. Use good judgment and meet in safe, public places.
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>4. Business Profiles & Promotions</div>
        <p className={styles.body}>
          Business accounts may create public profiles and list a catalog of items.
          Promoted content is labeled &quot;Sponsored&quot; and is never presented as
          organic content. Businesses are responsible for the accuracy of what they post.
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>5. Prohibited Conduct</div>
        <p className={styles.body}>
          You agree not to use Kinnect to harass others, post illegal or fraudulent
          content, impersonate someone else, spam, or attempt to circumvent the app's
          safety features (blocking, reporting, rate limits). Violations may result in
          content removal or account suspension.
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>6. Account Termination</div>
        <p className={styles.body}>
          You can delete your account at any time from your Profile. Deleting your
          account permanently removes your data, including messages, posts, and
          listings, and cannot be undone. Kinnect may also suspend or remove accounts
          that violate these terms.
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>7. No Warranty</div>
        <p className={styles.body}>
          Kinnect is provided &quot;as is.&quot; We work to keep it reliable and safe,
          but we don&apos;t guarantee uninterrupted access or that the service will be
          error-free.
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>8. Changes</div>
        <p className={styles.body}>
          We may update these terms as Kinnect grows. Continued use of the app after
          changes means you accept the updated terms.
        </p>
      </div>
    </main>
  );
}