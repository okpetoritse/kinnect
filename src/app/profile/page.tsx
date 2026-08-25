import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { signout } from "@/app/auth/actions";
import { getMyBusinessProfile } from "@/app/business/actions";
import Link from "next/link";
import styles from "./page.module.css";
import AvatarUpload from "./AvatarUpload";
import UsernameEditor from "./UsernameEditor";
import CountryPicker from "./CountryPicker";
import DeleteAccountButton from "./DeleteAccountButton";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, username, country")
    .eq("id", user.id)
    .single();

  const myBusiness = await getMyBusinessProfile();
  const name = profile?.full_name || "Unnamed";

  return (
    <main className={styles.wrapper}>
      <AvatarUpload
        userId={user.id}
        name={name}
        initialAvatarUrl={profile?.avatar_url || null}
      />
      <div className={styles.name}>{name}</div>
      <div className={styles.email}>{user.email}</div>

      <UsernameEditor initialUsername={profile?.username || null} />
      <CountryPicker initialCountry={profile?.country || null} />

      <div className={styles.menu}>
        <Link
          href={myBusiness ? `/business/${myBusiness.id}` : "/business/new"}
          className={styles.menuItem}
        >
          {myBusiness ? "View your business profile" : "Create a business profile"}
        </Link>
        <Link href="/business" className={styles.menuItem}>
          Discover businesses
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
          <button className={`${styles.menuItem} ${styles.signOutBtn}`} type="submit">
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