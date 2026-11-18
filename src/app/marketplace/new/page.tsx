import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getMyBusinesses } from "../actions";
import PageHeader from "@/components/PageHeader";
import styles from "./page.module.css";
import NewListingForm from "./NewListingForm";

export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    businessId?: string;
  }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const params = await searchParams;
  const businesses = await getMyBusinesses();

  const initialBusinessId =
    businesses.some((business) => business.id === params.businessId)
      ? params.businessId!
      : "";

  return (
    <main className={styles.wrapper}>
      <PageHeader title="Post a listing" />

      {params.error && (
        <div className={styles.error} role="alert">
          {params.error}
        </div>
      )}

      <NewListingForm
        businesses={businesses}
        initialBusinessId={initialBusinessId}
      />
    </main>
  );
}