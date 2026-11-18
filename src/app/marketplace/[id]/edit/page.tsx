
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { getListing, getMyBusinesses } from "../../actions";
import EditListingForm from "./EditListingForm";
import styles from "./page.module.css";

export default async function EditListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const listing = await getListing(id);

  if (!listing || listing.seller_id !== user.id) {
    notFound();
  }

  const businesses = await getMyBusinesses();

  return (
    <main className={styles.wrapper}>
      <Link href={`/marketplace/${id}`} className={styles.backLink}>
        ← Back to listing
      </Link>

      <PageHeader title="Edit listing" />

      <p className={styles.subtitle}>
        Update your listing details, photos and business placement.
      </p>

      {query.error && (
        <div className={styles.error} role="alert">
          {query.error}
        </div>
      )}

      <EditListingForm
        listing={{
          id: listing.id,
          title: listing.title,
          description: listing.description,
          price: listing.price,
          currency: listing.currency,
          category: listing.category,
          location: listing.location,
          business_id: listing.business_id,
          image_urls: listing.image_urls,
        }}
        businesses={businesses}
      />
    </main>
  );
}
