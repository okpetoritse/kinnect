import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getListing } from "../actions";
import BackButton from "@/components/BackButton";
import Avatar from "@/components/Avatar";
import Link from "next/link";
import styles from "./page.module.css";
import OwnerActions from "./OwnerActions";
import { startListingConversation } from "../actions";
import ListingGallery from "./ListingGallery";

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const listing = await getListing(id);
  if (!listing) {
    return (
      <main className={styles.wrapper}>
        <BackButton href="/marketplace" />
        <p>Listing not found.</p>
      </main>
    );
  }

  const isOwner = listing.seller_id === user.id;

  return (
    <main className={styles.wrapper}>
      <BackButton href="/marketplace" />

      <ListingGallery images={listing.image_urls || []} />

      {listing.status === "sold" && (
        <div className={styles.soldBanner}>This item has been sold</div>
      )}

      <div className={styles.title}>{listing.title}</div>
      {listing.price != null && (
        <div className={styles.price}>
          {listing.currency || "₦"}
          {listing.price.toLocaleString()}
        </div>
      )}
      <div className={styles.meta}>
        {[listing.category, listing.location].filter(Boolean).join(" · ")}
      </div>

      {listing.description && (
        <div className={styles.description}>{listing.description}</div>
      )}

      {listing.business ? (
        <Link href={`/business/${listing.business.id}`} className={styles.sellerCard}>
          <Avatar name={listing.business.name} size={40} />
          <div>
            <div className={styles.sellerName}>
              {listing.business.name} {listing.business.verified && "✅"}
            </div>
            <div className={styles.sellerLabel}>Business listing</div>
          </div>
        </Link>
      ) : (
        <div className={styles.sellerCard}>
          <Avatar
            name={listing.seller?.full_name || "?"}
            avatarUrl={listing.seller?.avatar_url}
            size={40}
          />
          <div>
            <div className={styles.sellerName}>{listing.seller?.full_name}</div>
            <div className={styles.sellerLabel}>Seller</div>
          </div>
        </div>
      )}

      {isOwner ? (
        <OwnerActions listingId={listing.id} />
      ) : (
        <form action={startListingConversation.bind(null, listing.id)}>
          <button className={styles.messageBtn} type="submit">
            Message seller
          </button>
        </form>
      )}
    </main>
  );
}