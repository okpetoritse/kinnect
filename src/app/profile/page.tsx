import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { signout } from "@/app/auth/actions";
import styles from "./page.module.css";
import AvatarUpload from "./AvatarUpload";
import UsernameEditor from "./UsernameEditor";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url, username")
    .eq("id", user.id)
    .single();

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

      <div className={styles.menu}>
        <form action={signout}>
          <button className={`${styles.menuItem} ${styles.signOutBtn}`} type="submit">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}