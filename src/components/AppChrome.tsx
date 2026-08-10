"use client";

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";
import styles from "./AppChrome.module.css";

const HIDE_NAV_ON = ["/login", "/signup", "/"];

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNav = !HIDE_NAV_ON.includes(pathname);

  return (
    <>
      <div className={showNav ? styles.contentWithNav : ""}>{children}</div>
      {showNav && <BottomNav />}
    </>
  );
}