
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { signout } from "@/app/auth/actions";
import { getMyBusinesses } from "@/app/business/actions";
import Link from "next/link";
import styles from "./page.module.css";
import AvatarUpload from "./AvatarUpload";
import UsernameEditor from "./UsernameEditor";
import CountryPicker from "./CountryPicker";
import DeleteAccountButton from "./DeleteAccountButton";
import NotificationToggle from "./NotificationToggle";
import FounderBadge from "@/components/FounderBadge";
import { ensureFoundingNumber } from "@/lib/founding/ensureFoundingNumber";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  ensureFoundingNumber(supabase, user.id).catch(() => {});

  const [{ data: profile }, myBusinesses] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, avatar_url, username, country, founding_number")
      .eq("id", user.id)
      .single(),

    getMyBusinesses(),
  ]);

  const name = profile?.full_name || "Unnamed";

  return (
    <main className={styles.wrapper}>
      <AvatarUpload
        userId={user.id}
        name={name}
        initialAvatarUrl={profile?.avatar_url || null}
      />

      <div className={styles.name}>
        {name}
        <FounderBadge number={profile?.founding_number} />
      </div>

      <div className={styles.email}>{user.email}</div>

      <UsernameEditor initialUsername={profile?.username || null} />
      <CountryPicker initialCountry={profile?.country || null} />

      {/* Multiple business identities under this account */}
      <section className={styles.businessSection}>
        <div className={styles.businessSectionHeader}>
          <div>
            <h2 className={styles.businessSectionTitle}>
              My businesses
            </h2>
            <p className={styles.businessSectionSubtitle}>
              Manage your business identities on Kinnect.
            </p>
          </div>

          <Link
            href="/business/new"
            className={styles.addBusinessButton}
          >
            + Add
          </Link>
        </div>

        {myBusinesses.length > 0 ? (
          <div className={styles.businessList}>
            {myBusinesses.map((business) => (
              <Link
                key={business.id}
                href={`/business/${business.id}`}
                className={styles.businessCard}
              >
                <div
                  className={styles.businessCardVisual}
                  style={{
                    background: business.cover_color || "#FF6F59",
                  }}
                >
                  {business.logo_url ? (
                    <img
                      src={business.logo_url}
                      alt=""
                      className={styles.businessCardLogo}
                    />
                  ) : (
                    <span>
                      {business.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                <div className={styles.businessCardInfo}>
                  <div className={styles.businessCardName}>
                    {business.name}
                    {business.verified && (
                      <span className={styles.businessVerified}>
                        ✓
                      </span>
                    )}
                  </div>

                  <div className={styles.businessCardMeta}>
                    {[business.category, business.location]
                      .filter(Boolean)
                      .join(" · ") || "Business profile"}
                  </div>
                </div>

                <span className={styles.businessCardArrow}>›</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className={styles.noBusinesses}>
            <p>You haven&apos;t created a business profile yet.</p>
            <Link href="/business/new">
              Create your first business
            </Link>
          </div>
        )}
      </section>

      <div className={styles.menu}>
        <NotificationToggle />

        <Link href="/business" className={styles.menuItem}>
          Discover businesses
        </Link>

        <Link href="/settings/media" className={styles.menuItem}>
          Media &amp; Storage
        </Link>

        <Link href="/marketplace" className={styles.menuItem}>
          Marketplace
        </Link>

        <Link href="/terms" className={styles.menuItem}>
          Terms of Service
        </Link>

        <Link href="/privacy" className={styles.menuItem}>
          Privacy Policy
        </Link>

        <form action={signout}>
          <button
            className={`${styles.menuItem} ${styles.signOutBtn}`}
            type="submit"
          >
            Sign out
          </button>
        </form>

        <div className={styles.dangerZone}>
          <DeleteAccountButton />
        </div>
      </div>
    </main>
  );
}
