"use client";

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";
import styles from "./AppChrome.module.css";
import InstallPrompt from "./InstallPrompt";
import NotificationPrompt from "./NotificationPrompt";


const HIDE_NAV_ON = ["/login", "/signup", "/"];

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showNav = !HIDE_NAV_ON.includes(pathname);

  return (
    <>
      <div className={showNav ? styles.contentWithNav : ""}>{children}</div>
      {showNav && <BottomNav />}
      {showNav && <InstallPrompt />}
      {showNav && <InstallPrompt />}
      {showNav && <NotificationPrompt />}
    </>
  );
}