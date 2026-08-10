"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Home, Heart, MessageCircle, Users, Smile } from "lucide-react";
import styles from "./BottomNav.module.css";

const TABS = [
  { href: "/home", label: "Home", Icon: Home },
  { href: "/friends", label: "Friends", Icon: Heart },
  { href: "/messages", label: "Messages", Icon: MessageCircle },
  { href: "/communities", label: "Communities", Icon: Users },
  { href: "/profile", label: "Profile", Icon: Smile },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkUnread() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("receiver_id", user.id)
        .is("read_at", null);

      if (mounted) setHasUnread((count || 0) > 0);
    }

    checkUnread();
    const interval = setInterval(checkUnread, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [pathname]);

  return (
    <nav className={styles.nav}>
      {TABS.map(({ href, label, Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`${styles.tab} ${isActive ? styles.tabActive : ""}`}
          >
            <span className={styles.iconWrapper}>
              <Icon size={22} strokeWidth={isActive ? 2.4 : 2} />
              {href === "/messages" && hasUnread && (
                <span className={styles.dot} />
              )}
            </span>
            <span className={styles.label}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}