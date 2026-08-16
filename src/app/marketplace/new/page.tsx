import { getMyBusinesses } from "../actions";
import PageHeader from "@/components/PageHeader";
import styles from "./page.module.css";
import NewListingForm from "./NewListingForm";

export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const businesses = await getMyBusinesses();

  return (
    <main className={styles.wrapper}>
      <PageHeader title="Post a listing" />
      {params.error && <div className={styles.error}>{params.error}</div>}
      <NewListingForm businesses={businesses} />
    </main>
  );
}