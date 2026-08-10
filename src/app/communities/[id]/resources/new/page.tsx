import PageHeader from "@/components/PageHeader";
import styles from "./page.module.css";
import NewResourceForm from "./NewResourceForm";

export default async function NewResourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className={styles.wrapper}>
      <PageHeader title="Add a link" />
      <NewResourceForm communityId={id} />
    </main>
  );
}