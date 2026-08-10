import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import styles from "./BackButton.module.css";

export default function BackButton({ href }: { href: string }) {
  return (
    <Link href={href} className={styles.btn}>
      <ArrowLeft size={19} />
    </Link>
  );
}