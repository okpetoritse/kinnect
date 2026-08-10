import PageHeader from "@/components/PageHeader";
import styles from "./page.module.css";
import NewCommunityForm from "./NewCommunityForm";

export default function NewCommunityPage() {
  return (
    <main className={styles.wrapper}>
      <PageHeader title="Create a community" />
      <NewCommunityForm />
    </main>
  );
}